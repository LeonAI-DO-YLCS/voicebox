## ADDED Requirements

### Requirement: Stage-Based Processing Progress
The system SHALL report recording processing progress using explicit ordered stages: `upload`, `validate`, `transcribe`, `embed`, `save`.

#### Scenario: Successful stage progression
- **WHEN** a recorded sample is processed successfully
- **THEN** progress advances through each defined stage in order until completion

#### Scenario: Stage failure
- **WHEN** processing fails in any stage
- **THEN** the failed stage is identified in the error payload and surfaced in the UI

### Requirement: Progress Event Correlation
The system SHALL correlate processing updates to a stable operation/task identifier so the UI can restore and continue displaying progress across navigation.

#### Scenario: User navigates away and back
- **WHEN** a processing operation is still active and the user changes routes
- **THEN** the UI restores progress display for the same operation using the stable task identifier

#### Scenario: Concurrent operations
- **WHEN** multiple operations are active simultaneously
- **THEN** progress updates are associated with the correct operation and do not overwrite each other

### Requirement: Actionable Processing Error Surface
The system SHALL include user-facing error summary, retry guidance, and technical correlation context for processing failures.

#### Scenario: Transcription model unavailable
- **WHEN** transcription cannot proceed due to missing or unavailable model
- **THEN** the UI shows an actionable message describing model state and retry conditions

#### Scenario: Backend validation failure
- **WHEN** processing fails due to invalid recording input
- **THEN** the UI shows a validation-specific error with a suggested corrective action
