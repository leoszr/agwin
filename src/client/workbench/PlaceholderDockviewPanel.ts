import type { PanelState, PanelType, WorkspaceContext } from "./types.js";
import type { IWorkbenchPanelInstance } from "./panelRegistry.js";

export interface PlaceholderPanelOptions {
  id: string;
  type: PanelType;
  title: string;
  context: WorkspaceContext;
  reason: string;
  original: PanelState;
  onRetry?: ((id: string) => void) | undefined;
}

/** Título exibido sem duplicar o sufixo entre recarregamentos. */
export function placeholderTitle(title: string): string {
  const suffix = " (indisponível)";
  return title.endsWith(suffix) ? title : `${title}${suffix}`;
}

/**
 * Placeholder recuperável para um painel cujo contexto está indisponível.
 * Preserva o contexto original (sem retargeting) e nunca segue o workspace ativo.
 */
export class PlaceholderDockviewPanel implements IWorkbenchPanelInstance {
  readonly state: PanelState;
  readonly reason: string;
  readonly original: PanelState;
  private element: HTMLElement | undefined;
  private readonly onRetry: ((id: string) => void) | undefined;
  private retryButton: HTMLButtonElement | undefined;

  constructor(options: PlaceholderPanelOptions) {
    this.reason = options.reason;
    this.original = {
      ...options.original,
      context: { ...options.original.context },
    };
    this.state = {
      id: options.id,
      type: options.type,
      title: placeholderTitle(options.title),
      mode: "pinned",
      context: { ...options.context },
      viewState: {
        placeholder: true,
        reason: options.reason,
        original: this.original,
      },
    };
    this.onRetry = options.onRetry;
  }

  setContext(context: WorkspaceContext): void {
    // Placeholder nunca troca de contexto sozinho; o argumento existe só pelo contrato.
    void context;
  }


  init(container: HTMLElement): void {
    this.element = container;
    this.render();
  }

  focus(): void {
    this.retryButton?.focus();
  }

  dispose(): void {
    this.retryButton = undefined;
    this.element = undefined;
  }

  private render(): void {
    const el = this.element;
    if (el === undefined) return;
    el.replaceChildren();
    el.className = "dockview-panel-placeholder";

    const title = el.ownerDocument.createElement("h3");
    title.textContent = this.state.title;
    el.appendChild(title);

    const reason = el.ownerDocument.createElement("p");
    reason.setAttribute("role", "status");
    reason.textContent = this.reason;
    el.appendChild(reason);

    const context = el.ownerDocument.createElement("p");
    context.textContent = `Contexto preservado: ${this.state.context.environmentId} / ${this.state.context.workspaceId}. Nenhum redirecionamento foi feito.`;
    el.appendChild(context);

    const retry = el.ownerDocument.createElement("button");
    retry.type = "button";
    retry.textContent = "Tentar novamente";
    retry.addEventListener("click", () => {
      this.onRetry?.(this.state.id);
    });
    el.appendChild(retry);
    this.retryButton = retry;
  }
}
