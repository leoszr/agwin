import { api, type Machine, type MachineHealth, type MachineRuntime } from "../api";
import { resetWorkspaceScopedState } from "../appState";
import type { WebEnvironmentStatus } from "../controlSurface/webEnvironmentRuntime";
import { BrowserErrorReporter, machineBrowserErrorScope } from "../browserErrors";
import type { GetState, NavigationDestinationOptions, NavigationSelection, SetState, UpdateUrl } from "./types";
import type { ProjectController } from "./projectController";

/**
 * Client runtime surface the controller drives: catalog loading plus the
 * per-environment connection state the navigation renders. Injectable so tests
 * can supply projections without a gateway.
 */
export interface MachineEnvironmentRuntime {
  refreshCatalog(): Promise<Machine[]>;
  connectEnvironment(machineId: string): Promise<void>;
  removeEnvironment(machineId: string): void;
  getStatus(machineId: string): WebEnvironmentStatus;
  statuses(): Record<string, WebEnvironmentStatus>;
  onStatusChange(listener: (status: WebEnvironmentStatus) => void): () => void;
}

export interface MachineControllerDependencies {
  navigateToMachine?: (machine: Machine, options?: NavigationDestinationOptions) => Promise<boolean>;
  captureNavigation?: () => NavigationSelection;
  environmentRuntime?: MachineEnvironmentRuntime;
}

export class MachineController {
  private readonly runtimeRefreshSeqByMachine = new Map<string, number>();
  private readonly navigateToMachine: MachineControllerDependencies["navigateToMachine"];
  private readonly captureNavigation: MachineControllerDependencies["captureNavigation"];
  private readonly environmentRuntime: MachineEnvironmentRuntime | undefined;
  private readonly browserErrors: BrowserErrorReporter;

  constructor(
    private readonly getState: GetState,
    private readonly setState: SetState,
    private readonly updateUrl: UpdateUrl,
    private readonly projects: Pick<ProjectController, "loadProjects">,
    deps: MachineControllerDependencies = {},
  ) {
    this.navigateToMachine = deps.navigateToMachine;
    this.captureNavigation = deps.captureNavigation;
    this.environmentRuntime = deps.environmentRuntime;
    this.browserErrors = new BrowserErrorReporter(getState, setState);
    // Connection state changes on its own schedule (reconnects, protocol
    // blocking), so the navigation renders it as soon as it changes.
    this.environmentRuntime?.onStatusChange(() => { this.syncEnvironmentStatuses(); });
  }

  async loadMachines(routeMachineId?: string): Promise<void> {
    this.setState({ error: "", isLoadingMachines: true });
    try {
      const machines = this.environmentRuntime === undefined ? await api.machines() : await this.environmentRuntime.refreshCatalog();
      const selectedMachine = await this.selectInitialMachine(machines, routeMachineId);
      const machineIds = new Set(machines.map((machine) => machine.id));
      for (const error of Object.values(this.getState().browserErrors)) {
        if (error.scope.kind !== "global" && !machineIds.has(error.scope.machineId)) this.browserErrors.discard(machineBrowserErrorScope(error.scope.machineId));
      }
      this.setState({
        machines,
        selectedMachine,
        machineRuntimes: filterKeys(this.getState().machineRuntimes, machineIds),
        machineStatusSnapshots: filterKeys(this.getState().machineStatusSnapshots, machineIds),
      });
      this.syncEnvironmentStatuses();
      void this.refreshMachineHealthFor(machines);
      void this.refreshMachineRuntimeFor(machines);
    } catch (error) {
      this.setState({ error: String(error) });
    } finally {
      this.setState({ isLoadingMachines: false });
    }
  }

  async selectMachine(machine: Machine, options: { updateUrl?: boolean | undefined } = {}): Promise<void> {
    if (this.getState().selectedMachine?.id === machine.id) return;
    await this.connectEnvironment(machine.id);
    const environmentStatus = this.environmentRuntime?.getStatus(machine.id);
    if (environmentStatus?.state === "blocked") {
      this.browserErrors.report(machineBrowserErrorScope(machine.id), blockedEnvironmentMessage(machine, environmentStatus));
      return;
    }
    this.setState({
      selectedMachine: machine,
      projects: [],
      workspaces: [],
      isLoadingWorkspaces: false,
      selectedProject: undefined,
      selectedWorkspace: undefined,
      selectedSession: undefined,
      messages: [],
      messagePageStart: 0,
      messagePageTotal: 0,
      status: undefined,
      activity: undefined,
      sessionStatuses: {},
      sessionActivities: {},
      sendingPrompts: {},
      workspacesByProjectId: {},
      workspaceDeletionRuns: {},
      ...resetWorkspaceScopedState(),
    });
    if (options.updateUrl !== false) this.updateUrl();
    await this.projects.loadProjects();
    void this.refreshMachineHealth(machine.id);
    void this.refreshMachineRuntime(machine.id);
  }

