// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectExplorer, type ProjectExplorerProject } from "./ProjectExplorer";
import type { Thread } from "../domain/thread";

describe("ProjectExplorer (Ticket 28)", () => {
  let container: HTMLElement;
  let projects: ProjectExplorerProject[];
  let threads: Thread[];
  let onSelectThread: (thread: Thread) => void;
  let onCreateThread: (projectId?: string) => void;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    projects = [
      { id: "proj-1", name: "Alpha Service", environmentId: "local" },
      { id: "proj-2", name: "Beta Worker", environmentId: "remote-aws" },
    ];

    threads = [
      {
        id: "t-1",
        sessionId: "s-1",
        workspaceId: "ws-main",
        projectId: "proj-1",
        environmentId: "local",
        title: "Fix crash on boot",
        state: "running",
        createdAt: "2026-09-12T10:00:00Z",
      },
      {
        id: "t-2",
        sessionId: "s-2",
        workspaceId: "ws-main",
        projectId: "proj-1",
        environmentId: "local",
        title: "Waiting user approval",
        state: "waiting",
        createdAt: "2026-09-12T10:05:00Z",
      },
      {
        id: "t-3",
        sessionId: "s-3",
        workspaceId: "ws-isolated",
        projectId: "proj-2",
        environmentId: "remote-aws",
        title: "Fix crash on boot", // Homonymous thread in another project/environment!
        state: "completed",
        createdAt: "2026-09-12T10:10:00Z",
      },
    ];

    onSelectThread = vi.fn();
    onCreateThread = vi.fn();
  });

  it("renders projects, state buckets, and threads with visible workspace and contextual environment tags", () => {
    new ProjectExplorer({
      container,
      projects,
      threads,
      onSelectThread,
      onCreateThread,
    });

    expect(container.textContent).toContain("Alpha Service");
    expect(container.textContent).toContain("Beta Worker");
    expect(container.textContent).toContain("Em execução");
    expect(container.textContent).toContain("Aguardando");
    expect(container.textContent).toContain("Concluído");

    // Visible workspace badge
    expect(container.querySelector(".badge-workspace")?.textContent).toBe("ws-main");

    // Environment appears for remote or ambiguous threads
    expect(container.textContent).toContain("remote-aws");
  });

  it("supports creating a thread globally and within a specific project", () => {
    new ProjectExplorer({
      container,
      projects,
      threads,
      onSelectThread,
      onCreateThread,
    });

    const globalBtn = container.querySelector<HTMLButtonElement>(".btn-create-thread-global");
    if (!globalBtn) throw new Error("Missing global button");
    globalBtn.click();
    expect(onCreateThread).toHaveBeenCalledWith();

    const projectBtn = container.querySelector<HTMLButtonElement>(".btn-create-thread-project");
    if (!projectBtn) throw new Error("Missing project button");
    projectBtn.click();
    expect(onCreateThread).toHaveBeenCalledWith("proj-1");
  });

  it("disambiguates homonymous threads across different projects and environments", () => {
    new ProjectExplorer({
      container,
      projects,
      threads,
      onSelectThread,
      onCreateThread,
    });

    const items = container.querySelectorAll(".thread-item");
    expect(items.length).toBe(3);

    // Both "Fix crash on boot" threads exist, one has remote-aws tag and ws-isolated
    const t3Element = Array.from(items).find((el) => {
      return el.getAttribute("aria-label")?.includes("remote-aws") ?? false;
    });
    expect(t3Element).toBeDefined();
    expect(t3Element?.textContent).toContain("ws-isolated");
    expect(t3Element?.textContent).toContain("remote-aws");
  });

  it("provides accessible status semantics (text + icons + aria-label) and keyboard navigation", () => {
    new ProjectExplorer({
      container,
      projects,
      threads,
      onSelectThread,
      onCreateThread,
    });

    const threadItem = container.querySelector<HTMLElement>(".thread-item");
    if (!threadItem) throw new Error("Missing thread item");
    expect(threadItem.getAttribute("aria-label")).toContain("Fix crash on boot");
    expect(threadItem.getAttribute("aria-label")).toContain("Em execução");

    // Keyboard activation
    threadItem.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onSelectThread).toHaveBeenCalledWith(threads[0]);
  });

  it("adapts layout and preserves usable navigation in compact viewport", () => {
    const explorer = new ProjectExplorer({
      container,
      projects,
      threads,
      onSelectThread,
      onCreateThread,
    });

    explorer.setCompactViewport(true);
    expect(container.classList.contains("compact")).toBe(true);

    // Clicking items still triggers onSelectThread in compact mode
    const item = container.querySelector<HTMLElement>(".thread-item");
    if (!item) throw new Error("Missing item");
    item.click();
    expect(onSelectThread).toHaveBeenCalled();
  });
});
