import { useState, useRef, useCallback, useEffect } from 'react';
import { usePlatform } from '@/platform/PlatformContext';
import type { AudioDevice } from '@/platform/types';

interface UseSystemAudioCaptureOptions {
  maxDurationSeconds?: number;
  onRecordingComplete?: (blob: Blob, duration?: number) => void;
}

/**
 * Hook for native system audio capture using Tauri commands.
 * Uses ScreenCaptureKit on macOS, WASAPI loopback on Windows,
 * and CPAL input capture on Linux/WSL with selectable host input devices.
 */
export function useSystemAudioCapture({
  maxDurationSeconds = 29,
  onRecordingComplete,
}: UseSystemAudioCaptureOptions = {}) {
  const platform = usePlatform();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState<string | null>(null);
  const [isLoadingInputDevices, setIsLoadingInputDevices] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const stopRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const isRecordingRef = useRef(false);

  const refreshInputDevices = useCallback(async () => {
    if (!platform.metadata.isTauri) {
      setInputDevices([]);
      setSelectedInputDeviceId(null);
      return;
    }

    try {
      setIsLoadingInputDevices(true);
      const devices = await platform.audio.listSystemAudioInputDevices();
      setInputDevices(devices);
      setSelectedInputDeviceId((currentId) => {
        if (currentId && devices.some((d) => d.id === currentId)) {
          return currentId;
        }
        const defaultDevice = devices.find((d) => d.is_default);
        return defaultDevice?.id ?? devices[0]?.id ?? null;
      });
    } catch (err) {
      console.error('Failed to list system audio input devices:', err);
      setInputDevices([]);
      setSelectedInputDeviceId(null);
    } finally {
      setIsLoadingInputDevices(false);
    }
  }, [platform]);

  // Check if system audio capture is supported
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
        // Dynamic import keeps web builds decoupled from Tauri runtime APIs.
        const { invoke } = await import('@tauri-apps/api/core');
        const supported = await invoke<boolean>('is_system_audio_supported');
        if (mounted) {
          const isCaptureSupported = Boolean(supported);
          setIsSupported(isCaptureSupported);
          if (isCaptureSupported) {
            await refreshInputDevices();
          }
        }
      } catch {
        if (mounted) {
          setIsSupported(platform.audio.isSystemAudioSupported());
          await refreshInputDevices();
        }
      }
    };

    void checkSupport();

    return () => {
      mounted = false;
    };
  }, [platform, refreshInputDevices]);

  const startRecording = useCallback(async () => {
    if (!platform.metadata.isTauri) {
      const errorMsg = 'System audio capture is only available in the desktop app.';
      setError(errorMsg);
      return;
    }

    if (!isSupported) {
      const errorMsg = 'System audio capture is not supported on this platform.';
      setError(errorMsg);
      return;
    }

    try {
      setError(null);
      setDuration(0);

      // Start native capture
      await platform.audio.startSystemAudioCapture(maxDurationSeconds, selectedInputDeviceId);

      setIsRecording(true);
      isRecordingRef.current = true;
      startTimeRef.current = Date.now();

      // Start timer
      timerRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          setDuration(elapsed);

          // Auto-stop at max duration
          if (elapsed >= maxDurationSeconds && stopRecordingRef.current) {
            void stopRecordingRef.current();
          }
        }
      }, 100);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to start system audio capture. Please check permissions.';
      setError(errorMessage);
      setIsRecording(false);
    }
  }, [maxDurationSeconds, isSupported, platform, selectedInputDeviceId]);

  const stopRecording = useCallback(async () => {
    if (!isRecording || !platform.metadata.isTauri) {
      return;
    }

    try {
      setIsRecording(false);
      isRecordingRef.current = false;

      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop capture and get Blob
      const blob = await platform.audio.stopSystemAudioCapture();

      // Pass the actual recorded duration
      const recordedDuration = startTimeRef.current 
        ? (Date.now() - startTimeRef.current) / 1000 
        : undefined;
      onRecordingComplete?.(blob, recordedDuration);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to stop system audio capture.';
      setError(errorMessage);
    }
  }, [isRecording, onRecordingComplete, platform]);

  // Store stopRecording in ref for use in timer
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

    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [stopRecording]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Cancel recording on unmount if still recording
      if (isRecordingRef.current && platform.metadata.isTauri) {
        // Call stop directly without the callback to avoid stale closure
        platform.audio.stopSystemAudioCapture().catch((err) => {
          console.error('Error stopping audio capture on unmount:', err);
        });
      }
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: Only run on unmount
  }, [platform]);

  return {
    isRecording,
    duration,
    error,
    isSupported,
    inputDevices,
    selectedInputDeviceId,
    setSelectedInputDeviceId,
    isLoadingInputDevices,
    refreshInputDevices,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
