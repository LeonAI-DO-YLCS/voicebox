# Recording UX / Progress QA Checklist

## Lifecycle

- [ ] Start recording transitions UI to `recording` state.
- [ ] Stop recording transitions to `processing`, then `ready`.
- [ ] Invalid transitions (for example idle -> processing) are rejected by lifecycle guard tests.
- [ ] Error state can reset back to `idle`.

## Device Selection and Health

- [ ] System Audio tab lists available input devices.
- [ ] Host default device is marked `(Host Default)`.
- [ ] If selected device disappears, selection falls back and warning is shown.
- [ ] Permission denied state shows actionable guidance.

## Recording Signal / Waveform

- [ ] Live input level meter updates during recording.
- [ ] Live waveform updates when waveform support is available.
- [ ] Meter fallback message appears when waveform sampling is unavailable.
- [ ] Remaining time warning appears near max duration and auto-stop triggers.
- [ ] Post-capture waveform preview shows playback playhead movement.

## Processing Progress

- [ ] Transcription flow reports stage labels (`upload`, `validate`, `transcribe`, `embed`, `save`).
- [ ] Stage progress updates render without conflicting spinners.
- [ ] Stage failure displays actionable error message.
- [ ] Multiple processing task IDs stay isolated.

## Active Task Visibility

- [ ] Background task panel renders active model downloads.
- [ ] Background task panel renders active recording-processing tasks.
- [ ] Active tasks survive route navigation and reload polling.
- [ ] Completed/failed tasks auto-expire after deterministic TTL.

## Verification Outcomes (2026-02-22)

- Automated checks passed:
  - `bun run --cwd app test`
  - `bun run --cwd app build`
  - `cd backend && uv run python -m unittest tests.test_recording_processing_tasks -v`
  - `cd tauri/src-tauri && cargo check`
- Manual desktop validation passed:
  - Tauri dev app launches and backend sidecar reaches ready state.
  - Recording lifecycle/status UI updates across record/stop/processing/ready flows.
  - WSL host-audio path surfaces actionable diagnostics when microphone access/device discovery fails.
  - Active task surface persists while navigating and restores processing visibility.
