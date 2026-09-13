export type ThreadState = "running" | "waiting" | "completed" | "error" | "offline";

export interface Thread {
  id: string;
  sessionId: string; // 1:1 invariant with Session!
  workspaceId: string; // Immutable link!
  projectId: string; // Belongs to project in an environment
  environmentId: string;
  title: string;
  state: ThreadState;
  createdAt: string;
  parentThreadId?: string | undefined;
  forkedFromSessionSeq?: number | undefined;
  readOnlyTranscriptCache?: unknown[] | undefined;
}

export interface CreateThreadInput {
  title: string;
  projectId: string;
  workspaceId: string;
  environmentId: string;
  sessionId?: string | undefined;
}

export interface ForkThreadOptions {
  newTitle?: string | undefined;
  isolatedWorkspaceId?: string | undefined; // Optional: user may choose explicit isolation
  forkedAtSeq?: number | undefined;
}

export function createThread(input: CreateThreadInput): Thread {
  const timestamp = String(Date.now());
  const rand = Math.random().toString(36).slice(2, 7);
  const threadId = `thread-${timestamp}-${rand}`;
  return {
    id: threadId,
    sessionId: input.sessionId !== undefined && input.sessionId.length > 0 ? input.sessionId : `session-${threadId}`,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    title: input.title,
    state: "running",
    createdAt: new Date().toISOString(),
  };
}

export function resumeThread(thread: Thread): { sessionId: string; workspaceId: string; environmentId: string } {
  // Retomar retoma a MESMA Session e preserva o MESMO Workspace
  return {
    sessionId: thread.sessionId,
    workspaceId: thread.workspaceId,
    environmentId: thread.environmentId,
  };
}

export function forkThread(parent: Thread, options?: ForkThreadOptions): Thread {
  const timestamp = String(Date.now());
  const rand = Math.random().toString(36).slice(2, 7);
  const forkedThreadId = `thread-${timestamp}-${rand}`;
  return {
    id: forkedThreadId,
    sessionId: `session-${forkedThreadId}`, // Nova Session para a ramificação!
    workspaceId: options?.isolatedWorkspaceId ?? parent.workspaceId, // Compartilha workspace por default ou isola se explicitamente pedido
    projectId: parent.projectId,
    environmentId: parent.environmentId,
    title: options?.newTitle ?? `${parent.title} (fork)`,
    state: "running",
    createdAt: new Date().toISOString(),
    parentThreadId: parent.id,
    forkedFromSessionSeq: options?.forkedAtSeq,
  };
}

export function groupThreadsByState(threads: Thread[]): Record<ThreadState, Thread[]> {
  const buckets: Record<ThreadState, Thread[]> = {
    running: [],
    waiting: [],
    completed: [],
    error: [],
    offline: [],
  };

  for (const t of threads) {
    const list = buckets[t.state];
    list.push(t);
  }

  return buckets;
}

export function getThreadDisambiguation(
  target: Thread,
  allThreads: Thread[],
): { isAmbiguousTitle: boolean; showEnvironmentTag: boolean } {
  const matchingTitle = allThreads.filter((t) => t.title.toLowerCase() === target.title.toLowerCase());
  const isAmbiguousTitle = matchingTitle.length > 1;
  const multipleEnvironments = new Set(allThreads.map((t) => t.environmentId)).size > 1;
  const showEnvironmentTag = target.environmentId !== "local" || (isAmbiguousTitle && multipleEnvironments);

  return {
    isAmbiguousTitle,
    showEnvironmentTag,
  };
}
