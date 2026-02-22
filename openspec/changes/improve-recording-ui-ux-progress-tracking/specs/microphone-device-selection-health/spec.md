## ADDED Requirements

### Requirement: Discoverable Microphone Device List
The system SHALL present a list of available microphone input devices for recording workflows.

#### Scenario: Devices are available
- **WHEN** the recording interface loads and input devices are discoverable
- **THEN** the UI shows each available device in a selectable list

#### Scenario: No devices available
- **WHEN** no input devices are discoverable
- **THEN** the UI shows a no-device state with guidance for remediation

### Requirement: Default Device Behavior
The system SHALL identify and preselect the host/default input device when available.

#### Scenario: Default device exists
- **WHEN** device discovery returns a default input device
- **THEN** the default device is selected automatically and marked as default in the UI

#### Scenario: Default device changes externally
- **WHEN** the operating system default input device changes while the app is running
- **THEN** the app refreshes device status and indicates the new default without silent mismatch

### Requirement: Device Health and Permission Error Reporting
The system SHALL distinguish permission failures, disconnected device failures, and unsupported host capture failures.

#### Scenario: Permission denied
- **WHEN** microphone access is denied by runtime or operating system policy
- **THEN** the UI shows a permission-specific error with explicit steps to grant access

#### Scenario: Selected device disconnects
- **WHEN** the currently selected input device becomes unavailable
- **THEN** the UI marks the device as disconnected and blocks recording until a valid device is selected
