// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Machine } from "../api";
import { initialAppState } from "../appState";
import { browserErrorScopeKey, machineBrowserErrorScope } from "../browserErrors";
import { MachineController, type MachineEnvironmentRuntime } from "../controllers/machineController";
import type { EnvironmentDescriptor } from "../../../shared/protocol/contracts";
import { CURRENT_PROTOCOL_VERSION } from "../../../shared/protocol/contracts";
import { WebEnvironmentRuntime, type WebEnvironmentRuntimeApi, type WebEnvironmentStatus } from "../controlSurface/webEnvironmentRuntime";
import { PiWebApp } from "./PiWebApp";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("PiWebApp environment runtime wiring", () => {
  it("detaches the environment runtime reversibly instead of disposing it", () => {
    const app = createApp();
    const environments = appEnvironmentRuntime(app);
    const detach = vi.spyOn(environments, "detach");
    const dispose = vi.spyOn(environments, "dispose");

    document.body.append(app);
    app.remove();

    // The element can be re-attached, so disconnect must be reversible.
    expect(detach).toHaveBeenCalledOnce();
    expect(dispose).not.toHaveBeenCalled();
  });

  it("keeps the runtime and its status listener working after a re-append", async () => {
    const app = createApp();
    const environments = appEnvironmentRuntime(app);
    if (!Reflect.set(environments, "api", fakeEnvironmentApi())) throw new Error("Could not inject the environment api");

    document.body.append(app);
    app.remove();
    document.body.append(app);

    environments.removeEnvironment("local");
    await environments.refreshCatalog();

    expect(environments.getStatus("local").state).toBe("connected");
    // The machine controller's status listener registered before the detach is
    // still wired, so the app state follows the reconnected projection.
    expect(appState(app).environmentStatuses["local"]).toMatchObject({ state: "connected" });
    app.remove();
  });

  it("does not treat an unselected blocked local machine as an already restored route", async () => {
    const app = createApp();
    const localBlocked: Machine = { id: "local", name: "Local", kind: "local", createdAt: "now", updatedAt: "now" };
    setAppState(app, { ...initialAppState(), machines: [localBlocked] });
    installMachineController(app, blockedEnvironmentRuntime(localBlocked.id));

    await callAsyncAppMethod(app, "restoreRouteFor", { machineId: localBlocked.id }, false, {});

    const scope = machineBrowserErrorScope(localBlocked.id);
    expect(appState(app).browserErrors[browserErrorScopeKey(scope)]?.message).toContain("incompatible with this client");
    expect(appState(app).selectedMachine).toBeUndefined();
  });

  it("drops the previously selected machine when the URL target is blocked", async () => {
    const app = createApp();
    const previous: Machine = { id: "local", name: "Local", kind: "local", createdAt: "now", updatedAt: "now" };
    const blocked: Machine = { id: "blocked-1", name: "Blocked", kind: "remote", baseUrl: "https://blocked.example.test", createdAt: "now", updatedAt: "now" };
    const project = { id: "project-1", name: "Project", path: "/repo", createdAt: "now" };
    setAppState(app, {
      ...initialAppState(),
      machines: [previous, blocked],
      selectedMachine: previous,
      projects: [project],
      selectedProject: project,
    });
    installMachineController(app, blockedEnvironmentRuntime(blocked.id));

    await callAsyncAppMethod(app, "restoreRouteFor", { machineId: blocked.id, projectId: project.id }, false, {});

    expect(appState(app).selectedMachine).toBeUndefined();
    expect(appState(app).selectedProject).toBeUndefined();
  });

  it("keeps the protocol diagnostic when a URL targets a blocked machine", async () => {
    const app = createApp();
    const blocked: Machine = { id: "blocked-1", name: "Blocked Remote", kind: "remote", baseUrl: "https://blocked.example.test", createdAt: "now", updatedAt: "now" };
    setAppState(app, { ...initialAppState(), machines: [blocked] });
    installMachineController(app, blockedEnvironmentRuntime(blocked.id));

    await callAsyncAppMethod(app, "restoreRouteFor", { machineId: blocked.id }, false, {});

    const scope = machineBrowserErrorScope(blocked.id);
    const message = appState(app).browserErrors[browserErrorScopeKey(scope)]?.message ?? "";
    expect(message).toContain("incompatible with this client");
    expect(message).not.toContain("Machine not found");
    expect(appState(app).selectedMachine).toBeUndefined();
  });
});

