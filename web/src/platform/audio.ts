import type { PlatformAudio, AudioDevice } from '@/platform/types';

export const webAudio: PlatformAudio = {
  isSystemAudioSupported(): boolean {
    return false; // System audio capture not supported in web
  },

  async startSystemAudioCapture(
    _maxDurationSecs: number,
    _inputDeviceId?: string | null,
  ): Promise<void> {
    throw new Error('System audio capture is only available in the desktop app.');
  },

  async stopSystemAudioCapture(): Promise<Blob> {
    throw new Error('System audio capture is only available in the desktop app.');
  },

  async listSystemAudioInputDevices(): Promise<AudioDevice[]> {
    return []; // Native input device listing is desktop-only
  },

  async listOutputDevices(): Promise<AudioDevice[]> {
    return []; // No native device routing in web
  },

  async playToDevices(_audioData: Uint8Array, _deviceIds: string[]): Promise<void> {
    throw new Error('Native audio device routing is only available in the desktop app.');
  },

  stopPlayback(): void {
    // No-op for web
  },
};
