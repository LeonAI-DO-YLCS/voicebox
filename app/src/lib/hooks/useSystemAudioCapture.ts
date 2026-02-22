import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type MicrophonePermissionState,
  type NormalizedInputDevice,
  normalizeInputDevices,
  resolveDeviceSelection,
} from '@/lib/recording/devices';
import {
  getRecordingLifecycleCopy,
  type RecordingLifecycleState,
  transitionRecordingLifecycle,
} from '@/lib/recording/lifecycle';
import { usePlatform } from '@/platform/PlatformContext';

interface UseSystemAudioCaptureOptions {
  maxDurationSeconds?: number;
  onRecordingComplete?: (blob: Blob, duration?: number) => void;
}

function mapSystemCaptureErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Failed to start system audio capture.';

  if (/denied|not allowed|permission|access/i.test(raw)) {
    return 'Microphone permission was denied. Allow desktop microphone access and retry.';
  }

  if (/selected input device .* not available|not available/i.test(raw)) {
    return 'The selected input device is disconnected or unavailable. Refresh devices and select another input.';
  }

  if (/No Linux input devices found/i.test(raw)) {
    return 'No host input devices were detected. On WSL2, ensure WSLg/PulseAudio is running and Windows microphone access for desktop apps is enabled.';
  }

  if (/not supported/i.test(raw)) {
    return 'System audio capture is unsupported on this host/runtime.';
  }

  return raw;
}

