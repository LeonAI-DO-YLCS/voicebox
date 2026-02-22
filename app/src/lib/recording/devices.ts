import type { AudioDevice } from '@/platform/types';

export type InputDeviceAvailability = 'available' | 'disconnected';
export type MicrophonePermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface NormalizedInputDevice {
  id: string;
  name: string;
  isDefault: boolean;
  availability: InputDeviceAvailability;
  permission: MicrophonePermissionState;
  host?: string;
  diagnostics?: string;
}

export function normalizeInputDevices(
  devices: AudioDevice[],
  permission: MicrophonePermissionState,
): NormalizedInputDevice[] {
  return devices.map((device) => ({
    id: device.id,
    name: device.name,
    isDefault: Boolean(device.is_default),
    availability:
      device.availability && device.availability.toLowerCase() === 'disconnected'
        ? 'disconnected'
        : 'available',
    permission:
      device.permission_state === 'granted' ||
      device.permission_state === 'denied' ||
      device.permission_state === 'prompt'
        ? device.permission_state
        : permission,
    host: device.host,
    diagnostics: device.diagnostics,
  }));
}

export interface DeviceSelectionResolution {
  selectedDeviceId: string | null;
  disconnectedDeviceId: string | null;
}

export function resolveDeviceSelection(
  currentDeviceId: string | null,
  devices: NormalizedInputDevice[],
): DeviceSelectionResolution {
  if (currentDeviceId) {
    const matching = devices.find((device) => device.id === currentDeviceId);
    if (matching && matching.availability === 'available') {
      return { selectedDeviceId: currentDeviceId, disconnectedDeviceId: null };
    }
  }

  const preferred =
    devices.find((device) => device.availability === 'available' && device.isDefault) ??
    devices.find((device) => device.availability === 'available') ??
    null;

  const disconnectedDeviceId =
    currentDeviceId && !devices.some((device) => device.id === currentDeviceId)
      ? currentDeviceId
      : null;

  return {
    selectedDeviceId: preferred?.id ?? null,
    disconnectedDeviceId,
  };
}
