import type {
  EnvironmentDescriptor,
  EnvironmentId,
} from "../../shared/protocol/contracts";
import { EnvironmentConnection } from "./EnvironmentConnection";
import type {
  EnvironmentConnectionOptions,
  EnvironmentProjection,
  EnvironmentStatus,
  SessionRef,
  SessionSnapshot,
} from "./types";
export interface CatalogMachine {
  id: string;
  name: string;
  baseUrl?: string;
}

export interface ClientRuntimeOptions {
  catalogFetcher: () => Promise<CatalogMachine[]>;
  descriptorFetcher: (envId: EnvironmentId) => Promise<EnvironmentDescriptor>;
  sessionSnapshotFetcher?: ((envId: EnvironmentId, session: SessionRef) => Promise<SessionSnapshot>) | undefined;
}

/**
 * Client-side projections and connection state for every environment the
 * browser talks to through the gateway. It owns no execution and no durable
 * state: each environment stays the authority for its sessions.
 */
export class ClientRuntime {
  private readonly connections = new Map<EnvironmentId, EnvironmentConnection>();
  private readonly projections = new Map<EnvironmentId, EnvironmentProjection>();
  private readonly projectionChangeListeners = new Set<(projection: EnvironmentProjection) => void>();
  private selectedEnvironmentId: EnvironmentId = "local";

  constructor(private readonly options: ClientRuntimeOptions) {}

  getSelectedEnvironmentId(): EnvironmentId {
    return this.selectedEnvironmentId;
  }

  setSelectedEnvironmentId(envId: EnvironmentId): void {
    this.selectedEnvironmentId = envId;
  }

  /**
   * Load the gateway catalog and connect every environment it lists. Each
   * environment connects independently, so a slow or offline one neither
   * blocks nor invalidates the others.
   */
  async loadCatalog(): Promise<CatalogMachine[]> {
    const machines = await this.options.catalogFetcher();

    // Ensure all connections and projections exist immediately so every environment
    // in the catalog is known even before network probes finish.
    for (const m of machines) {
      const conn = this.connectionFor(m.id);
      void conn.connect().catch(() => {
        // Handled internally by EnvironmentConnection (state -> offline, emitError)
      });
    }

    return machines;
  }

  getConnection(envId: EnvironmentId): EnvironmentConnection | undefined {
    return this.connections.get(envId);
  }

  /**
   * Connection for an environment, established before the caller uses it. A
   * connection that lost its session transport keeps its descriptor, so the
   * state — not the descriptor — decides whether a probe is needed; concurrent
   * callers share the probe through the connection.
   */
  async ensureConnected(envId: EnvironmentId): Promise<EnvironmentConnection> {
    const conn = this.connectionFor(envId);
    if (conn.state !== "connected") await conn.connect();
    return conn;
  }

  getProjection(envId: EnvironmentId): EnvironmentProjection {
    return this.ensureProjection(envId);
  }

  getStatus(envId: EnvironmentId): EnvironmentStatus {
    const projection = this.ensureProjection(envId);
    return {
      environmentId: envId,
      state: projection.status,
      degraded: projection.degraded,
      ...(projection.error === undefined ? {} : { error: projection.error }),
    };
  }

  getAllProjections(): EnvironmentProjection[] {
    return Array.from(this.projections.values());
  }

  onProjectionChange(listener: (projection: EnvironmentProjection) => void): () => void {
    this.projectionChangeListeners.add(listener);
    return () => {
      this.projectionChangeListeners.delete(listener);
    };
  }

  /**
   * Fetch a session's snapshot through this environment and make it the
   * projection's active session. Live events that arrive while the fetch is in
   * flight are held until `applySnapshot` has installed the seed, so the
   * consumer never sees an event applied before the state it belongs to.
   */
  async switchSession(
    envId: EnvironmentId,
    session: SessionRef,
    applySnapshot?: (snapshot: SessionSnapshot, isCurrent: () => boolean) => void | Promise<void>,
  ): Promise<SessionSnapshot | undefined> {
    const projection = this.ensureProjection(envId);
    projection.activeSession = session;
    if (!projection.sessions.some((s) => s.id === session.id)) {
      projection.sessions.push(session);
    }

    const conn = this.connections.get(envId);
    if (conn?.state !== "connected") {
      this.notifyProjection(projection);
      const message = conn?.error?.message ?? `Environment "${envId}" is ${conn?.state ?? "not connected"}`;
      throw new Error(message);
    }

    const snapshot = await conn.fetchSessionSnapshotWithReconciliation(session, applySnapshot);
    if (snapshot !== undefined) {
      projection.snapshots.set(session.id, snapshot);
    }
    this.notifyProjection(projection);
    return snapshot;
  }

