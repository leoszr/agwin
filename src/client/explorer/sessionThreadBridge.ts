import type { Project, Workspace, SessionInfo, SessionStatus, SessionActivity, Machine } from "../src/api";
import type { WebEnvironmentStatus } from "../src/controlSurface/webEnvironmentRuntime";
import type { Thread, ThreadState } from "../domain/thread";
import type { ProjectExplorerProject } from "./ProjectExplorer";
import { normalizeSessionPath } from "../src/sessionPaths";
import { shortSessionId } from "../src/sessionLabels";

export type BridgeProject = Project & { environmentId?: string | undefined };

export interface SessionThreadBridgeOptions {
  sessions: readonly SessionInfo[];
  workspaces: readonly Workspace[];
  projects: readonly BridgeProject[];
  machines?: readonly Machine[] | undefined;
  selectedMachineId?: string | undefined;
  sessionStatuses?: Record<string, SessionStatus> | undefined;
  sessionActivities?: Record<string, SessionActivity> | undefined;
  sendingPrompts?: Record<string, true> | undefined;
  environmentStatuses?: Record<string, WebEnvironmentStatus> | undefined;
  unreadSessionIds?: ReadonlySet<string> | undefined;
}

export interface SessionThreadBridgeResult {
  projects: ProjectExplorerProject[];
  threads: Thread[];
  sessionByThreadId: Map<string, SessionInfo>;
  workspaceByThreadId: Map<string, Workspace>;
  projectByThreadId: Map<string, Project>;
}

export function deriveThreadState(
  sessionId: string,
  environmentId: string,
  options: Pick<SessionThreadBridgeOptions, "sessionStatuses" | "sessionActivities" | "sendingPrompts" | "environmentStatuses">,
): ThreadState {
  const envStatus = options.environmentStatuses?.[environmentId];
  if (
    envStatus !== undefined &&
    (envStatus.state === "offline" || envStatus.state === "blocked" || envStatus.error !== undefined)
  ) {
    return "offline";
  }

  const activity = options.sessionActivities?.[sessionId];
  if (activity?.phase === "error") {
    return "error";
  }

  const status = options.sessionStatuses?.[sessionId];
  if (
    status?.pendingAsk !== undefined ||
    (status?.pendingDialogs !== undefined && status.pendingDialogs.length > 0)
  ) {
    return "waiting";
  }

  const sending = options.sendingPrompts?.[sessionId] === true;
  if (
    sending ||
    status?.isStreaming === true ||
    status?.isBashRunning === true ||
    status?.isCompacting === true ||
    activity?.phase === "active"
  ) {
    return "running";
  }

  return "completed";
}

export function sessionTitle(session: SessionInfo): string {
  if (session.name !== undefined && session.name.trim() !== "") {
    return session.name.trim();
  }
  if (session.firstMessage.trim() !== "") {
    return session.firstMessage.trim();
  }
  return shortSessionId(session.id);
}

function projectEnvId(proj: BridgeProject, defaultEnvId: string): string {
  return proj.environmentId ?? defaultEnvId;
}

export function bridgeSessionsToThreads(options: SessionThreadBridgeOptions): SessionThreadBridgeResult {
  const defaultEnvId = options.selectedMachineId ?? "local";
  const sessionByThreadId = new Map<string, SessionInfo>();
  const workspaceByThreadId = new Map<string, Workspace>();
  const projectByThreadId = new Map<string, Project>();

  // Map of normalized path -> Workspace
  const workspaceByPath = new Map<string, Workspace>();
  for (const ws of options.workspaces) {
    workspaceByPath.set(normalizeSessionPath(ws.path), ws);
  }

  // Map of projectId -> Project
  const projectById = new Map<string, BridgeProject>();
  for (const proj of options.projects) {
    projectById.set(proj.id, proj);
  }

  // Build ProjectExplorerProject list
  const knownProjectKeys = new Set<string>();
  const explorerProjects: ProjectExplorerProject[] = [];

  for (const proj of options.projects) {
    const envId = projectEnvId(proj, defaultEnvId);
    const key = `${proj.id}:${envId}`;
    if (!knownProjectKeys.has(key)) {
      knownProjectKeys.add(key);
      explorerProjects.push({
        id: proj.id,
        name: proj.name,
        environmentId: envId,
      });
    }
  }

  const threads: Thread[] = [];

  for (const session of options.sessions) {
    const sessionCwd = session.cwd;
    const normCwd = normalizeSessionPath(sessionCwd);

    // 1. Resolve Workspace
    const matchedWs = workspaceByPath.get(normCwd);
    const workspaceId = matchedWs?.id ?? (sessionCwd !== "" ? sessionCwd : "default-workspace");
    const workspaceLabel = matchedWs !== undefined ? (matchedWs.label !== "" ? matchedWs.label : matchedWs.path) : sessionCwd;

    // 2. Resolve Project
    let projectId = matchedWs?.projectId;
    let matchedProject: BridgeProject | undefined;

    if (projectId !== undefined) {
      matchedProject = projectById.get(projectId);
    }

    if (matchedProject === undefined) {
      // Fallback: search by path prefix
      matchedProject = options.projects.find(
        (p) => normCwd === normalizeSessionPath(p.path) || normCwd.startsWith(normalizeSessionPath(p.path)),
      );
      if (matchedProject !== undefined) {
        projectId = matchedProject.id;
      }
    }

    let projectName = matchedProject?.name ?? "Other Sessions";
    if (projectId === undefined || matchedProject === undefined) {
      projectId = "default-project";
      projectName = "Other Sessions";
    }

    // 3. Resolve Environment (derived from project or defaultEnvId)
    const environmentId = matchedProject ? projectEnvId(matchedProject, defaultEnvId) : defaultEnvId;

    // Ensure project exists for this environment
    const projectEnvKey = `${projectId}:${environmentId}`;
    if (!knownProjectKeys.has(projectEnvKey)) {
      knownProjectKeys.add(projectEnvKey);
      explorerProjects.push({
        id: projectId,
        name: projectName,
        environmentId,
      });
    }

    // 4. Derive ThreadState
    const state = deriveThreadState(session.id, environmentId, options);

    const title = sessionTitle(session);
    const unread = options.unreadSessionIds?.has(session.id) ?? false;

    const thread: Thread = {
      id: session.id,
      sessionId: session.id,
      workspaceId,
      projectId,
      environmentId,
      title,
      state,
      createdAt: session.created,
      workspaceLabel,
      projectName,
      unread,
    };

    threads.push(thread);
    sessionByThreadId.set(thread.id, session);
    if (matchedWs !== undefined) {
      workspaceByThreadId.set(thread.id, matchedWs);
    }
    if (matchedProject !== undefined) {
      projectByThreadId.set(thread.id, matchedProject);
    }
  }

  return {
    projects: explorerProjects,
    threads,
    sessionByThreadId,
    workspaceByThreadId,
    projectByThreadId,
  };
}
