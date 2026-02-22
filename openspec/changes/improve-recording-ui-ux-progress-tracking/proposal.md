## Why

Recording and cloning workflows currently provide limited live feedback across capture, processing, and model progress, which makes it harder for users to trust what the app is doing and recover quickly from issues. Improving recording UX and visibility now will reduce failed attempts, improve first-run success, and make long-running tasks understandable.

## What Changes

- Add clear, persistent recording lifecycle states (`idle`, `armed`, `recording`, `paused`, `processing`, `ready`, `error`) across voice profile recording flows.
- Add microphone/device usability improvements: explicit selectable input list, default-device indicator, disconnected-device messaging, and quick mic health checks.
- Add richer recording feedback: live input level meter, waveform visualization during and after recording, elapsed time, remaining duration, and trim-ready preview states.
- Add processing and transcription visibility: stage-based progress (`upload`, `validate`, `transcribe`, `embed`, `save`) with actionable error surfaces and retry affordances.
- Add active task/progress visibility for model and recording-related background operations to reduce hidden work and ambiguity.
- Standardize recording and progress-related error messaging across backend and frontend for clearer troubleshooting context.

## Capabilities

### New Capabilities
- `recording-lifecycle-feedback`: Define and expose unified recording state transitions and user-visible status messaging.
- `microphone-device-selection-health`: Define microphone discovery, default selection behavior, and device health/error handling requirements.
- `recording-waveform-visualization`: Define requirements for live and post-capture waveform/timeline display and time-based feedback.
- `recording-processing-progress-tracking`: Define stage-based processing and transcription progress semantics, progress reporting, and retry behavior.
- `recording-task-visibility`: Define requirements for showing active recording/model tasks and preserving visibility during navigation and refresh.

### Modified Capabilities
- None.

## Impact

- Affected frontend areas: voice profile recording components, audio capture hooks, API client types, progress/toast UX, and server status surfaces.
- Affected backend areas: transcription/model progress signaling, task progress reporting, and error payload consistency.
- Affected desktop/native areas: Tauri audio bridge and input-device enumeration paths.
- Affected documentation: user setup/troubleshooting and developer workflow docs for recording and progress behavior.
