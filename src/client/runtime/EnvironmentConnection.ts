import {
  CURRENT_PROTOCOL_VERSION,
  checkProtocolCompatibility,
  createProtocolError,
  type EnvironmentDescriptor,
  type EnvironmentId,
  type EnvironmentState,
  type ProtocolError,
} from "../../shared/protocol/contracts";
import type { EnvironmentConnectionOptions, SessionSnapshot } from "./types";

export interface SequencedEvent {
  seq: number;
  data: unknown;
  sessionId: string;
}

interface SessionSyncState {
  buffered: SequencedEvent[];
  pending: boolean;
  lastSeq: number;
}

export class EnvironmentConnection {
  readonly environmentId: EnvironmentId;
  private _state: EnvironmentState = "connecting";
  private _descriptor: EnvironmentDescriptor | undefined;
  private _error: ProtocolError | undefined;
  private readonly stateListeners = new Set<(state: EnvironmentState) => void>();
  private readonly errorListeners = new Set<(error: ProtocolError) => void>();
  private readonly sessionEventListeners = new Set<(event: SequencedEvent) => void>();
  private reconnectTimer?: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private reconnectAttempts = 0;
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

  async connect(): Promise<boolean> {
    if (this.disposed) return false;
    this.setState("connecting");

    try {
      const descriptor = await this.options.descriptorFetcher(this.environmentId);
      this._descriptor = descriptor;

      const clientVersion = this.options.clientVersion ?? CURRENT_PROTOCOL_VERSION;
      const compatibility = checkProtocolCompatibility(clientVersion, descriptor.protocolVersion);

      if (!compatibility.compatible) {
        const err = createProtocolError(
          "INCOMPATIBLE_VERSION",
          compatibility.reason ?? "Incompatible protocol version",
          this.environmentId,
          { clientVersion, serverVersion: descriptor.protocolVersion },
        );
        this._error = err;
        this.setState("blocked");
        this.emitError(err);
        return false;
      }

      this._error = undefined;
      this.reconnectAttempts = 0;
      this.setState("connected");
      return true;
    } catch (err) {
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

  private syncFor(sessionId: string): SessionSyncState {
    let s = this.sessionSync.get(sessionId);
    if (s === undefined) {
      s = { buffered: [], pending: false, lastSeq: 0 };
      this.sessionSync.set(sessionId, s);
    }
    return s;
  }

  async fetchSessionSnapshotWithReconciliation(sessionId: string): Promise<SessionSnapshot | undefined> {
    if (this._state !== "connected" || !this.options.sessionSnapshotFetcher) return undefined;

    const sync = this.syncFor(sessionId);
    sync.pending = true;
    sync.buffered.length = 0; // reset buffer for this session only

    try {
      const snapshot = await this.options.sessionSnapshotFetcher(this.environmentId, sessionId);
      sync.lastSeq = snapshot.seq;

      // Reconcile buffered events: apply only events whose seq > snapshot.seq
      // and whose sessionId matches this snapshot (per-session isolation).
      const pendingEvents = [...sync.buffered];
      sync.buffered.length = 0;
      sync.pending = false;

      for (const ev of pendingEvents) {
        if (ev.sessionId !== sessionId) continue;
        if (ev.seq > sync.lastSeq) {
          sync.lastSeq = ev.seq;
          snapshot.messages.push(ev.data);
          snapshot.seq = ev.seq;
          snapshot.messageCount++;
        }
      }

      return snapshot;
    } catch (err) {
      sync.pending = false;
      throw err;
    }
  }

  receiveLiveEvent(sequencedEvent: SequencedEvent): void {
    const sync = this.syncFor(sequencedEvent.sessionId);
    if (sync.pending) {
      sync.buffered.push(sequencedEvent);
      return;
    }

    if (sequencedEvent.seq > sync.lastSeq) {
      sync.lastSeq = sequencedEvent.seq;
      for (const listener of this.sessionEventListeners) {
        listener(sequencedEvent);
      }
    }
  }

  emitSessionEvent(event: SequencedEvent): void {
    for (const listener of this.sessionEventListeners) {
      listener(event);
    }
  }

  markOffline(message = "Environment disconnected"): void {
    const err = createProtocolError("ENVIRONMENT_OFFLINE", message, this.environmentId);
    this._error = err;
    this.setState("offline");
    this.emitError(err);
    this.scheduleReconnect();
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
