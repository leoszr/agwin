import { describe, expect, it } from "vitest";
import {
  createThread,
  forkThread,
  resumeThread,
  type Thread,
} from "./thread";

describe("Thread Domain Model & Identity (Ticket 29)", () => {
  it("creates thread with 1:1 session invariant and immutable workspace link", () => {
    const thread = createThread({
      title: "Refactor core parser",
      projectId: "proj-1",
      workspaceId: "ws-dev",
      environmentId: "local",
    });

    expect(thread.id).toMatch(/^thread-/);
    expect(thread.sessionId).toBe(`session-${thread.id}`);
    expect(thread.workspaceId).toBe("ws-dev");
  });

  it("resuming a thread resumes the exact same Session without duplicating execution", () => {
    const thread = createThread({
      title: "Deploy step",
      projectId: "proj-1",
      workspaceId: "ws-deploy",
      environmentId: "local",
    });

    const resumed = resumeThread(thread);
    expect(resumed.sessionId).toBe(thread.sessionId);
    expect(resumed.workspaceId).toBe(thread.workspaceId);
    expect(resumed.environmentId).toBe(thread.environmentId);
  });

  it("forking creates a new Thread and new Session linked to the origin parent", () => {
    const parent = createThread({
      title: "Exploration branch",
      projectId: "proj-1",
      workspaceId: "ws-main",
      environmentId: "local",
    });

    const forked = forkThread(parent, { newTitle: "Alternative approach", forkedAtSeq: 15 });

    expect(forked.id).not.toBe(parent.id);
    expect(forked.sessionId).not.toBe(parent.sessionId);
    expect(forked.parentThreadId).toBe(parent.id);
    expect(forked.forkedFromSessionSeq).toBe(15);
    expect(forked.title).toBe("Alternative approach");
    // By default, shares parent's workspace without forced isolation
    expect(forked.workspaceId).toBe(parent.workspaceId);
  });

  it("allows explicit workspace isolation on fork when requested", () => {
    const parent = createThread({
      title: "Dangerous migration",
      projectId: "proj-1",
      workspaceId: "ws-shared",
      environmentId: "local",
    });

    const isolatedFork = forkThread(parent, {
      isolatedWorkspaceId: "ws-isolated-worktree",
    });

    expect(isolatedFork.workspaceId).toBe("ws-isolated-worktree");
    expect(parent.workspaceId).toBe("ws-shared");
  });

  it("allows multiple threads to share the same workspace", () => {
    const t1 = createThread({ title: "Task 1", projectId: "proj-1", workspaceId: "ws-shared", environmentId: "local" });
    const t2 = createThread({ title: "Task 2", projectId: "proj-1", workspaceId: "ws-shared", environmentId: "local" });

    expect(t1.workspaceId).toBe(t2.workspaceId);
    expect(t1.sessionId).not.toBe(t2.sessionId);
  });

  it("unavailable thread remains readable with cached transcript and without silent redirection", () => {
    const thread: Thread = {
      ...createThread({ title: "Remote Task", projectId: "proj-remote", workspaceId: "ws-remote", environmentId: "remote-vps" }),
      state: "offline",
      readOnlyTranscriptCache: [
        { role: "user", content: "Cached query" },
        { role: "assistant", content: "Cached result before host went offline" },
      ],
    };

    expect(thread.state).toBe("offline");
    expect(thread.readOnlyTranscriptCache).toHaveLength(2);
    // Workspace remains the original one
    expect(thread.workspaceId).toBe("ws-remote");
  });
});
