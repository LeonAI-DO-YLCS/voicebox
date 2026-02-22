## ADDED Requirements

### Requirement: Live Recording Signal Feedback
The system SHALL provide live signal feedback during recording via level metering and waveform visualization when supported.

#### Scenario: Live waveform supported
- **WHEN** recording is active and waveform sampling is available
- **THEN** the UI renders a continuously updating waveform and elapsed recording time

#### Scenario: Waveform unavailable
- **WHEN** waveform sampling is unavailable in the current runtime
- **THEN** the UI falls back to a live level meter and timer without blocking recording

### Requirement: Post-Capture Waveform Preview
The system SHALL provide a post-capture waveform preview with a visible playhead for sample review.

#### Scenario: User reviews a captured sample
- **WHEN** recording completes and captured audio is available
- **THEN** the UI shows a waveform preview that supports playback progress indication

#### Scenario: Empty capture
- **WHEN** recording stops but captured audio contains no usable signal
- **THEN** the UI shows an invalid-capture state instead of rendering a misleading waveform preview

### Requirement: Time Boundaries and Duration Visibility
The system SHALL display elapsed duration and configured maximum duration boundaries during capture.

#### Scenario: Approaching max duration
- **WHEN** elapsed recording time nears configured maximum duration
- **THEN** the UI highlights remaining time and warns the user before auto-stop

#### Scenario: Maximum duration reached
- **WHEN** recording reaches configured maximum duration
- **THEN** recording auto-stops and transitions to processing
