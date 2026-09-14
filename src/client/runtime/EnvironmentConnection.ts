import {
  CURRENT_PROTOCOL_VERSION,
  checkProtocolCompatibility,
  createProtocolError,
  missingEnvironmentCapabilities,
  type EnvironmentDescriptor,
  type EnvironmentId,
  type EnvironmentState,
  type ProtocolError,
} from "../../shared/protocol/contracts";
import { REQUIRED_ENVIRONMENT_CAPABILITIES, type EnvironmentConnectionOptions, type SessionRef, type SessionSnapshot } from "./types";

export interface SequencedEvent {
  /** Transport sequence stamped by the environment; frames without one fail open. */
  seq?: number | undefined;
  data: unknown;
  sessionId: string;
}

interface SessionSyncState {
  buffered: SequencedEvent[];
  /**
   * Open intervals for this session. A request opens its interval synchronously
   * (before it is queued), and the buffer is released only when the last one
   * finishes, so a queued reconciliation never runs behind an open buffer.
   */
  pending: number;
  lastSeq: number;
  /** Tail of the per-session reconciliation chain; serializes overlapping fetches. */
  chain: Promise<void>;
  epoch: number;
  /**
   * When true, events are buffered even when pending === 0 until the first valid
   * snapshot of the epoch rebases the watermark.
   */
  needsRebase: boolean;
}

/**
 * Connection to one environment: version/capability gate, connection state, and
 * the exactly-once interval for each session it observes.
 *
 * The interval is owned by the fetch that closes it: events arriving while a
 * snapshot is being read are buffered, the watermark advances to the snapshot's
 * sequence, the consumer installs the seed through its `applySnapshot`
 * callback, and only then are the buffered events released on top. Events
 * without a transport sequence fail open: they are forwarded in arrival order
 * instead of being dropped.
 */
export class EnvironmentConnection {
  readonly environmentId: EnvironmentId;
  private _state: EnvironmentState = "connecting";
  private _descriptor: EnvironmentDescriptor | undefined;
  private _error: ProtocolError | undefined;
  private _degraded = false;
  private _degradedReason: string | undefined;
  private readonly stateListeners = new Set<(state: EnvironmentState) => void>();
  private readonly errorListeners = new Set<(error: ProtocolError) => void>();
  private readonly sessionEventListeners = new Set<(event: SequencedEvent) => void>();
  private reconnectTimer?: ReturnType<typeof setTimeout> | undefined;
  private connectPromise: Promise<boolean> | undefined;
  private disposed = false;
  private reconnectAttempts = 0;
  private transportEpoch = 0;
  private readonly sessionSync = new Map<string, SessionSyncState>();

  constructor(private readonly options: EnvironmentConnectionOptions) {
    this.environmentId = options.environmentId;
  }

  get state(): EnvironmentState {
    return this._state;
  }

  get descriptor(): EnvironmentDescriptor | undefined {
    return this._descriptor;
  }

  get error(): ProtocolError | undefined {
    return this._error;
  }

  /** True while the link works under a minor version difference or a missing non-blocking capability. */
  get degraded(): boolean {
    return this._degraded;
  }

  get degradedReason(): string | undefined {
    return this._degradedReason;
  }

