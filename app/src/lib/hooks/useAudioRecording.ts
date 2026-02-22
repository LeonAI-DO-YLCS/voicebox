import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlatform } from '@/platform/PlatformContext';
import { convertToWav } from '@/lib/utils/audio';

interface UseAudioRecordingOptions {
  maxDurationSeconds?: number;
  onRecordingComplete?: (blob: Blob, duration?: number) => void;
}

export function useAudioRecording({
  maxDurationSeconds = 29,
  onRecordingComplete,
}: UseAudioRecordingOptions = {}) {
  const platform = usePlatform();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeFallbackRef = useRef(false);
  const nativeFallbackReasonRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const cancelledRef = useRef<boolean>(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const extractErrorMessage = useCallback((err: unknown): string => {
    if (err instanceof Error && typeof err.message === 'string') {
      return err.message;
    }
    if (typeof err === 'string') {
      return err;
    }
    if (typeof err === 'object' && err !== null) {
      const record = err as Record<string, unknown>;
      if (typeof record.message === 'string') {
        return record.message;
      }
      if (typeof record.error === 'string') {
        return record.error;
      }
      if (typeof record.cause === 'string') {
        return record.cause;
      }
      try {
        return JSON.stringify(record);
      } catch {
        return String(err);
      }
    }
    return String(err);
  }, []);

  const mapMicError = useCallback(
    (err: unknown): string => {
      if (typeof err === 'object' && err !== null) {
        const domErr = err as DOMException & { message?: string };
        const message = domErr.message || '';

        if (
          domErr.name === 'NotAllowedError' ||
          domErr.name === 'SecurityError' ||
          /request is not allowed/i.test(message)
        ) {
          if (platform.metadata.isTauri) {
            if (nativeFallbackReasonRef.current) {
              return `Microphone access was denied by the webview/runtime. Native fallback unavailable: ${nativeFallbackReasonRef.current}`;
            }
            return 'Microphone access was denied by the webview/runtime. Use the "System Audio" tab for native input capture, or enable Windows microphone privacy access (including desktop apps) and restart Voicebox.';
          }
          return 'Microphone access was denied. Allow microphone permission for Voicebox and try again.';
        }

        if (domErr.name === 'NotFoundError') {
          return 'No microphone was found. Connect or enable a microphone and try again.';
        }

        if (domErr.name === 'NotReadableError') {
          return 'The microphone is currently unavailable (possibly in use by another app). Close other apps using the mic and try again.';
        }

        if (message.trim().length > 0) {
          return message;
        }
      }

      if (typeof err === 'string' && err.trim().length > 0) {
        return err;
      }

      return 'Failed to access microphone. Please check permissions and device availability.';
    },
    [platform.metadata.isTauri],
  );

  const startNativeFallbackCapture = useCallback(async () => {
    await platform.audio.startSystemAudioCapture(maxDurationSeconds, null);
    nativeFallbackRef.current = true;
    setIsRecording(true);
    startTimeRef.current = Date.now();

    timerRef.current = window.setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setDuration(elapsed);
      if (elapsed >= maxDurationSeconds) {
        void stopRecording();
      }
    }, 100);
  }, [maxDurationSeconds, platform.audio]);

  const tryNativeFallbackCapture = useCallback(async (): Promise<boolean> => {
    if (!platform.metadata.isTauri) {
      nativeFallbackReasonRef.current = 'Not running in Tauri runtime.';
      return false;
    }
    try {
      await startNativeFallbackCapture();
      nativeFallbackReasonRef.current = null;
      return true;
    } catch (err) {
      nativeFallbackReasonRef.current = extractErrorMessage(err);
      return false;
    }
  }, [extractErrorMessage, platform.metadata.isTauri, startNativeFallbackCapture]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];
      cancelledRef.current = false;
      nativeFallbackRef.current = false;
      setDuration(0);

      // Check if getUserMedia is available
      // In Tauri, navigator.mediaDevices might not be available immediately
      if (typeof navigator === 'undefined') {
        if (await tryNativeFallbackCapture()) {
          return;
        }
        const errorMsg =
          'Navigator API is not available. This might be a Tauri configuration issue.';
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Try waiting a bit for Tauri webview to initialize
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (await tryNativeFallbackCapture()) {
            return;
          }
          console.error('MediaDevices check:', {
            hasNavigator: typeof navigator !== 'undefined',
            hasMediaDevices: !!navigator?.mediaDevices,
            hasGetUserMedia: !!navigator?.mediaDevices?.getUserMedia,
            isTauri: platform.metadata.isTauri,
          });

          const errorMsg = platform.metadata.isTauri
            ? 'Microphone access is not available. Please ensure:\n1. The app has microphone permissions in System Settings (macOS: System Settings > Privacy & Security > Microphone)\n2. You restart the app after granting permissions\n3. You are using Tauri v2 with a webview that supports getUserMedia'
            : 'Microphone access is not available. Please ensure you are using a secure context (HTTPS or localhost) and that your browser has microphone permissions enabled.';
          setError(errorMsg);
          throw new Error(errorMsg);
        }
      }

      // Request microphone access
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        if (await tryNativeFallbackCapture()) {
          return;
        }
        throw err;
      }

      streamRef.current = stream;

      // Create MediaRecorder with preferred MIME type
      const options: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus',
      };

      // Fallback to default if webm not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        delete options.mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Snapshot the cancellation flag and recorded duration immediately —
        // cancelRecording() clears chunks and sets cancelledRef synchronously
        // before this async handler runs, so we must check it first.
        const wasCancelled = cancelledRef.current;
        const recordedDuration = startTimeRef.current
          ? (Date.now() - startTimeRef.current) / 1000
          : undefined;

        const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Stop all tracks now that we have the data
        streamRef.current?.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;

        // Don't fire completion callback if the recording was cancelled
        if (wasCancelled) return;

        // Convert to WAV format to avoid needing ffmpeg on backend
        try {
          const wavBlob = await convertToWav(webmBlob);
          onRecordingComplete?.(wavBlob, recordedDuration);
        } catch (err) {
          console.error('Error converting audio to WAV:', err);
          // Fallback to original blob if conversion fails
          onRecordingComplete?.(webmBlob, recordedDuration);
        }
      };

      mediaRecorder.onerror = (event) => {
        setError('Recording error occurred');
        console.error('MediaRecorder error:', event);
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Start timer
      timerRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          setDuration(elapsed);

          // Auto-stop at max duration
          if (elapsed >= maxDurationSeconds) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
              setIsRecording(false);
              clearTimer();
            }
          }
        }
      }, 100);
    } catch (err) {
      const errorMessage = mapMicError(err);
      setError(errorMessage);
      setIsRecording(false);
    }
  }, [
    maxDurationSeconds,
    onRecordingComplete,
    tryNativeFallbackCapture,
    clearTimer,
    mapMicError,
  ]);

  const stopRecording = useCallback(() => {
    if (nativeFallbackRef.current && isRecording) {
      nativeFallbackRef.current = false;
      setIsRecording(false);
      clearTimer();
      const recordedDuration = startTimeRef.current
        ? (Date.now() - startTimeRef.current) / 1000
        : undefined;

      void platform.audio
        .stopSystemAudioCapture()
        .then((blob) => {
          onRecordingComplete?.(blob, recordedDuration);
        })
        .catch((err) => {
          setError(mapMicError(err));
        });
      return;
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearTimer();
    }
  }, [isRecording, platform.audio, onRecordingComplete, clearTimer, mapMicError]);

  const cancelRecording = useCallback(() => {
    if (nativeFallbackRef.current) {
      nativeFallbackRef.current = false;
      setIsRecording(false);
      setDuration(0);
      clearTimer();
      void platform.audio.stopSystemAudioCapture().catch((err) => {
        console.error('Failed stopping native fallback capture:', err);
      });
      return;
    }

    if (mediaRecorderRef.current) {
      cancelledRef.current = true; // Must be set before stop() triggers onstop
      chunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setDuration(0);
    }

    // Stop all tracks
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;

    clearTimer();
  }, [platform.audio, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      if (nativeFallbackRef.current) {
        nativeFallbackRef.current = false;
        void platform.audio.stopSystemAudioCapture().catch((err) => {
          console.error('Error stopping native fallback capture on unmount:', err);
        });
      }
    };
  }, [clearTimer, platform.audio]);

  return {
    isRecording,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