  async addMachine(input: { name: string; baseUrl: string; token?: string }): Promise<Machine | undefined> {
    const expected = navigationSelection(this.getState(), this.captureNavigation);
    this.setState({ error: "" });
    try {
      const machine = await api.addMachine(input);
      this.setState({ machines: [...this.getState().machines.filter((candidate) => candidate.id !== machine.id), machine] });
      // Register the new environment with the runtime before selecting it, so
      // its connection and status exist even if navigation does not open it.
      await this.connectEnvironment(machine.id);
      if (this.navigateToMachine !== undefined) await this.navigateToMachine(machine, { expected });
      else await this.selectMachine(machine);
      return machine;
    } catch (error) {
      this.setState({ error: String(error) });
      return undefined;
    }
  }

  async deleteMachine(machine: Machine | undefined = this.getState().selectedMachine, options: { selectFallback?: boolean } = {}): Promise<Machine | undefined> {
    if (machine === undefined) return undefined;
    if (machine.kind === "local") {
      this.browserErrors.report(machineBrowserErrorScope(machine.id), "The local machine cannot be removed.");
      return undefined;
    }
    try {
      await api.deleteMachine(machine.id);
      // Drop the environment's connection, reconnect timer, and projection
      // before it can resurface through the runtime's status list.
      this.environmentRuntime?.removeEnvironment(machine.id);
      const machines = this.getState().machines.filter((candidate) => candidate.id !== machine.id);
      const local = this.usableMachine(machines);
      this.browserErrors.discard(machineBrowserErrorScope(machine.id));
      this.setState({ machines, machineStatuses: omitKey(this.getState().machineStatuses, machine.id), machineRuntimes: omitKey(this.getState().machineRuntimes, machine.id), machineStatusSnapshots: omitKey(this.getState().machineStatusSnapshots, machine.id), environmentStatuses: omitKey(this.getState().environmentStatuses, machine.id) });
      if (this.getState().selectedMachine?.id === machine.id && local !== undefined) {
        if (options.selectFallback === false) return local;
        const expected = navigationSelection(this.getState(), this.captureNavigation);
        if (this.navigateToMachine !== undefined) await this.navigateToMachine(local, { expected });
        else await this.selectMachine(local);
        return local;
      }
      if (this.getState().selectedMachine?.id === machine.id) {
        // No usable fallback (every remaining environment is blocked): leave
        // nothing selected instead of pointing at a machine that no longer exists.
        this.setState({ selectedMachine: undefined, ...resetWorkspaceScopedState() });
      }
      return undefined;
    } catch (error) {
      this.browserErrors.report(machineBrowserErrorScope(machine.id), String(error));
      return undefined;
    }
  }

  async refreshMachineHealth(machineId = this.getState().selectedMachine?.id ?? "local"): Promise<MachineHealth | undefined> {
    try {
      const health = await api.health(machineId);
      this.setState({ machineStatuses: { ...this.getState().machineStatuses, [health.machineId]: health } });
      return health;
    } catch (error) {
      this.browserErrors.report(machineBrowserErrorScope(machineId), String(error));
      return undefined;
    }
  }

  async refreshMachineRuntime(machineId = this.getState().selectedMachine?.id ?? "local"): Promise<MachineRuntime | undefined> {
    const seq = (this.runtimeRefreshSeqByMachine.get(machineId) ?? 0) + 1;
    this.runtimeRefreshSeqByMachine.set(machineId, seq);
    try {
      const runtime = await api.runtime(machineId, true);
      if (this.runtimeRefreshSeqByMachine.get(machineId) !== seq) return undefined;
      this.setState({ machineRuntimes: { ...this.getState().machineRuntimes, [runtime.machineId]: runtime } });
      return runtime;
    } catch (error) {
      if (this.runtimeRefreshSeqByMachine.get(machineId) === seq) this.browserErrors.report(machineBrowserErrorScope(machineId), String(error));
      return undefined;
    }
  }

