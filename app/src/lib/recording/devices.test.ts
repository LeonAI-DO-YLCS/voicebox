import { describe, expect, it } from 'bun:test';
import { normalizeInputDevices, resolveDeviceSelection } from './devices';

describe('device normalization and selection', () => {
  it('prefers host default when no selection exists', () => {
    const devices = normalizeInputDevices(
      [
        { id: 'mic-1', name: 'Mic 1', is_default: false },
        { id: 'mic-2', name: 'Mic 2', is_default: true },
      ],
      'granted',
    );

    const selected = resolveDeviceSelection(null, devices);
    expect(selected.selectedDeviceId).toBe('mic-2');
    expect(selected.disconnectedDeviceId).toBeNull();
  });

  it('falls back to available device when selected one disappears', () => {
    const devices = normalizeInputDevices(
      [{ id: 'mic-2', name: 'Mic 2', is_default: true }],
      'granted',
    );
    const selected = resolveDeviceSelection('missing-mic', devices);
    expect(selected.selectedDeviceId).toBe('mic-2');
    expect(selected.disconnectedDeviceId).toBe('missing-mic');
  });

  it('preserves denied permission state from native payload', () => {
    const devices = normalizeInputDevices(
      [
        {
          id: 'mic-1',
          name: 'Mic 1',
          is_default: true,
          permission_state: 'denied',
        },
      ],
      'granted',
    );
    expect(devices[0].permission).toBe('denied');
  });
});
