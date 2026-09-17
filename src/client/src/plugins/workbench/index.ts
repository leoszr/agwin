import type { PiWebPlugin, WorkspacePluginBinding } from "../types.js";
import "../../../workbench/DockviewWorkbenchPanel.js";

export function createWorkbenchPlugin(
  getTerminalBinding?: () => WorkspacePluginBinding | undefined,
  getDiffBinding?: () => WorkspacePluginBinding | undefined,
): PiWebPlugin {
  return {
    apiVersion: 2,
    name: "Bancada",
    activate: (context) => ({
      contributions: {
        workspacePanels: [
          {
            id: "workspace.workbench",
            title: "Bancada",
            order: 25,
            icon: context.svg`
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <path d="M3 9h18"></path>
                <path d="M9 21V9"></path>
              </svg>
            `,
            render: (panelContext) => {
              const terminalBinding = getTerminalBinding?.();
              const diffBinding = getDiffBinding?.();
              return context.html`<dockview-workbench-panel .context=${panelContext} .terminalBinding=${terminalBinding} .diffBinding=${diffBinding}></dockview-workbench-panel>`;
            },
          },
        ],
      },
    }),
  };
}

