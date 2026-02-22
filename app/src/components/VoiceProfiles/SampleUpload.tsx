import { zodResolver } from '@hookform/resolvers/zod';
import { Mic, Monitor, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getErrorDisplayDetails } from '@/lib/errors';
import { useAudioPlayer } from '@/lib/hooks/useAudioPlayer';
import { useAudioRecording } from '@/lib/hooks/useAudioRecording';
import { useAddSample, useProfile, useVoiceCloneReferencePolicy } from '@/lib/hooks/useProfiles';
import { useRecordingProcessingProgress } from '@/lib/hooks/useRecordingProcessingProgress';
import { useSystemAudioCapture } from '@/lib/hooks/useSystemAudioCapture';
import { useTranscription } from '@/lib/hooks/useTranscription';
import { RECORDING_PROCESSING_STAGE_LABELS } from '@/lib/recording/processing';
import { formatAudioDuration, getAudioDuration } from '@/lib/utils/audio';
import { usePlatform } from '@/platform/PlatformContext';
import { AudioSampleRecording } from './AudioSampleRecording';
import { AudioSampleSystem } from './AudioSampleSystem';
import { AudioSampleUpload } from './AudioSampleUpload';

const sampleSchema = z.object({
  file: z.instanceof(File, { message: 'Please select an audio file' }),
  referenceText: z
    .string()
    .min(1, 'Reference text is required')
    .max(1000, 'Reference text must be less than 1000 characters'),
});

type SampleFormValues = z.infer<typeof sampleSchema>;

const FALLBACK_VOICE_CLONE_POLICY = {
  hard_min_seconds: 2,
  recommended_target_seconds: 15,
  hard_max_seconds: 30,
  capture_auto_stop_seconds: 29,
};

interface SampleUploadProps {
  profileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SampleUpload({ profileId, open, onOpenChange }: SampleUploadProps) {
  const platform = usePlatform();
  const addSample = useAddSample();
  const transcribe = useTranscription();
  const { data: profile } = useProfile(profileId);
  const { data: voiceClonePolicy } = useVoiceCloneReferencePolicy();
  const { toast } = useToast();
  const [mode, setMode] = useState<'upload' | 'record' | 'system'>('upload');
  const [activeTranscriptionTaskId, setActiveTranscriptionTaskId] = useState<string | null>(null);
  const { isPlaying, playbackProgress, playPause, cleanup: cleanupAudio } = useAudioPlayer();
  const effectivePolicy = voiceClonePolicy ?? FALLBACK_VOICE_CLONE_POLICY;
  const minAudioDurationSeconds = effectivePolicy.hard_min_seconds;
  const maxAudioDurationSeconds = effectivePolicy.hard_max_seconds;
  const recommendedAudioDurationSeconds = effectivePolicy.recommended_target_seconds;
  const captureMaxDurationSeconds = Math.max(
    1,
    Math.min(effectivePolicy.capture_auto_stop_seconds, Math.floor(maxAudioDurationSeconds)),
  );

  const form = useForm<SampleFormValues>({
    resolver: zodResolver(sampleSchema),
    defaultValues: {
      referenceText: '',
    },
  });

  const selectedFile = form.watch('file');
  const { task: activeProcessingTask } = useRecordingProcessingProgress(activeTranscriptionTaskId);

  const {
    isRecording,
    duration,
    error: recordingError,
    lifecycleState: recordingLifecycleState,
    lifecycleStatus: recordingLifecycleStatus,
    liveInputLevel,
    waveformSamples,
    waveformMode,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecording({
    maxDurationSeconds: captureMaxDurationSeconds,
    onRecordingComplete: (blob, recordedDuration) => {
      // Convert blob to File object
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: blob.type || 'audio/webm',
      }) as File & { recordedDuration?: number };
      // Store the actual recorded duration to bypass metadata reading issues on Windows
      if (recordedDuration !== undefined) {
        file.recordedDuration = recordedDuration;
      }
      form.setValue('file', file, { shouldValidate: true });
      toast({
        title: 'Recording complete',
        description: 'Audio has been recorded successfully.',
      });
    },
  });

