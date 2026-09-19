// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DockviewWorkbench } from "./DockviewWorkbench";
import { DiffDockviewPanel, type DiffService } from "./DiffDockviewPanel";
import { PlaceholderDockviewPanel } from "./PlaceholderDockviewPanel";
import { TerminalDockviewPanel } from "./TerminalDockviewPanel";
import { LAYOUT_STORAGE_KEY } from "./layoutStorage";
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

describe("DockviewWorkbench Layout Persistence (Ticket 26)", () => {
  let wsLocal: WorkspaceContext;
  let wsRemote: WorkspaceContext;
  let diffServiceMock: DiffService;

  beforeEach(() => {
    wsLocal = { environmentId: "local", workspaceId: "ws-main", cwd: "/home/user/app" };
    wsRemote = { environmentId: "remote-1", workspaceId: "ws-main", cwd: "/srv/backend" };
    diffServiceMock = {
      getChangedFiles: () => Promise.resolve([]),
      getFileDiff: (_env, wsId, path) => Promise.resolve(`diff for ${path} in ${wsId}`),
    };
    document.body.replaceChildren();
    localStorage.clear();
  });

  afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it("restores unavailable contexts as recoverable placeholders without retargeting, and revives them on retry", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const workbench = new DockviewWorkbench({ container: host, initialContext: wsLocal });
    workbench.addDiffPanel({
      id: "diff-remote",
      mode: "pinned",
      context: wsRemote,
      diffService: diffServiceMock,
    });
    workbench.addTerminalPanel({
      id: "term-local",
      context: wsLocal,
      panelContext: fakePanelContext("ws-main"),
      renderPanel: () => undefined,
    });
    workbench.saveLayout();
    workbench.dispose();

    const restored = new DockviewWorkbench({ container: host, initialContext: wsLocal });
    const onlyLocal = (ctx: WorkspaceContext): boolean => ctx.environmentId === "local";
    expect(
      restored.restoreSavedLayout({
        diffService: diffServiceMock,
        terminalPanelContext: fakePanelContext("ws-main"),
        renderTerminalPanel: () => undefined,
        isContextAvailable: onlyLocal,
      }),
    ).toBe(true);

    const placeholder = restored.registry.getPanelInstance("diff-remote");
    if (!(placeholder instanceof PlaceholderDockviewPanel)) {
      throw new Error("Expected diff-remote to restore as a placeholder");
    }
    expect(placeholder.state.title).toContain("(indisponível)");
    expect(placeholder.state.context.environmentId).toBe("remote-1");
    expect(placeholder.state.context.workspaceId).toBe("ws-main");
    expect(placeholder.reason).toContain("remote-1");

    const revivedTerminal = restored.registry.getPanelInstance("term-local");
    if (!(revivedTerminal instanceof TerminalDockviewPanel)) {
      throw new Error("Expected term-local to restore as a live terminal");
    }
    expect(revivedTerminal.state.mode).toBe("pinned");

    // Placeholder renderiza motivo + retry sem trocar de contexto.
    const el = document.createElement("div");
    placeholder.init(el);
    expect(el.textContent).toContain("remote-1");
    const retryButton = el.querySelector("button");
    expect(retryButton?.textContent).toContain("Tentar novamente");
    restored.setWorkspace({ environmentId: "local", workspaceId: "ws-other", cwd: "/tmp" });
    expect(placeholder.state.context.workspaceId).toBe("ws-main");

    // Retry com contexto ainda indisponível falha sem destruir o placeholder.
    expect(restored.retryPlaceholder("diff-remote")).toBe(false);
    expect(restored.registry.getPanelInstance("diff-remote")).toBe(placeholder);

    // Retry com contexto disponível revive o painel real no contexto original.
    expect(restored.retryPlaceholder("diff-remote", { diffService: diffServiceMock })).toBe(true);
    const revived = restored.registry.getPanelInstance("diff-remote");
    if (!(revived instanceof DiffDockviewPanel)) {
      throw new Error("Expected diff-remote to revive as a live diff panel");
    }
    expect(revived.state.context.environmentId).toBe("remote-1");
    expect(revived.state.context.workspaceId).toBe("ws-main");
    restored.dispose();
  });

  it("persists layout automatically and recovers from invalid data without touching execution", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const workbench = new DockviewWorkbench({ container: host, initialContext: wsLocal });
    workbench.addTerminalPanel({
      id: "term-autosave",
      context: wsLocal,
      panelContext: fakePanelContext("ws-main"),
      renderPanel: () => undefined,
    });

    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    expect(raw).toContain("term-autosave");
    expect(raw).not.toContain("password");
    workbench.dispose();

    localStorage.setItem(LAYOUT_STORAGE_KEY, "not a layout{{{");
    const broken = new DockviewWorkbench({ container: host, initialContext: wsLocal });
    expect(broken.restoreSavedLayout()).toBe(false);
    expect(broken.registry.getAllPanels()).toHaveLength(0);
    broken.dispose();
  });

  it("resets geometry to default without deleting instances or transient state", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const workbench = new DockviewWorkbench({ container: host, initialContext: wsLocal });
    const terminal = workbench.addTerminalPanel({
      id: "term-keep",
      context: wsLocal,
      panelContext: fakePanelContext("ws-main"),
      renderPanel: () => undefined,
    });
    const diff = workbench.addDiffPanel({ id: "diff-keep", mode: "pinned", diffService: diffServiceMock });
    diff.setDirty(true);

    workbench.resetToDefaultLayout();

    expect(workbench.registry.getPanelInstance("term-keep")).toBe(terminal);
    expect(workbench.registry.getPanelInstance("diff-keep")).toBe(diff);
    expect(terminal.state.context.workspaceId).toBe("ws-main");
    expect(diff.state.isUnsafeDirty).toBe(true);
    expect(workbench.api.getPanel("term-keep")).toBeDefined();
    expect(workbench.api.getPanel("diff-keep")).toBeDefined();
    expect(localStorage.getItem(LAYOUT_STORAGE_KEY)).toContain("diff-keep");
    workbench.dispose();
  });

  it("compacts and re-expands on narrow viewports without losing selection", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const workbench = new DockviewWorkbench({ container: host, initialContext: wsLocal });
    workbench.addTerminalPanel({
      id: "term-a",
      context: wsLocal,
      panelContext: fakePanelContext("ws-main"),
      renderPanel: () => undefined,
    });
    workbench.addDiffPanel({ id: "diff-b", mode: "pinned", diffService: diffServiceMock });
    workbench.api.getPanel("diff-b")?.api.setActive();
    expect(workbench.api.activePanel?.id).toBe("diff-b");

    expect(workbench.handleContainerWidth(400)).toBe(true);
    expect(host.classList.contains("workbench-compact")).toBe(true);

    expect(workbench.handleContainerWidth(1200)).toBe(false);
    expect(host.classList.contains("workbench-compact")).toBe(false);
    expect(workbench.api.activePanel?.id).toBe("diff-b");
    expect(workbench.registry.getAllPanels()).toHaveLength(2);
    workbench.dispose();
  });

  it("ignores the retry button callback safely after placeholder dispose", () => {
    const onRetry = vi.fn();
    const placeholder = new PlaceholderDockviewPanel({
      id: "ph-1",
      type: "diff",
      title: "Diff",
      context: wsRemote,
      reason: "Ambiente 'remote-1' ou Workspace 'ws-main' está offline.",
      original: {
        id: "ph-1",
        type: "diff",
        title: "Diff",
        mode: "pinned",
        context: { ...wsRemote },
      },
      onRetry,
    });
    const el = document.createElement("div");
    document.body.appendChild(el);
    placeholder.init(el);
    expect(placeholder.state.mode).toBe("pinned");
    el.querySelector("button")?.click();
    expect(onRetry).toHaveBeenCalledWith("ph-1");
    placeholder.setContext(wsLocal);
    expect(placeholder.state.context.environmentId).toBe("remote-1");
    placeholder.dispose();
  });

  it("rolls back staged panels when Dockview rejects the saved geometry", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const workbench = new DockviewWorkbench({ container: host, initialContext: wsLocal });
    workbench.addTerminalPanel({
      id: "term-valid",
      context: wsLocal,
      panelContext: fakePanelContext("ws-main"),
      renderPanel: () => undefined,
    });
    workbench.saveLayout();
    workbench.dispose();

    const restored = new DockviewWorkbench({ container: host, initialContext: wsLocal });
    vi.spyOn(restored.api, "fromJSON").mockImplementation(() => {
      throw new Error("bad geometry");
    });
    expect(
      restored.restoreSavedLayout({
        terminalPanelContext: fakePanelContext("ws-main"),
        renderTerminalPanel: () => undefined,
      }),
    ).toBe(false);
    expect(restored.registry.getAllPanels()).toHaveLength(0);

    // O fallback padrão parte de um registry limpo, sem colisão de ids.
    restored.addTerminalPanel({
      id: "workbench-term-main",
      context: wsLocal,
      panelContext: fakePanelContext("ws-main"),
      renderPanel: () => undefined,
    });
    expect(restored.registry.getAllPanels()).toHaveLength(1);
    restored.dispose();
  });

  it("keeps the recoverable placeholder when reviving fails to add the live panel", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const workbench = new DockviewWorkbench({ container: host, initialContext: wsLocal });
    workbench.addDiffPanel({
      id: "diff-remote",
      mode: "pinned",
      context: wsRemote,
      diffService: diffServiceMock,
    });
    workbench.saveLayout();
    workbench.dispose();

    const restored = new DockviewWorkbench({ container: host, initialContext: wsLocal });
    expect(
      restored.restoreSavedLayout({
        diffService: diffServiceMock,
        isContextAvailable: (ctx) => ctx.environmentId === "local",
      }),
    ).toBe(true);
    const placeholder = restored.registry.getPanelInstance("diff-remote");
    if (!(placeholder instanceof PlaceholderDockviewPanel)) {
      throw new Error("Expected diff-remote to restore as a placeholder");
    }

    // A primeira adição (painel real) falha; o placeholder deve sobreviver sem órfãos.
    vi.spyOn(restored.api, "addPanel").mockImplementationOnce(() => {
      throw new Error("dockview unavailable");
    });
    expect(restored.retryPlaceholder("diff-remote", { diffService: diffServiceMock })).toBe(false);
    expect(restored.registry.getPanelInstance("diff-remote")).toBe(placeholder);
    expect(restored.registry.getPanel("diff-remote")?.id).toBe("diff-remote");

    // Nova tentativa funciona: revive como painel real no contexto original.
    expect(restored.retryPlaceholder("diff-remote", { diffService: diffServiceMock })).toBe(true);
    const revived = restored.registry.getPanelInstance("diff-remote");
    if (!(revived instanceof DiffDockviewPanel)) {
      throw new Error("Expected diff-remote to revive as a live diff panel");
    }
    expect(revived.state.context.environmentId).toBe("remote-1");
    restored.dispose();
  });
});
