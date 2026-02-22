"""
Unit tests for STT model normalization and model selection priority.
"""

import os
import unittest
from unittest import mock

from backend.backends.mlx_backend import MLXSTTBackend
from backend.backends.pytorch_backend import PyTorchSTTBackend


class STTModelSelectionTests(unittest.TestCase):
    def test_pytorch_prefers_best_cached_model(self) -> None:
        backend = PyTorchSTTBackend(model_size="base")
        cached = {"large-v3": True, "base": True}

        with mock.patch.object(
            backend,
            "_is_model_cached",
            side_effect=lambda model_size: cached.get(model_size, False),
        ):
            with mock.patch.dict(
                os.environ,
                {"VOICEBOX_STT_MODEL_SIZE": "auto"},
                clear=False,
            ):
                preferred = backend.get_preferred_model_size()

        self.assertEqual(preferred, "large-v3")

    def test_pytorch_honors_explicit_env_override(self) -> None:
        with mock.patch.dict(
            os.environ,
            {"VOICEBOX_STT_MODEL_SIZE": "openai/whisper-large-v3-turbo"},
            clear=False,
        ):
            backend = PyTorchSTTBackend(model_size="base")
            preferred = backend.get_preferred_model_size()

        self.assertEqual(preferred, "turbo")

    def test_pytorch_auto_mode_does_not_fallback_to_base(self) -> None:
        backend = PyTorchSTTBackend(model_size="turbo")
        cached = {"base": True}

        with mock.patch.object(
            backend,
            "_is_model_cached",
            side_effect=lambda model_size: cached.get(model_size, False),
        ):
            with mock.patch.dict(
                os.environ,
                {"VOICEBOX_STT_MODEL_SIZE": "auto"},
                clear=False,
            ):
                preferred = backend.get_preferred_model_size()

        self.assertEqual(preferred, "turbo")

    def test_mlx_prefers_best_cached_model(self) -> None:
        backend = MLXSTTBackend(model_size="base")
        cached = {"turbo": True, "large-v3": True, "base": True}

        with mock.patch.object(
            backend,
            "_is_model_cached",
            side_effect=lambda model_size: cached.get(model_size, False),
        ):
            with mock.patch.dict(
                os.environ,
                {"VOICEBOX_STT_MODEL_SIZE": "auto"},
                clear=False,
            ):
                preferred = backend.get_preferred_model_size()

        self.assertEqual(preferred, "turbo")

    def test_model_aliases_normalize_to_expected_repo_key(self) -> None:
        self.assertEqual(
            PyTorchSTTBackend._normalize_model_size("openai/whisper-large-v3-turbo"),
            "turbo",
        )
        self.assertEqual(
            MLXSTTBackend._normalize_model_size("whisper-large-v3"),
            "large-v3",
        )


if __name__ == "__main__":
    unittest.main()
