import { EventEmitter } from "node:events";

/**
 * In-process pub/sub so the SSE route (apps/web) and Inngest workflows (this package)
 * can talk to each other directly — both run inside the same Next.js server process,
 * since Inngest invokes functions via HTTP callbacks into /api/inngest.
 */
const bus = new EventEmitter();
bus.setMaxListeners(0);

export interface WorkspaceEvent {
  type: string;
  [key: string]: unknown;
}

function channel(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

export function publishWorkspaceEvent(
  workspaceId: string,
  event: WorkspaceEvent,
): void {
  bus.emit(channel(workspaceId), event);
}

/** Returns an unsubscribe function. */
export function subscribeWorkspaceEvents(
  workspaceId: string,
  listener: (event: WorkspaceEvent) => void,
): () => void {
  const ch = channel(workspaceId);
  bus.on(ch, listener);
  return () => bus.off(ch, listener);
}
