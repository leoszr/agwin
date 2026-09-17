// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DockviewWorkbench } from "./DockviewWorkbench";
import { TerminalDockviewPanel, type TerminalPanelRender } from "./TerminalDockviewPanel";
import { WorkbenchPanelRegistry } from "./panelRegistry";
import type { WorkspacePanelContext } from "../src/plugins/types";
import type { WorkspaceContext } from "./types";

function fakePanelContext(workspaceId: string): WorkspacePanelContext {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal structural double; the renderer under test receives it opaquely.
  return {
    environmentId: "local",
    workspaceId,
    cwd: `/home/user/${workspaceId}`,
  } as unknown as WorkspacePanelContext;
}
describe("TerminalDockviewPanel plugin host (Ticket 25)", () => {
  let wsA: WorkspaceContext;
  let wsB: WorkspaceContext;

  afterEach(() => {
    document.body.replaceChildren();
  });

  beforeEach(() => {
    wsA = { environmentId: "local", workspaceId: "ws-a", cwd: "/home/user/project-a" };
    wsB = { environmentId: "local", workspaceId: "ws-b", cwd: "/home/user/project-b" };
  });

  it("is always born pinned to the chosen workspace and rejects following mode", () => {
    const registry = new WorkbenchPanelRegistry();
    const termPanel = new TerminalDockviewPanel({ id: "term-1", context: wsA });

    expect(termPanel.state.mode).toBe("pinned");
    expect(termPanel.state.context.workspaceId).toBe("ws-a");

    registry.registerPanel(termPanel.state);

    // Attempting to set Terminal to following mode must be strictly rejected
    const allowed = registry.setPanelMode("term-1", "following");
    expect(allowed).toBe(false);
    expect(termPanel.state.mode).toBe("pinned");

    registry.setActiveWorkspace(wsB);
    expect(termPanel.state.context.workspaceId).toBe("ws-a");
  });

  it("renders the plugin-owned terminal content with the panel context", () => {
    const renderPanel = vi.fn((container: HTMLElement) => {
      const marker = document.createElement("p");
      marker.textContent = "Terminal";
      container.appendChild(marker);
    });
    const panelContext = fakePanelContext("ws-a");
    const termPanel = new TerminalDockviewPanel({ id: "term-2", context: wsA, panelContext, renderPanel });

    const container = document.createElement("div");
    document.body.appendChild(container);
    termPanel.init(container);

    expect(renderPanel).toHaveBeenCalledTimes(1);
    expect(renderPanel).toHaveBeenCalledWith(container, panelContext);
    expect(container.textContent).toContain("Terminal");
  });

  it("degrades to a generic placeholder when the plugin renderer is unavailable", () => {
    const withoutRender = new TerminalDockviewPanel({ id: "term-3", context: wsA, panelContext: fakePanelContext("ws-a") });
    const container = document.createElement("div");
    document.body.appendChild(container);
    withoutRender.init(container);
    expect(container.querySelector(".terminal-panel-unavailable")).not.toBeNull();

    const withoutContext: TerminalPanelRender = () => {
      throw new Error("renderer must not run without a panel context");
    };
    const orphan = new TerminalDockviewPanel({ id: "term-4", context: wsA, renderPanel: withoutContext });
    const orphanContainer = document.createElement("div");
    document.body.appendChild(orphanContainer);
    orphan.init(orphanContainer);
    expect(orphanContainer.querySelector(".terminal-panel-unavailable")).not.toBeNull();
  });

  it("never retargets its workspace on setContext", () => {
    const termPanel = new TerminalDockviewPanel({ id: "term-5", context: wsA });
    termPanel.setContext(wsB);
    expect(termPanel.state.context.workspaceId).toBe("ws-a");
    expect(termPanel.state.mode).toBe("pinned");
  });

  it("focuses hosted content and cleans up on dispose", () => {
    const termPanel = new TerminalDockviewPanel({
      id: "term-6",
      context: wsA,
      panelContext: fakePanelContext("ws-a"),
      renderPanel: (container) => {
        const input = document.createElement("input");
        container.appendChild(input);
      },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    termPanel.init(container);

    termPanel.focus();
    expect(document.activeElement?.tagName).toBe("INPUT");

    termPanel.setFloating(true);
    expect(termPanel.getIsFloating()).toBe(true);
    termPanel.setPopout(true);
    expect(termPanel.getIsPopout()).toBe(true);

    termPanel.dispose();
    expect(container.innerHTML).toBe("");
  });

  it("restores terminal panels from a saved layout with the injected renderer", () => {
    const hostContainer = document.createElement("div");
    document.body.appendChild(hostContainer);

    const workbench = new DockviewWorkbench({ container: hostContainer, initialContext: wsA });
    const renderPanel = vi.fn((container: HTMLElement) => {
      container.textContent = "Terminal";
    });
    const termPanel = workbench.addTerminalPanel({
      id: "term-dockview-1",
      panelContext: fakePanelContext("ws-a"),
      renderPanel,
    });

    expect(termPanel.state.type).toBe("terminal");
    expect(termPanel.state.mode).toBe("pinned");
    expect(workbench.registry.getPanelInstance("term-dockview-1")).toBe(termPanel);

    workbench.setWorkspace(wsB);
    expect(termPanel.state.context.workspaceId).toBe("ws-a");

    const savedLayout = workbench.saveLayout();
    expect(savedLayout.panels.find((p) => p.id === "term-dockview-1")?.type).toBe("terminal");
    workbench.dispose();

    const restored = new DockviewWorkbench({ container: hostContainer, initialContext: wsA });
    expect(restored.restoreSavedLayout({
      terminalPanelContext: fakePanelContext("ws-a"),
      renderTerminalPanel: renderPanel,
    })).toBe(true);
    const revived = restored.registry.getPanelInstance("term-dockview-1");
    if (!(revived instanceof TerminalDockviewPanel)) throw new Error("Restored terminal panel is not a live instance");
    expect(revived.state.context.workspaceId).toBe("ws-a");
    expect(revived.state.mode).toBe("pinned");
    restored.dispose();
  });
});
