import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type { ActiveRecordingProcessingTask } from '@/lib/api/types';

const POLL_INTERVAL_MS = 700;

export function useRecordingProcessingProgress(taskId: string | null) {
  const [task, setTask] = useState<ActiveRecordingProcessingTask | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const hasSeenTaskRef = useRef(false);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      hasSeenTaskRef.current = false;
      setIsPolling(false);
      return;
    }

    let cancelled = false;
    setIsPolling(true);

    const poll = async () => {
      try {
        const activeTasks = await apiClient.getActiveTasks();
        const matchingTask =
          activeTasks.recording_processing.find((activeTask) => activeTask.task_id === taskId) ??
          null;

        if (cancelled) return;

        if (matchingTask) {
          hasSeenTaskRef.current = true;
          setTask(matchingTask);
          setIsPolling(true);
          return;
        }

        if (hasSeenTaskRef.current) {
          setTask(null);
          setIsPolling(false);
          return;
        }

        setTask(null);
      } catch {
        if (!cancelled) {
          setTask((current) => current);
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId]);

  return {
    task,
    isPolling,
  };
}
