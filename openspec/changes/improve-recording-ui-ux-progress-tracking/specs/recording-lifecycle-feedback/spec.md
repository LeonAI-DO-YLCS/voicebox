## ADDED Requirements

### Requirement: Canonical Recording Lifecycle States
The system SHALL expose a canonical recording lifecycle with the states `idle`, `armed`, `recording`, `paused`, `processing`, `ready`, and `error` for voice recording workflows.

#### Scenario: Recording starts successfully
- **WHEN** a user starts recording with a valid input device and granted permissions
- **THEN** the UI transitions from `armed` to `recording` and displays recording-active feedback

#### Scenario: Recording finishes and enters processing
- **WHEN** a user stops recording after captured audio is available
- **THEN** the UI transitions to `processing` until post-capture processing completes

### Requirement: Valid Lifecycle Transitions
The system SHALL enforce deterministic lifecycle transitions and MUST reject invalid jumps that can produce contradictory UI states.

#### Scenario: Invalid transition attempt
- **WHEN** the UI receives an event that would transition directly from `idle` to `processing`
- **THEN** the transition is rejected and the state remains unchanged with an internal validation signal

#### Scenario: Recover from failure
- **WHEN** a recording operation fails and enters `error`
- **THEN** the user can perform a reset action that transitions to `idle`

### Requirement: Lifecycle-Driven User Messaging
The system SHALL provide user-visible status text tied to lifecycle state so users can understand current progress without inspecting logs.

#### Scenario: Processing status shown
- **WHEN** the lifecycle state is `processing`
- **THEN** the UI shows a processing-specific status message and disables conflicting recording actions

#### Scenario: Error state messaging
- **WHEN** the lifecycle state is `error`
- **THEN** the UI shows an actionable error summary with a recovery path