  onStateChange(listener: (state: EnvironmentState) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  onError(listener: (error: ProtocolError) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  onSessionEvent(listener: (event: SequencedEvent) => void): () => void {
    this.sessionEventListeners.add(listener);
    return () => {
      this.sessionEventListeners.delete(listener);
    };
  }

  /**
   * Probe or re-establish the environment. Concurrent callers share one probe,
   * so a reconnect that races the caller's own refresh cannot fetch the
   * descriptor twice.
   */
  connect(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (this.connectPromise !== undefined) return this.connectPromise;
    const attempt = this.performConnect().finally(() => {
      if (this.connectPromise === attempt) this.connectPromise = undefined;
    });
    this.connectPromise = attempt;
    return attempt;
  }

  private async performConnect(): Promise<boolean> {
    if (this.disposed) return false;
    // An explicit probe supersedes a scheduled retry: leaving the timer armed
    // would probe again a connection that may already be healthy.
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      delete this.reconnectTimer;
    }
    this.setState("connecting");

    try {
      const descriptor = await this.options.descriptorFetcher(this.environmentId);
      // The environment may have been removed while the descriptor was in
      // flight; a late answer must not resurrect its state or schedule retries.
      if (this.isDisposed()) return false;
      this._descriptor = descriptor;

      const clientVersion = this.options.clientVersion ?? CURRENT_PROTOCOL_VERSION;
      const compatibility = checkProtocolCompatibility(clientVersion, descriptor.protocolVersion);

      if (!compatibility.compatible) {
        if (this.isDisposed()) return false;
        const err = createProtocolError(
          "INCOMPATIBLE_VERSION",
          compatibility.reason ?? "Incompatible protocol version",
          this.environmentId,
          { clientVersion, serverVersion: descriptor.protocolVersion },
        );
        this._degraded = false;
        this._degradedReason = undefined;
        this._error = err;
        this.setState("blocked");
        this.emitError(err);
        return false;
      }

      // Capabilities gate the operations the client may offer. A missing core
      // capability is a declared degradation, not a failed connection, so the
      // environment stays usable under its reduced contract.
      if (this.isDisposed()) return false;

      const missing = missingEnvironmentCapabilities(descriptor.capabilities, REQUIRED_ENVIRONMENT_CAPABILITIES);
      const reasons: string[] = [];
      if (compatibility.degraded && compatibility.reason !== undefined) reasons.push(compatibility.reason);
      if (missing.length > 0) reasons.push(`Environment is missing capabilities: ${missing.join(", ")}`);
      this._degraded = reasons.length > 0;
      this._degradedReason = reasons.length === 0 ? undefined : reasons.join("; ");

      this._error = undefined;
      this.reconnectAttempts = 0;
      this.setState("connected");
      return true;
    } catch (err) {
      if (this.isDisposed()) return false;
      const protoErr = createProtocolError(
        "ENVIRONMENT_OFFLINE",
        err instanceof Error ? err.message : String(err),
        this.environmentId,
      );
      this._error = protoErr;
      this.setState("offline");
      this.emitError(protoErr);
      this.scheduleReconnect();
      return false;
    }
  }

  /** Read through a method so control-flow analysis cannot narrow a stale value. */
  private isDisposed(): boolean {
    return this.disposed;
  }

  private syncFor(sessionId: string): SessionSyncState {
    let s = this.sessionSync.get(sessionId);
    if (s === undefined) {
      s = {
        buffered: [],
        pending: 0,
        lastSeq: 0,
        chain: Promise.resolve(),
        epoch: this.transportEpoch,
        needsRebase: false,
      };
      this.sessionSync.set(sessionId, s);
    }
    return s;
  }

  private invalidateSessionSyncs(): void {
    this.transportEpoch += 1;
    for (const [sessionId, oldSync] of this.sessionSync) {
      oldSync.buffered = [];
      oldSync.needsRebase = true;
      this.sessionSync.set(sessionId, {
        buffered: [],
        pending: 0,
        lastSeq: 0,
        chain: Promise.resolve(),
        epoch: this.transportEpoch,
        needsRebase: true,
      });
    }
  }

  /**
   * Fetch a session's snapshot and close its interval in order: watermark, then
   * the consumer's `applySnapshot` (awaited when it is async), then the events
   * buffered during the fetch. A failed fetch ends the interval too, so a
   * session never freezes on a buffer nobody closes.
   */
  fetchSessionSnapshotWithReconciliation(
    session: SessionRef,
    applySnapshot?: (snapshot: SessionSnapshot, isCurrent: () => boolean) => void | Promise<void>,
  ): Promise<SessionSnapshot | undefined> {
    const sync = this.syncFor(session.id);
    // The interval opens now, not when the queued fetch starts: an event that
    // races the request must still wait for the seed. Overlapping fetches would
    // each release the buffer and could install an older seed over newer
    // released events, so the chain keeps one reconciliation at a time.
    sync.pending += 1;
    const run = sync.chain.then(() => this.reconcileSessionSnapshot(sync, session, applySnapshot));
    sync.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  private async reconcileSessionSnapshot(
    sync: SessionSyncState,
    session: SessionRef,
    applySnapshot?: (snapshot: SessionSnapshot, isCurrent: () => boolean) => void | Promise<void>,
  ): Promise<SessionSnapshot | undefined> {
    if (this._state !== "connected") {
      this.closeInterval(session.id, sync);
      const message = this._error?.message ?? `Environment "${this.environmentId}" is ${this._state}`;
      throw new Error(message);
    }
    if (!this.options.sessionSnapshotFetcher) {
      this.closeInterval(session.id, sync);
      throw new Error(`Environment "${this.environmentId}" has no snapshot fetcher`);
    }
    try {
      const snapshot = await this.options.sessionSnapshotFetcher(this.environmentId, session);

      const isCurrent = () => this.sessionSync.get(session.id) === sync && !this.disposed;

      // Discard if this sync state was superseded by a transport loss / new epoch
      // while the fetch was in flight.
      if (!isCurrent()) {
        return undefined;
      }

      if (sync.needsRebase) {
        // First valid snapshot of a new epoch (reconnect / server restart).
        // Apply the seed while the buffer is still held closed by needsRebase:
        if (applySnapshot !== undefined) await applySnapshot(snapshot, isCurrent);
        if (!isCurrent()) return undefined;

        // Commit watermark and clear needsRebase only after successful install:
        sync.lastSeq = snapshot.seq;
        sync.needsRebase = false;
        return snapshot;
      }

      // Within the same steady-state epoch:
      // A snapshot older than events already delivered is stale (racing responses).
      // Do not regress the watermark or apply the stale snapshot.
      if (snapshot.seq < sync.lastSeq) {
        return undefined;
      }

      if (applySnapshot !== undefined) await applySnapshot(snapshot, isCurrent);
      if (!isCurrent()) return undefined;

      sync.lastSeq = snapshot.seq;
      return snapshot;
    } finally {
      this.closeInterval(session.id, sync);
    }
  }

  private closeInterval(sessionId: string, sync: SessionSyncState): void {
    sync.pending = Math.max(0, sync.pending - 1);
    // Only the active, non-orphaned sync for this session releases its buffer.
    if (this.sessionSync.get(sessionId) === sync && sync.pending === 0 && !sync.needsRebase) {
      this.releaseBuffered(sync);
    }
  }

  receiveLiveEvent(sequencedEvent: SequencedEvent): void {
    const sync = this.syncFor(sequencedEvent.sessionId);
    if (sync.pending > 0 || sync.needsRebase) {
      sync.buffered.push(sequencedEvent);
      return;
    }
    this.deliver(sync, sequencedEvent);
  }

  markOffline(message = "Environment disconnected"): void {
    const err = createProtocolError("ENVIRONMENT_OFFLINE", message, this.environmentId);
    this._error = err;
    this.invalidateSessionSyncs();
    this.setState("offline");
    this.emitError(err);
    this.scheduleReconnect();
  }

  /**
   * State-only offline report from a session transport loss. The transport owns
   * its retry loop, so this connection schedules no second one; the caller
   * re-probes it through {@link probe} when the transport reopens.
   */
  reportTransportLoss(message: string): void {
    const err = createProtocolError("ENVIRONMENT_OFFLINE", message, this.environmentId);
    this._error = err;
    this.invalidateSessionSyncs();
    this.setState("offline");
    this.emitError(err);
  }

  /**
   * Stop background work without losing state: a suspended connection keeps
   * its descriptor, projections, and listeners, so a client surface that is
   * detached and re-attached resumes instead of reconnecting from scratch.
   */
  suspend(): void {
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      delete this.reconnectTimer;
    }
  }

  /** Re-probe version and capabilities after the transport reconnected. */
  probe(): void {
    if (this.disposed || this._state === "blocked") return;
    void this.connect();
  }

  private releaseBuffered(sync: SessionSyncState): void {
    const buffered = sync.buffered;
    sync.buffered = [];
    for (const event of buffered) this.deliver(sync, event);
  }

  private deliver(sync: SessionSyncState, event: SequencedEvent): void {
    if (event.seq !== undefined) {
      if (event.seq <= sync.lastSeq) return;
      sync.lastSeq = event.seq;
    }
    for (const listener of this.sessionEventListeners) {
      listener(event);
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || this._state === "blocked") return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    // Exponential backoff: 500ms, 1s, 2s, capped at 8s
    const delay = Math.min(500 * Math.pow(2, this.reconnectAttempts), 8000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, delay);
  }

  disconnect(): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      delete this.reconnectTimer;
    }
    this.setState("offline");
    this.stateListeners.clear();
    this.errorListeners.clear();
    this.sessionEventListeners.clear();
    this.sessionSync.clear();
  }

  private setState(next: EnvironmentState): void {
    if (this._state === next) return;
    this._state = next;
    for (const listener of this.stateListeners) {
      listener(next);
    }
  }

  private emitError(err: ProtocolError): void {
    for (const listener of this.errorListeners) {
      listener(err);
    }
  }
}
