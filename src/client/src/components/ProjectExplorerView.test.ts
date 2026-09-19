// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./ProjectExplorerView";
import { ProjectExplorerView } from "./ProjectExplorerView";
import type { Project, Workspace, SessionInfo } from "../api";

describe("ProjectExplorerView component", () => {
  let element: ProjectExplorerView;

  const dummyProject: Project = {
    id: "proj-alpha",
    name: "Alpha Project",
    path: "/home/user/alpha",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const dummyWorkspace: Workspace = {
    id: "ws-main",
    projectId: "proj-alpha",
    path: "/home/user/alpha",
    label: "alpha · main",
    isMain: true,
    effectiveConfig: {},
  };

  const dummySession: SessionInfo = {
    id: "session-1",
    path: "/home/user/alpha/.pi/sessions/session-1.jsonl",
    cwd: "/home/user/alpha",
    name: "Initial task",
    created: "2026-01-01T00:00:00.000Z",
    modified: "2026-01-01T00:00:00.000Z",
    firstMessage: "Hello",
    messageCount: 1,
  };

  beforeEach(async () => {
    element = new ProjectExplorerView();
    element.projects = [dummyProject];
    element.workspaces = [dummyWorkspace];
    element.sessions = [dummySession];
    document.body.appendChild(element);
    await element.updateComplete;
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("mounts and renders project and thread with workspace label on second line", () => {
    expect(element.renderRoot.textContent).toContain("Alpha Project");
    expect(element.renderRoot.textContent).toContain("Initial task");
    expect(element.renderRoot.textContent).toContain("alpha · main");

    const line2 = element.renderRoot.querySelector(".thread-line-2");
    expect(line2?.textContent).toContain("alpha · main");
  });

  it("triggers onSelectSession with session, workspace and project when thread is clicked", () => {
    const onSelect = vi.fn();
    element.onSelectSession = onSelect;

    const threadItem = element.renderRoot.querySelector<HTMLElement>(".thread-item");
    expect(threadItem).not.toBeNull();
    threadItem?.click();

    expect(onSelect).toHaveBeenCalledWith(dummySession, dummyWorkspace, dummyProject);
  });

  it("triggers onStartSession when global or project create button is clicked", () => {
    const onStart = vi.fn();
    element.onStartSession = onStart;

    const globalBtn = element.renderRoot.querySelector<HTMLButtonElement>(".btn-create-thread-global");
    expect(globalBtn).not.toBeNull();
    globalBtn?.click();
    expect(onStart).toHaveBeenCalledWith(undefined);

    const projectBtn = element.renderRoot.querySelector<HTMLButtonElement>(".btn-create-thread-project");
    expect(projectBtn).not.toBeNull();
    projectBtn?.click();
    expect(onStart).toHaveBeenCalledWith("proj-alpha");
  });

  it("renders remote environment badge when session is on remote environment", async () => {
    const remoteProject: Project = {
      ...dummyProject,
      id: "proj-remote",
      name: "Remote Project",
      path: "/home/remote/atlas",
    };
    const remoteWorkspace: Workspace = {
      ...dummyWorkspace,
      id: "ws-remote",
      projectId: "proj-remote",
      path: "/home/remote/atlas",
    };
    const remoteSession: SessionInfo = {
      id: "session-remote",
      path: "/home/remote/atlas/.pi/sessions/session-remote.jsonl",
      cwd: "/home/remote/atlas",
      name: "Remote task",
      created: "2026-01-01T00:00:00.000Z",
      modified: "2026-01-01T00:00:00.000Z",
      firstMessage: "Remote task",
      messageCount: 1,
    };
    element.selectedMachine = {
      id: "atlas-server",
      name: "Atlas Remote",
      kind: "remote",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    element.projects = [remoteProject];
    element.workspaces = [remoteWorkspace];
    element.sessions = [remoteSession];
    await element.updateComplete;

    expect(element.renderRoot.textContent).toContain("atlas-server");
  });
});
