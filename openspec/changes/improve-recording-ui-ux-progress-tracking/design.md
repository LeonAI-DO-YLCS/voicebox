## Context

Voice recording and voice-clone sample flows span frontend UI state, Tauri native device integration, backend transcription/model progress, and task visibility surfaces. The current implementation has partial progress and error feedback, but users can still lose context between capture, upload, transcription, and model readiness, especially when operations are long-running or when microphone/device state changes during interaction.

This change must work across desktop and web targets, with special handling for WSL/host-audio edge cases in desktop mode. It also must integrate with existing backend task progress streams and model download tracking without introducing duplicate polling, conflicting progress states, or fragile one-off UI logic.

Stakeholders:
- End users recording samples and cloning voices
- Developers maintaining frontend hooks/components, Tauri audio bridge, and backend progress endpoints
- Support/debugging workflows that need clearer operational status and actionable failures

Constraints:
- Preserve existing API compatibility where possible
- Avoid regressions in current recording and upload paths
- Keep progress semantics consistent across recording/transcription/model downloads
- Support degraded behavior when microphone permissions or native device discovery fail

## Goals / Non-Goals

**Goals:**
- Provide a unified recording lifecycle model and expose it consistently across recording UI.
- Make microphone/device behavior explicit (selection, default, disconnect, failure reason).
- Provide time-based and waveform-based feedback during and after recording.
- Provide stage-based processing visibility from upload through saved sample readiness.
- Make active tasks and model-related work visible and resilient across navigation/reload.
- Standardize recording/progress error payloads and frontend rendering for user-comprehensible troubleshooting.

**Non-Goals:**
- Replacing the full audio capture engine or introducing a new DSP pipeline.
- Building advanced audio editing features beyond basic preview/trim-oriented feedback.
- Redesigning unrelated app areas outside recording/progress and adjacent model/task visibility.
- Introducing remote telemetry/analytics infrastructure as part of this iteration.

## Decisions

### 1) Introduce a canonical recording state machine
Decision:
Use a single finite state model (`idle`, `armed`, `recording`, `paused`, `processing`, `ready`, `error`) in recording hooks and UI components.

Rationale:
A canonical state machine prevents contradictory UI states and simplifies recovery logic.

Alternatives considered:
- Implicit boolean flags per component: rejected due to state drift and duplicated condition logic.
- Backend-driven lifecycle only: rejected because local capture/permission state must be represented before backend involvement.

### 2) Separate device-state concerns from capture-state concerns
Decision:
Model microphone availability/selection as a dedicated device state layer (selected device, host default, disconnected, permission denied), referenced by recording flows.

Rationale:
Device problems and capture problems have different recovery actions and should not share ambiguous error handling.

Alternatives considered:
- Embed device checks inside start-recording action only: rejected due to poor preflight UX and unclear errors.

### 3) Unify progress as stage events with stable IDs
Decision:
Represent processing/transcription/model work as stage events with stable task IDs and deterministic order (`upload`, `validate`, `transcribe`, `embed`, `save`).

Rationale:
Stage semantics reduce "stuck spinner" ambiguity and allow resumable, restorable progress UI.

Alternatives considered:
- Keep percent-only progress: rejected because users cannot infer what operation is currently running.
- Keep per-feature progress models (recording vs model download): rejected due to inconsistent UX and duplicated rendering.

### 4) Use shared error envelope for recording/progress APIs
Decision:
Return/consume a shared error envelope with title/summary/hint/technical/request-id mapping for all recording-related failures.

Rationale:
Users need actionable errors; developers need correlation IDs and technical context.

Alternatives considered:
- Endpoint-specific raw errors: rejected due to inconsistent user messaging and support burden.

### 5) Build waveform feedback as progressive enhancement
Decision:
Use lightweight live waveform + post-capture waveform preview in recording surfaces, with graceful fallback to level/time meters when unavailable.

Rationale:
Waveform improves confidence and review quality without requiring a full editor.

Alternatives considered:
- Full waveform editing timeline now: rejected to keep scope aligned with MVP usability improvements.
- No waveform, meter-only: rejected because users need visual confidence in captured speech structure.

### 6) Preserve compatibility by layering, not replacing
Decision:
Layer new lifecycle/progress abstractions over existing hooks/endpoints, then incrementally migrate components.

Rationale:
Minimizes regression risk and supports phased rollout.

Alternatives considered:
- Big-bang rewrite of recording surfaces: rejected due to high regression and difficult rollback.

## Risks / Trade-offs

- [State-model mismatch between components] -> Mitigation: centralize transitions in shared hook/store and enforce transition guards.
- [Progress event race conditions across polling + SSE] -> Mitigation: normalize by task ID and event timestamp; define last-write-wins rules.
- [WSL/host audio edge cases still produce noisy errors] -> Mitigation: explicit fallback paths and user-facing diagnostics for unsupported hosts.
- [Waveform rendering performance on low-end devices] -> Mitigation: downsample display data and cap refresh rate.
- [Inconsistent backend stage reporting across endpoints] -> Mitigation: add adapter layer and schema validation tests for stage payloads.

## Migration Plan

1. Define canonical recording state and event typings in shared frontend API/types layer.
2. Introduce updated hook interfaces (`useAudioRecording`, `useSystemAudioCapture`) with compatibility wrappers.
3. Add backend progress/stage mapping adjustments and error-envelope alignment for recording/transcribe endpoints.
4. Migrate voice profile recording components to new lifecycle + device-state surfaces.
5. Enable waveform + timer/meter UI with fallback behavior.
6. Integrate active task visibility and restore behavior in shared app shell progress handling.
7. Add tests for state transitions, stage progression, and primary error scenarios.
8. Roll out docs/troubleshooting updates and remove deprecated UI paths.

Rollback strategy:
- Keep previous hook contract behind compatibility wrappers during rollout.
- Feature-flag or switchable rendering path for new recording UI until validated.

## Open Questions

- Should "paused" state be enabled in first release, or deferred to reduce UI complexity?
- Should waveform persistence be stored for each sample draft, or be session-only?
- Should model-download progress and recording-processing progress share one unified task UI or remain visually separated with shared semantics?
- Which minimum diagnostic details should be exposed to users by default vs behind "technical details" disclosure?
