## 1. Policy Foundation

- [x] 1.1 Add backend config model for voice clone reference policy (`hard_min_seconds`, `recommended_target_seconds`, `hard_max_seconds`) with safe defaults.
- [x] 1.2 Replace hard-coded duration checks in backend validation with policy-driven values.
- [x] 1.3 Implement startup-time policy validation and safe fallback behavior for invalid config.

## 2. Backend Quality Selection

- [x] 2.1 Add deterministic quality metric utilities (silence ratio, RMS floor, clipping risk) for candidate segments.
- [x] 2.2 Implement best-segment selection for samples longer than `recommended_target_seconds` with bounded processing.
- [x] 2.3 Integrate selected segment usage into profile sample ingestion and prompt creation path.
- [x] 2.4 Add deterministic fallback behavior when no segment passes quality thresholds.
- [x] 2.5 Persist selection metadata (offsets, metrics, fallback reason, policy version) with sample records.

## 3. API and Frontend Alignment

- [x] 3.1 Add backend endpoint to expose effective voice clone policy values to clients.
- [x] 3.2 Update frontend profile form and sample upload flows to use server-provided policy limits.
- [x] 3.3 Remove duplicated frontend hard-coded 30-second constants and update messaging to recommended vs maximum.
- [x] 3.4 Ensure recording/capture hooks use policy-driven auto-stop values within hard bounds.

## 4. Testing and Validation

- [x] 4.1 Add backend unit tests for policy parsing, validation bounds, and invalid-config fallback.
- [x] 4.2 Add backend unit tests for quality metric computation and best-segment selection behavior.
- [x] 4.3 Add integration tests for sample upload acceptance/rejection across boundary durations.
- [x] 4.4 Add regression tests confirming existing profile generation APIs remain backward compatible.

## 5. Documentation and Rollout

- [x] 5.1 Update developer docs for voice profile validation policy and selection behavior.
- [x] 5.2 Document operational tuning guidance for `recommended_target_seconds` and `hard_max_seconds`.
- [x] 5.3 Add release notes describing compatibility, defaults, and rollback instructions.
