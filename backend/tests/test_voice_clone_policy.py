"""
Unit tests for voice clone reference policy parsing and segment quality selection.
"""

import os
import unittest
from unittest import mock

import numpy as np

from backend import config
from backend.utils.audio import compute_quality_metrics, select_best_reference_segment


class VoiceClonePolicyConfigTests(unittest.TestCase):
    def test_load_policy_from_env_values(self) -> None:
        with mock.patch.dict(
            os.environ,
            {
                "VOICE_CLONE_REF_HARD_MIN_SECONDS": "3",
                "VOICE_CLONE_REF_RECOMMENDED_TARGET_SECONDS": "18",
                "VOICE_CLONE_REF_HARD_MAX_SECONDS": "45",
                "VOICE_CLONE_REF_CAPTURE_AUTO_STOP_SECONDS": "25",
                "VOICE_CLONE_REF_MIN_RMS": "0.02",
                "VOICE_CLONE_REF_MAX_SILENCE_RATIO": "0.35",
                "VOICE_CLONE_REF_MAX_CLIPPING_RATIO": "0.015",
                "VOICE_CLONE_REF_SELECTION_STEP_SECONDS": "0.25",
                "VOICE_CLONE_REF_POLICY_VERSION": "test-v2",
            },
            clear=False,
        ):
            policy = config._load_voice_clone_reference_policy()

        self.assertEqual(policy.hard_min_seconds, 3.0)
        self.assertEqual(policy.recommended_target_seconds, 18.0)
        self.assertEqual(policy.hard_max_seconds, 45.0)
        self.assertEqual(policy.capture_auto_stop_seconds, 25)
        self.assertEqual(policy.min_rms, 0.02)
        self.assertEqual(policy.max_silence_ratio, 0.35)
        self.assertEqual(policy.max_clipping_ratio, 0.015)
        self.assertEqual(policy.selection_step_seconds, 0.25)
        self.assertEqual(policy.policy_version, "test-v2")

    def test_invalid_policy_falls_back_to_defaults(self) -> None:
        with mock.patch.dict(
            os.environ,
            {
                "VOICE_CLONE_REF_HARD_MIN_SECONDS": "20",
                "VOICE_CLONE_REF_RECOMMENDED_TARGET_SECONDS": "10",
                "VOICE_CLONE_REF_HARD_MAX_SECONDS": "8",
            },
            clear=False,
        ):
            policy = config._load_voice_clone_reference_policy()

        self.assertEqual(policy, config._DEFAULT_VOICE_CLONE_POLICY)


class VoiceCloneSelectionTests(unittest.TestCase):
    def test_compute_quality_metrics_reports_expected_ranges(self) -> None:
        audio = np.concatenate(
            [
                np.zeros(100, dtype=np.float32),
                np.full(100, 0.25, dtype=np.float32),
            ]
        )
        metrics = compute_quality_metrics(audio, silence_threshold=0.01, clipping_threshold=0.99)

        self.assertGreater(metrics["rms"], 0.0)
        self.assertGreater(metrics["silence_ratio"], 0.0)
        self.assertLess(metrics["silence_ratio"], 1.0)
        self.assertEqual(metrics["clipping_ratio"], 0.0)
        self.assertGreater(metrics["peak_abs"], 0.0)

    def test_select_best_segment_prefers_voiced_window(self) -> None:
        sample_rate = 1000
        seconds = 2
        t = np.linspace(0, seconds, sample_rate * seconds, endpoint=False, dtype=np.float32)

        silence = np.zeros(sample_rate * seconds, dtype=np.float32)
        voiced = 0.2 * np.sin(2 * np.pi * 220 * t)
        clipped = np.ones(sample_rate * seconds, dtype=np.float32)
        audio = np.concatenate([silence, voiced, clipped])

        selected, meta = select_best_reference_segment(
            audio=audio,
            sample_rate=sample_rate,
            recommended_target_seconds=2.0,
            min_rms=0.01,
            max_silence_ratio=0.45,
            max_clipping_ratio=0.02,
            selection_step_seconds=2.0,
            policy_version="test-policy",
        )

        self.assertEqual(selected.shape[0], sample_rate * seconds)
        self.assertEqual(meta["selected_start_ms"], 2000)
        self.assertEqual(meta["selected_end_ms"], 4000)
        self.assertIsNone(meta["fallback_reason"])
        self.assertEqual(meta["policy_version"], "test-policy")
        self.assertGreater(meta["metrics"]["rms"], 0.01)

    def test_select_best_segment_fallback_is_deterministic(self) -> None:
        sample_rate = 1000
        audio = np.zeros(sample_rate * 4, dtype=np.float32)

        selected, meta = select_best_reference_segment(
            audio=audio,
            sample_rate=sample_rate,
            recommended_target_seconds=2.0,
            min_rms=0.05,
            max_silence_ratio=0.01,
            max_clipping_ratio=0.0,
            selection_step_seconds=2.0,
            policy_version="test-policy",
        )

        self.assertEqual(selected.shape[0], sample_rate * 2)
        self.assertEqual(meta["selected_start_ms"], 0)
        self.assertEqual(meta["selected_end_ms"], 2000)
        self.assertEqual(meta["fallback_reason"], "no_segment_met_quality_thresholds")


if __name__ == "__main__":
    unittest.main()
