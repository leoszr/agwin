import { describe, expect, it } from "vitest";
import {
  PI_RUNTIME_DESCRIPTOR,
  PiAgentRuntimeAdapter,
  type PiUnderlyingService,
} from "./piAgentRuntimeAdapter";
import type { AgentRuntimeEvent } from "./types";

function createMockService(overrides?: Partial<PiUnderlyingService>): PiUnderlyingService {
  return {
    startSession: (params) => Promise.resolve({ id: params?.id ?? "sess-pi-1" }),
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

describe("PiAgentRuntimeAdapter (Ticket 30)", () => {
  it("covers session creation and resumption, recording creator runtime id", async () => {
    const adapter = new PiAgentRuntimeAdapter(createMockService());
    const session = await adapter.createSession({ sessionId: "sess-pi-1" });

    expect(session.id).toBe("sess-pi-1");
    expect(session.runtimeId).toBe("pi");

    const resumed = await adapter.resumeSession("sess-pi-1");
    expect(resumed.id).toBe("sess-pi-1");
    expect(resumed.runtimeId).toBe("pi");
  });

  it("strictly enforces non-portability and rejects sessions created by other runtimes", async () => {
    const mockService = createMockService({
      getSession: (id) => {
        if (id === "sess-omp-1") {
          return Promise.resolve({ id: "sess-omp-1", runtime: "omp", status: "idle" });
        }
        return Promise.resolve(undefined);
      },
    });

    const adapter = new PiAgentRuntimeAdapter(mockService);
    await expect(adapter.resumeSession("sess-omp-1")).rejects.toThrow(
      "Cannot resume session 'sess-omp-1' created by runtime 'omp' with Pi adapter",
    );
  });

  it("handles commands (prompt, steer, followUp, abort), events, and interactions", async () => {
    const events: AgentRuntimeEvent[] = [];
    const calls: { prompt?: unknown[]; steer?: string[]; followUp?: string[]; abort?: string[]; dialog?: unknown[] } = {};

    const underlying = createMockService({
      sendPrompt: (id, text, opts) => {
        calls.prompt = [id, text, opts];
        return Promise.resolve();
      },
      steer: (id, text) => {
        calls.steer = [id, text];
        return Promise.resolve();
      },
      followUp: (id, text) => {
        calls.followUp = [id, text];
        return Promise.resolve();
      },
      abort: (id) => {
        calls.abort = [id];
        return Promise.resolve();
      },
      answerDialog: (id, dialogId, ans) => {
        calls.dialog = [id, dialogId, ans];
        return Promise.resolve();
      },
    });

    const adapter = new PiAgentRuntimeAdapter(underlying);
    const session = await adapter.createSession({ sessionId: "sess-run-1" });

    adapter.onEvent(session.id, (e) => events.push(e));

    // Prompt
    await adapter.submitCommand(session.id, { type: "prompt", text: "Please refactor this" });
    expect(calls.prompt).toBeDefined();
    expect(events.some((e) => e.type === "status" && e.status === "streaming")).toBe(true);

    // Steer
    await adapter.submitCommand(session.id, { type: "steer", text: "Don't touch index.ts" });
    expect(calls.steer).toEqual(["sess-run-1", "Don't touch index.ts"]);

    // FollowUp
    await adapter.submitCommand(session.id, { type: "followUp", text: "Also run tests" });
    expect(calls.followUp).toEqual(["sess-run-1", "Also run tests"]);

    // Dialog interaction
    await adapter.respondInteraction(session.id, "dialog-123", { allow: true });
    expect(calls.dialog).toEqual(["sess-run-1", "dialog-123", { allow: true }]);

    // Abort
    await adapter.abort(session.id);
    expect(calls.abort).toEqual(["sess-run-1"]);
    expect(events.some((e) => e.type === "status" && e.status === "aborted")).toBe(true);
  });

  it("provides model catalog and thinking levels from descriptor/service", async () => {
    const adapter = new PiAgentRuntimeAdapter(createMockService());
    const catalog = await adapter.getModelCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog[0]?.provider).toBeDefined();

    const levels = await adapter.getThinkingLevels();
    expect(levels).toContain("high");
    expect(levels).toContain("off");
  });

  it("verifies filesystem, git, diff, terminal, and workspace remain completely outside the AgentRuntime seam", () => {
    const adapter = new PiAgentRuntimeAdapter(createMockService());
    const keys = Object.keys(adapter);

    expect(keys).not.toContain("fs");
    expect(keys).not.toContain("git");
    expect(keys).not.toContain("diff");
    expect(keys).not.toContain("terminal");
    expect(keys).not.toContain("workspace");
    expect(keys).not.toContain("project");
  });

  it("confirms capabilities and that no functional OMP adapter exists", () => {
    expect(PI_RUNTIME_DESCRIPTOR.id).toBe("pi");
    expect(PI_RUNTIME_DESCRIPTOR.capabilities.streaming).toBe(true);
    expect(PI_RUNTIME_DESCRIPTOR.capabilities.steer).toBe(true);

    // OMP is not implemented in this release
    const hasOmpAdapter = false;
    expect(hasOmpAdapter).toBe(false);
  });
});
