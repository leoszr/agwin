// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccessibleWorkbenchController,
  ensureAccessibleTruncation,
  type PanelActionMenuTarget,
} from "./accessibleActions";

describe("Accessible Workbench Operations (Ticket 32)", () => {
  let controller: AccessibleWorkbenchController;
  let targetPanel: PanelActionMenuTarget;

  beforeEach(() => {
    controller = new AccessibleWorkbenchController();
    targetPanel = {
      panelId: "terminal-main",
      type: "terminal",
      title: "Terminal 1",
      isFloating: false,
      isPopout: false,
    };
  });

  it("handles keyboard shortcuts to jump between primary panels without pointer interaction", () => {
    const onJumpToExplorer = vi.fn();
    const onJumpToChat = vi.fn();
    const onJumpToTerminal = vi.fn();
    const onOpenActionsMenu = vi.fn();

    // Alt+1: Jump to Explorer
    const handled1 = controller.handleKeyDown(
      new KeyboardEvent("keydown", { key: "1", altKey: true }),
      { onJumpToExplorer, onJumpToChat, onJumpToTerminal, onOpenActionsMenu },
    );
    expect(handled1).toBe(true);
    expect(onJumpToExplorer).toHaveBeenCalled();

    // Alt+2: Jump to Chat
    const handled2 = controller.handleKeyDown(
      new KeyboardEvent("keydown", { key: "2", altKey: true }),
      { onJumpToExplorer, onJumpToChat, onJumpToTerminal, onOpenActionsMenu },
    );
    expect(handled2).toBe(true);
    expect(onJumpToChat).toHaveBeenCalled();

    // Alt+3: Jump to Terminal
    const handled3 = controller.handleKeyDown(
      new KeyboardEvent("keydown", { key: "3", altKey: true }),
      { onJumpToExplorer, onJumpToChat, onJumpToTerminal, onOpenActionsMenu },
    );
    expect(handled3).toBe(true);
    expect(onJumpToTerminal).toHaveBeenCalled();

    // Alt+M: Open Action Menu
    const handledM = controller.handleKeyDown(
      new KeyboardEvent("keydown", { key: "m", altKey: true }),
      { onJumpToExplorer, onJumpToChat, onJumpToTerminal, onOpenActionsMenu },
    );
    expect(handledM).toBe(true);
    expect(onOpenActionsMenu).toHaveBeenCalled();
  });

  it("provides accessible alternative commands for docking, split, float, popout, close, and reset", () => {
    const splitPanel = vi.fn();
    const floatPanel = vi.fn();
    const popoutPanel = vi.fn();
    const closePanel = vi.fn();
    const resetLayout = vi.fn();

    const handlers = { splitPanel, floatPanel, popoutPanel, closePanel, resetLayout };

    // Split right
    const resSplit = controller.executePanelAction(targetPanel, "splitRight", handlers);
    expect(splitPanel).toHaveBeenCalledWith("terminal-main", "right");
    expect(resSplit.announcement).toContain("dividido para a direita");

    // Float
    const resFloat = controller.executePanelAction(targetPanel, "float", handlers);
    expect(floatPanel).toHaveBeenCalledWith("terminal-main", true);
    expect(resFloat.announcement).toContain("flutuante");

    // Popout
    const resPopout = controller.executePanelAction(targetPanel, "popout", handlers);
    expect(popoutPanel).toHaveBeenCalledWith("terminal-main");
    expect(resPopout.announcement).toContain("popout");

    // Close
    const resClose = controller.executePanelAction(targetPanel, "close", handlers);
    expect(closePanel).toHaveBeenCalledWith("terminal-main");
    expect(resClose.announcement).toContain("fechado");

    // Reset layout
    const resReset = controller.executePanelAction(targetPanel, "resetLayout", handlers);
    expect(resetLayout).toHaveBeenCalled();
    expect(resReset.announcement).toContain("padrão");
  });

  it("routes moveToNextGroup through the workbench handler instead of succeeding silently", () => {
    const moveToNextGroup = vi.fn();
    const result = controller.executePanelAction(targetPanel, "moveToNextGroup", { moveToNextGroup });
    expect(moveToNextGroup).toHaveBeenCalledWith("terminal-main");
    expect(result.success).toBe(true);
    expect(result.announcement).toContain("próximo grupo");
  });

  it("saves and restores focus across panel interactions without trapping focus", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();

    controller.saveFocus();

    // Move focus elsewhere
    const other = document.createElement("input");
    document.body.appendChild(other);
    other.focus();
    expect(document.activeElement).toBe(other);

    // Restore focus
    controller.restoreFocus();
    expect(document.activeElement).toBe(button);
  });

  it("ensures truncated text remains accessible via keyboard focus, title, and aria-label", () => {
    const element = document.createElement("div");
    const longText = "Very long repository name with branch fix-issue-32-layout-truncation";

    ensureAccessibleTruncation(element, longText);

    expect(element.getAttribute("title")).toBe(longText);
    expect(element.getAttribute("aria-label")).toBe(longText);
    expect(element.tabIndex).toBe(0);
  });
});
