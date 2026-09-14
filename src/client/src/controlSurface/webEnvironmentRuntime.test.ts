import { describe, expect, it } from "vitest";
import { CURRENT_PROTOCOL_VERSION, type EnvironmentDescriptor } from "../../../shared/protocol/contracts";
import type { Machine, SessionTranscriptSnapshot } from "../api";
import { WebEnvironmentRuntime, type WebEnvironmentRuntimeApi } from "./webEnvironmentRuntime";

function machine(id: string, kind: Machine["kind"] = id === "local" ? "local" : "remote"): Machine {
  return {
    id,
    name: id,
    kind,
    ...(kind === "remote" ? { baseUrl: `https://${id}.example.test` } : {}),
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  };
}

function descriptor(id: string, overrides: Partial<EnvironmentDescriptor> = {}): EnvironmentDescriptor {
  return {
    id,
    name: id,
    kind: id === "local" ? "local" : "remote",
    protocolVersion: CURRENT_PROTOCOL_VERSION,
    capabilities: { streaming: true, replayCursor: true, transcriptSnapshot: true },
    status: "connected",
    ...overrides,
  };
}

function fakeApi(overrides: Partial<WebEnvironmentRuntimeApi> = {}): WebEnvironmentRuntimeApi {
  return {
    machines: () => Promise.resolve([machine("local"), machine("remote-1")]),
    descriptor: (machineId) => Promise.resolve(descriptor(machineId, { id: "local", kind: "local" })),
    messages: () => Promise.resolve({ messages: [{ role: "user", content: "hello" }], start: 0, total: 1 }),
    streamSnapshot: () => Promise.resolve({ seq: 7, partial: null }),
    transcriptSnapshot: () => Promise.resolve({ seq: 7, partial: null, messages: [{ role: "user", content: "hello" }], start: 0, total: 1 }),
    ...overrides,
  };
}

