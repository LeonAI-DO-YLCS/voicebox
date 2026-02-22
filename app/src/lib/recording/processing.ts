export type RecordingProcessingStage = 'upload' | 'validate' | 'transcribe' | 'embed' | 'save';

export const RECORDING_PROCESSING_STAGES: RecordingProcessingStage[] = [
  'upload',
  'validate',
  'transcribe',
  'embed',
  'save',
];

export const RECORDING_PROCESSING_STAGE_LABELS: Record<RecordingProcessingStage, string> = {
  upload: 'Uploading sample',
  validate: 'Validating audio',
  transcribe: 'Transcribing speech',
  embed: 'Preparing voice embedding',
  save: 'Saving sample',
};

export type RecordingProcessingStatus = 'running' | 'complete' | 'error';

export interface RecordingProcessingTask {
  task_id: string;
  status: RecordingProcessingStatus;
  stage: RecordingProcessingStage;
  progress: number | null;
  message?: string;
  started_at: string;
  updated_at: string;
  error?: string;
}