/** The app boots real sockets, fetches, and timers; this test needs only the lifecycle. */
function createApp(): PiWebApp {
  const app = new PiWebApp();
  for (const method of [
    "connectRealtime",
    "syncSessionUnreadMachines",
    "scheduleSelectedSessionRefresh",
    "loadClientConfig",
    "ensureGatewayPluginsLoaded",
    "loadProjectsAndRestoreRoute",
    "schedulePiWebStatusRefresh",
  ]) {
    if (!Reflect.set(app, method, () => Promise.resolve())) throw new Error(`Could not stub PiWebApp.${method}`);
  }
  return app;
}

function appEnvironmentRuntime(app: PiWebApp): WebEnvironmentRuntime {
  const environments: unknown = Reflect.get(app, "environments");
  if (!(environments instanceof WebEnvironmentRuntime)) throw new Error("Missing WebEnvironmentRuntime");
  return environments;
}

function setAppState(app: PiWebApp, state: ReturnType<typeof initialAppState>): void {
  if (!Reflect.set(app, "state", state)) throw new Error("Could not set PiWebApp state");
}

function appState(app: PiWebApp): ReturnType<typeof initialAppState> {
  const state: unknown = Reflect.get(app, "state");
  if (!isAppState(state)) throw new Error("PiWebApp state was unavailable");
  return state;
}

function isAppState(value: unknown): value is ReturnType<typeof initialAppState> {
  return typeof value === "object" && value !== null && "browserErrors" in value && "machines" in value;
}

async function callAsyncAppMethod(app: PiWebApp, name: string, ...args: unknown[]): Promise<void> {
  const method: unknown = Reflect.get(app, name);
  if (typeof method !== "function") throw new Error(`PiWebApp.${name} is not callable`);
  const result: unknown = Reflect.apply(method, app, args);
  if (result instanceof Promise) await result;
}

function installMachineController(app: PiWebApp, environmentRuntime: MachineEnvironmentRuntime): void {
  const controller = new MachineController(
    () => appState(app),
    (patch) => { setAppState(app, { ...appState(app), ...patch }); },
    () => undefined,
    { loadProjects: () => Promise.resolve() },
    { environmentRuntime },
  );
  if (!Reflect.set(app, "machines", controller)) throw new Error("Could not replace the machine controller");
}

function fakeEnvironmentApi(): WebEnvironmentRuntimeApi {
  const machine: Machine = { id: "local", name: "Local", kind: "local", createdAt: "now", updatedAt: "now" };
  const descriptor: EnvironmentDescriptor = {
    id: "local",
    name: "Local",
    kind: "local",
    protocolVersion: CURRENT_PROTOCOL_VERSION,
    capabilities: { streaming: true, replayCursor: true, transcriptSnapshot: true },
    status: "connected",
  };
  const page = { messages: [], start: 0, total: 0 };
  return {
    machines: () => Promise.resolve([machine]),
    descriptor: () => Promise.resolve(descriptor),
    messages: () => Promise.resolve(page),
    streamSnapshot: () => Promise.resolve({ seq: 0, partial: null }),
    transcriptSnapshot: () => Promise.resolve({ seq: 0, partial: null, ...page }),
  };
}

function blockedEnvironmentRuntime(machineId: string): MachineEnvironmentRuntime {
  const status: WebEnvironmentStatus = {
    environmentId: machineId,
    state: "blocked",
    degraded: false,
    error: { code: "INCOMPATIBLE_VERSION", message: "Major version mismatch: client is 1.0, server is 99.0" },
  };
  return {
    refreshCatalog: () => Promise.resolve([]),
    connectEnvironment: () => Promise.resolve(),
    removeEnvironment: () => undefined,
    getStatus: (id) => (id === machineId ? status : { environmentId: id, state: "connected", degraded: false }),
    statuses: () => ({ [machineId]: status }),
    onStatusChange: () => () => undefined,
  };
}