describe("WebEnvironmentRuntime", () => {
  it("loads the gateway catalog through the runtime and connects environments independently", async () => {
    let resolveHanging!: (value: EnvironmentDescriptor) => void;
    const hanging = new Promise<EnvironmentDescriptor>((resolve) => { resolveHanging = resolve; });
    const runtime = new WebEnvironmentRuntime({
      api: fakeApi({
        machines: () => Promise.resolve([machine("local"), machine("remote-1"), machine("remote-hanging")]),
        descriptor: (machineId) => machineId === "remote-hanging"
          ? hanging
          : Promise.resolve(descriptor(machineId, { id: machineId, kind: machineId === "local" ? "local" : "remote" })),
      }),
    });

    try {
      const machines = await runtime.refreshCatalog();

      expect(machines.map((entry) => entry.id)).toEqual(["local", "remote-1", "remote-hanging"]);

      await runtime.connectEnvironment("local");
      await runtime.connectEnvironment("remote-1");

      expect(runtime.getStatus("local")).toMatchObject({ state: "connected", degraded: false });
      expect(runtime.getStatus("remote-1")).toMatchObject({ state: "connected", degraded: false });
      expect(runtime.getStatus("remote-hanging")).toMatchObject({ state: "connecting" });
    } finally {
      resolveHanging(descriptor("remote-hanging"));
      runtime.dispose();
    }
  });

  it("installs the atomic snapshot before releasing events that raced the fetch", async () => {
    let resolveSnapshot: ((snapshot: SessionTranscriptSnapshot) => void) | undefined;
    const snapshotPromise = new Promise<SessionTranscriptSnapshot>((resolve) => { resolveSnapshot = resolve; });
    const callOrder: string[] = [];
    const runtime = new WebEnvironmentRuntime({
      api: fakeApi({
        transcriptSnapshot: () => { callOrder.push("transcriptSnapshot"); return snapshotPromise; },
      }),
    });
    await runtime.refreshCatalog();

    const order: string[] = [];
    runtime.subscribeSessionEvents("local", "sess-1", (event) => order.push(`event:${JSON.stringify(event)}`));
    const fetchPromise = runtime.fetchSessionTranscript("local", { id: "sess-1", cwd: "/repo" }, (transcript) => {
      order.push(`install:${String(transcript.stream.seq)}`);
    });

    // A live event races the snapshot fetch and must wait behind its watermark.
    runtime.ingestSessionEvent("local", "sess-1", { type: "assistant.delta", text: "live" }, 8);
    expect(order).toEqual([]);

    resolveSnapshot?.({ seq: 7, partial: { role: "assistant" }, messages: [{ role: "user", content: "hello" }], start: 0, total: 1 });
    const transcript = await fetchPromise;
    if (transcript === "superseded") throw new Error("Expected transcript object");

    // One authoritative read: page, watermark, and partial come from the owner.
    expect(callOrder).toEqual(["transcriptSnapshot"]);
    expect(order).toEqual(["install:7", "event:" + JSON.stringify({ type: "assistant.delta", text: "live" })]);
    expect(transcript.page).toEqual({ messages: [{ role: "user", content: "hello" }], start: 0, total: 1 });
    expect(transcript.stream).toEqual({ seq: 7, partial: { role: "assistant" } });
  });

  it("keeps a failing environment isolated while the others stay connected", async () => {
    const runtime = new WebEnvironmentRuntime({
      api: fakeApi({
        descriptor: (machineId) => machineId === "remote-1"
          ? Promise.reject(new Error("Connection refused: host unreachable"))
          : Promise.resolve(descriptor(machineId, { id: "local", kind: "local" })),
      }),
    });

    await runtime.refreshCatalog();
    await runtime.connectEnvironment("local");
    await runtime.connectEnvironment("remote-1");

    expect(runtime.getStatus("local")).toMatchObject({ state: "connected" });
    expect(runtime.getStatus("remote-1")).toMatchObject({ state: "offline" });
    expect(runtime.getStatus("remote-1").error?.message).toContain("Connection refused");
  });

  it("blocks an incompatible environment and refuses to fetch its sessions", async () => {
    const runtime = new WebEnvironmentRuntime({
      api: fakeApi({
        descriptor: (machineId) => Promise.resolve(machineId === "remote-1"
          ? descriptor(machineId, { protocolVersion: { major: 99, minor: 0 } })
          : descriptor(machineId, { id: "local", kind: "local" })),
      }),
    });
    await runtime.refreshCatalog();
    await runtime.connectEnvironment("remote-1");

    const status = runtime.getStatus("remote-1");
    expect(status.state).toBe("blocked");
    expect(status.error?.code).toBe("INCOMPATIBLE_VERSION");

    await expect(runtime.fetchSessionTranscript("remote-1", { id: "sess-1", cwd: "/repo" })).rejects.toThrow("Major version mismatch");
    expect(runtime.getStatus("remote-1").state).toBe("blocked");
  });

  it("fails a join observably when the environment has no atomic snapshot contract", async () => {
    const runtime = new WebEnvironmentRuntime({
      api: fakeApi({ descriptor: (machineId) => Promise.resolve(descriptor(machineId, { id: "local", kind: "local", capabilities: { streaming: true } })) }),
    });
    await runtime.refreshCatalog();

    await expect(runtime.fetchSessionTranscript("local", { id: "sess-1", cwd: "/repo" })).rejects.toThrow("does not support a coherent transcript snapshot");
  });

  it("applies an atomic snapshot exactly once under continuous streaming", async () => {
    const committed = { role: "assistant", content: "committed while reading" };
    let resolveSnapshot: ((snapshot: SessionTranscriptSnapshot) => void) | undefined;
    const snapshotPromise = new Promise<SessionTranscriptSnapshot>((resolve) => { resolveSnapshot = resolve; });
    const runtime = new WebEnvironmentRuntime({
      api: fakeApi({ transcriptSnapshot: () => snapshotPromise }),
    });
    await runtime.refreshCatalog();

    const delivered: unknown[] = [];
    runtime.subscribeSessionEvents("local", "sess-1", (event) => delivered.push(event));
    const fetch = runtime.fetchSessionTranscript("local", { id: "sess-1", cwd: "/repo" });
    // The message commits while the snapshot read is in flight; the atomic
    // snapshot (seq 5) already contains it.
    runtime.ingestSessionEvent("local", "sess-1", { type: "message.append", message: committed }, 5);
    // The stream keeps producing past the watermark.
    runtime.ingestSessionEvent("local", "sess-1", { type: "assistant.delta", text: "streaming" }, 6);
    resolveSnapshot?.({ seq: 5, partial: null, messages: [{ role: "user", content: "before" }, committed], start: 0, total: 2 });
    const transcript = await fetch;
    if (transcript === "superseded") throw new Error("Expected transcript object");

    // The committed message is in the seed and its buffered event is dropped:
    // no duplicate. The event past the watermark is delivered: no loss.
    expect(transcript.page.messages).toEqual([{ role: "user", content: "before" }, committed]);
    expect(delivered).toEqual([{ type: "assistant.delta", text: "streaming" }]);

    // Later events keep flowing on top of the seed.
    runtime.ingestSessionEvent("local", "sess-1", { type: "assistant.delta", text: "more" }, 7);
    expect(delivered).toEqual([{ type: "assistant.delta", text: "streaming" }, { type: "assistant.delta", text: "more" }]);
  });

  it("owns environment lifetime: a removed machine leaves no connection behind", async () => {
    const runtime = new WebEnvironmentRuntime({ api: fakeApi() });
    await runtime.refreshCatalog();
    expect(runtime.statuses()["remote-1"]).toMatchObject({ state: "connected" });

    runtime.removeEnvironment("remote-1");

    expect(runtime.statuses()["remote-1"]).toBeUndefined();
    expect(runtime.getStatus("local")).toMatchObject({ state: "connected" });
  });
});
