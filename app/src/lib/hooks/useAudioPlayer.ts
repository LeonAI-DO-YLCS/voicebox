import { useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentFileSignatureRef = useRef<string | null>(null);
  const { toast } = useToast();

  const cleanup = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current = null;
    }
    currentFileSignatureRef.current = null;
    setIsPlaying(false);
    setPlaybackProgress(0);
  };

  const bindAudioEvents = (audio: HTMLAudioElement) => {
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setPlaybackProgress(1);
    });

    audio.addEventListener('timeupdate', () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
        setPlaybackProgress(0);
        return;
      }
      setPlaybackProgress(clamp(audio.currentTime / audio.duration, 0, 1));
    });

    audio.addEventListener('seeked', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setPlaybackProgress(clamp(audio.currentTime / audio.duration, 0, 1));
      }
    });

    audio.addEventListener('error', () => {
      setIsPlaying(false);
      toast({
        title: 'Playback error',
        description: 'Failed to play audio file',
        variant: 'destructive',
      });
      cleanup();
    });
  };

  const playPause = (file: File | null | undefined) => {
    if (!file) return;

    const nextFileSignature = `${file.name}-${file.size}-${file.lastModified}`;
    const isSameFile = currentFileSignatureRef.current === nextFileSignature;

    if (!audioRef.current || !isSameFile) {
      cleanup();

      const audio = new Audio(URL.createObjectURL(file));
      audioRef.current = audio;
      currentFileSignatureRef.current = nextFileSignature;
      bindAudioEvents(audio);

      void audio.play().then(
        () => {
          setIsPlaying(true);
          setPlaybackProgress(0);
        },
        () => {
          setIsPlaying(false);
        },
      );
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    void audioRef.current.play().then(
      () => {
        setIsPlaying(true);
      },
      () => {
        setIsPlaying(false);
      },
    );
  };

  return {
    isPlaying,
    playbackProgress,
    playPause,
    cleanup,
  };
}
