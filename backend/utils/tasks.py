"""
Task tracking for active downloads, generations, and recording processing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Dict, List, Optional


PROCESSING_STAGES = ("upload", "validate", "transcribe", "embed", "save")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class DownloadTask:
    """Represents an active download task."""

    model_name: str
    status: str = "downloading"  # downloading, extracting, complete, error
    started_at: datetime = field(default_factory=_now_utc)
    error: Optional[str] = None


@dataclass
class GenerationTask:
    """Represents an active generation task."""

    task_id: str
    profile_id: str
    text_preview: str  # First 50 chars of text
    started_at: datetime = field(default_factory=_now_utc)


@dataclass
class RecordingProcessingTask:
    """Represents an active recording processing operation."""

    task_id: str
    stage: str = "upload"
    status: str = "running"  # running, complete, error
    progress: Optional[float] = 0.0
    message: Optional[str] = None
    error: Optional[str] = None
    started_at: datetime = field(default_factory=_now_utc)
    updated_at: datetime = field(default_factory=_now_utc)


class TaskManager:
    """Manages active downloads, generations, and recording-processing tasks."""

    def __init__(self):
        self._active_downloads: Dict[str, DownloadTask] = {}
        self._active_generations: Dict[str, GenerationTask] = {}
        self._active_recording_tasks: Dict[str, RecordingProcessingTask] = {}
        self._lock = Lock()

    def start_download(self, model_name: str) -> None:
        """Mark a download as started."""
        with self._lock:
            self._active_downloads[model_name] = DownloadTask(
                model_name=model_name,
                status="downloading",
            )

    def complete_download(self, model_name: str) -> None:
        """Mark a download as complete."""
        with self._lock:
            if model_name in self._active_downloads:
                del self._active_downloads[model_name]

    def error_download(self, model_name: str, error: str) -> None:
        """Mark a download as failed."""
        with self._lock:
            if model_name in self._active_downloads:
                self._active_downloads[model_name].status = "error"
                self._active_downloads[model_name].error = error

    def start_generation(self, task_id: str, profile_id: str, text: str) -> None:
        """Mark a generation as started."""
        text_preview = text[:50] + "..." if len(text) > 50 else text
        with self._lock:
            self._active_generations[task_id] = GenerationTask(
                task_id=task_id,
                profile_id=profile_id,
                text_preview=text_preview,
            )

    def complete_generation(self, task_id: str) -> None:
        """Mark a generation as complete."""
        with self._lock:
            if task_id in self._active_generations:
                del self._active_generations[task_id]

    def start_recording_processing(self, task_id: str, message: Optional[str] = None) -> None:
        """Start a recording-processing task with deterministic initial stage."""
        with self._lock:
            self._active_recording_tasks[task_id] = RecordingProcessingTask(
                task_id=task_id,
                stage="upload",
                status="running",
                progress=0.0,
                message=message or "Uploading sample",
            )

    def update_recording_processing(
        self,
        task_id: str,
        stage: str,
        progress: Optional[float] = None,
        message: Optional[str] = None,
    ) -> None:
        """Update a recording-processing task stage and progress."""
        if stage not in PROCESSING_STAGES:
            raise ValueError(f"Invalid processing stage: {stage}")

        with self._lock:
            task = self._active_recording_tasks.get(task_id)
            if task is None:
                task = RecordingProcessingTask(task_id=task_id)
                self._active_recording_tasks[task_id] = task

            task.stage = stage
            task.status = "running"
            task.updated_at = _now_utc()
            task.error = None
            if progress is not None:
                task.progress = max(0.0, min(100.0, progress))
            if message is not None:
                task.message = message

    def complete_recording_processing(
        self, task_id: str, stage: str = "save", message: Optional[str] = None
    ) -> None:
        """Mark recording-processing as complete and remove from active set."""
        with self._lock:
            task = self._active_recording_tasks.get(task_id)
            if task is None:
                return
            task.stage = stage
            task.status = "complete"
            task.progress = 100.0
            task.message = message or "Sample saved"
            task.updated_at = _now_utc()
            del self._active_recording_tasks[task_id]

    def error_recording_processing(
        self,
        task_id: str,
        error: str,
        stage: Optional[str] = None,
        message: Optional[str] = None,
    ) -> None:
        """Mark recording-processing task as failed."""
        with self._lock:
            task = self._active_recording_tasks.get(task_id)
            if task is None:
                task = RecordingProcessingTask(task_id=task_id)
                self._active_recording_tasks[task_id] = task

            if stage is not None and stage in PROCESSING_STAGES:
                task.stage = stage
            task.status = "error"
            task.error = error
            task.message = message or error
            task.updated_at = _now_utc()

    def complete_error_recording_processing(self, task_id: str) -> None:
        """Remove failed recording-processing task after frontend acknowledged it."""
        with self._lock:
            if task_id in self._active_recording_tasks:
                del self._active_recording_tasks[task_id]

    def get_active_downloads(self) -> List[DownloadTask]:
        """Get all active downloads."""
        with self._lock:
            return list(self._active_downloads.values())

    def get_active_generations(self) -> List[GenerationTask]:
        """Get all active generations."""
        with self._lock:
            return list(self._active_generations.values())

    def get_active_recording_tasks(self) -> List[RecordingProcessingTask]:
        """Get all active recording processing tasks."""
        with self._lock:
            expiry_cutoff = _now_utc() - timedelta(seconds=30)
            stale_error_ids = [
                task_id
                for task_id, task in self._active_recording_tasks.items()
                if task.status == "error" and task.updated_at < expiry_cutoff
            ]
            for task_id in stale_error_ids:
                del self._active_recording_tasks[task_id]
            return list(self._active_recording_tasks.values())

    def is_download_active(self, model_name: str) -> bool:
        """Check if a download is active."""
        with self._lock:
            return model_name in self._active_downloads

    def is_generation_active(self, task_id: str) -> bool:
        """Check if a generation is active."""
        with self._lock:
            return task_id in self._active_generations

    def is_recording_processing_active(self, task_id: str) -> bool:
        """Check if a recording-processing task is active."""
        with self._lock:
            return task_id in self._active_recording_tasks


# Global task manager instance
_task_manager: Optional[TaskManager] = None


def get_task_manager() -> TaskManager:
    """Get or create the global task manager."""
    global _task_manager
    if _task_manager is None:
        _task_manager = TaskManager()
    return _task_manager
