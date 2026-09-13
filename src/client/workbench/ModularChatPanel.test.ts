// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { ModularChatPanel, type ChatMessageEntry } from "./ModularChatPanel";
import { PiAgentRuntimeAdapter, type PiUnderlyingService } from "../../server/agent/piAgentRuntimeAdapter";
import type { Thread } from "../domain/thread";
import type { WorkspaceContext } from "./types";

function createMockService(overrides?: Partial<PiUnderlyingService>): PiUnderlyingService {
  return {
    startSession: (params) => Promise.resolve({ id: params?.id ?? "sess-a" }),
    getSession: (id) => Promise.resolve({ id, runtime: "pi", status: "idle" }),
    sendPrompt: () => Promise.resolve(),
    steer: () => Promise.resolve(),
    followUp: () => Promise.resolve(),
    abort: () => Promise.resolve(),
    listModels: () => Promise.resolve([{ id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "anthropic" }]),
    getThinkingLevels: () => Promise.resolve(["off", "low", "medium", "high"]),
    ...overrides,
  };
}

describe("ModularChatPanel (Ticket 31)", () => {
  let wsContext: WorkspaceContext;
  let threadA: Thread;
  let threadB: Thread;
  let adapter: PiAgentRuntimeAdapter;
  let draftStore: Map<string, string>;

  beforeEach(() => {
    wsContext = { environmentId: "local", workspaceId: "ws-chat", cwd: "/repo" };
    threadA = {
      id: "thread-a",
      sessionId: "session-a",
      workspaceId: "ws-chat",
      projectId: "proj-1",
      environmentId: "local",
      title: "First Thread",
      state: "running",
      createdAt: "now",
    };
    threadB = {
      id: "thread-b",
      sessionId: "session-b",
      workspaceId: "ws-chat",
      projectId: "proj-1",
      environmentId: "local",
      title: "Second Thread",
      state: "running",
      createdAt: "now",
    };

    adapter = new PiAgentRuntimeAdapter(createMockService());
    draftStore = new Map();
  });

  it("handles prompt, steer, follow-up, and abort via AgentRuntime", async () => {
    await adapter.createSession({ sessionId: "session-a" });

    const chat = new ModularChatPanel({
      id: "chat-main",
      context: wsContext,
      runtime: adapter,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    chat.init(container);
    chat.attachThread(threadA);

    // Send prompt with model and attachments
    await chat.sendPrompt("Run diagnostic check", {
      model: "claude-sonnet-4-5",
      attachments: [{ name: "log.txt", type: "text/plain" }],
      thinkingLevel: "high",
    });

    expect(chat.getTranscript()).toHaveLength(1);
    expect(chat.getTranscript()[0]?.content).toBe("Run diagnostic check");
    expect(chat.getTranscript()[0]?.attachments).toHaveLength(1);

    // Steer
    await chat.steer("Focus on network errors only");
    expect(chat.getTranscript().some((m) => m.content.includes("Focus on network errors only"))).toBe(true);

    // Follow-up
    await chat.followUp("Summarize top 3 causes");
    expect(chat.getTranscript().some((m) => m.content.includes("Summarize top 3 causes"))).toBe(true);

    // Abort
    await chat.abort();
    const session = await adapter.resumeSession("session-a");
    expect(session.status).toBe("aborted");
  });

  it("restores the draft when submitCommand rejects", async () => {
    const failing = new PiAgentRuntimeAdapter(createMockService({
      sendPrompt: () => Promise.reject(new Error("gateway offline")),
    }));
    await failing.createSession({ sessionId: "session-a" });
    const chat = new ModularChatPanel({ id: "chat-fail", context: wsContext, runtime: failing });
    chat.attachThread(threadA);
    await expect(chat.sendPrompt("draft to keep")).rejects.toThrow("gateway offline");
    expect(chat.getComposerDraft()).toBe("draft to keep");
    expect(chat.getTranscript()).toHaveLength(0);
  });

  it("maintains transcript and replay consistency across reconnection", () => {
    const chat = new ModularChatPanel({
      id: "chat-reconnect",
      context: wsContext,
    });

    chat.attachThread(threadA);
    chat.appendAssistantChunk("Initial message before reconnect.");

    // Simulate reconnection replay
    const replayedTranscript: ChatMessageEntry[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Initial message before reconnect. Plus continued stream." },
    ];

    chat.applyReconnectionSnapshot(replayedTranscript);
    expect(chat.getTranscript()).toEqual(replayedTranscript);
  });

  it("preserves composer draft across unsafe thread switches", () => {
    const chat = new ModularChatPanel({
      id: "chat-drafts",
      context: wsContext,
      draftStorage: {
        loadDraft: (tId) => draftStore.get(tId),
        saveDraft: (tId, text) => { draftStore.set(tId, text); },
      },
    });

    chat.attachThread(threadA);
    chat.setComposerDraft("Unfinished draft message for Thread A");

    // Switching to Thread B preserves draft for Thread A
    chat.attachThread(threadB);
    expect(chat.getComposerDraft()).toBe("");

    // Draft store retained Thread A's draft
    expect(draftStore.get("thread-a")).toBe("Unfinished draft message for Thread A");

    // Switching back restores Thread A's draft
    chat.attachThread(threadA);
    expect(chat.getComposerDraft()).toBe("Unfinished draft message for Thread A");
  });

  it("syncs full thread identity and pins the panel on unsafe thread switch", () => {
    const chat = new ModularChatPanel({
      id: "chat-invariant",
      context: wsContext,
      draftStorage: {
        loadDraft: (tId) => draftStore.get(tId),
        saveDraft: (tId, text) => { draftStore.set(tId, text); },
      },
    });
    chat.attachThread(threadA);
    expect(chat.state.context.projectId).toBe("proj-1");
    expect(chat.state.context.workspaceId).toBe("ws-chat");
    expect(chat.state.context.cwd).toBe("/repos/ws-chat");

    chat.setComposerDraft("rascunho em andamento");
    const otherEnv: Thread = { ...threadB, workspaceId: "ws-other", projectId: "proj-2", environmentId: "remote-1" };
    chat.attachThread(otherEnv);
    expect(draftStore.get("thread-a")).toBe("rascunho em andamento");
    expect(chat.state.context.workspaceId).toBe("ws-other");
    expect(chat.state.context.projectId).toBe("proj-2");
    expect(chat.state.mode).toBe("pinned");
  });

  it("allows long-running executions to be observed in Web and Desktop without duplicating session", async () => {
    const session = await adapter.createSession({ sessionId: "long-session-1" });
    const sharedThread: Thread = {
      id: "thread-long",
      sessionId: "long-session-1",
      workspaceId: "ws-chat",
      projectId: "proj-1",
      environmentId: "local",
      title: "Long Running Agent Execution",
      state: "running",
      createdAt: "now",
    };

    // Client 1 (Web)
    const webChat = new ModularChatPanel({ id: "web-chat", context: wsContext, runtime: adapter });
    webChat.attachThread(sharedThread);

    // Client 2 (Desktop)
    const desktopChat = new ModularChatPanel({ id: "desktop-chat", context: wsContext, runtime: adapter });
    desktopChat.attachThread(sharedThread);

    // Web sends prompt
    await webChat.sendPrompt("Start 10-minute compilation");
    expect(webChat.getActiveSessionId()).toBe("long-session-1");
    expect(desktopChat.getActiveSessionId()).toBe("long-session-1");

    // Both point to same session without spawning another session
    expect(session.id).toBe("long-session-1");
  });
});