  /**
   * Record a session transport loss. The session socket retries on its own, so
   * only the environment state changes here.
   */
  reportTransportLoss(envId: EnvironmentId, message: string): void {
    this.connectionFor(envId).reportTransportLoss(message);
  }

  /** Re-probe an environment after its session transport reconnected. */
  probeEnvironment(envId: EnvironmentId): void {
    this.connectionFor(envId).probe();
  }

  /**
   * Forget one environment entirely: its connection, its reconnect timer, and
   * its projection. Used when a machine leaves the catalog.
   */
  removeEnvironment(envId: EnvironmentId): void {
    const conn = this.connections.get(envId);
    if (conn !== undefined) {
      conn.disconnect();
      this.connections.delete(envId);
    }
    this.projections.delete(envId);
  }

  /** Keep only environments the catalog still lists. */
  retainEnvironments(envIds: Iterable<EnvironmentId>): void {
    const keep = new Set(envIds);
    for (const envId of [...this.connections.keys()]) {
      if (!keep.has(envId)) this.removeEnvironment(envId);
    }
    for (const envId of [...this.projections.keys()]) {
      if (!keep.has(envId)) this.projections.delete(envId);
    }
  }

  /**
   * Route one live event of a session through the environment's exactly-once
   * gate. The event reaches {@link subscribeSessionEvents} listeners only when
   * it is not already reflected by the applied snapshot.
   */
  ingestSessionEvent(envId: EnvironmentId, sessionId: string, event: unknown, seq?: number): void {
    this.connectionFor(envId).receiveLiveEvent({ sessionId, data: event, ...(seq === undefined ? {} : { seq }) });
  }

  subscribeSessionEvents(envId: EnvironmentId, sessionId: string, listener: (event: unknown, seq?: number) => void): () => void {
    return this.connectionFor(envId).onSessionEvent((event) => {
      if (event.sessionId !== sessionId) return;
      listener(event.data, event.seq);
    });
  }

  private connectionFor(envId: EnvironmentId): EnvironmentConnection {
    let conn = this.connections.get(envId);
    if (conn === undefined) {
      conn = this.createConnection(envId);
      this.connections.set(envId, conn);
    }
    return conn;
  }

  private createConnection(envId: EnvironmentId): EnvironmentConnection {
    const connOptions: EnvironmentConnectionOptions = {
      environmentId: envId,
      descriptorFetcher: this.options.descriptorFetcher,
      sessionSnapshotFetcher: this.options.sessionSnapshotFetcher,
    };
    const conn = new EnvironmentConnection(connOptions);

    conn.onStateChange((state) => {
      const proj = this.ensureProjection(envId);
      proj.status = state;
      proj.descriptor = conn.descriptor;
      proj.degraded = conn.degraded;
      proj.error = conn.error;
      this.notifyProjection(proj);
    });

    conn.onError((error) => {
      const proj = this.ensureProjection(envId);
      proj.error = error;
      proj.degraded = conn.degraded;
      this.notifyProjection(proj);
    });

    return conn;
  }

  private ensureProjection(envId: EnvironmentId): EnvironmentProjection {
    let proj = this.projections.get(envId);
    if (proj === undefined) {
      proj = {
        environmentId: envId,
        status: "connecting",
        degraded: false,
        sessions: [],
        snapshots: new Map(),
      };
      this.projections.set(envId, proj);
    }
    return proj;
  }

  private notifyProjection(projection: EnvironmentProjection): void {
    for (const listener of this.projectionChangeListeners) {
      listener(projection);
    }
  }

  /**
   * Stop background work without losing projections or listeners. A surface
   * that is detached and re-attached resumes from here; `dispose` stays the
   * explicit final teardown.
   */
  detach(): void {
    for (const conn of this.connections.values()) {
      conn.suspend();
    }
  }

  dispose(): void {
    for (const conn of this.connections.values()) {
      conn.disconnect();
    }
    this.connections.clear();
    this.projections.clear();
    this.projectionChangeListeners.clear();
  }
}
