import type {
  EnvironmentDescriptor,
  EnvironmentId,
} from "../../shared/protocol/contracts";
import { EnvironmentConnection } from "./EnvironmentConnection";
import type {
  EnvironmentConnectionOptions,
  EnvironmentProjection,
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
  sessionSnapshotFetcher?: (envId: EnvironmentId, sessionId: string) => Promise<SessionSnapshot>;
}

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

  async loadCatalog(): Promise<EnvironmentDescriptor[]> {
    const machines = await this.options.catalogFetcher();

    // Independent parallel connection: a slow or offline machine does not block others!
    const results = await Promise.allSettled(
      machines.map(async (m) => {
        const envId = m.id;
        let conn = this.connections.get(envId);
        if (conn === undefined) {
          conn = this.createConnection(envId);
          this.connections.set(envId, conn);
        }
        this.ensureProjection(envId);

        await conn.connect();
        return conn.descriptor;
      }),
    );

    const descriptors: EnvironmentDescriptor[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== undefined) {
        descriptors.push(r.value);
      }
    }

    return descriptors;
  }

  getConnection(envId: EnvironmentId): EnvironmentConnection | undefined {
    return this.connections.get(envId);
  }

  getProjection(envId: EnvironmentId): EnvironmentProjection {
    return this.ensureProjection(envId);
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

  async switchSession(envId: EnvironmentId, session: SessionRef): Promise<SessionSnapshot | undefined> {
    const projection = this.ensureProjection(envId);
    projection.activeSessionId = session.id;
    if (!projection.sessions.some((s) => s.id === session.id)) {
      projection.sessions.push(session);
    }

    const conn = this.connections.get(envId);
    if (conn?.state !== "connected") {
      this.notifyProjection(projection);
      return undefined;
    }

    const snapshot = await conn.fetchSessionSnapshotWithReconciliation(session.id);
    if (snapshot !== undefined) {
      projection.snapshots.set(session.id, snapshot);
    }
    this.notifyProjection(projection);
    return snapshot;
  }

  applyLiveEvent(envId: EnvironmentId, sessionId: string, event: unknown, seq?: number): void {
    const projection = this.ensureProjection(envId);
    const existing = projection.snapshots.get(sessionId);
    const nextSeq = seq ?? ((existing?.seq ?? 0) + 1);

    // Deduplicate before mutating state: stale/duplicate seq never touches the snapshot.
    if (existing !== undefined && nextSeq <= existing.seq) {
      return;
    }

    if (existing !== undefined) {
      existing.messages.push(event);
      existing.seq = nextSeq;
      existing.messageCount++;
    }

    const conn = this.connections.get(envId);
    conn?.receiveLiveEvent({ seq: nextSeq, data: event, sessionId });

    this.notifyProjection(projection);
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
      this.notifyProjection(proj);
      // Pos-reconexao: reatualiza o snapshot da sessao ativa sem exigir switchSession manual.
      if (state === "connected" && proj.activeSessionId !== undefined) {
        const sessionId = proj.activeSessionId;
        void conn.fetchSessionSnapshotWithReconciliation(sessionId).then((snapshot) => {
          if (snapshot !== undefined) {
            proj.snapshots.set(sessionId, snapshot);
            this.notifyProjection(proj);
          }
        }).catch(() => {
          // Mantem o snapshot anterior; falha de fetch nao invalida a projecao conectada.
        });
      }
    });

    conn.onError((error) => {
      const proj = this.ensureProjection(envId);
      proj.error = error;
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

  dispose(): void {
    for (const conn of this.connections.values()) {
      conn.disconnect();
    }
    this.connections.clear();
    this.projectionChangeListeners.clear();
  }
}
