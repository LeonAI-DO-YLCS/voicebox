## Why

Voice profile sample handling is currently constrained by a fixed 30-second application rule, which is stricter than current model/service guidance and can reject useful reference material. We need a configurable, bounded strategy that improves clone quality while keeping system behavior predictable, testable, and safe.

## What Changes

- Replace the fixed 30-second sample limit with a configurable duration policy (recommended window + hard maximum).
- Add backend quality-aware reference handling for uploaded samples so longer samples can be accepted within bounds and normalized into a model-friendly reference segment.
- Expose effective policy values to the UI so validation and messaging stay consistent with backend enforcement.
- Keep a strict upper bound and deterministic fallback behavior to avoid unbounded latency, memory growth, and unstable cloning quality.

## Capabilities

### New Capabilities
- `clone-reference-duration-policy`: Configurable duration governance for voice profile samples with synchronized frontend/backend enforcement.
- `clone-reference-quality-selection`: Deterministic quality scoring and best-segment selection for reference audio before prompt construction.

### Modified Capabilities
- None.

## Impact

- Affected backend modules: `backend/utils/audio.py`, `backend/profiles.py`, `backend/main.py`, backend config loading.
- Affected frontend modules: `app/src/components/VoiceProfiles/ProfileForm.tsx`, recording/capture hooks, upload messaging.
- New/updated API surface: policy read endpoint for effective limits and recommendations.
- Test impact: unit tests for policy parsing and selection logic, integration tests for sample upload acceptance/rejection paths.
