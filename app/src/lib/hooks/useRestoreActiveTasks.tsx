import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type {
  ActiveDownloadTask,
  ActiveGenerationTask,
  ActiveRecordingProcessingTask,
} from '@/lib/api/types';
import { mergeUnifiedTasks, type UnifiedActiveTask } from '@/lib/recording/activeTasks';
import { RECORDING_PROCESSING_STAGE_LABELS } from '@/lib/recording/processing';
import { useGenerationStore } from '@/stores/generationStore';

const POLL_INTERVAL = 1500;
const TERMINAL_TASK_TTL_MS = 8000;

function toUnifiedDownloadTask(task: ActiveDownloadTask): UnifiedActiveTask {
  const status = task.status === 'error' ? 'error' : 'running';
  return {
    id: `download:${task.model_name}`,
    source: 'download',
    title: `Model Download: ${task.model_name}`,
    subtitle: status === 'error' ? 'Download failed' : 'Download in progress',
    status,
    progress: null,
    startedAt: task.started_at,
    updatedAt: task.started_at,
  };
}

function toUnifiedGenerationTask(task: ActiveGenerationTask): UnifiedActiveTask {
  return {
    id: `generation:${task.task_id}`,
    source: 'generation',
    title: 'Speech Generation',
    subtitle: task.text_preview,
    status: 'running',
    progress: null,
    startedAt: task.started_at,
    updatedAt: task.started_at,
  };
}

function toUnifiedProcessingTask(task: ActiveRecordingProcessingTask): UnifiedActiveTask {
  const status = task.status === 'error' ? 'error' : 'running';
  return {
    id: `processing:${task.task_id}`,
    source: 'recording_processing',
    title: 'Recording Processing',
    subtitle:
      task.message ||
      (status === 'error'
        ? task.error || 'Processing failed'
        : RECORDING_PROCESSING_STAGE_LABELS[task.stage]),
    status,
    progress: task.progress,
    startedAt: task.started_at,
    updatedAt: task.updated_at,
  };
}

export function useRestoreActiveTasks() {
  const [activeDownloads, setActiveDownloads] = useState<ActiveDownloadTask[]>([]);
  const [tasks, setTasks] = useState<UnifiedActiveTask[]>([]);
  const setIsGenerating = useGenerationStore((state) => state.setIsGenerating);
  const setActiveGenerationId = useGenerationStore((state) => state.setActiveGenerationId);
  const previousTaskMapRef = useRef<Map<string, UnifiedActiveTask>>(new Map());

  const fetchActiveTasks = useCallback(async () => {
    try {
      const active = await apiClient.getActiveTasks();

      if (active.generations.length > 0) {
        setIsGenerating(true);
        setActiveGenerationId(active.generations[0].task_id);
      } else {
        const currentId = useGenerationStore.getState().activeGenerationId;
        if (currentId) {
          setIsGenerating(false);
          setActiveGenerationId(null);
        }
      }

      setActiveDownloads(active.downloads);

      const now = Date.now();
      const currentTasks: UnifiedActiveTask[] = [];
      for (const download of active.downloads) {
        currentTasks.push(toUnifiedDownloadTask(download));
      }
      for (const generation of active.generations) {
        currentTasks.push(toUnifiedGenerationTask(generation));
      }
      for (const processing of active.recording_processing) {
        currentTasks.push(toUnifiedProcessingTask(processing));
      }

      const merged = mergeUnifiedTasks(
        previousTaskMapRef.current,
        currentTasks,
        now,
        TERMINAL_TASK_TTL_MS,
      );

      previousTaskMapRef.current = merged;
      setTasks(
        Array.from(merged.values()).sort((a, b) => {
          const aTime = new Date(a.updatedAt).getTime();
          const bTime = new Date(b.updatedAt).getTime();
          return bTime - aTime;
        }),
      );
    } catch (error) {
      console.debug('Failed to fetch active tasks:', error);
    }
  }, [setActiveGenerationId, setIsGenerating]);

  useEffect(() => {
    void fetchActiveTasks();
    const interval = setInterval(() => {
      void fetchActiveTasks();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchActiveTasks]);

  return { activeDownloads, tasks };
}

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'qwen-tts-1.7B': 'Qwen TTS 1.7B',
  'qwen-tts-0.6B': 'Qwen TTS 0.6B',
  'whisper-turbo': 'Whisper Turbo (Large-v3 Turbo)',
  'whisper-large-v3': 'Whisper Large-v3',
  'whisper-base': 'Whisper Base',
  'whisper-small': 'Whisper Small',
  'whisper-medium': 'Whisper Medium',
  'whisper-large': 'Whisper Large',
};
