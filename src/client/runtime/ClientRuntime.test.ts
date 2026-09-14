import { describe, expect, it, vi } from "vitest";
import { CURRENT_PROTOCOL_VERSION, parseEnvironmentDescriptor, type EnvironmentDescriptor } from "../../shared/protocol/contracts";
import { ClientRuntime } from "./ClientRuntime";
import type { SessionRef, SessionSnapshot } from "./types";

function descriptor(overrides: Partial<EnvironmentDescriptor> & { id: string }): EnvironmentDescriptor {
  return {
    name: overrides.id === "local" ? "Local Host" : "Remote",
    kind: overrides.id === "local" ? "local" : "remote",
    protocolVersion: CURRENT_PROTOCOL_VERSION,
    capabilities: { streaming: true, transcriptSnapshot: true },
    status: "connected",
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
describe("ClientRuntime & EnvironmentConnection", () => {
  it("obtains the catalog and connects to each environment independently", async () => {
    const descriptors: Record<string, EnvironmentDescriptor> = {
      local: descriptor({ id: "local", name: "Local Host", capabilities: { streaming: true, transcriptSnapshot: true, pty: true } }),
      "remote-1": descriptor({ id: "remote-1", name: "Remote VPS", capabilities: { streaming: true, transcriptSnapshot: true } }),
    };
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([
        { id: "local", name: "Local Host" },
        { id: "remote-1", name: "Remote VPS" },
      ]),
      descriptorFetcher: (id) => {
        const value = descriptors[id];
        if (value === undefined) throw new Error("Descriptor not found");
        return Promise.resolve(value);
      },
    });

    const loaded = await runtime.loadCatalog();

    expect(loaded.map((d) => d.id)).toEqual(["local", "remote-1"]);
    await runtime.ensureConnected("local");
    await runtime.ensureConnected("remote-1");
    expect(runtime.getStatus("local")).toMatchObject({ state: "connected", degraded: false });
    expect(runtime.getStatus("remote-1")).toMatchObject({ state: "connected", degraded: false });
  });

  it("keeps snapshot, events, and session identity consistent after reconnection", async () => {
    const session: SessionRef = { id: "sess-123", cwd: "/project", environmentId: "local" };
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve(descriptor({ id: "local" })),
      sessionSnapshotFetcher: (_env, ref) => Promise.resolve({
        sessionId: ref.id,
        environmentId: "local",
        messageCount: 1,
        messages: [{ role: "user", content: "hello" }],
        seq: 1,
      }),
    });

    await runtime.loadCatalog();
    const snapshot1 = await runtime.switchSession("local", session);
    expect(snapshot1?.sessionId).toBe("sess-123");
    expect(snapshot1?.seq).toBe(1);

    const delivered: unknown[] = [];
    runtime.subscribeSessionEvents("local", "sess-123", (event) => delivered.push(event));
    runtime.ingestSessionEvent("local", "sess-123", { role: "assistant", content: "world" }, 2);
    expect(delivered).toEqual([{ role: "assistant", content: "world" }]);

    // A duplicate transport sequence is never delivered twice.
    runtime.ingestSessionEvent("local", "sess-123", { role: "assistant", content: "dup" }, 2);
    expect(delivered).toHaveLength(1);

    const conn = runtime.getConnection("local");
    if (conn === undefined) throw new Error("Missing local connection");
    conn.markOffline();
    expect(runtime.getStatus("local").state).toBe("offline");

    await conn.connect();
    expect(runtime.getStatus("local").state).toBe("connected");
    expect(runtime.getProjection("local").activeSession?.id).toBe("sess-123");

    // The same environment resolves the same session identity after reconnect.
    const snapshot2 = await runtime.switchSession("local", session);
    expect(snapshot2?.sessionId).toBe("sess-123");
  });

  it("ignores a descriptor that resolves after the environment was removed", async () => {
    vi.useFakeTimers();
    try {
      let resolveDescriptor: ((value: EnvironmentDescriptor) => void) | undefined;
      const pending = new Promise<EnvironmentDescriptor>((resolve) => { resolveDescriptor = resolve; });
      let descriptorCalls = 0;
      const runtime = new ClientRuntime({
        catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
        descriptorFetcher: () => { descriptorCalls += 1; return pending; },
      });
      const connecting = runtime.ensureConnected("local");
      const removed = runtime.getConnection("local");
      runtime.removeEnvironment("local");
      resolveDescriptor?.(descriptor({ id: "local" }));

      await connecting;
      await vi.advanceTimersByTimeAsync(10_000);

      // A late answer must not resurrect the removed environment, flip the
      // disposed connection back to connected, nor schedule a retry for it.
      expect(descriptorCalls).toBe(1);
      expect(removed?.state).toBe("offline");
      expect(runtime.getConnection("local")).toBeUndefined();
      expect(runtime.getAllProjections()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a scheduled retry when an explicit probe starts", async () => {
    vi.useFakeTimers();
    try {
      let descriptorCalls = 0;
      let failNext = true;
      const runtime = new ClientRuntime({
        catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
        descriptorFetcher: () => {
          descriptorCalls += 1;
          if (failNext) { failNext = false; return Promise.reject(new Error("offline")); }
          return Promise.resolve(descriptor({ id: "local" }));
        },
      });
      await runtime.loadCatalog();
      await runtime.getConnection("local")?.connect();
      expect(runtime.getStatus("local").state).toBe("offline");

      await runtime.ensureConnected("local");
      expect(runtime.getStatus("local").state).toBe("connected");
      await vi.advanceTimersByTimeAsync(10_000);
      // The scheduled retry was superseded by the successful probe.
      expect(descriptorCalls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("serializes concurrent reconciliations of one session", async () => {
    const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
      let resolve: ((value: T) => void) | undefined;
      const promise = new Promise<T>((settle) => { resolve = settle; });
      return { promise, resolve: (value) => { resolve?.(value); } };
    };
    const first = deferred<SessionSnapshot>();
    const second = deferred<SessionSnapshot>();
    const snapshots = [first.promise, second.promise];
    let fetchCalls = 0;
    const installs: number[] = [];
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve(descriptor({ id: "local" })),
      sessionSnapshotFetcher: () => {
        const snapshot = snapshots[fetchCalls] ?? Promise.resolve({ sessionId: "sess-1", environmentId: "local", messageCount: 0, messages: [], seq: 0 });
        fetchCalls += 1;
        return snapshot;
      },
    });
    await runtime.loadCatalog();
    const session: SessionRef = { id: "sess-1", cwd: "/repo" };
    const firstFetch = runtime.switchSession("local", session, (snapshot) => { installs.push(snapshot.seq); });
    const secondFetch = runtime.switchSession("local", session, (snapshot) => { installs.push(snapshot.seq); });

    // Only one reconciliation is in flight; the second waits its turn.
    await vi.waitFor(() => { expect(fetchCalls).toBe(1); });
    first.resolve({ sessionId: "sess-1", environmentId: "local", messageCount: 1, messages: [], seq: 1 });
    await firstFetch;
    expect(installs).toEqual([1]);
    await vi.waitFor(() => { expect(fetchCalls).toBe(2); });

    second.resolve({ sessionId: "sess-1", environmentId: "local", messageCount: 2, messages: [], seq: 2 });
    await secondFetch;
    expect(installs).toEqual([1, 2]);
  });

  it("re-establishes an offline connection before fetching and collapses concurrent probes", async () => {
    const descriptorCalls: string[] = [];
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: (envId) => {
        descriptorCalls.push(envId);
        return Promise.resolve(descriptor({ id: envId }));
      },
      sessionSnapshotFetcher: (_env, ref) => Promise.resolve({
        sessionId: ref.id,
        environmentId: "local",
        messageCount: 1,
        messages: [{ role: "user", content: "hello" }],
        seq: 1,
      }),
    });
    await runtime.loadCatalog();
    await runtime.ensureConnected("local");
    const conn = runtime.getConnection("local");
    if (conn === undefined) throw new Error("Missing local connection");
    // A transport loss keeps the descriptor but drops the state to offline.
    conn.markOffline();
    expect(runtime.getStatus("local").state).toBe("offline");
    expect(conn.descriptor).toBeDefined();
    await Promise.all([runtime.ensureConnected("local"), runtime.ensureConnected("local")]);
    const snapshot = await runtime.switchSession("local", { id: "sess-after-loss", cwd: "/repo" });

    expect(snapshot?.sessionId).toBe("sess-after-loss");
    expect(runtime.getStatus("local").state).toBe("connected");
    // One probe at catalog load plus one shared probe: concurrent callers do not
    // duplicate the descriptor request.
    expect(descriptorCalls).toEqual(["local", "local"]);
  });

  it("holds live events until the snapshot watermark closes the interval", async () => {
    const session: SessionRef = { id: "sess-concurrent", cwd: "/proj", environmentId: "local" };
    let resolveSnapshot: ((snap: SessionSnapshot) => void) | undefined;
    const snapshotPromise = new Promise<SessionSnapshot>((resolve) => {
      resolveSnapshot = resolve;
    });
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve(descriptor({ id: "local" })),
      sessionSnapshotFetcher: () => snapshotPromise,
    });
    await runtime.loadCatalog();

    const order: string[] = [];
    runtime.subscribeSessionEvents("local", "sess-concurrent", (event) => order.push(`event:${JSON.stringify(event)}`));
    const switchPromise = runtime.switchSession("local", session, (snapshot) => {
      // The consumer installs the seed here, before any held event is released.
      order.push(`install:${String(snapshot.seq)}`);
    });

    // The event arrives before the snapshot resolves: it must wait, not be lost.
    runtime.ingestSessionEvent("local", "sess-concurrent", { type: "assistant.delta", text: "live" }, 2);
    expect(order).toEqual([]);

    resolveSnapshot?.({
      sessionId: "sess-concurrent",
      environmentId: "local",
      messageCount: 1,
      messages: [{ role: "user", content: "hello" }],
      seq: 1,
    });
    const result = await switchPromise;

    // Install strictly precedes the held event: an event can never land on the
    // previous transcript revision and then be overwritten by the seed.
    expect(order).toEqual(["install:1", "event:" + JSON.stringify({ type: "assistant.delta", text: "live" })]);
    expect(result?.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(result?.seq).toBe(1);
  });

  it("delivers live events without an interval until a snapshot fetch starts", async () => {
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve(descriptor({ id: "local" })),
      sessionSnapshotFetcher: () => new Promise<SessionSnapshot>(() => undefined),
    });
    await runtime.loadCatalog();

    const delivered: unknown[] = [];
    runtime.subscribeSessionEvents("local", "sess-pending", (event) => delivered.push(event));
    // A pending-start subscription never fetches a snapshot: nothing may hold
    // its events on an interval that will never close.
    runtime.ingestSessionEvent("local", "sess-pending", { type: "session.startup" }, 3);

    expect(delivered).toEqual([{ type: "session.startup" }]);
  });

  it("forgets a removed environment and prunes environments the catalog dropped", async () => {
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }, { id: "remote-1", name: "Remote" }]),
      descriptorFetcher: (envId) => Promise.resolve(descriptor({ id: envId, kind: envId === "local" ? "local" : "remote" })),
    });
    await runtime.loadCatalog();
    expect(runtime.getAllProjections().map((projection) => projection.environmentId).sort()).toEqual(["local", "remote-1"]);

    runtime.retainEnvironments(["local"]);
    expect(runtime.getAllProjections().map((projection) => projection.environmentId)).toEqual(["local"]);
    expect(runtime.getConnection("remote-1")).toBeUndefined();

    await runtime.ensureConnected("remote-1");
    expect(runtime.getAllProjections().map((projection) => projection.environmentId).sort()).toEqual(["local", "remote-1"]);

    runtime.removeEnvironment("remote-1");
    expect(runtime.getAllProjections().map((projection) => projection.environmentId)).toEqual(["local"]);
    expect(runtime.getConnection("remote-1")).toBeUndefined();
  });

  it("isolates live events per session and ignores duplicate transport sequences", async () => {
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve(descriptor({ id: "local" })),
      sessionSnapshotFetcher: (_env, ref) => Promise.resolve({
        sessionId: ref.id,
        environmentId: "local",
        messageCount: 1,
        messages: [],
        seq: 1,
      }),
    });
    await runtime.loadCatalog();
    await runtime.switchSession("local", { id: "sess-a", cwd: "/a" });
    await runtime.switchSession("local", { id: "sess-b", cwd: "/b" });

    const forA: unknown[] = [];
    const forB: unknown[] = [];
    runtime.subscribeSessionEvents("local", "sess-a", (event) => forA.push(event));
    runtime.subscribeSessionEvents("local", "sess-b", (event) => forB.push(event));

    runtime.ingestSessionEvent("local", "sess-b", { type: "message.append" }, 2);
    runtime.ingestSessionEvent("local", "sess-b", { type: "message.append" }, 2);
    runtime.ingestSessionEvent("local", "sess-b", { type: "message.append" }, 1);

    expect(forA).toEqual([]);
    expect(forB).toEqual([{ type: "message.append" }]);
  });

  it("blocks an environment whose major protocol version is incompatible", async () => {
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "remote-future", name: "Future Node" }]),
      descriptorFetcher: () => Promise.resolve(descriptor({ id: "remote-future", protocolVersion: { major: 99, minor: 0 } })),
    });

    await runtime.loadCatalog();
    await runtime.getConnection("remote-future")?.connect();
    const conn = runtime.getConnection("remote-future");
    if (conn === undefined) throw new Error("Missing remote connection");
    expect(conn.state).toBe("blocked");
    expect(conn.error?.code).toBe("INCOMPATIBLE_VERSION");
    const status = runtime.getStatus("remote-future");
    expect(status.state).toBe("blocked");
    expect(status.degraded).toBe(false);
    expect(status.error?.code).toBe("INCOMPATIBLE_VERSION");
  });

  it("degrades predictably on a minor version difference or a missing required capability", async () => {
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([
        { id: "newer-minor", name: "Newer minor" },
        { id: "no-streaming", name: "No streaming" },
      ]),
      descriptorFetcher: (id) => Promise.resolve(id === "newer-minor"
        ? descriptor({ id, protocolVersion: { major: 1, minor: 9 } })
        : descriptor({ id, capabilities: {} })),
    });

    await runtime.loadCatalog();
    await runtime.ensureConnected("newer-minor");
    await runtime.ensureConnected("no-streaming");
    const newerMinor = runtime.getStatus("newer-minor");
    expect(newerMinor).toMatchObject({ state: "connected", degraded: true });
    expect(newerMinor.error).toBeUndefined();

    const noStreaming = runtime.getStatus("no-streaming");
    expect(noStreaming).toMatchObject({ state: "connected", degraded: true });
    expect(runtime.getConnection("no-streaming")?.degradedReason).toContain("streaming");
  });

  it("isolates the failure of one environment so it does not invalidate other projections", async () => {
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([
        { id: "local", name: "Local" },
        { id: "flaky-remote", name: "Flaky Remote" },
      ]),
      descriptorFetcher: (id) => {
        if (id === "flaky-remote") return Promise.reject(new Error("Connection refused: host unreachable"));
        return Promise.resolve(descriptor({ id }));
      },
    });

    await runtime.loadCatalog();
    await runtime.ensureConnected("local");
    await runtime.getConnection("flaky-remote")?.connect();
    const local = runtime.getStatus("local");
    const flaky = runtime.getStatus("flaky-remote");
    expect(local).toMatchObject({ state: "connected" });
    expect(local.error).toBeUndefined();
    expect(flaky).toMatchObject({ state: "offline" });
    expect(flaky.error?.code).toBe("ENVIRONMENT_OFFLINE");
    expect(flaky.error?.message).toContain("Connection refused");
    expect(runtime.getConnection("local")?.state).toBe("connected");
  });

  it("drops only client-side projections on dispose; the environment keeps the session", async () => {
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve(descriptor({ id: "local" })),
      sessionSnapshotFetcher: (_env, ref) => Promise.resolve({
        sessionId: ref.id,
        environmentId: "local",
        messageCount: 0,
        messages: [],
        seq: 0,
      }),
    });
    await runtime.loadCatalog();
    await runtime.ensureConnected("local");
    await runtime.switchSession("local", { id: "sess-long-running", cwd: "/repo" });
    expect(runtime.getProjection("local").sessions.map((session) => session.id)).toEqual(["sess-long-running"]);

    runtime.dispose();

    expect(runtime.getConnection("local")).toBeUndefined();
    expect(runtime.getAllProjections()).toEqual([]);
  });

  it("reconciles the active session snapshot consistently on reconnect", async () => {
    let serverSeq = 1;
    const session: SessionRef = { id: "sess-auto", cwd: "/project", environmentId: "local" };
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve(descriptor({ id: "local" })),
      sessionSnapshotFetcher: (_env, ref) => Promise.resolve({
        sessionId: ref.id,
        environmentId: "local",
        messageCount: serverSeq,
        messages: Array.from({ length: serverSeq }, (_, i) => ({ role: "user", content: `msg-${String(i + 1)}` })),
        seq: serverSeq,
      }),
    });
    await runtime.loadCatalog();
    await runtime.switchSession("local", session);
    expect(runtime.getProjection("local").snapshots.get("sess-auto")?.seq).toBe(1);

    // The environment advances while the client is offline; on reconnect the session owner drives reconciliation.
    serverSeq = 3;
    const conn = runtime.getConnection("local");
    if (conn === undefined) throw new Error("Missing local connection");
    conn.markOffline();
    await conn.connect();
    const snapshot = await runtime.switchSession("local", session);
    expect(snapshot?.seq).toBe(3);
    expect(runtime.getProjection("local").snapshots.get("sess-auto")?.seq).toBe(3);
    expect(runtime.getProjection("local").snapshots.get("sess-auto")?.messages).toHaveLength(3);
  });

  it("rejects a stale snapshot within the same epoch when live events have already advanced the watermark", async () => {
    let currentResolver = deferred<SessionSnapshot>();
    const session: SessionRef = { id: "sess-stale", cwd: "/repo", environmentId: "local" };
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve(descriptor({ id: "local" })),
      sessionSnapshotFetcher: () => currentResolver.promise,
    });
    await runtime.loadCatalog();
    await runtime.ensureConnected("local");

    // First fetch installs initial seed at seq 10
    let installed: SessionSnapshot | undefined;
    const firstSwitch = runtime.switchSession("local", session, (snap) => { installed = snap; });
    currentResolver.resolve({
      sessionId: "sess-stale",
      environmentId: "local",
      messageCount: 1,
      messages: [{ role: "user", content: "m10" }],
      seq: 10,
    });
    await firstSwitch;
    expect(installed?.seq).toBe(10);

    // Live event arrives with seq: 11
    const delivered: unknown[] = [];
    runtime.subscribeSessionEvents("local", "sess-stale", (event) => delivered.push(event));
    runtime.ingestSessionEvent("local", "sess-stale", { role: "assistant", content: "m11" }, 11);
    expect(delivered).toHaveLength(1);

    // Now prepare a second snapshot fetch resolving with stale seq: 10
    currentResolver = deferred<SessionSnapshot>();
    let secondInstalled: SessionSnapshot | undefined;
    const secondSwitch = runtime.switchSession("local", session, (snap) => { secondInstalled = snap; });
    currentResolver.resolve({
      sessionId: "sess-stale",
      environmentId: "local",
      messageCount: 1,
      messages: [{ role: "user", content: "m10-stale" }],
      seq: 10,
    });
    const result = await secondSwitch;
    // Stale snapshot is rejected and not applied!
    expect(result).toBeUndefined();
    expect(secondInstalled).toBeUndefined();
    // Subsequent event seq 12 is still delivered
    runtime.ingestSessionEvent("local", "sess-stale", { role: "assistant", content: "m12" }, 12);
    expect(delivered).toHaveLength(2);
  });

  it("discards an in-flight fetch from a superseded epoch and never delivers its buffered events", async () => {
    const oldResolver = deferred<SessionSnapshot>();
    const newResolver = deferred<SessionSnapshot>();
    const oldStarted = deferred<boolean>();
    const session: SessionRef = { id: "sess-epoch", cwd: "/repo", environmentId: "local" };
    let fetchCount = 0;
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve(descriptor({ id: "local" })),
      sessionSnapshotFetcher: () => {
        fetchCount++;
        if (fetchCount === 1) {
          oldStarted.resolve(true);
          return oldResolver.promise;
        }
        return newResolver.promise;
      },
    });
    await runtime.loadCatalog();
    await runtime.ensureConnected("local");

    const delivered: unknown[] = [];
    runtime.subscribeSessionEvents("local", "sess-epoch", (event) => delivered.push(event));

    // Start fetch in epoch 0
    let oldInstalled: SessionSnapshot | undefined;
    const oldPromise = runtime.switchSession("local", session, (snap) => { oldInstalled = snap; });
    await oldStarted.promise;
    expect(fetchCount).toBe(1);
    // Live event arrives into buffer during fetch
    runtime.ingestSessionEvent("local", "sess-epoch", { role: "user", content: "old-event" }, 5);
    const conn = runtime.getConnection("local");
    if (conn === undefined) throw new Error("Missing local connection");
    conn.reportTransportLoss("lost connection");

    // Reconnect: starts epoch 1
    await conn.connect();
    let newInstalled: SessionSnapshot | undefined;
    const newPromise = runtime.switchSession("local", session, (snap) => { newInstalled = snap; });

    // Now the old fetch from epoch 0 resolves:
    oldResolver.resolve({
      sessionId: "sess-epoch",
      environmentId: "local",
      messageCount: 1,
      messages: [],
      seq: 4,
    });
    await oldPromise;
    // Must NOT be applied!
    expect(oldInstalled).toBeUndefined();

    // Event arrives in epoch 1 before snapshot
    runtime.ingestSessionEvent("local", "sess-epoch", { role: "user", content: "new-event" }, 2);

    // New fetch resolves for epoch 1:
    newResolver.resolve({
      sessionId: "sess-epoch",
      environmentId: "local",
      messageCount: 1,
      messages: [{ role: "user", content: "new-seed" }],
      seq: 1,
    });
    await newPromise;

    expect(newInstalled?.seq).toBe(1);
    // Old buffered event (seq 5 from epoch 0) was NEVER delivered! Only new-event (seq 2) from epoch 1 is delivered!
    expect(delivered).toEqual([{ role: "user", content: "new-event" }]);
  });

  it("does not let a pending or slow remote probe block the catalog or local environment", async () => {
    const pendingResolver = deferred<EnvironmentDescriptor>();
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([
        { id: "local", name: "Local" },
        { id: "remote-hanging", name: "Hanging Remote" },
      ]),
      descriptorFetcher: (id) => {
        if (id === "remote-hanging") return pendingResolver.promise;
        return Promise.resolve(descriptor({ id: "local" }));
      },
    });

    try {
      const catalog = await runtime.loadCatalog();
      expect(catalog.map((m) => m.id)).toEqual(["local", "remote-hanging"]);

      await runtime.ensureConnected("local");
      expect(runtime.getStatus("local").state).toBe("connected");
      expect(runtime.getStatus("remote-hanging").state).toBe("connecting");
    } finally {
      pendingResolver.resolve(descriptor({ id: "remote-hanging" }));
      runtime.dispose();
    }
  });
});