  private async selectInitialMachine(machines: Machine[], routeMachineId?: string): Promise<Machine | undefined> {
    const targetId = routeMachineId ?? "local";
    const requestedMachine = machines.find((machine) => machine.id === targetId);
    const candidates = requestedMachine !== undefined
      ? [requestedMachine, ...machines.filter((m) => m.id !== requestedMachine.id)]
      : machines;

    for (const candidate of candidates) {
      await this.connectEnvironment(candidate.id);
      const status = this.environmentRuntime?.getStatus(candidate.id);
      if (status?.state === "blocked") {
        this.browserErrors.report(machineBrowserErrorScope(candidate.id), blockedEnvironmentMessage(candidate, status));
        continue;
      }
      if (candidate.kind !== "remote") return candidate;
      const health = await this.safeRemoteHealth(candidate);
      this.setState({ machineStatuses: { ...this.getState().machineStatuses, [health.machineId]: health } });
      if (!health.ok) this.browserErrors.report(machineBrowserErrorScope(candidate.id), `${candidate.name} is unavailable; reconnecting…`);
      return candidate;
    }
    return undefined;
  }

  private async safeRemoteHealth(machine: Machine): Promise<MachineHealth> {
    try {
      return await api.health(machine.id);
    } catch (error) {
      return {
        machineId: machine.id,
        ok: false,
        checkedAt: new Date().toISOString(),
        status: "offline",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async connectEnvironment(machineId: string): Promise<void> {
    if (this.environmentRuntime === undefined) return;
    try {
      await this.environmentRuntime.connectEnvironment(machineId);
    } catch {
      // A machine that cannot be reached yet still exists in the catalog; the
      // runtime reports the offline status and retries on its own schedule.
    } finally {
      this.syncEnvironmentStatuses();
    }
  }

  /**
   * First machine a blocked-environment fallback may use: local is preferred
   * only when the runtime does not already know it is protocol-blocked.
   */
  private usableMachine(machines: Machine[]): Machine | undefined {
    const local = machines.find((machine) => machine.id === "local");
    if (local !== undefined && this.environmentRuntime?.getStatus(local.id).state !== "blocked") return local;
    return machines.find((machine) => this.environmentRuntime?.getStatus(machine.id).state !== "blocked");
  }

  private syncEnvironmentStatuses(): void {
    if (this.environmentRuntime === undefined) return;
    this.setState({ environmentStatuses: this.environmentRuntime.statuses() });
  }

  private async refreshMachineHealthFor(machines: Machine[]): Promise<void> {
    const results = await Promise.allSettled(machines.map((machine) => api.health(machine.id)));
    const health = Object.fromEntries(results.flatMap((result) => result.status === "fulfilled" ? [[result.value.machineId, result.value] as const] : []));
    if (Object.keys(health).length > 0) this.setState({ machineStatuses: { ...this.getState().machineStatuses, ...health } });
  }

  private async refreshMachineRuntimeFor(machines: Machine[]): Promise<void> {
    const results = await Promise.allSettled(machines.map((machine) => api.runtime(machine.id)));
    const runtimes = Object.fromEntries(results.flatMap((result) => result.status === "fulfilled" ? [[result.value.machineId, result.value] as const] : []));
    if (Object.keys(runtimes).length > 0) this.setState({ machineRuntimes: { ...this.getState().machineRuntimes, ...runtimes } });
  }
}

function blockedEnvironmentMessage(machine: Machine, status: WebEnvironmentStatus): string {
  const detail = status.error?.message ?? "the protocol version is not supported";
  return `${machine.name} is incompatible with this client: ${detail}`;
}

function omitKey<T>(record: Record<string, T>, keyToOmit: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== keyToOmit));
}

function filterKeys<T>(record: Record<string, T>, allowedKeys: Set<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => allowedKeys.has(key)));
}

function navigationSelection(state: ReturnType<GetState>, captureNavigation?: () => NavigationSelection): NavigationSelection {
  return captureNavigation?.() ?? {
    machineId: state.selectedMachine?.id ?? "local",
    projectId: state.selectedProject?.id,
    workspaceId: state.selectedWorkspace?.id,
    ...(state.selectedSession === undefined || Reflect.get(state.selectedSession, "clientPendingStart") !== true ? { sessionId: state.selectedSession?.id } : {}),
  };
}
