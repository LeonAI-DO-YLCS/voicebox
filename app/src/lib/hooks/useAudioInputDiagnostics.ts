import { useCallback, useState } from 'react';
import type { AudioInputSignalProbe } from '@/platform/types';
import { usePlatform } from '@/platform/PlatformContext';

interface UseAudioInputDiagnosticsResult {
  lastProbe: AudioInputSignalProbe | null;
  isProbing: boolean;
  probeError: string | null;
  runProbe: (inputDeviceId?: string | null, durationMs?: number) => Promise<void>;
}

export function useAudioInputDiagnostics(): UseAudioInputDiagnosticsResult {
  const platform = usePlatform();
  const [lastProbe, setLastProbe] = useState<AudioInputSignalProbe | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const runProbe = useCallback(
    async (inputDeviceId?: string | null, durationMs = 2000) => {
      setProbeError(null);
      setIsProbing(true);
      try {
        const probe = await platform.audio.probeSystemAudioInputSignal(inputDeviceId, durationMs);
        setLastProbe(probe);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setProbeError(message);
      } finally {
        setIsProbing(false);
      }
    },
    [platform.audio],
  );

  return {
    lastProbe,
    isProbing,
    probeError,
    runProbe,
  };
}
