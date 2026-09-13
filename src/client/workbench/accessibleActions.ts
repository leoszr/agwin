export type AccessiblePanelAction =
  | "splitRight"
  | "splitDown"
  | "moveToNextGroup"
  | "float"
  | "popout"
  | "close"
  | "focus"
  | "resetLayout";

export interface PanelActionMenuTarget {
  panelId: string;
  type: string;
  title: string;
  isFloating: boolean;
  isPopout: boolean;
}

export interface AccessibleActionResult {
  success: boolean;
  action: AccessiblePanelAction;
  panelId?: string | undefined;
  announcement: string;
  focusTargetSelector?: string | undefined;
}

export class AccessibleWorkbenchController {
  private lastFocusedElement: HTMLElement | null = null;

  handleKeyDown(
    event: KeyboardEvent,
    callbacks: {
      onJumpToExplorer?: () => void;
      onJumpToChat?: () => void;
      onJumpToTerminal?: () => void;
      onOpenActionsMenu?: () => void;
    },
  ): boolean {
    // Alt+1: Explorer, Alt+2: Chat, Alt+3: Terminal, Alt+M: Menu de Ações
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      if (event.key === "1") {
        event.preventDefault();
        callbacks.onJumpToExplorer?.();
        return true;
      }
      if (event.key === "2") {
        event.preventDefault();
        callbacks.onJumpToChat?.();
        return true;
      }
      if (event.key === "3") {
        event.preventDefault();
        callbacks.onJumpToTerminal?.();
        return true;
      }
      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        callbacks.onOpenActionsMenu?.();
        return true;
      }
    }
    return false;
  }

  executePanelAction(
    target: PanelActionMenuTarget,
    action: AccessiblePanelAction,
    contextHandlers: {
      splitPanel?: (id: string, dir: "right" | "down") => void;
      floatPanel?: (id: string, floating: boolean) => void;
      popoutPanel?: (id: string) => void;
      closePanel?: (id: string) => void;
      resetLayout?: () => void;
      focusPanel?: (id: string) => void;
      moveToNextGroup?: (id: string) => void;
    },
  ): AccessibleActionResult {
    switch (action) {
      case "splitRight":
        contextHandlers.splitPanel?.(target.panelId, "right");
        return {
          success: true,
          action,
          panelId: target.panelId,
          announcement: `Painel ${target.title} dividido para a direita.`,
          focusTargetSelector: `[data-panel-id="${target.panelId}"]`,
        };

      case "splitDown":
        contextHandlers.splitPanel?.(target.panelId, "down");
        return {
          success: true,
          action,
          panelId: target.panelId,
          announcement: `Painel ${target.title} dividido para baixo.`,
          focusTargetSelector: `[data-panel-id="${target.panelId}"]`,
        };

      case "float": {
        const nextFloating = !target.isFloating;
        contextHandlers.floatPanel?.(target.panelId, nextFloating);
        return {
          success: true,
          action,
          panelId: target.panelId,
          announcement: nextFloating
            ? `Painel ${target.title} agora está flutuante.`
            : `Painel ${target.title} ancorado de volta à grade.`,
        };
      }

      case "popout":
        contextHandlers.popoutPanel?.(target.panelId);
        return {
          success: true,
          action,
          panelId: target.panelId,
          announcement: `Painel ${target.title} aberto em nova janela popout.`,
        };

      case "close":
        contextHandlers.closePanel?.(target.panelId);
        return {
          success: true,
          action,
          panelId: target.panelId,
          announcement: `Painel ${target.title} fechado.`,
          focusTargetSelector: ".project-explorer",
        };

      case "resetLayout":
        contextHandlers.resetLayout?.();
        return {
          success: true,
          action,
          announcement: "Layout da bancada restaurado para a configuração padrão.",
          focusTargetSelector: ".chat-input",
        };

      case "moveToNextGroup":
        contextHandlers.moveToNextGroup?.(target.panelId);
        return {
          success: true,
          action,
          panelId: target.panelId,
          announcement: `Painel ${target.title} movido para o próximo grupo.`,
        };

      case "focus":
      default:
        contextHandlers.focusPanel?.(target.panelId);
        return {
          success: true,
          action,
          panelId: target.panelId,
          announcement: `Foco movido para o painel ${target.title}.`,
          focusTargetSelector: `[data-panel-id="${target.panelId}"]`,
        };
    }
  }

  saveFocus(): void {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      this.lastFocusedElement = document.activeElement;
    }
  }

  restoreFocus(): void {
    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === "function") {
      this.lastFocusedElement.focus();
      this.lastFocusedElement = null;
    }
  }
}

export function ensureAccessibleTruncation(element: HTMLElement, fullText: string): void {
  element.setAttribute("title", fullText);
  element.setAttribute("aria-label", fullText);
  element.tabIndex = 0; // Focusable by keyboard to read tooltip
}
