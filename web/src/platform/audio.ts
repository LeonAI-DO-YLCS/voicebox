import type { PlatformAudio, AudioDevice, AudioInputSignalProbe } from '@/platform/types';

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

  async getSystemAudioCaptureLevels(): Promise<number[]> {
    return [];
  },

  async probeSystemAudioInputSignal(): Promise<AudioInputSignalProbe> {
    return {
      device_name: 'Desktop runtime required',
      duration_ms: 0,
      sample_count: 0,
      peak: 0,
      rms: 0,
      normalized_level: 0,
      has_signal: false,
      message: 'Signal diagnostics are only available in the desktop app.',
    };
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
