import { Mic, Monitor, Pause, Play, RotateCw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AudioDevice } from '@/platform/types';
import { formatAudioDuration } from '@/lib/utils/audio';

interface AudioSampleSystemProps {
  file: File | null | undefined;
  isRecording: boolean;
  duration: number;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onTranscribe: () => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  inputDevices: AudioDevice[];
  selectedInputDeviceId: string | null;
  onSelectInputDevice: (deviceId: string) => void;
  onRefreshInputDevices?: () => void;
  isLoadingInputDevices?: boolean;
  isTranscribing?: boolean;
  maxDurationSeconds?: number;
}

export function AudioSampleSystem({
  file,
  isRecording,
  duration,
  onStart,
  onStop,
  onCancel,
  onTranscribe,
  onPlayPause,
  isPlaying,
  inputDevices,
  selectedInputDeviceId,
  onSelectInputDevice,
  onRefreshInputDevices,
  isLoadingInputDevices = false,
  isTranscribing = false,
  maxDurationSeconds = 30,
}: AudioSampleSystemProps) {
  const hasInputDevices = inputDevices.length > 0;

  return (
    <FormItem>
      <FormControl>
        <div className="space-y-4">
          {!isRecording && !file && (
            <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-dashed rounded-lg min-h-[180px]">
              {hasInputDevices && (
                <div className="w-full max-w-md space-y-2">
                  <p className="text-sm text-muted-foreground">Audio Input Source</p>
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
                        {inputDevices.map((device) => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.name}
                            {device.is_default ? ' (Default)' : ''}
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
                        <RotateCw className={`h-4 w-4 ${isLoadingInputDevices ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <Button type="button" onClick={onStart} size="lg" className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Start Capture
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Capture system audio or microphone input. On Linux/WSL, all host-exposed inputs are
                listed above and the host default is selected automatically.
                Maximum duration: {maxDurationSeconds} seconds.
              </p>
            </div>
          )}

          {isRecording && (
            <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-destructive rounded-lg bg-destructive/5 min-h-[180px]">
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
              <p className="text-sm text-muted-foreground text-center">
                {formatAudioDuration(Math.max(0, maxDurationSeconds - duration))} remaining
              </p>
            </div>
          )}

          {file && !isRecording && (
            <div className="flex flex-col items-center justify-center gap-4 p-4 border-2 border-primary rounded-lg bg-primary/5 min-h-[180px]">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                <span className="font-medium">Capture complete</span>
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
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
