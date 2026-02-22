## Context

Voicebox currently enforces a fixed 30-second reference-audio cap in both frontend and backend flows. This causes avoidable rejection of valid reference material and makes policy changes require source edits. At the same time, naively allowing arbitrarily long reference audio risks instability: higher memory/latency, increased transcript mismatch impact, and reduced clone consistency from mixed-content clips.

The desired path is a bounded, configurable policy with deterministic quality selection so the system can accept richer input without becoming unbounded or brittle.

## Goals / Non-Goals

**Goals:**
- Introduce a backend-owned, configurable duration policy (`hard_min`, `recommended_target`, `hard_max`).
- Keep frontend validation in sync with backend policy values via a small read endpoint.
- Add deterministic quality scoring and best-segment selection for long-but-valid samples.
- Preserve existing generation and profile APIs so this can ship without breaking clients.
- Keep implementation complexity low with clear defaults, bounded loops, and explicit fallbacks.

**Non-Goals:**
- No model fine-tuning workflow changes.
- No new external DSP/ML dependency for advanced diarization or speaker separation in MVP.
- No unbounded "use whole long file" prompt path.
- No schema-breaking response changes for existing endpoints.

## Decisions

### Decision 1: Backend as policy source of truth
- **Choice:** Define policy in backend configuration with safe defaults and expose effective values via a read endpoint.
- **Reasoning:** Eliminates drift between frontend constants and backend validators; enables operator tuning without code edits.
- **Alternatives considered:**
  - Keep duplicated constants in frontend/backend: rejected due to drift risk.
  - Frontend as source of truth: rejected because backend must remain authoritative for security and API correctness.

### Decision 2: Bounded configurable window, not unlimited input
- **Choice:** Enforce `hard_min`/`hard_max`, with `recommended_target` as the processing target window.
- **Reasoning:** Supports better quality opportunities while preserving predictable resource usage and avoiding worst-case regression.
- **Alternatives considered:**
  - Remove hard maximum: rejected due to memory/latency risk and increased failure surface.
  - Keep fixed 30s forever: rejected because it is unnecessarily restrictive relative to model/service guidance.

### Decision 3: Deterministic quality-first segmentation
- **Choice:** For audio > `recommended_target`, select the best contiguous segment using deterministic metrics (silence ratio, RMS floor, clipping), then pass selected audio to prompt creation.
- **Reasoning:** Improves consistency and debuggability without introducing heavy ML complexity.
- **Alternatives considered:**
  - Random/first-N-second selection: rejected due to unstable quality.
  - Full ASR-alignment scoring in MVP: deferred due to complexity and added latency.

### Decision 4: Metadata for traceability
- **Choice:** Store selection offsets/metrics/policy version with sample metadata.
- **Reasoning:** Enables debugging and future tuning without reprocessing blind.
- **Alternatives considered:**
  - No metadata: rejected due to poor operability.

### Decision 5: Backward-compatible implementation layering
- **Choice:** Keep current endpoint contracts; implement policy/selection behind existing upload and prompt creation paths.
- **Reasoning:** Low migration risk and no client breakage.
- **Alternatives considered:**
  - New upload contract requiring client policy logic: rejected for compatibility overhead.

## Risks / Trade-offs

- **[Risk] Misconfigured policy values** → **Mitigation:** Validate at startup, enforce safe fallback defaults, emit structured warnings.
- **[Risk] Quality thresholds too strict or too lax** → **Mitigation:** Keep conservative defaults and include metadata for calibration.
- **[Risk] Added processing time for long samples** → **Mitigation:** Bound candidate search and segment length; short-circuit for clips <= recommended target.
- **[Risk] Regression in existing profile generation** → **Mitigation:** Backward-compatible API behavior and integration tests for old/new sample paths.
- **[Risk] User confusion on recommended vs hard maximum** → **Mitigation:** UI displays both values with clear wording ("recommended" vs "maximum allowed").

## Migration Plan

1. Add backend config schema and default values for duration policy and selection thresholds.
2. Implement policy read endpoint and wire frontend validation/display to server-provided values.
3. Implement selection pipeline in sample ingestion path with bounded deterministic metrics.
4. Persist selection metadata for each processed sample.
5. Add tests:
   - Policy parsing/fallback
   - Validation acceptance/rejection at bounds
   - Segment selection and fallback
   - End-to-end sample upload behavior
6. Rollout:
   - Release with defaults equivalent to current behavior where safe.
   - Increase `hard_max` only after test verification and monitoring.
7. Rollback:
   - Revert config to prior strict values; disable selection path via config switch if needed.

## Open Questions

- Should MVP include optional transcript-alignment confidence (ASR vs reference text), or defer to phase 2?
- What should the initial default `hard_max_seconds` be for production (45 vs 60)?
- Should selection metadata be exposed in API responses immediately or stored backend-only first?
