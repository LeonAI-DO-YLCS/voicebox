export interface VoiceboxErrorDetails {
  title: string;
  summary: string;
  hint?: string;
  technical?: string;
  requestId?: string;
  status?: number;
  endpoint?: string;
  method?: string;
}

export class VoiceboxAppError extends Error {
  details: VoiceboxErrorDetails;

  constructor(details: VoiceboxErrorDetails) {
    super(details.summary);
    this.name = 'VoiceboxAppError';
    this.details = details;
  }
}

export function isVoiceboxAppError(error: unknown): error is VoiceboxAppError {
  return error instanceof VoiceboxAppError;
}

export function getErrorDisplayDetails(
  error: unknown,
  fallbackTitle = 'Something went wrong',
): VoiceboxErrorDetails {
  if (isVoiceboxAppError(error)) {
    return error.details;
  }

  if (error instanceof Error) {
    return {
      title: fallbackTitle,
      summary: error.message || 'Unexpected error',
      technical: error.stack,
    };
  }

  return {
    title: fallbackTitle,
    summary: 'Unexpected error',
    technical: typeof error === 'string' ? error : JSON.stringify(error, null, 2),
  };
}
