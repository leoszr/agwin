import type { SessionRef } from "../api";
import type { SessionEventSocket } from "../controllers/sessionController";
import { parseSessionSocketEvent, SessionSocket, type SessionUiEvent } from "../sessionSocket";
import type { WebEnvironmentRuntime } from "./webEnvironmentRuntime";

/**
 * Session subscription for the real Web client: live frames pass through the
 * client runtime's exactly-once gate before reaching the transcript controller,
 * a blocked environment is never subscribed, and an unexpected transport drop
 * is reported to the runtime as a state signal (the transport retries itself).
 */
export class RuntimeSessionSocket implements SessionEventSocket {
  private handler: ((event: SessionUiEvent) => void) | undefined;
  private unsubscribe: (() => void) | undefined;

  constructor(
    private readonly environment: WebEnvironmentRuntime,
    private readonly socket: SessionEventSocket = new SessionSocket(),
  ) {}

  connect(
    session: SessionRef,
    onEvent: (event: SessionUiEvent) => void,
    onReconnect?: () => void,
    machineId = "local",
    onInitialOpen?: () => void,
    onDisconnect?: (reason: string) => void,
  ): void {
    this.close();
    this.handler = onEvent;

    // A blocked environment offers no session operations, so it gets no
    // subscription; the caller surfaces the protocol error instead.
    if (this.environment.getStatus(machineId).state === "blocked") return;

    this.unsubscribe = this.environment.subscribeSessionEvents(machineId, session.id, (event) => {
      // The runtime carries events opaquely; validate them at this transport
      // boundary so the controller only ever sees session stream vocabulary.
      const parsed = parseSessionSocketEvent(event);
      if (parsed !== undefined) this.handler?.(parsed);
    });

    const recover = (): void => {
      if (this.environment.getStatus(machineId).state !== "connected") this.environment.probeEnvironment(machineId);
    };
    this.socket.connect(
      session,
      (event) => {
        this.environment.ingestSessionEvent(machineId, session.id, event, event.seq);
      },
      () => {
        recover();
        onReconnect?.();
      },
      machineId,
      () => {
        recover();
        onInitialOpen?.();
      },
      (reason) => {
        this.environment.reportTransportLoss(machineId, reason);
        onDisconnect?.(reason);
      },
    );
  }

  setHandler(onEvent: (event: SessionUiEvent) => void): void {
    this.handler = onEvent;
  }

  close(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.handler = undefined;
    this.socket.close();
  }
}
