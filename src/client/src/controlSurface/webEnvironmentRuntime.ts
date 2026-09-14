import type { MessagePage, Machine, SessionRef, SessionStreamSnapshot, SessionTranscriptSnapshot } from "../api";
import { api as defaultApi } from "../api";
import type { EnvironmentDescriptor, EnvironmentState, ProtocolError } from "../../../shared/protocol/contracts";
import { ClientRuntime, type CatalogMachine } from "../../runtime/ClientRuntime";
import type { SessionRef as RuntimeSessionRef, SessionSnapshot } from "../../runtime/types";


/**
 * Page size of the selected-session snapshot. The UI shows the same window as
 * the session controller's own refresh, so a runtime-fetched page and a direct
 * one describe the same transcript slice.
 */
export const WEB_SESSION_PAGE_SIZE = 100;

/** The gateway calls this adapter is allowed to make; kept narrow for tests. */
export interface WebEnvironmentRuntimeApi {
  machines(): Promise<Machine[]>;
  descriptor(machineId: string): Promise<EnvironmentDescriptor>;
  messages(session: SessionRef, options: { limit: number }, machineId: string): Promise<MessagePage>;
  streamSnapshot(session: SessionRef, machineId: string): Promise<SessionStreamSnapshot>;
  transcriptSnapshot(session: SessionRef, options: { limit: number }, machineId: string): Promise<SessionTranscriptSnapshot>;
}

export interface WebSessionTranscript {
  page: MessagePage;
  stream: SessionStreamSnapshot;
}

export type WebSessionTranscriptResult = WebSessionTranscript | "superseded";

export interface WebEnvironmentStatus {
  environmentId: string;
  state: EnvironmentState;
  degraded: boolean;
  error?: ProtocolError | undefined;
}

/**
 * Browser-facing wiring between the gateway API and the shared client runtime.
 * The runtime owns catalog loading, per-environment connection state, and the
 * exactly-once session interval; this adapter only translates the gateway's
 * HTTP vocabulary (machines, message pages, stream snapshots) into it.
 */
export class WebEnvironmentRuntime {
  private readonly runtime: ClientRuntime;
  private readonly api: WebEnvironmentRuntimeApi;
  private catalog: Machine[] = [];

  constructor(options: { api?: WebEnvironmentRuntimeApi } = {}) {
    this.api = options.api ?? defaultApi;
    this.runtime = new ClientRuntime({
      catalogFetcher: () => this.fetchCatalog(),
      descriptorFetcher: (envId) => this.api.descriptor(envId),
      sessionSnapshotFetcher: (envId, session) => this.fetchSessionSnapshot(envId, session),
    });
  }

  /**
   * Load the catalog through the runtime and connect every environment it
   * lists. Environments that left the catalog are forgotten with their timer
   * and projection, so a removed machine cannot come back through the runtime.
   */
  async refreshCatalog(): Promise<Machine[]> {
    await this.runtime.loadCatalog();
    this.runtime.retainEnvironments(this.catalog.map((machine) => machine.id));
    return this.catalog;
  }

  /** Connect an environment that just joined the catalog (a machine was added). */
  async connectEnvironment(machineId: string): Promise<void> {
    await this.runtime.ensureConnected(machineId);
  }

  /** Forget an environment whose machine was removed. */
  removeEnvironment(machineId: string): void {
    this.runtime.removeEnvironment(machineId);
  }

  getStatus(machineId: string): WebEnvironmentStatus {
    const status = this.runtime.getStatus(machineId);
    return {
      environmentId: status.environmentId,
      state: status.state,
      degraded: status.degraded,
      ...(status.error === undefined ? {} : { error: status.error }),
    };
  }

  statuses(): Record<string, WebEnvironmentStatus> {
    return Object.fromEntries(this.runtime.getAllProjections().map((projection) => [
      projection.environmentId,
      this.getStatus(projection.environmentId),
    ]));
  }

