import { describe, expect, it } from 'bun:test';
import { canTransitionRecordingLifecycle, transitionRecordingLifecycle } from './lifecycle';

describe('recording lifecycle transitions', () => {
  it('allows valid transitions in the expected order', () => {
    expect(canTransitionRecordingLifecycle('idle', 'armed')).toBe(true);
    expect(canTransitionRecordingLifecycle('armed', 'recording')).toBe(true);
    expect(canTransitionRecordingLifecycle('recording', 'processing')).toBe(true);
    expect(canTransitionRecordingLifecycle('processing', 'ready')).toBe(true);
  });

  it('rejects invalid direct transitions', () => {
    expect(canTransitionRecordingLifecycle('idle', 'processing')).toBe(false);
    const result = transitionRecordingLifecycle('idle', 'processing');
    expect(result.valid).toBe(false);
    expect(result.next).toBe('idle');
  });

  it('supports reset from error back to idle', () => {
    const result = transitionRecordingLifecycle('error', 'idle');
    expect(result.valid).toBe(true);
    expect(result.next).toBe('idle');
  });
});
