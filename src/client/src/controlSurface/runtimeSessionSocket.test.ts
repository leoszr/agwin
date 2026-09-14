import { describe, expect, it } from "vitest";
import { CURRENT_PROTOCOL_VERSION, type EnvironmentDescriptor } from "../../../shared/protocol/contracts";
import type { Machine, SessionRef, SessionTranscriptSnapshot, SessionUiEvent } from "../api";
import type { SessionEventSocket } from "../controllers/sessionController";
import { RuntimeSessionSocket } from "./runtimeSessionSocket";
import { WebEnvironmentRuntime, type WebEnvironmentRuntimeApi } from "./webEnvironmentRuntime";

class FakeTransport implements SessionEventSocket {
  connectCount = 0;
  closeCount = 0;
  onEvent: ((event: SessionUiEvent) => void) | undefined;
  onReconnect: (() => void) | undefined;
  onInitialOpen: (() => void) | undefined;
  onDisconnect: ((reason: string) => void) | undefined;

  connect(
    session: SessionRef,
    onEvent: (event: SessionUiEvent) => void,
    onReconnect?: () => void,
    _machineId?: string,
    onInitialOpen?: () => void,
    onDisconnect?: (reason: string) => void,
  ): void {
    this.connectCount += 1;
    this.onEvent = onEvent;
    this.onReconnect = onReconnect;
    this.onInitialOpen = onInitialOpen;
    this.onDisconnect = onDisconnect;
    void session;
  }

  setHandler(): void {
    // The wrapper owns the handler swap; the transport never needs it here.
  }

  close(): void {
    this.closeCount += 1;
    this.onEvent = undefined;
  }

  emit(event: SessionUiEvent): void {
    this.onEvent?.(event);
  }

  drop(): void {
    this.onDisconnect?.("Session stream disconnected");
  }

  reopen(): void {
    this.onReconnect?.();
  }
}

function machine(id: string): Machine {
  return {
    id,
    name: id,
    kind: id === "local" ? "local" : "remote",
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  };
}

function descriptor(id: string, protocolVersion = CURRENT_PROTOCOL_VERSION): EnvironmentDescriptor {
  return {
    id,
    name: id,
    kind: "remote",
    protocolVersion,
    capabilities: { streaming: true, replayCursor: true, transcriptSnapshot: true },
    status: "connected",
  };
}

function fakeApi(overrides: Partial<WebEnvironmentRuntimeApi> = {}): WebEnvironmentRuntimeApi {
  return {
    machines: () => Promise.resolve([machine("local"), machine("remote-1")]),
    descriptor: (machineId) => Promise.resolve(descriptor(machineId)),
    messages: () => Promise.resolve({ messages: [{ role: "user", content: "hello" }], start: 0, total: 1 }),
    streamSnapshot: () => Promise.resolve({ seq: 1, partial: null }),
    transcriptSnapshot: () => Promise.resolve({ seq: 1, partial: null, messages: [{ role: "user", content: "hello" }], start: 0, total: 1 }),
    ...overrides,
  };
}

const session: SessionRef = { id: "sess-1", cwd: "/repo" };