  onStatusChange(listener: (status: WebEnvironmentStatus) => void): () => void {
    return this.runtime.onProjectionChange((projection) => {
      listener(this.getStatus(projection.environmentId));
    });
  }

  /** Report an unexpected session transport drop; the transport retries itself. */
  reportTransportLoss(machineId: string, message: string): void {
    this.runtime.reportTransportLoss(machineId, message);
  }

  /** Re-probe an environment after its session transport reconnected. */
  probeEnvironment(machineId: string): void {
    this.runtime.probeEnvironment(machineId);
  }

  /** Route one live event through the environment's exactly-once gate. */
  ingestSessionEvent(machineId: string, sessionId: string, event: unknown, seq?: number): void {
    this.runtime.ingestSessionEvent(machineId, sessionId, event, seq);
  }

  subscribeSessionEvents(machineId: string, sessionId: string, listener: (event: unknown, seq?: number) => void): () => void {
    return this.runtime.subscribeSessionEvents(machineId, sessionId, listener);
  }

  /**
   * Committed transcript seed plus its stream watermark, fetched through the
   * runtime. `install` receives the seed before events buffered during the
   * fetch are released, so the caller seeds its state and watermark exactly
   * once and the interval cannot apply an event ahead of the state it belongs to.
   */
  async fetchSessionTranscript(
    machineId: string,
    session: SessionRef,
    install?: (transcript: WebSessionTranscript, isCurrent: () => boolean) => void | Promise<void>,
  ): Promise<WebSessionTranscriptResult> {
    // Probe only when the environment is not connected yet: the check is
    // synchronous, so a connected environment starts its interval in this same
    // tick and no live event slips in before the snapshot it belongs to.
    if (this.runtime.getConnection(machineId)?.state !== "connected") await this.runtime.ensureConnected(machineId);
    const snapshot = await this.runtime.switchSession(machineId, session, async (resolved, isCurrent) => {
      if (install === undefined) return;
      await install({
        page: { messages: resolved.messages, start: resolved.pageStart ?? 0, total: resolved.messageCount },
        stream: { seq: resolved.seq, partial: resolved.partial },
      }, isCurrent);
    });
    if (snapshot === undefined) return "superseded";
    return {
      page: { messages: snapshot.messages, start: snapshot.pageStart ?? 0, total: snapshot.messageCount },
      stream: { seq: snapshot.seq, partial: snapshot.partial },
    };
  }

  /** Reversible cleanup for a detached surface; `dispose` is the final teardown. */
  detach(): void {
    this.runtime.detach();
  }

  dispose(): void {
    this.runtime.dispose();
  }

  private async fetchCatalog(): Promise<CatalogMachine[]> {
    const machines = await this.api.machines();
    this.catalog = machines;
    return machines.map((machine) => ({
      id: machine.id,
      name: machine.name,
      ...(machine.baseUrl === undefined ? {} : { baseUrl: machine.baseUrl }),
    }));
  }

  private async fetchSessionSnapshot(envId: string, session: RuntimeSessionRef): Promise<SessionSnapshot> {
    // The environment must serve the atomic join contract. Without it there is
    // no coherent (page, watermark, partial) tuple to seed from, so the join
    // fails observably: the caller keeps its previous transcript and live
    // events keep flowing instead of applying an ambiguous pair.
    if (this.runtime.getProjection(envId).descriptor?.capabilities.transcriptSnapshot !== true) {
      throw new Error(`Environment "${envId}" does not support a coherent transcript snapshot`);
    }
    const snapshot = await this.api.transcriptSnapshot(session, { limit: WEB_SESSION_PAGE_SIZE }, envId);
    return {
      sessionId: session.id,
      environmentId: envId,
      messageCount: snapshot.total,
      messages: snapshot.messages,
      seq: snapshot.seq,
      pageStart: snapshot.start,
      partial: snapshot.partial,
    };
  }
}