  const {
    isRecording: isSystemRecording,
    duration: systemDuration,
    error: systemRecordingError,
    isSupported: isSystemAudioSupported,
    permissionState: systemPermissionState,
    lifecycleState: systemLifecycleState,
    lifecycleStatus: systemLifecycleStatus,
    inputDevices: systemInputDevices,
    selectedInputDeviceId,
    disconnectedDeviceId,
    setSelectedInputDeviceId,
    isLoadingInputDevices,
    refreshInputDevices,
    startRecording: startSystemRecording,
    stopRecording: stopSystemRecording,
    cancelRecording: cancelSystemRecording,
  } = useSystemAudioCapture({
    maxDurationSeconds: captureMaxDurationSeconds,
    onRecordingComplete: (blob, recordedDuration) => {
      // Convert blob to File object
      const file = new File([blob], `system-audio-${Date.now()}.wav`, {
        type: blob.type || 'audio/wav',
      }) as File & { recordedDuration?: number };
      // Store the actual recorded duration to bypass metadata reading issues on Windows
      if (recordedDuration !== undefined) {
        file.recordedDuration = recordedDuration;
      }
      form.setValue('file', file, { shouldValidate: true });
      toast({
        title: 'System audio captured',
        description: 'Audio has been captured successfully.',
      });
    },
  });

  // Show recording errors
  useEffect(() => {
    if (recordingError) {
      toast({
        title: 'Recording error',
        description: recordingError,
        variant: 'destructive',
      });
    }
  }, [recordingError, toast]);

  // Show system audio recording errors
  useEffect(() => {
    if (systemRecordingError) {
      toast({
        title: 'System audio capture error',
        description: systemRecordingError,
        variant: 'destructive',
      });
    }
  }, [systemRecordingError, toast]);

