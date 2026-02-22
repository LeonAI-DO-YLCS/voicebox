import { describe, expect, it } from 'bun:test';
import { mergeUnifiedTasks, type UnifiedActiveTask } from './activeTasks';

function makeTask(id: string, overrides?: Partial<UnifiedActiveTask>): UnifiedActiveTask {
  return {
    id,
    source: 'recording_processing',
    title: 'Recording Processing',
    subtitle: 'Transcribing',
    status: 'running',
    progress: 50,
    startedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('mergeUnifiedTasks', () => {
  it('keeps mixed active task types without collisions', () => {
    const previous = new Map<string, UnifiedActiveTask>();
    const now = Date.now();
    const merged = mergeUnifiedTasks(
      previous,
      [
        makeTask('download:qwen-tts-1.7B', { source: 'download', title: 'Model Download' }),
        makeTask('processing:abc', {
          source: 'recording_processing',
          title: 'Recording Processing',
        }),
      ],
      now,
      5000,
    );

    expect(merged.size).toBe(2);
    expect(merged.has('download:qwen-tts-1.7B')).toBe(true);
    expect(merged.has('processing:abc')).toBe(true);
  });

  it('marks disappeared running task as terminal complete and expires it', () => {
    const now = Date.now();
    const previous = new Map<string, UnifiedActiveTask>([
      ['processing:abc', makeTask('processing:abc')],
    ]);

    const withTerminal = mergeUnifiedTasks(previous, [], now, 1000);
    const completedTask = withTerminal.get('processing:abc');
    expect(completedTask?.status).toBe('complete');
    expect(completedTask?.terminalAt).toBe(now);

    const expired = mergeUnifiedTasks(withTerminal, [], now + 2000, 1000);
    expect(expired.has('processing:abc')).toBe(false);
  });
});
