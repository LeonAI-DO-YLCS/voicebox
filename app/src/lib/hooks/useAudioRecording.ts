import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getRecordingLifecycleCopy,
  type RecordingLifecycleState,
  transitionRecordingLifecycle,
} from '@/lib/recording/lifecycle';
import { convertToWav } from '@/lib/utils/audio';
import { usePlatform } from '@/platform/PlatformContext';

interface UseAudioRecordingOptions {
  maxDurationSeconds?: number;
  onRecordingComplete?: (blob: Blob, duration?: number) => void;
}

type WaveformMode = 'waveform' | 'meter';

export function useAudioRecording({
  maxDurationSeconds = 29,
  onRecordingComplete,
}: UseAudioRecordingOptions = {}) {
  const platform = usePlatform();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lifecycleState, setLifecycleState] = useState<RecordingLifecycleState>('idle');
  const [liveInputLevel, setLiveInputLevel] = useState(0);
  const [waveformSamples, setWaveformSamples] = useState<number[]>([]);
  const [waveformMode, setWaveformMode] = useState<WaveformMode>('waveform');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeFallbackRef = useRef(false);
  const nativeFallbackReasonRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const cancelledRef = useRef<boolean>(false);
  const stopRecordingRef = useRef<(() => void) | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const waveformBufferRef = useRef<Float32Array | null>(null);

  const applyLifecycleState = useCallback((target: RecordingLifecycleState) => {
    setLifecycleState((current) => {
      const result = transitionRecordingLifecycle(current, target);
      if (!result.valid) {
        console.warn(
          `[recording:lifecycle] rejected transition ${current} -> ${target}; keeping ${result.next}`,
        );
      }
      return result.next;
    });
  }, []);

  const resetLifecycle = useCallback(() => {
    setError(null);
    setDuration(0);
    setLiveInputLevel(0);
    setWaveformSamples([]);
    applyLifecycleState('idle');
  }, [applyLifecycleState]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopSignalMonitoring = useCallback(() => {
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    analyserRef.current = null;
    waveformBufferRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const startSignalMonitoring = useCallback((stream: MediaStream): boolean => {
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return false;
      }

      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      sourceNodeRef.current = source;
      analyserRef.current = analyser;
      waveformBufferRef.current = new Float32Array(analyser.fftSize);
      return true;
    } catch (monitoringError) {
      console.warn(
        'Waveform monitoring is unavailable, falling back to meter mode:',
        monitoringError,
      );
      return false;
    }
  }, []);

  const sampleInputLevel = useCallback(() => {
    const analyser = analyserRef.current;
    const waveformBuffer = waveformBufferRef.current;
    if (!analyser || !waveformBuffer) {
      return;
    }

    analyser.getFloatTimeDomainData(waveformBuffer);
    let sumSquares = 0;
    for (let index = 0; index < waveformBuffer.length; index += 1) {
      const sample = waveformBuffer[index];
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / waveformBuffer.length);
    const normalizedLevel = Math.min(1, Math.max(0, rms * 3));
    setLiveInputLevel(normalizedLevel);
    setWaveformSamples((current) => [...current.slice(-239), normalizedLevel]);
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
    applyLifecycleState('armed');
    await platform.audio.startSystemAudioCapture(maxDurationSeconds, null);
    nativeFallbackRef.current = true;
    setWaveformMode('meter');
    setIsRecording(true);
    applyLifecycleState('recording');
    startTimeRef.current = Date.now();

    timerRef.current = window.setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setDuration(elapsed);
      if (elapsed >= maxDurationSeconds) {
        stopRecordingRef.current?.();
      }
    }, 100);
  }, [applyLifecycleState, maxDurationSeconds, platform.audio]);

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
      setLiveInputLevel(0);
      setWaveformSamples([]);
      setWaveformMode('waveform');
      applyLifecycleState('armed');

      if (typeof navigator === 'undefined') {
        if (await tryNativeFallbackCapture()) {
          return;
        }
        const errorMsg =
          'Navigator API is not available. This might be a Tauri configuration issue.';
        setError(errorMsg);
        applyLifecycleState('error');
        throw new Error(errorMsg);
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (await tryNativeFallbackCapture()) {
            return;
          }
          const errorMsg = platform.metadata.isTauri
            ? 'Microphone access is not available. Please ensure:\n1. The app has microphone permissions in System Settings (macOS: System Settings > Privacy & Security > Microphone)\n2. You restart the app after granting permissions\n3. You are using Tauri v2 with a webview that supports getUserMedia'
            : 'Microphone access is not available. Please ensure you are using a secure context (HTTPS or localhost) and that your browser has microphone permissions enabled.';
          setError(errorMsg);
          applyLifecycleState('error');
          throw new Error(errorMsg);
        }
      }

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
      const canMonitorWaveform = startSignalMonitoring(stream);
      if (!canMonitorWaveform) {
        setWaveformMode('meter');
      }

      const options: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus',
      };

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
        const wasCancelled = cancelledRef.current;
        const recordedDuration = startTimeRef.current
          ? (Date.now() - startTimeRef.current) / 1000
          : undefined;

        const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        streamRef.current?.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
        stopSignalMonitoring();

        if (wasCancelled) {
          resetLifecycle();
          return;
        }

        applyLifecycleState('processing');
        try {
          const wavBlob = await convertToWav(webmBlob);
          onRecordingComplete?.(wavBlob, recordedDuration);
        } catch (err) {
          console.error('Error converting audio to WAV:', err);
          onRecordingComplete?.(webmBlob, recordedDuration);
        }
        applyLifecycleState('ready');
      };

      mediaRecorder.onerror = (event) => {
        const nextError = 'Recording error occurred';
        setError(nextError);
        applyLifecycleState('error');
        console.error('MediaRecorder error:', event);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      applyLifecycleState('recording');
      startTimeRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          setDuration(elapsed);
          sampleInputLevel();

          if (elapsed >= maxDurationSeconds) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              applyLifecycleState('processing');
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
      applyLifecycleState('error');
    }
  }, [
    applyLifecycleState,
    clearTimer,
    mapMicError,
    maxDurationSeconds,
    onRecordingComplete,
    platform.metadata.isTauri,
    resetLifecycle,
    sampleInputLevel,
    startSignalMonitoring,
    stopSignalMonitoring,
    tryNativeFallbackCapture,
  ]);

  const stopRecording = useCallback(() => {
    if (nativeFallbackRef.current && isRecording) {
      nativeFallbackRef.current = false;
      setIsRecording(false);
      clearTimer();
      applyLifecycleState('processing');
      const recordedDuration = startTimeRef.current
        ? (Date.now() - startTimeRef.current) / 1000
        : undefined;

      void platform.audio
        .stopSystemAudioCapture()
        .then((blob) => {
          onRecordingComplete?.(blob, recordedDuration);
          applyLifecycleState('ready');
        })
        .catch((err) => {
          setError(mapMicError(err));
          applyLifecycleState('error');
        });
      return;
    }

    if (mediaRecorderRef.current && isRecording) {
      applyLifecycleState('processing');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearTimer();
    }
  }, [
    applyLifecycleState,
    clearTimer,
    isRecording,
    mapMicError,
    onRecordingComplete,
    platform.audio,
  ]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const cancelRecording = useCallback(() => {
    if (nativeFallbackRef.current) {
      nativeFallbackRef.current = false;
      setIsRecording(false);
      setDuration(0);
      setLiveInputLevel(0);
      clearTimer();
      stopSignalMonitoring();
      void platform.audio.stopSystemAudioCapture().catch((err) => {
        console.error('Failed stopping native fallback capture:', err);
      });
      resetLifecycle();
      return;
    }

    if (mediaRecorderRef.current) {
      cancelledRef.current = true;
      chunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setDuration(0);
      setLiveInputLevel(0);
    }

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;

    clearTimer();
    stopSignalMonitoring();
    resetLifecycle();
  }, [clearTimer, platform.audio, resetLifecycle, stopSignalMonitoring]);

  useEffect(() => {
    return () => {
      clearTimer();
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      stopSignalMonitoring();
      if (nativeFallbackRef.current) {
        nativeFallbackRef.current = false;
        void platform.audio.stopSystemAudioCapture().catch((err) => {
          console.error('Error stopping native fallback capture on unmount:', err);
        });
      }
    };
  }, [clearTimer, platform.audio, stopSignalMonitoring]);

  const lifecycleStatus = useMemo(
    () => getRecordingLifecycleCopy(lifecycleState),
    [lifecycleState],
  );

  return {
    isRecording,
    duration,
    error,
    lifecycleState,
    lifecycleStatus,
    liveInputLevel,
    waveformSamples,
    waveformMode,
    startRecording,
    stopRecording,
    cancelRecording,
    resetLifecycle,
  };
}
