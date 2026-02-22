export type RecordingLifecycleState =
  | 'idle'
  | 'armed'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'ready'
  | 'error';

export interface RecordingLifecycleStatusCopy {
  title: string;
  description: string;
}

export const RECORDING_LIFECYCLE_STATUS_COPY: Record<
  RecordingLifecycleState,
  RecordingLifecycleStatusCopy
> = {
  idle: {
    title: 'Ready to start',
    description: 'Prepare your microphone and start when ready.',
  },
  armed: {
    title: 'Microphone armed',
    description: 'Press start to begin recording.',
  },
  recording: {
    title: 'Recording in progress',
    description: 'Speak clearly and keep background noise low.',
  },
  paused: {
    title: 'Recording paused',
    description: 'Resume recording or stop to process the sample.',
  },
  processing: {
    title: 'Processing sample',
    description: 'Preparing audio for transcription and profile use.',
  },
  ready: {
    title: 'Recording ready',
    description: 'Playback or transcribe before saving.',
  },
  error: {
    title: 'Recording error',
    description: 'Review the error details and reset to try again.',
  },
};

const VALID_TRANSITIONS: Record<RecordingLifecycleState, RecordingLifecycleState[]> = {
  idle: ['armed', 'error'],
  armed: ['recording', 'idle', 'error'],
  recording: ['paused', 'processing', 'idle', 'error'],
  paused: ['recording', 'processing', 'idle', 'error'],
  processing: ['ready', 'error', 'idle'],
  ready: ['armed', 'recording', 'idle', 'error'],
  error: ['idle', 'armed'],
};

export interface TransitionResult {
  next: RecordingLifecycleState;
  valid: boolean;
}

export function canTransitionRecordingLifecycle(
  from: RecordingLifecycleState,
  to: RecordingLifecycleState,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function transitionRecordingLifecycle(
  from: RecordingLifecycleState,
  to: RecordingLifecycleState,
): TransitionResult {
  if (from === to) {
    return { next: from, valid: true };
  }

  if (!canTransitionRecordingLifecycle(from, to)) {
    return { next: from, valid: false };
  }

  return { next: to, valid: true };
}

export function getRecordingLifecycleCopy(
  state: RecordingLifecycleState,
): RecordingLifecycleStatusCopy {
  return RECORDING_LIFECYCLE_STATUS_COPY[state];
}
