## ADDED Requirements

### Requirement: Configurable Reference Duration Policy
The system SHALL enforce voice profile sample duration using configurable policy values instead of hard-coded constants. The policy SHALL include:
- `recommended_target_seconds`
- `hard_max_seconds`
- `hard_min_seconds`

The system MUST reject samples shorter than `hard_min_seconds` or longer than `hard_max_seconds`.

#### Scenario: Sample exceeds hard maximum
- **WHEN** a user uploads a sample with duration greater than `hard_max_seconds`
- **THEN** the backend rejects the request with a validation error that includes the effective maximum

#### Scenario: Sample is within hard bounds
- **WHEN** a user uploads a sample with duration between `hard_min_seconds` and `hard_max_seconds` inclusive
- **THEN** the backend accepts the sample for quality processing

### Requirement: UI and Backend Policy Consistency
The system SHALL provide an API-readable policy payload so UI validation and messaging use the same effective values enforced by the backend.

#### Scenario: UI retrieves effective policy
- **WHEN** the client requests the voice cloning policy endpoint
- **THEN** the response includes `recommended_target_seconds`, `hard_min_seconds`, and `hard_max_seconds`

#### Scenario: Policy values change via configuration
- **WHEN** an operator changes policy configuration and restarts the backend
- **THEN** backend validation and UI-displayed limits reflect the new values without code changes

### Requirement: Deterministic Guardrails
The system SHALL maintain bounded processing behavior for reference audio regardless of configured values.

#### Scenario: Configuration is invalid
- **WHEN** policy configuration is missing or invalid (e.g., `hard_max_seconds < recommended_target_seconds`)
- **THEN** the backend falls back to safe defaults and logs a warning

#### Scenario: Processing large but valid sample
- **WHEN** a sample duration is valid but larger than `recommended_target_seconds`
- **THEN** the backend processes it through bounded segment selection and does not pass the full unbounded waveform directly to prompt building