describe("RuntimeSessionSocket", () => {
  it("delivers frames immediately for a subscription that never fetches a snapshot", async () => {
    const environment = new WebEnvironmentRuntime({ api: fakeApi() });
    await environment.refreshCatalog();
    const transport = new FakeTransport();
    const socket = new RuntimeSessionSocket(environment, transport);
    const delivered: SessionUiEvent[] = [];
    socket.connect(session, (event) => delivered.push(event), undefined, "remote-1");

    // Pending-start subscriptions have no join snapshot; holding their frames
    // on an interval that never closes would freeze the startup dialogs.
    transport.emit({ type: "assistant.delta", text: "startup", seq: 2 });

    expect(delivered).toHaveLength(1);
  });

  it("holds frames that race a snapshot fetch and releases them to the active handler", async () => {
    let resolveSnapshot: ((snapshot: SessionTranscriptSnapshot) => void) | undefined;
    const snapshotPromise = new Promise<SessionTranscriptSnapshot>((resolve) => { resolveSnapshot = resolve; });
    const environment = new WebEnvironmentRuntime({ api: fakeApi({ transcriptSnapshot: () => snapshotPromise }) });
    await environment.refreshCatalog();
    const transport = new FakeTransport();
    const socket = new RuntimeSessionSocket(environment, transport);
    const delivered: SessionUiEvent[] = [];
    socket.connect(session, (event) => delivered.push(event), undefined, "remote-1");

    const refresh = environment.fetchSessionTranscript("remote-1", session);
    transport.emit({ type: "assistant.delta", text: "racing", seq: 2 });
    expect(delivered).toHaveLength(0);

    resolveSnapshot?.({ seq: 1, partial: null, messages: [{ role: "user", content: "hello" }], start: 0, total: 1 });
    await refresh;

    expect(delivered).toEqual([{ type: "assistant.delta", text: "racing", seq: 2 }]);
  });

  it("swaps the handler without reconnecting the transport", async () => {
    const environment = new WebEnvironmentRuntime({ api: fakeApi() });
    await environment.refreshCatalog();
    const transport = new FakeTransport();
    const socket = new RuntimeSessionSocket(environment, transport);
    const first: SessionUiEvent[] = [];
    const second: SessionUiEvent[] = [];
    socket.connect(session, (event) => first.push(event), undefined, "remote-1");
    await environment.fetchSessionTranscript("remote-1", session);

    socket.setHandler((event) => second.push(event));
    transport.emit({ type: "assistant.delta", text: "after-swap", seq: 2 });

    expect(first).toEqual([]);
    expect(second).toEqual([{ type: "assistant.delta", text: "after-swap", seq: 2 }]);
    expect(transport.connectCount).toBe(1);
  });

  it("reports an unexpected drop to the runtime and re-probes when the transport reopens", async () => {
    let descriptorCalls = 0;
    const environment = new WebEnvironmentRuntime({
      api: fakeApi({
        descriptor: (machineId) => {
          descriptorCalls += 1;
          return Promise.resolve(descriptor(machineId));
        },
      }),
    });
    await environment.refreshCatalog();
    const transport = new FakeTransport();
    const socket = new RuntimeSessionSocket(environment, transport);
    socket.connect(session, () => undefined, undefined, "remote-1");
    const callsBeforeDrop = descriptorCalls;

    transport.drop();
    expect(environment.getStatus("remote-1").state).toBe("offline");
    expect(environment.getStatus("remote-1").error?.code).toBe("ENVIRONMENT_OFFLINE");

    transport.reopen();
    // The refresh that follows a reconnect must await the environment gate
    // instead of failing on the stale offline connection, and the probe that
    // recover() started is the same one the gate awaits.
    const transcript = await environment.fetchSessionTranscript("remote-1", session);
    if (transcript === "superseded") throw new Error("Expected transcript object");
    expect(transcript.page.total).toBe(1);
    expect(environment.getStatus("remote-1").state).toBe("connected");
    expect(descriptorCalls).toBe(callsBeforeDrop + 1);
  });

  it("does not subscribe a protocol-blocked environment and closes its subscription", async () => {
    const environment = new WebEnvironmentRuntime({
      api: fakeApi({ descriptor: (machineId) => Promise.resolve(descriptor(machineId, { major: 99, minor: 0 })) }),
    });
    await environment.refreshCatalog();
    const transport = new FakeTransport();
    const socket = new RuntimeSessionSocket(environment, transport);

    socket.connect(session, () => undefined, undefined, "remote-1");
    expect(transport.connectCount).toBe(0);

    // connect() already retires a previous subscription; the close that matters
    // here is the one the caller performs on the blocked session.
    transport.closeCount = 0;
    socket.close();
    expect(transport.closeCount).toBe(1);
  });

  it("stops delivering frames after close", async () => {
    const environment = new WebEnvironmentRuntime({ api: fakeApi() });
    await environment.refreshCatalog();
    const transport = new FakeTransport();
    const socket = new RuntimeSessionSocket(environment, transport);
    const delivered: SessionUiEvent[] = [];
    socket.connect(session, (event) => delivered.push(event), undefined, "remote-1");
    await environment.fetchSessionTranscript("remote-1", session);

    transport.closeCount = 0;
    socket.close();
    environment.ingestSessionEvent("remote-1", "sess-1", { type: "assistant.delta", text: "late", seq: 5 });

    expect(delivered).toEqual([]);
    expect(transport.closeCount).toBe(1);
  });
});
