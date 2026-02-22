import unittest
from datetime import datetime, timedelta, timezone

from utils.tasks import PROCESSING_STAGES, TaskManager


class RecordingProcessingTaskTests(unittest.TestCase):
    def test_stage_progression_and_completion(self):
        manager = TaskManager()
        task_id = "task-stage-order"

        manager.start_recording_processing(task_id, "Uploading")
        manager.update_recording_processing(task_id, "upload", progress=10, message="Upload done")
        manager.update_recording_processing(task_id, "validate", progress=30, message="Validated")
        manager.update_recording_processing(task_id, "transcribe", progress=60, message="Transcribing")
        manager.update_recording_processing(task_id, "embed", progress=80, message="Embedding")
        manager.update_recording_processing(task_id, "save", progress=95, message="Saving")

        active = manager.get_active_recording_tasks()
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0].task_id, task_id)
        self.assertEqual(active[0].stage, "save")
        self.assertEqual(active[0].status, "running")
        self.assertEqual(active[0].progress, 95)

        manager.complete_recording_processing(task_id, stage="save", message="Saved")
        self.assertEqual(manager.get_active_recording_tasks(), [])

    def test_tasks_do_not_overlap_between_task_ids(self):
        manager = TaskManager()
        task_a = "task-a"
        task_b = "task-b"

        manager.start_recording_processing(task_a, "A upload")
        manager.start_recording_processing(task_b, "B upload")
        manager.update_recording_processing(task_a, "validate", progress=25, message="A validate")
        manager.update_recording_processing(task_b, "transcribe", progress=60, message="B transcribe")

        tasks = {task.task_id: task for task in manager.get_active_recording_tasks()}
        self.assertEqual(set(tasks.keys()), {task_a, task_b})
        self.assertEqual(tasks[task_a].stage, "validate")
        self.assertEqual(tasks[task_b].stage, "transcribe")
        self.assertEqual(tasks[task_a].progress, 25)
        self.assertEqual(tasks[task_b].progress, 60)

    def test_error_cleanup_after_ttl(self):
        manager = TaskManager()
        task_id = "task-error-expiry"

        manager.start_recording_processing(task_id)
        manager.error_recording_processing(task_id, "failed", stage="transcribe")

        active = manager.get_active_recording_tasks()
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0].status, "error")
        self.assertEqual(active[0].stage, "transcribe")

        manager._active_recording_tasks[task_id].updated_at = datetime.now(timezone.utc) - timedelta(
            seconds=31
        )

        self.assertEqual(manager.get_active_recording_tasks(), [])

    def test_invalid_processing_stage_rejected(self):
        manager = TaskManager()
        task_id = "task-invalid-stage"
        manager.start_recording_processing(task_id)

        with self.assertRaises(ValueError):
            manager.update_recording_processing(task_id, "invalid-stage", progress=10)

        self.assertEqual(
            tuple(PROCESSING_STAGES), ("upload", "validate", "transcribe", "embed", "save")
        )


if __name__ == "__main__":
    unittest.main()
