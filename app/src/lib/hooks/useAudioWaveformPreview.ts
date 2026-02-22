import { useEffect, useState } from 'react';

interface UseAudioWaveformPreviewResult {
  waveformSamples: number[];
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_WAVEFORM_BARS = 80;

export function useAudioWaveformPreview(
  file: File | null | undefined,
): UseAudioWaveformPreviewResult {
  const [waveformSamples, setWaveformSamples] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const buildWaveform = async () => {
      if (!file) {
        setWaveformSamples([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) {
        setWaveformSamples([]);
        setError('AudioContext is unavailable in this runtime.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const audioContext = new AudioContextCtor();
      try {
        const arrayBuffer = await file.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(arrayBuffer);

        const channels: Float32Array[] = [];
        for (let index = 0; index < decoded.numberOfChannels; index += 1) {
          channels.push(decoded.getChannelData(index));
        }
        if (channels.length === 0) {
          throw new Error('Decoded audio has no channels.');
        }

        const totalSamples = decoded.length;
        const blockSize = Math.max(1, Math.floor(totalSamples / DEFAULT_WAVEFORM_BARS));
        const computed: number[] = [];

        for (let blockIndex = 0; blockIndex < DEFAULT_WAVEFORM_BARS; blockIndex += 1) {
          const start = blockIndex * blockSize;
          const end = Math.min(totalSamples, start + blockSize);
          if (start >= end) {
            computed.push(0.04);
            continue;
          }

          let peak = 0;
          for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
            let mixedSample = 0;
            for (const channel of channels) {
              mixedSample += channel[sampleIndex] ?? 0;
            }
            mixedSample /= channels.length;
            peak = Math.max(peak, Math.abs(mixedSample));
          }
          computed.push(peak);
        }

        const maxPeak = Math.max(...computed, 0.0001);
        const normalized = computed.map((value) => {
          const adjusted = value / maxPeak;
          return Math.max(0.05, Math.min(1, adjusted));
        });

        if (!cancelled) {
          setWaveformSamples(normalized);
          setError(null);
        }
      } catch (waveformError) {
        if (!cancelled) {
          setWaveformSamples([]);
          setError(
            waveformError instanceof Error
              ? waveformError.message
              : 'Failed to generate waveform preview.',
          );
        }
      } finally {
        await audioContext.close().catch(() => {});
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void buildWaveform();

    return () => {
      cancelled = true;
    };
  }, [file]);

  return {
    waveformSamples,
    isLoading,
    error,
  };
}
