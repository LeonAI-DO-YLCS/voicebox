import { Loader2, Mic, Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import type { RecordingLifecycleState } from '@/lib/recording/lifecycle';
import type { RecordingProcessingTask } from '@/lib/recording/processing';
import { formatAudioDuration } from '@/lib/utils/audio';

interface AudioSampleRecordingProps {
  file: File | null | undefined;
  isRecording: boolean;
  duration: number;
  lifecycleState: RecordingLifecycleState;
  lifecycleStatus: {
    title: string;
    description: string;
  };
  liveInputLevel: number;
  waveformSamples: number[];
  waveformMode: 'waveform' | 'meter';
  playbackProgress?: number;
  activeProcessingTask?: RecordingProcessingTask | null;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onTranscribe: () => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  isTranscribing?: boolean;
  maxDurationSeconds?: number;
}

function LiveLevelMeter({ level }: { level: number }) {
  const clampedLevel = Math.max(0, Math.min(1, level));
  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full bg-accent transition-[width] duration-100"
        style={{ width: `${Math.round(clampedLevel * 100)}%` }}
      />
    </div>
  );
}

function WaveformStrip({
  samples,
  playheadProgress,
}: {
  samples: number[];
  playheadProgress?: number;
}) {
  const bars = samples.length > 0 ? samples : Array.from({ length: 60 }, () => 0.08);
  const playheadPercent =
    playheadProgress !== undefined ? Math.max(0, Math.min(1, playheadProgress)) * 100 : null;

  return (
    <div className="relative h-20 w-full rounded-md bg-background/40 border border-border px-2 py-2 flex items-end gap-[2px] overflow-hidden">
      {bars.map((sample, index) => (
        <div
          key={`${index}-${sample}`}
          className="flex-1 bg-accent/70 rounded-sm"
          style={{ height: `${Math.max(6, Math.round(sample * 100))}%` }}
        />
      ))}
      {playheadPercent !== null && (
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-primary"
          style={{ left: `calc(${playheadPercent}% - 1px)` }}
        />
      )}
    </div>
  );
}

export function AudioSampleRecording({
  file,
  isRecording,
  duration,
  lifecycleState,
  lifecycleStatus,
  liveInputLevel,
  waveformSamples,
  waveformMode,
  playbackProgress,
  activeProcessingTask,
  onStart,
  onStop,
  onCancel,
  onTranscribe,
  onPlayPause,
  isPlaying,
  isTranscribing = false,
  maxDurationSeconds = 30,
}: AudioSampleRecordingProps) {
  const remainingSeconds = Math.max(0, maxDurationSeconds - duration);
  const isNearMaxDuration = remainingSeconds <= 5;

  return (
    <FormItem>
      <FormControl>
        <div className="space-y-4">
          {!isRecording && !file && lifecycleState !== 'processing' && (
            <div className="relative flex flex-col items-center justify-center gap-4 p-4 border-2 border-dashed rounded-lg min-h-[210px] overflow-hidden">
              <Button
                type="button"
                onClick={onStart}
                size="lg"
                className="relative z-10 flex items-center gap-2"
              >
                <Mic className="h-5 w-5" />
                Start Recording
              </Button>
              <p className="relative z-10 text-sm text-muted-foreground text-center">
                {lifecycleStatus.description}
              </p>
              <p className="relative z-10 text-xs text-muted-foreground text-center">
                Maximum duration: {maxDurationSeconds} seconds.
              </p>
            </div>
          )}

          {isRecording && (
            <div className="relative flex flex-col items-center justify-center gap-4 p-4 border-2 border-accent rounded-lg bg-accent/5 min-h-[210px] overflow-hidden">
              <div className="w-full space-y-3">
                {waveformMode === 'waveform' ? (
                  <WaveformStrip samples={waveformSamples} />
                ) : (
                  <div className="space-y-2">
                    <LiveLevelMeter level={liveInputLevel} />
                    <p className="text-xs text-muted-foreground text-center">
                      Waveform unavailable in this runtime. Showing input level meter fallback.
                    </p>
                  </div>
                )}
              </div>

              <div className="relative z-10 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-accent animate-pulse" />
                  <span className="text-lg font-mono font-semibold">
                    {formatAudioDuration(duration)}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                onClick={onStop}
                className="relative z-10 flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Square className="h-4 w-4" />
                Stop Recording
              </Button>
              <p
                className={`relative z-10 text-sm text-center ${isNearMaxDuration ? 'text-amber-500' : 'text-muted-foreground'}`}
              >
                {formatAudioDuration(remainingSeconds)} remaining
              </p>
            </div>
          )}

          {!isRecording && lifecycleState === 'processing' && (
            <div className="flex flex-col items-center justify-center gap-3 p-4 border rounded-lg bg-muted/20 min-h-[180px]">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="font-medium">{lifecycleStatus.title}</p>
              <p className="text-sm text-muted-foreground text-center">
                {activeProcessingTask?.message || lifecycleStatus.description}
              </p>
            </div>
          )}

          {file && !isRecording && lifecycleState !== 'processing' && (
            <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-primary rounded-lg bg-primary/5 min-h-[210px]">
              <div className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                <span className="font-medium">Recording complete</span>
              </div>
              <div className="w-full space-y-2">
                <WaveformStrip samples={waveformSamples} playheadProgress={playbackProgress} />
                <p className="text-xs text-muted-foreground text-center">
                  Playback progress is shown on the waveform preview.
                </p>
              </div>
              <p className="text-sm text-muted-foreground text-center">File: {file.name}</p>
              <div className="flex gap-2">
                <Button type="button" size="icon" variant="outline" onClick={onPlayPause}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onTranscribe}
                  disabled={isTranscribing}
                  className="flex items-center gap-2"
                >
                  <Mic className="h-4 w-4" />
                  {isTranscribing ? 'Transcribing...' : 'Transcribe'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="flex items-center gap-2"
                >
                  Record Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
