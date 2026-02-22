import { AlertTriangle, Mic, Monitor, Pause, Play, RotateCw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NormalizedInputDevice } from '@/lib/recording/devices';
import type { RecordingLifecycleState } from '@/lib/recording/lifecycle';
import { formatAudioDuration } from '@/lib/utils/audio';
import type { AudioInputSignalProbe } from '@/platform/types';
import { AudioInputDiagnosticsPanel } from './AudioInputDiagnosticsPanel';
import { LiveLevelMeter, WaveformStrip } from './WaveformFeedback';

interface AudioSampleSystemProps {
  file: File | null | undefined;
  isRecording: boolean;
  duration: number;
  lifecycleState: RecordingLifecycleState;
  lifecycleStatus: {
    title: string;
    description: string;
  };
  permissionState: 'granted' | 'denied' | 'prompt' | 'unknown';
  inputDevices: NormalizedInputDevice[];
  selectedInputDeviceId: string | null;
  disconnectedDeviceId?: string | null;
  onSelectInputDevice: (deviceId: string) => void;
  onRefreshInputDevices?: () => void;
  isLoadingInputDevices?: boolean;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onTranscribe: () => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  isTranscribing?: boolean;
  maxDurationSeconds?: number;
  liveInputLevel: number;
  waveformSamples: number[];
  waveformMode: 'waveform' | 'meter';
  playbackProgress?: number;
  previewWaveformSamples?: number[];
  diagnosticsProbe?: AudioInputSignalProbe | null;
  diagnosticsError?: string | null;
  isDiagnosticsRunning?: boolean;
  onRunDiagnostics?: () => void;
  diagnosticsDisabled?: boolean;
}

export function AudioSampleSystem({
  file,
  isRecording,
  duration,
  lifecycleState,
  lifecycleStatus,
  permissionState,
  inputDevices,
  selectedInputDeviceId,
  disconnectedDeviceId,
  onSelectInputDevice,
  onRefreshInputDevices,
  isLoadingInputDevices = false,
  onStart,
  onStop,
  onCancel,
  onTranscribe,
  onPlayPause,
  isPlaying,
  isTranscribing = false,
  maxDurationSeconds = 30,
  liveInputLevel,
  waveformSamples,
  waveformMode,
  playbackProgress,
  previewWaveformSamples = [],
  diagnosticsProbe = null,
  diagnosticsError = null,
  isDiagnosticsRunning = false,
  onRunDiagnostics,
  diagnosticsDisabled = false,
}: AudioSampleSystemProps) {
  const availableDevices = inputDevices.filter((device) => device.availability === 'available');
  const hasInputDevices = availableDevices.length > 0;
  const selectedDevice =
    availableDevices.find((device) => device.id === selectedInputDeviceId) ?? null;
  const remainingSeconds = Math.max(0, maxDurationSeconds - duration);

  return (
    <FormItem>
      <FormControl>
        <div className="space-y-4">
          {!isRecording && !file && (
            <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-dashed rounded-lg min-h-[220px]">
              <div className="w-full max-w-md space-y-2">
                <p className="text-sm text-muted-foreground">Audio Input Source</p>
                {hasInputDevices ? (
                  <div className="flex gap-2">
                    <Select
                      value={selectedInputDeviceId ?? undefined}
                      onValueChange={onSelectInputDevice}
                      disabled={isLoadingInputDevices}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select input source" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDevices.map((device) => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.name}
                            {device.isDefault ? ' (Host Default)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {onRefreshInputDevices && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={onRefreshInputDevices}
                        disabled={isLoadingInputDevices}
                        aria-label="Refresh audio input devices"
                      >
                        <RotateCw
                          className={`h-4 w-4 ${isLoadingInputDevices ? 'animate-spin' : ''}`}
                        />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <p className="font-medium text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      No input devices available
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Connect/enable a microphone and refresh. On WSL2 ensure WSLg/PulseAudio is
                      active and Windows microphone access for desktop apps is enabled.
                    </p>
                  </div>
                )}
                {selectedDevice && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedDevice.name}
                    {selectedDevice.isDefault ? ' (Host Default)' : ''}
                  </p>
                )}
                {disconnectedDeviceId && (
                  <p className="text-xs text-amber-500">
                    Previously selected device disconnected: {disconnectedDeviceId}
                  </p>
                )}
                {permissionState === 'denied' && (
                  <p className="text-xs text-destructive">
                    Microphone permission denied. Enable desktop microphone access and restart
                    Voicebox if needed.
                  </p>
                )}
              </div>
              <Button
                type="button"
                onClick={onStart}
                size="lg"
                className="flex items-center gap-2"
                disabled={!hasInputDevices || permissionState === 'denied'}
              >
                <Monitor className="h-5 w-5" />
                Start Capture
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                {lifecycleStatus.description} Maximum duration: {maxDurationSeconds} seconds.
              </p>
              {onRunDiagnostics && (
                <div className="w-full max-w-md">
                  <AudioInputDiagnosticsPanel
                    title="System/Mic Signal Check"
                    description="Checks whether the selected input source receives audible signal."
                    onRunProbe={onRunDiagnostics}
                    isProbing={isDiagnosticsRunning}
                    probe={diagnosticsProbe}
                    error={diagnosticsError}
                    disabled={diagnosticsDisabled}
                  />
                </div>
              )}
            </div>
          )}

          {isRecording && (
            <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-destructive rounded-lg bg-destructive/5 min-h-[210px]">
              <div className="w-full space-y-3">
                {waveformMode === 'waveform' ? (
                  <WaveformStrip samples={waveformSamples} />
                ) : (
                  <div className="space-y-2">
                    <LiveLevelMeter level={liveInputLevel} />
                    <p className="text-xs text-muted-foreground text-center">
                      Live waveform unavailable in this runtime. Showing input level meter fallback.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                  <span className="text-lg font-mono font-semibold">
                    {formatAudioDuration(duration)}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                onClick={onStop}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                Stop Capture
              </Button>
              <p
                className={`text-sm text-center ${remainingSeconds <= 5 ? 'text-amber-500' : 'text-muted-foreground'}`}
              >
                {formatAudioDuration(remainingSeconds)} remaining
              </p>
            </div>
          )}

          {file && !isRecording && lifecycleState !== 'processing' && (
            <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-primary rounded-lg bg-primary/5 min-h-[210px]">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                <span className="font-medium">Capture complete</span>
              </div>
              <div className="w-full space-y-2">
                <WaveformStrip
                  samples={waveformSamples.length > 0 ? waveformSamples : previewWaveformSamples}
                  playheadProgress={playbackProgress}
                />
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
                  Capture Again
                </Button>
              </div>
            </div>
          )}

          {!isRecording && lifecycleState === 'processing' && (
            <div className="rounded-md border p-3 bg-muted/20">
              <p className="text-sm font-medium">{lifecycleStatus.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{lifecycleStatus.description}</p>
            </div>
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
