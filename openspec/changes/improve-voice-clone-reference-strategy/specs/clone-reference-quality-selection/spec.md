## ADDED Requirements

### Requirement: Quality-Aware Reference Scoring
The system SHALL compute deterministic quality metrics for candidate reference regions, including at minimum silence ratio, RMS floor compliance, and clipping risk.

#### Scenario: Candidate region is low quality
- **WHEN** a candidate region has excessive silence or clipping beyond configured thresholds
- **THEN** the region is marked ineligible for prompt selection

#### Scenario: Candidate region is acceptable
- **WHEN** a candidate region satisfies all required metric thresholds
- **THEN** the system includes it in quality ranking for final selection

### Requirement: Best Segment Selection Within Target Window
For samples longer than `recommended_target_seconds`, the system SHALL select the best-scoring contiguous segment with duration capped to the recommended target window before voice prompt creation.

#### Scenario: Long sample requires selection
- **WHEN** uploaded reference audio is longer than `recommended_target_seconds` and within hard bounds
- **THEN** the backend selects a single best segment and uses that segment as the prompt source

#### Scenario: Short sample bypasses segmentation
- **WHEN** uploaded reference audio duration is less than or equal to `recommended_target_seconds`
- **THEN** the backend uses the full sample without additional segmentation

### Requirement: Explainable Selection Metadata
The system SHALL persist selection metadata with each profile sample so operators can trace why and how a segment was chosen.

#### Scenario: Metadata is stored after selection
- **WHEN** a best segment is selected for a sample
- **THEN** the stored metadata includes selected start/end offsets, measured quality metrics, and policy version

#### Scenario: Selection falls back
- **WHEN** no candidate region passes quality thresholds
- **THEN** the backend applies a deterministic fallback rule and marks the fallback reason in metadata

### Requirement: Backward-Compatible Prompt Construction
The system SHALL preserve the existing voice prompt creation API contract while using selected/processed audio under the hood.

#### Scenario: Existing generation flow
- **WHEN** generation is requested for a profile created before this change
- **THEN** the generation request succeeds without client-side API changes

#### Scenario: Multi-sample profile prompt creation
- **WHEN** a profile contains multiple samples
- **THEN** prompt construction uses each sample's selected/processed reference and does not rely on raw unbounded concatenation alone
