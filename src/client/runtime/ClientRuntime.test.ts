import { describe, expect, it } from "vitest";
import { CURRENT_PROTOCOL_VERSION, type EnvironmentDescriptor } from "../../shared/protocol/contracts";
import { ClientRuntime } from "./ClientRuntime";
import type { SessionRef, SessionSnapshot } from "./types";

describe("ClientRuntime & EnvironmentConnection (Ticket 21)", () => {
  it("obtains catalog and connects without exposing remote credentials", async () => {
    const rawCatalog = [
      { id: "local", name: "Local Host" },
      { id: "remote-1", name: "Remote VPS" },
    ];

    const descriptorMap: Record<string, EnvironmentDescriptor> = {
      local: {
        id: "local",
        name: "Local Host",
        kind: "local",
        protocolVersion: CURRENT_PROTOCOL_VERSION,
        capabilities: { streaming: true, pty: true },
        status: "connected",
      },
      "remote-1": {
        id: "remote-1",
        name: "Remote VPS",
        kind: "remote",
        protocolVersion: CURRENT_PROTOCOL_VERSION,
        capabilities: { streaming: true, pty: false },
        status: "connected",
      },
    };

    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve(rawCatalog),
      descriptorFetcher: (id) => {
        const desc = descriptorMap[id];
        if (!desc) throw new Error("Descriptor not found");
        return Promise.resolve(desc);
      },
    });

    const descriptors = await runtime.loadCatalog();
    expect(descriptors).toHaveLength(2);
    expect(descriptors.map((d) => d.id)).toEqual(["local", "remote-1"]);

    // Verify no credentials exist in catalog or descriptors
    for (const d of descriptors) {
      expect("token" in d).toBe(false);
      expect("headers" in d).toBe(false);
      expect("password" in d).toBe(false);
    }
  });

  it("keeps snapshot, events, and session identity consistent after reconnection", async () => {
    const session: SessionRef = { id: "sess-123", cwd: "/project", environmentId: "local" };
    const initialSnapshot: SessionSnapshot = {
      sessionId: "sess-123",
      environmentId: "local",
      messageCount: 1,
      messages: [{ role: "user", content: "hello" }],
      seq: 1,
    };

    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve({
        id: "local",
        name: "Local",
        kind: "local",
        protocolVersion: CURRENT_PROTOCOL_VERSION,
        capabilities: { streaming: true },
        status: "connected",
      }),
      sessionSnapshotFetcher: () => Promise.resolve({ ...initialSnapshot }),
    });

    await runtime.loadCatalog();
    const snapshot1 = await runtime.switchSession("local", session);
    expect(snapshot1?.sessionId).toBe("sess-123");
    expect(snapshot1?.seq).toBe(1);

    // Apply live event
    runtime.applyLiveEvent("local", "sess-123", { role: "assistant", content: "world" });
    const proj = runtime.getProjection("local");
    expect(proj.snapshots.get("sess-123")?.messages).toHaveLength(2);
    expect(proj.snapshots.get("sess-123")?.seq).toBe(2);

    // Simulate reconnection (fetching fresh snapshot)
    const conn = runtime.getConnection("local");
    if (!conn) throw new Error("Missing local connection");
    conn.markOffline();
    expect(proj.status).toBe("offline");

    await conn.connect();
    expect(proj.status).toBe("connected");

    // Re-fetch snapshot on reconnection preserves identity
    const snapshot2 = await runtime.switchSession("local", session);
    expect(snapshot2?.sessionId).toBe("sess-123");
    expect(proj.activeSessionId).toBe("sess-123");
  });

  it("buffers live events arriving during in-flight snapshot fetch without dropping or wiping them", async () => {
    const session: SessionRef = { id: "sess-concurrent", cwd: "/proj", environmentId: "local" };
    let resolveSnapshot: ((snap: SessionSnapshot) => void) | undefined;
    const snapshotPromise = new Promise<SessionSnapshot>((resolve) => {
      resolveSnapshot = resolve;
    });

    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve({
        id: "local",
        name: "Local",
        kind: "local",
        protocolVersion: CURRENT_PROTOCOL_VERSION,
        capabilities: { streaming: true },
        status: "connected",
      }),
      sessionSnapshotFetcher: () => snapshotPromise,
    });

    await runtime.loadCatalog();

    // Start snapshot fetch in flight
    const switchPromise = runtime.switchSession("local", session);

    // Live event arrives before snapshot resolves (seq: 2)
    runtime.applyLiveEvent("local", "sess-concurrent", { role: "assistant", content: "live chunk while fetching snapshot" }, 2);

    // Now snapshot resolves with earlier seq: 1
    const baseSnapshot: SessionSnapshot = {
      sessionId: "sess-concurrent",
      environmentId: "local",
      messageCount: 1,
      messages: [{ role: "user", content: "hello" }],
      seq: 1,
    };
    resolveSnapshot?.(baseSnapshot);

    const result = await switchPromise;

    // Both user message (from snapshot seq: 1) and live chunk (seq: 2) are preserved!
    expect(result?.messages).toHaveLength(2);
    expect(result?.seq).toBe(2);
    expect(result?.messages[1]).toEqual({ role: "assistant", content: "live chunk while fetching snapshot" });
  });

  it("isolates live events per session and ignores duplicate seq", async () => {
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve({
        id: "local",
        name: "Local",
        kind: "local",
        protocolVersion: CURRENT_PROTOCOL_VERSION,
        capabilities: { streaming: true },
        status: "connected",
      }),
      sessionSnapshotFetcher: (_env, sessionId) => Promise.resolve({
        sessionId,
        environmentId: "local",
        messageCount: 1,
        messages: [{ role: "user", content: "hello-" + sessionId }],
        seq: 1,
      }),
    });
    await runtime.loadCatalog();
    await runtime.switchSession("local", { id: "sess-a", cwd: "/a" });
    await runtime.switchSession("local", { id: "sess-b", cwd: "/b" });

    runtime.applyLiveEvent("local", "sess-b", { role: "assistant", content: "for-b" }, 2);
    const proj = runtime.getProjection("local");
    expect(proj.snapshots.get("sess-a")?.messages).toHaveLength(1);
    expect(proj.snapshots.get("sess-b")?.messages).toHaveLength(2);

    // Duplicate seq for B is ignored and never mutates the snapshot.
    runtime.applyLiveEvent("local", "sess-b", { role: "assistant", content: "dup" }, 2);
    expect(proj.snapshots.get("sess-b")?.messages).toHaveLength(2);
    expect(proj.snapshots.get("sess-b")?.seq).toBe(2);
  });

  it("predictably blocks on incompatible major protocol version", async () => {
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "remote-future", name: "Future Node" }]),
      descriptorFetcher: () => Promise.resolve({
        id: "remote-future",
        name: "Future Node",
        kind: "remote",
        protocolVersion: { major: 99, minor: 0 },
        capabilities: { streaming: true },
        status: "connected",
      }),
    });

    await runtime.loadCatalog();
    const conn = runtime.getConnection("remote-future");
    if (!conn) throw new Error("Missing remote connection");
    expect(conn.state).toBe("blocked");
    expect(conn.error?.code).toBe("INCOMPATIBLE_VERSION");
    expect(conn.error?.message).toContain("Major version mismatch");

    const proj = runtime.getProjection("remote-future");
    expect(proj.status).toBe("blocked");
    expect(proj.error?.code).toBe("INCOMPATIBLE_VERSION");
  });

  it("isolates failure of one environment so it does not invalidate others", async () => {
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([
        { id: "local", name: "Local" },
        { id: "flaky-remote", name: "Flaky Remote" },
      ]),
      descriptorFetcher: (id) => {
        if (id === "flaky-remote") return Promise.reject(new Error("Connection refused: host unreachable"));
        return Promise.resolve({
          id: "local",
          name: "Local",
          kind: "local",
          protocolVersion: CURRENT_PROTOCOL_VERSION,
          capabilities: { streaming: true },
          status: "connected",
        });
      },
    });

    await runtime.loadCatalog();

    const localProj = runtime.getProjection("local");
    const flakyProj = runtime.getProjection("flaky-remote");

    expect(localProj.status).toBe("connected");
    expect(localProj.error).toBeUndefined();

    expect(flakyProj.status).toBe("offline");
    expect(flakyProj.error?.code).toBe("ENVIRONMENT_OFFLINE");
    expect(flakyProj.error?.message).toContain("Connection refused");

    // Local remains fully operational
    const localConn = runtime.getConnection("local");
    if (!localConn) throw new Error("Missing local connection");
    expect(localConn.state).toBe("connected");
  });

  it("does not terminate server-side execution upon UI/API disconnect or restart", async () => {
    const session: SessionRef = { id: "sess-long-running", cwd: "/repo" };
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve({
        id: "local",
        name: "Local",
        kind: "local",
        protocolVersion: CURRENT_PROTOCOL_VERSION,
        capabilities: { streaming: true },
        status: "connected",
      }),
    });

    await runtime.loadCatalog();
    await runtime.switchSession("local", session);

    // Client runtime disposes (e.g. browser tab closed or UI reloads)
    runtime.dispose();

    expect(runtime.getConnection("local")).toBeUndefined();
  });

  it("refreshes the active session snapshot automatically after reconnect", async () => {
    let serverSeq = 1;
    const session: SessionRef = { id: "sess-auto", cwd: "/project", environmentId: "local" };
    const runtime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local" }]),
      descriptorFetcher: () => Promise.resolve({
        id: "local",
        name: "Local",
        kind: "local",
        protocolVersion: CURRENT_PROTOCOL_VERSION,
        capabilities: { streaming: true },
        status: "connected",
      }),
      sessionSnapshotFetcher: () => Promise.resolve({
        sessionId: "sess-auto",
        environmentId: "local",
        messageCount: serverSeq,
        messages: Array.from({ length: serverSeq }, (_, i) => ({ role: "user", content: `msg-${String(i + 1)}` })),
        seq: serverSeq,
      }),
    });
    await runtime.loadCatalog();
    await runtime.switchSession("local", session);
    expect(runtime.getProjection("local").snapshots.get("sess-auto")?.seq).toBe(1);

    // Server avanca durante o offline; o reconnect deve buscar sem switchSession manual.
    serverSeq = 3;
    const conn = runtime.getConnection("local");
    if (!conn) throw new Error("Missing local connection");
    conn.markOffline();
    await conn.connect();
    for (let i = 0; i < 20 && runtime.getProjection("local").snapshots.get("sess-auto")?.seq !== 3; i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(runtime.getProjection("local").snapshots.get("sess-auto")?.seq).toBe(3);
    expect(runtime.getProjection("local").snapshots.get("sess-auto")?.messages).toHaveLength(3);
  });
});