export function useSystemAudioCapture({
  maxDurationSeconds = 29,
  onRecordingComplete,
}: UseSystemAudioCaptureOptions = {}) {
  const platform = usePlatform();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>('unknown');
  const [inputDevices, setInputDevices] = useState<NormalizedInputDevice[]>([]);
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState<string | null>(null);
  const [disconnectedDeviceId, setDisconnectedDeviceId] = useState<string | null>(null);
  const [isLoadingInputDevices, setIsLoadingInputDevices] = useState(false);
  const [lifecycleState, setLifecycleState] = useState<RecordingLifecycleState>('idle');
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const stopRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const isRecordingRef = useRef(false);

  const applyLifecycleState = useCallback((target: RecordingLifecycleState) => {
    setLifecycleState((current) => {
      const result = transitionRecordingLifecycle(current, target);
      if (!result.valid) {
        console.warn(
          `[system-capture:lifecycle] rejected transition ${current} -> ${target}; keeping ${result.next}`,
        );
      }
      return result.next;
    });
  }, []);

  const refreshPermissionState = useCallback(async (): Promise<MicrophonePermissionState> => {
    if (typeof navigator === 'undefined' || !('permissions' in navigator)) {
      setPermissionState('unknown');
      return 'unknown';
    }

    try {
      const permission = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      const nextState =
        permission.state === 'granted' ||
        permission.state === 'denied' ||
        permission.state === 'prompt'
          ? permission.state
          : 'unknown';
      setPermissionState(nextState);
      return nextState;
    } catch {
      setPermissionState('unknown');
      return 'unknown';
    }
  }, []);

  const refreshInputDevices = useCallback(async () => {
    if (!platform.metadata.isTauri) {
      setInputDevices([]);
      setSelectedInputDeviceId(null);
      setDisconnectedDeviceId(null);
      return;
    }

    const latestPermissionState = await refreshPermissionState();
    try {
      setIsLoadingInputDevices(true);
      const rawDevices = await platform.audio.listSystemAudioInputDevices();
      const normalizedDevices = normalizeInputDevices(rawDevices, latestPermissionState);
      const selection = resolveDeviceSelection(selectedInputDeviceId, normalizedDevices);

      setInputDevices(normalizedDevices);
      setSelectedInputDeviceId(selection.selectedDeviceId);
      setDisconnectedDeviceId(selection.disconnectedDeviceId);

      if (selection.disconnectedDeviceId) {
        setError(
          'The previously selected input device disconnected. A new available device has been selected.',
        );
      }
    } catch (refreshError) {
      console.error('Failed to list system audio input devices:', refreshError);
      setInputDevices([]);
      setSelectedInputDeviceId(null);
      setDisconnectedDeviceId(null);
      setError(mapSystemCaptureErrorMessage(refreshError));
    } finally {
      setIsLoadingInputDevices(false);
    }
  }, [platform, refreshPermissionState, selectedInputDeviceId]);

  useEffect(() => {
    let mounted = true;

    const checkSupport = async () => {
      if (!platform.metadata.isTauri) {
        if (mounted) {
          setIsSupported(false);
        }
        return;
      }

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const supported = await invoke<boolean>('is_system_audio_supported');
        if (mounted) {
          const isCaptureSupported = Boolean(supported);
          setIsSupported(isCaptureSupported);
          if (isCaptureSupported) {
            applyLifecycleState('armed');
            await refreshInputDevices();
          }
        }
      } catch {
        if (mounted) {
          const isCaptureSupported = platform.audio.isSystemAudioSupported();
          setIsSupported(isCaptureSupported);
          if (isCaptureSupported) {
            applyLifecycleState('armed');
            await refreshInputDevices();
          }
        }
      }
    };

    void checkSupport();

    return () => {
      mounted = false;
    };
  }, [applyLifecycleState, platform, refreshInputDevices]);

  useEffect(() => {
    if (!platform.metadata.isTauri || isRecording) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshInputDevices();
    }, 4000);

    return () => clearInterval(interval);
  }, [isRecording, platform.metadata.isTauri, refreshInputDevices]);

  const startRecording = useCallback(async () => {
    if (!platform.metadata.isTauri) {
      const errorMsg = 'System audio capture is only available in the desktop app.';
      setError(errorMsg);
      applyLifecycleState('error');
      return;
    }

    if (!isSupported) {
      const errorMsg = 'System audio capture is not supported on this platform.';
      setError(errorMsg);
      applyLifecycleState('error');
      return;
    }

    const selectedDevice = selectedInputDeviceId
      ? inputDevices.find((device) => device.id === selectedInputDeviceId)
      : null;

    if (selectedDevice && selectedDevice.availability === 'disconnected') {
      const errorMsg =
        'Selected input device is disconnected. Refresh and choose an available device.';
      setError(errorMsg);
      applyLifecycleState('error');
      return;
    }

    try {
      setError(null);
      setDuration(0);
      applyLifecycleState('armed');

      await platform.audio.startSystemAudioCapture(maxDurationSeconds, selectedInputDeviceId);

      setIsRecording(true);
      isRecordingRef.current = true;
      startTimeRef.current = Date.now();
      applyLifecycleState('recording');

      timerRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          setDuration(elapsed);
          if (elapsed >= maxDurationSeconds && stopRecordingRef.current) {
            applyLifecycleState('processing');
            void stopRecordingRef.current();
          }
        }
      }, 100);
    } catch (captureError) {
      const errorMessage = mapSystemCaptureErrorMessage(captureError);
      setError(errorMessage);
      setIsRecording(false);
      applyLifecycleState('error');
    }
  }, [
    applyLifecycleState,
    inputDevices,
    isSupported,
    maxDurationSeconds,
    platform,
    selectedInputDeviceId,
  ]);

  const stopRecording = useCallback(async () => {
    if (!isRecording || !platform.metadata.isTauri) {
      return;
    }

    try {
      setIsRecording(false);
      isRecordingRef.current = false;
      applyLifecycleState('processing');

      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const blob = await platform.audio.stopSystemAudioCapture();
      const recordedDuration = startTimeRef.current
        ? (Date.now() - startTimeRef.current) / 1000
        : undefined;
      onRecordingComplete?.(blob, recordedDuration);
      applyLifecycleState('ready');
    } catch (captureError) {
      const errorMessage = mapSystemCaptureErrorMessage(captureError);
      setError(errorMessage);
      applyLifecycleState('error');
    }
  }, [applyLifecycleState, isRecording, onRecordingComplete, platform]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const cancelRecording = useCallback(async () => {
    if (isRecordingRef.current) {
      await stopRecording();
    }

    setIsRecording(false);
    isRecordingRef.current = false;
    setDuration(0);
    setError(null);
    applyLifecycleState('idle');

    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [applyLifecycleState, stopRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (isRecordingRef.current && platform.metadata.isTauri) {
        void platform.audio.stopSystemAudioCapture().catch((captureError) => {
          console.error('Error stopping audio capture on unmount:', captureError);
        });
      }
    };
  }, [platform]);

  const lifecycleStatus = useMemo(
    () => getRecordingLifecycleCopy(lifecycleState),
    [lifecycleState],
  );

  return {
    isRecording,
    duration,
    error,
    isSupported,
    permissionState,
    lifecycleState,
    lifecycleStatus,
    inputDevices,
    selectedInputDeviceId,
    disconnectedDeviceId,
    setSelectedInputDeviceId,
    isLoadingInputDevices,
    refreshInputDevices,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
