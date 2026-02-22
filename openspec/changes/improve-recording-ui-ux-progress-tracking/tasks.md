## 1. Recording Lifecycle Foundation

- [x] 1.1 Define and export canonical recording lifecycle states (`idle`, `armed`, `recording`, `paused`, `processing`, `ready`, `error`) in shared frontend types/store.
- [x] 1.2 Refactor recording hooks to use validated lifecycle transitions and prevent invalid state jumps.
- [x] 1.3 Add lifecycle-driven status copy mapping and wire it into recording UI surfaces.
- [x] 1.4 Add unit tests for lifecycle transition correctness and reset-from-error behavior.

## 2. Microphone Device Selection and Health

- [x] 2.1 Add a normalized input-device model (id, name, default, available/disconnected, permission state) for desktop/web capture paths.
- [x] 2.2 Implement explicit device selection UI with default-device indicator and no-device empty state.
- [x] 2.3 Implement device refresh/update behavior when host default changes or selected device disconnects.
- [x] 2.4 Implement differentiated error handling for permission denied, unsupported host capture, and disconnected device scenarios.
- [x] 2.5 Add tests for device selection fallback, permission-denied messaging, and disconnected-device blocking.

## 3. Recording Signal and Waveform UX

- [x] 3.1 Add live input level meter rendering in recording UI with low-overhead update cadence.
- [x] 3.2 Implement live waveform rendering during active recording with elapsed timer display.
- [x] 3.3 Implement post-capture waveform preview with playback progress indicator.
- [x] 3.4 Add fallback behavior to meter-only mode when waveform sampling is unavailable.
- [x] 3.5 Add max-duration boundary visibility (remaining-time warning and auto-stop transition to processing).

## 4. Processing and Progress Tracking

- [x] 4.1 Define stage-based processing model (`upload`, `validate`, `transcribe`, `embed`, `save`) in backend/typed API responses.
- [x] 4.2 Propagate stable task identifiers through recording-processing updates for restoration and correlation.
- [x] 4.3 Update frontend progress rendering to display stage + percent/indeterminate status without conflicting state sources.
- [x] 4.4 Standardize recording/transcription error envelope usage and map it to actionable UI error panels.
- [x] 4.5 Add integration tests for stage progression order, stage-failure rendering, and concurrent task separation.

## 5. Active Task Visibility and Persistence

- [x] 5.1 Extend active-task aggregation to include recording-processing tasks and model-download tasks under unified semantics.
- [x] 5.2 Implement persistent active-task UI surface that survives navigation and refresh.
- [x] 5.3 Implement terminal-state cleanup behavior for completed/failed tasks with deterministic expiry/removal.
- [x] 5.4 Add tests for task restoration on reload and mixed-task concurrent rendering.

## 6. Tauri/Desktop Integration Hardening

- [x] 6.1 Ensure Tauri audio bridge exposes required device metadata and lifecycle events for the new UI model.
- [x] 6.2 Improve WSL/desktop diagnostics messaging for unsupported host audio backends and missing runtime permissions.
- [x] 6.3 Verify native capture flows against lifecycle/progress semantics and align emitted errors with standardized envelope.

## 7. Documentation and Verification

- [x] 7.1 Update developer docs for recording lifecycle, device-state model, and progress stage semantics.
- [x] 7.2 Update troubleshooting docs for microphone permission, host-device routing, and task/progress recovery behavior.
- [x] 7.3 Add/update QA checklist covering recording lifecycle, waveform fallback, device changes, and processing progress states.
- [x] 7.4 Run targeted validation (unit/integration + manual desktop pass) and document verification outcomes.
