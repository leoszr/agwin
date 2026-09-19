import { describe, expect, it } from "vitest";
import { bridgeSessionsToThreads, deriveThreadState, sessionTitle } from "./sessionThreadBridge";
import type { Project, Workspace, SessionInfo, SessionStatus, SessionActivity } from "../src/api";

describe("sessionThreadBridge", () => {
  const dummyProject: Project = {
    id: "proj-1",
    name: "Alpha App",
    path: "/home/user/projects/alpha",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const dummyWorkspace: Workspace = {
    id: "ws-1",
    projectId: "proj-1",
    path: "/home/user/projects/alpha",
    label: "alpha · main",
    isMain: true,
    effectiveConfig: {},
  };

  const baseSession: SessionInfo = {
    id: "sess-1",
    path: "/home/user/projects/alpha/.pi/sessions/sess-1.jsonl",
    cwd: "/home/user/projects/alpha",
    name: "Feature login",
    created: "2026-01-02T00:00:00.000Z",
    modified: "2026-01-02T01:00:00.000Z",
    firstMessage: "Help implement auth",
    messageCount: 5,
  };

  it("bridges SessionInfo to Thread with workspace and project associations", () => {
    const result = bridgeSessionsToThreads({
      sessions: [baseSession],
      workspaces: [dummyWorkspace],
      projects: [dummyProject],
      selectedMachineId: "local",
    });

    expect(result.projects).toHaveLength(1);
    const proj = result.projects[0];
    expect(proj).toBeDefined();
    expect(proj?.id).toBe("proj-1");
    expect(proj?.name).toBe("Alpha App");

    expect(result.threads).toHaveLength(1);
    const thread = result.threads[0];
    expect(thread).toBeDefined();
    if (!thread) throw new Error("Thread expected");

    expect(thread.id).toBe("sess-1");
    expect(thread.sessionId).toBe("sess-1");
    expect(thread.projectId).toBe("proj-1");
    expect(thread.projectName).toBe("Alpha App");
    expect(thread.workspaceId).toBe("ws-1");
    expect(thread.workspaceLabel).toBe("alpha · main");
    expect(thread.title).toBe("Feature login");
    expect(thread.state).toBe("completed");

    expect(result.sessionByThreadId.get("sess-1")).toBe(baseSession);
    expect(result.workspaceByThreadId.get("sess-1")).toBe(dummyWorkspace);
    expect(result.projectByThreadId.get("sess-1")).toBe(dummyProject);
  });

  it("derives running state for active streaming or prompt sending", () => {
    const status: SessionStatus = {
      sessionId: "sess-1",
      isStreaming: true,
      isCompacting: false,
      isBashRunning: false,
      pendingMessageCount: 0,
      queuedMessages: [],
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      cost: 0,
    };

    const state = deriveThreadState("sess-1", "local", {
      sessionStatuses: { "sess-1": status },
    });
    expect(state).toBe("running");

    const sendingState = deriveThreadState("sess-1", "local", {
      sendingPrompts: { "sess-1": true },
    });
    expect(sendingState).toBe("running");
  });

  it("derives waiting state for pendingAsk or extension dialogs", () => {
    const statusWithAsk: SessionStatus = {
      sessionId: "sess-1",
      isStreaming: false,
      isCompacting: false,
      isBashRunning: false,
      pendingMessageCount: 0,
      queuedMessages: [],
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      cost: 0,
      pendingAsk: {
        askId: "ask-1",
        askedAt: "2026-01-02T00:00:00.000Z",
        questions: [{ id: "q1", question: "Confirm deploy?", options: [{ label: "Yes", value: "yes" }] }],
      },
    };

    const state = deriveThreadState("sess-1", "local", {
      sessionStatuses: { "sess-1": statusWithAsk },
    });
    expect(state).toBe("waiting");
  });

  it("derives error state for error activity phase", () => {
    const activity: SessionActivity = {
      sessionId: "sess-1",
      phase: "error",
      label: "Process crashed",
      at: "2026-01-02T00:00:00.000Z",
    };

    const state = deriveThreadState("sess-1", "local", {
      sessionActivities: { "sess-1": activity },
    });
    expect(state).toBe("error");
  });

  it("derives offline state when environment is offline", () => {
    const state = deriveThreadState("sess-1", "remote-atlas", {
      environmentStatuses: {
        "remote-atlas": {
          environmentId: "remote-atlas",
          state: "offline",
          degraded: false,
        },
      },
    });
    expect(state).toBe("offline");
  });

  it("formats session title with priority: name > firstMessage > shortSessionId", () => {
    expect(sessionTitle({ ...baseSession, name: "Explicit Name" })).toBe("Explicit Name");
    expect(sessionTitle({ ...baseSession, name: "", firstMessage: "First Message" })).toBe("First Message");
    expect(sessionTitle({ ...baseSession, name: "", firstMessage: "" })).toBe("sess-1");
  });
});