describe("protocol contract parsing", () => {
  it("accepts a descriptor with unknown extra fields and rejects malformed known fields", () => {
    const parsed = parseEnvironmentDescriptor({
      id: "remote-1",
      name: "Remote",
      kind: "remote",
      protocolVersion: { major: 1, minor: 0 },
      capabilities: { streaming: true, futureFlag: "ignored" },
      status: "connected",
      futureField: { anything: true },
    });
    expect(parsed).toEqual({
      id: "remote-1",
      name: "Remote",
      kind: "remote",
      protocolVersion: { major: 1, minor: 0 },
      capabilities: { streaming: true },
      status: "connected",
    });

    expect(() => parseEnvironmentDescriptor({ id: "x", name: "x", kind: "remote", protocolVersion: { major: "1", minor: 0 }, capabilities: {}, status: "connected" })).toThrow();
    expect(() => parseEnvironmentDescriptor({ id: "x", name: "x", kind: "unknown", protocolVersion: { major: 1, minor: 0 }, capabilities: {}, status: "connected" })).toThrow();
    expect(() => parseEnvironmentDescriptor({ id: "x", name: "x", kind: "remote", protocolVersion: { major: 1, minor: 0 }, capabilities: { streaming: "yes" }, status: "connected" })).toThrow();
  });
});
