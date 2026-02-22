"""
Integration and regression tests for profile sample ingestion and prompt creation.
"""

import asyncio
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest import mock

import numpy as np
import soundfile as sf

from backend import config, database, models, profiles
from backend.database import ProfileSample as DBProfileSample


def _run_async(coro):
    return asyncio.run(coro)


def _write_sine_wav(path: Path, duration_seconds: float, sample_rate: int = 24000) -> None:
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds), endpoint=False)
    audio = 0.2 * np.sin(2 * np.pi * 220 * t)
    sf.write(str(path), audio.astype(np.float32), sample_rate)


class _FakeTTSModel:
    def __init__(self) -> None:
        self.create_calls = []
        self.combine_calls = []

    async def create_voice_prompt(self, audio_path: str, reference_text: str, use_cache: bool = True):
        self.create_calls.append(
            {
                "audio_path": audio_path,
                "reference_text": reference_text,
                "use_cache": use_cache,
            }
        )
        return {"audio_path": audio_path, "reference_text": reference_text}, None

    async def combine_voice_prompts(self, audio_paths, reference_texts):
        self.combine_calls.append(
            {
                "audio_paths": audio_paths,
                "reference_texts": reference_texts,
            }
        )
        combined_audio = np.zeros(24000, dtype=np.float32)
        combined_text = " ".join(reference_texts)
        return combined_audio, combined_text


class ProfileSamplePipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name) / "data"
        config.set_data_dir(self.data_dir)
        database.init_db()
        self.db = database.SessionLocal()

        self.profile = _run_async(
            profiles.create_profile(
                models.VoiceProfileCreate(
                    name=f"test-profile-{uuid.uuid4().hex[:8]}",
                    description="test profile",
                    language="en",
                ),
                self.db,
            )
        )

    def tearDown(self) -> None:
        self.db.close()
        if database.engine is not None:
            database.engine.dispose()
        self.temp_dir.cleanup()

    def test_sample_ingestion_enforces_duration_boundaries(self) -> None:
        policy = config.VoiceCloneReferencePolicy(
            hard_min_seconds=2.0,
            recommended_target_seconds=3.0,
            hard_max_seconds=4.0,
            capture_auto_stop_seconds=3,
            min_rms=0.01,
            max_silence_ratio=0.45,
            max_clipping_ratio=0.02,
            selection_step_seconds=0.5,
            policy_version="it-test",
        )

        with mock.patch.object(profiles.config, "get_voice_clone_reference_policy", return_value=policy):
            accepted_durations = (2.0, 4.0)
            rejected_durations = (1.9, 4.1)

            for duration in accepted_durations:
                with self.subTest(duration=duration):
                    audio_path = Path(self.temp_dir.name) / f"ok-{duration:.1f}.wav"
                    _write_sine_wav(audio_path, duration)
                    sample = _run_async(
                        profiles.add_profile_sample(
                            profile_id=self.profile.id,
                            audio_path=str(audio_path),
                            reference_text=f"accepted {duration}",
                            db=self.db,
                        )
                    )
                    self.assertEqual(sample.profile_id, self.profile.id)
                    self.assertIsNotNone(sample.selection_policy_version)
                    self.assertIsNotNone(sample.selection_end_ms)

            for duration in rejected_durations:
                with self.subTest(duration=duration):
                    audio_path = Path(self.temp_dir.name) / f"reject-{duration:.1f}.wav"
                    _write_sine_wav(audio_path, duration)
                    with self.assertRaises(ValueError):
                        _run_async(
                            profiles.add_profile_sample(
                                profile_id=self.profile.id,
                                audio_path=str(audio_path),
                                reference_text=f"rejected {duration}",
                                db=self.db,
                            )
                        )

    def test_single_sample_prompt_creation_remains_backward_compatible(self) -> None:
        audio_path = Path(self.temp_dir.name) / "legacy-single.wav"
        _write_sine_wav(audio_path, 2.5)

        sample = DBProfileSample(
            id=str(uuid.uuid4()),
            profile_id=self.profile.id,
            audio_path=str(audio_path),
            reference_text="legacy sample one",
        )
        self.db.add(sample)
        self.db.commit()

        fake_tts = _FakeTTSModel()
        with mock.patch("backend.profiles.get_tts_model", return_value=fake_tts):
            prompt = _run_async(profiles.create_voice_prompt_for_profile(self.profile.id, self.db))

        self.assertEqual(len(fake_tts.create_calls), 1)
        self.assertEqual(len(fake_tts.combine_calls), 0)
        self.assertEqual(prompt["reference_text"], "legacy sample one")

    def test_multi_sample_prompt_creation_remains_backward_compatible(self) -> None:
        audio_path_one = Path(self.temp_dir.name) / "legacy-multi-1.wav"
        audio_path_two = Path(self.temp_dir.name) / "legacy-multi-2.wav"
        _write_sine_wav(audio_path_one, 2.5)
        _write_sine_wav(audio_path_two, 2.6)

        sample_one = DBProfileSample(
            id=str(uuid.uuid4()),
            profile_id=self.profile.id,
            audio_path=str(audio_path_one),
            reference_text="legacy sample one",
        )
        sample_two = DBProfileSample(
            id=str(uuid.uuid4()),
            profile_id=self.profile.id,
            audio_path=str(audio_path_two),
            reference_text="legacy sample two",
        )
        self.db.add_all([sample_one, sample_two])
        self.db.commit()

        fake_tts = _FakeTTSModel()
        with mock.patch("backend.profiles.get_tts_model", return_value=fake_tts):
            prompt = _run_async(profiles.create_voice_prompt_for_profile(self.profile.id, self.db))

        self.assertEqual(len(fake_tts.combine_calls), 1)
        self.assertEqual(len(fake_tts.create_calls), 1)
        self.assertIn("legacy sample one", prompt["reference_text"])
        self.assertIn("legacy sample two", prompt["reference_text"])


if __name__ == "__main__":
    unittest.main()
