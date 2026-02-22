## ADDED Requirements

### Requirement: Active Task Visibility for Recording-Related Work
The system SHALL display active recording-related tasks, including processing and model-download tasks, in a persistent visible surface.

#### Scenario: Active tasks present
- **WHEN** one or more recording-related tasks are active
- **THEN** the UI displays each task with current status and progress state

#### Scenario: No active tasks
- **WHEN** no recording-related tasks are active
- **THEN** the active-task surface shows an empty state without stale task entries

### Requirement: Task State Persistence Across Refresh
The system SHALL restore active task visibility after app navigation or refresh while tasks are still in progress.

#### Scenario: App reload during active task
- **WHEN** the app reloads while a recording processing task is active
- **THEN** the UI restores that task's status and continues progress updates

#### Scenario: Completed task cleanup
- **WHEN** a task reaches terminal completion state
- **THEN** the task transitions out of active-task view according to defined completion behavior

### Requirement: Unified Task Semantics Across Sources
The system SHALL normalize task semantics so model download progress and recording processing progress can be rendered consistently.

#### Scenario: Mixed task types
- **WHEN** model download and recording processing tasks run concurrently
- **THEN** the UI renders both using a shared task status model without type-specific ambiguity

#### Scenario: Task error normalization
- **WHEN** any task fails
- **THEN** the error state includes normalized status, user-facing message, and diagnostic details
