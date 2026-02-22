export type UnifiedTaskSource = 'download' | 'generation' | 'recording_processing';
export type UnifiedTaskStatus = 'running' | 'complete' | 'error';

export interface UnifiedActiveTask {
  id: string;
  source: UnifiedTaskSource;
  title: string;
  subtitle: string;
  status: UnifiedTaskStatus;
  progress: number | null;
  startedAt: string;
  updatedAt: string;
  terminalAt?: number;
}

export function mergeUnifiedTasks(
  previous: Map<string, UnifiedActiveTask>,
  currentTasks: UnifiedActiveTask[],
  now: number,
  terminalTtlMs: number,
): Map<string, UnifiedActiveTask> {
  const currentTaskMap = new Map<string, UnifiedActiveTask>(
    currentTasks.map((task) => [task.id, task]),
  );

  const merged = new Map<string, UnifiedActiveTask>(currentTaskMap);
  for (const [taskId, previousTask] of previous.entries()) {
    if (!currentTaskMap.has(taskId) && !previousTask.terminalAt) {
      merged.set(taskId, {
        ...previousTask,
        status: previousTask.status === 'error' ? 'error' : 'complete',
        subtitle: previousTask.status === 'error' ? previousTask.subtitle : 'Completed',
        terminalAt: now,
        updatedAt: new Date(now).toISOString(),
      });
    }
  }

  for (const [taskId, task] of merged.entries()) {
    if (task.terminalAt && now - task.terminalAt > terminalTtlMs) {
      merged.delete(taskId);
    }
  }

  return merged;
}