  async function handleTranscribe() {
    const file = form.getValues('file');
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select an audio file first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const taskId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `recording-${Date.now()}`;
      setActiveTranscriptionTaskId(taskId);
      const language = profile?.language as 'en' | 'zh' | undefined;
      const result = await transcribe.mutateAsync({ file, language, taskId });
      setActiveTranscriptionTaskId(result.task_id ?? taskId);

      form.setValue('referenceText', result.text, { shouldValidate: true });
    } catch (error) {
      const details = getErrorDisplayDetails(error, 'Transcription failed');
      toast({
        title: details.title,
        description: `${details.summary}${details.hint ? ` ${details.hint}` : ''}`,
        variant: 'destructive',
      });
    } finally {
      window.setTimeout(() => {
        setActiveTranscriptionTaskId(null);
      }, 1500);
    }
  }

  async function onSubmit(data: SampleFormValues) {
    try {
      const duration = await getAudioDuration(data.file as File & { recordedDuration?: number });
      if (duration < minAudioDurationSeconds || duration > maxAudioDurationSeconds) {
        const durationText = formatAudioDuration(duration);
        const minText = formatAudioDuration(minAudioDurationSeconds);
        const maxText = formatAudioDuration(maxAudioDurationSeconds);
        throw new Error(
          `Audio duration ${durationText} is outside allowed bounds (${minText} to ${maxText}).`,
        );
      }

      await addSample.mutateAsync({
        profileId,
        file: data.file,
        referenceText: data.referenceText,
      });

      toast({
        title: 'Sample added',
        description: 'Audio sample has been added successfully.',
      });

      handleOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add sample',
        variant: 'destructive',
      });
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      form.reset();
      setMode('upload');
      if (isRecording) {
        cancelRecording();
      }
      if (isSystemRecording) {
        cancelSystemRecording();
      }
      cleanupAudio();
    }
    onOpenChange(newOpen);
  }

  function handleCancelRecording() {
    if (mode === 'record') {
      cancelRecording();
    } else if (mode === 'system') {
      cancelSystemRecording();
    }
    form.resetField('file');
    cleanupAudio();
  }

  function handlePlayPause() {
    const file = form.getValues('file');
    playPause(file);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Audio Sample</DialogTitle>
          <DialogDescription>
            Upload an audio file and provide the reference text that matches the audio.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'upload' | 'record' | 'system')}>
              <TabsList
                className={`grid w-full ${platform.metadata.isTauri && isSystemAudioSupported ? 'grid-cols-3' : 'grid-cols-2'}`}
              >
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4 shrink-0" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="record" className="flex items-center gap-2">
                  <Mic className="h-4 w-4 shrink-0" />
                  Record
                </TabsTrigger>
                {platform.metadata.isTauri && isSystemAudioSupported && (
                  <TabsTrigger value="system" className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 shrink-0" />
                    System Audio
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, name } }) => (
                    <AudioSampleUpload
                      file={selectedFile}
                      onFileChange={onChange}
                      onTranscribe={handleTranscribe}
                      onPlayPause={handlePlayPause}
                      isPlaying={isPlaying}
                      isTranscribing={transcribe.isPending}
                      fieldName={name}
                      recommendedDurationSeconds={recommendedAudioDurationSeconds}
                      maxDurationSeconds={maxAudioDurationSeconds}
                    />
                  )}
                />
              </TabsContent>

              <TabsContent value="record" className="space-y-4">
                <FormField
                  control={form.control}
                  name="file"
                  render={() => (
                    <AudioSampleRecording
                      file={selectedFile}
                      isRecording={isRecording}
                      duration={duration}
                      lifecycleState={recordingLifecycleState}
                      lifecycleStatus={recordingLifecycleStatus}
                      liveInputLevel={liveInputLevel}
                      waveformSamples={waveformSamples}
                      waveformMode={waveformMode}
                      playbackProgress={playbackProgress}
                      activeProcessingTask={activeProcessingTask}
                      onStart={startRecording}
                      onStop={stopRecording}
                      onCancel={handleCancelRecording}
                      onTranscribe={handleTranscribe}
                      onPlayPause={handlePlayPause}
                      isPlaying={isPlaying}
                      isTranscribing={transcribe.isPending}
                      maxDurationSeconds={captureMaxDurationSeconds}
                    />
                  )}
                />
              </TabsContent>

              {platform.metadata.isTauri && isSystemAudioSupported && (
                <TabsContent value="system" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="file"
                    render={() => (
                      <AudioSampleSystem
                        file={selectedFile}
                        isRecording={isSystemRecording}
                        duration={systemDuration}
                        lifecycleState={systemLifecycleState}
                        lifecycleStatus={systemLifecycleStatus}
                        permissionState={systemPermissionState}
                        inputDevices={systemInputDevices}
                        selectedInputDeviceId={selectedInputDeviceId}
                        disconnectedDeviceId={disconnectedDeviceId}
                        onSelectInputDevice={setSelectedInputDeviceId}
                        onRefreshInputDevices={refreshInputDevices}
                        isLoadingInputDevices={isLoadingInputDevices}
                        onStart={startSystemRecording}
                        onStop={stopSystemRecording}
                        onCancel={handleCancelRecording}
                        onTranscribe={handleTranscribe}
                        onPlayPause={handlePlayPause}
                        isPlaying={isPlaying}
                        isTranscribing={transcribe.isPending}
                        maxDurationSeconds={captureMaxDurationSeconds}
                      />
                    )}
                  />
                </TabsContent>
              )}
            </Tabs>

            {(transcribe.isPending || activeProcessingTask) && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">
                  {RECORDING_PROCESSING_STAGE_LABELS[activeProcessingTask?.stage ?? 'transcribe']}
                </p>
                <Progress value={activeProcessingTask?.progress ?? undefined} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {activeProcessingTask?.message ||
                    (transcribe.isPending ? 'Processing in progress...' : 'Awaiting completion...')}
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="referenceText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Text</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the exact text spoken in the audio..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addSample.isPending}>
                {addSample.isPending ? 'Uploading...' : 'Add Sample'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
