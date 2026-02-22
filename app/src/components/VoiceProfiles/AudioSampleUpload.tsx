import { Mic, Pause, Play, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { WaveformStrip } from './WaveformFeedback';

interface AudioSampleUploadProps {
  file: File | null | undefined;
  onFileChange: (file: File | undefined) => void;
  onTranscribe: () => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  isValidating?: boolean;
  isTranscribing?: boolean;
  isDisabled?: boolean;
  fieldName: string;
  recommendedDurationSeconds?: number;
  maxDurationSeconds?: number;
  waveformSamples?: number[];
  playbackProgress?: number;
  isWaveformLoading?: boolean;
}

export function AudioSampleUpload({
  file,
  onFileChange,
  onTranscribe,
  onPlayPause,
  isPlaying,
  isValidating = false,
  isTranscribing = false,
  isDisabled = false,
  fieldName,
  recommendedDurationSeconds = 15,
  maxDurationSeconds = 30,
  waveformSamples = [],
  playbackProgress,
  isWaveformLoading = false,
}: AudioSampleUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <FormItem>
      <FormControl>
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="audio/*"
            name={fieldName}
            ref={fileInputRef}
            onChange={(e) => {
              const selectedFile = e.target.files?.[0];
              if (selectedFile) {
                onFileChange(selectedFile);
              } else {
                onFileChange(undefined);
              }
            }}
            className="hidden"
          />
          {/* biome-ignore lint/a11y/useSemanticElements: Drop zone container wraps nested controls and needs div semantics. */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const droppedFile = e.dataTransfer.files?.[0];
              if (droppedFile?.type.startsWith('audio/')) {
                onFileChange(droppedFile);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`flex flex-col items-center justify-center gap-4 p-4 border-2 rounded-lg transition-colors min-h-[180px] ${
              file
                ? 'border-primary bg-primary/5'
                : isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-dashed border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
          >
            {!file ? (
              <>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-5 w-5" />
                  Choose File
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Click to choose a file or drag and drop. Recommended: {recommendedDurationSeconds}
                  s, maximum: {maxDurationSeconds}s.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  <span className="font-medium">File uploaded</span>
                </div>
                <div className="w-full space-y-2">
                  <WaveformStrip samples={waveformSamples} playheadProgress={playbackProgress} />
                  <p className="text-xs text-muted-foreground text-center">
                    {isWaveformLoading
                      ? 'Generating waveform preview...'
                      : 'Playback progress is shown on the waveform preview.'}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground text-center">File: {file.name}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={onPlayPause}
                    disabled={isValidating}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onTranscribe}
                    disabled={isTranscribing || isValidating || isDisabled}
                    className="flex items-center gap-2"
                  >
                    <Mic className="h-4 w-4" />
                    {isTranscribing ? 'Transcribing...' : 'Transcribe'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onFileChange(undefined);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
