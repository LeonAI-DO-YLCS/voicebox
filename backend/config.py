"""
Configuration module for voicebox backend.

Handles data directory configuration for production bundling.
"""

import os
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Tuple

# Allow users to override the HuggingFace model download directory.
# Set VOICEBOX_MODELS_DIR to an absolute path before starting the server.
# This sets HF_HUB_CACHE so all huggingface_hub downloads go to that path.
_custom_models_dir = os.environ.get("VOICEBOX_MODELS_DIR")
if _custom_models_dir:
    os.environ["HF_HUB_CACHE"] = _custom_models_dir
    print(f"[config] Model download path set to: {_custom_models_dir}")

# Default data directory (used in development)
_data_dir = Path("data")


@dataclass(frozen=True)
class VoiceCloneReferencePolicy:
    """Runtime policy for voice clone reference audio handling."""

    hard_min_seconds: float = 2.0
    recommended_target_seconds: float = 15.0
    hard_max_seconds: float = 60.0
    capture_auto_stop_seconds: int = 29
    min_rms: float = 0.01
    max_silence_ratio: float = 0.45
    max_clipping_ratio: float = 0.02
    selection_step_seconds: float = 0.5
    policy_version: str = "v1"

    def to_dict(self) -> dict:
        return asdict(self)


_DEFAULT_VOICE_CLONE_POLICY = VoiceCloneReferencePolicy()


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except ValueError:
        print(f"[config] Invalid float for {name}={raw!r}; using default {default}")
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        print(f"[config] Invalid int for {name}={raw!r}; using default {default}")
        return default


def _validate_voice_clone_policy(policy: VoiceCloneReferencePolicy) -> Tuple[bool, str]:
    issues = []
    if policy.hard_min_seconds <= 0:
        issues.append("hard_min_seconds must be > 0")
    if policy.recommended_target_seconds <= 0:
        issues.append("recommended_target_seconds must be > 0")
    if policy.hard_max_seconds <= 0:
        issues.append("hard_max_seconds must be > 0")
    if policy.hard_min_seconds > policy.recommended_target_seconds:
        issues.append("hard_min_seconds must be <= recommended_target_seconds")
    if policy.recommended_target_seconds > policy.hard_max_seconds:
        issues.append("recommended_target_seconds must be <= hard_max_seconds")
    if policy.capture_auto_stop_seconds <= 0:
        issues.append("capture_auto_stop_seconds must be > 0")
    if policy.capture_auto_stop_seconds > int(policy.hard_max_seconds):
        issues.append("capture_auto_stop_seconds must be <= hard_max_seconds")
    if policy.min_rms <= 0:
        issues.append("min_rms must be > 0")
    if not (0 <= policy.max_silence_ratio <= 1):
        issues.append("max_silence_ratio must be between 0 and 1")
    if not (0 <= policy.max_clipping_ratio <= 1):
        issues.append("max_clipping_ratio must be between 0 and 1")
    if policy.selection_step_seconds <= 0:
        issues.append("selection_step_seconds must be > 0")

    if issues:
        return False, "; ".join(issues)
    return True, ""


def _load_voice_clone_reference_policy() -> VoiceCloneReferencePolicy:
    """
    Load voice clone policy from environment and validate once at startup.

    Falls back to safe defaults if values are missing or invalid.
    """

    policy = VoiceCloneReferencePolicy(
        hard_min_seconds=_env_float(
            "VOICE_CLONE_REF_HARD_MIN_SECONDS",
            _DEFAULT_VOICE_CLONE_POLICY.hard_min_seconds,
        ),
        recommended_target_seconds=_env_float(
            "VOICE_CLONE_REF_RECOMMENDED_TARGET_SECONDS",
            _DEFAULT_VOICE_CLONE_POLICY.recommended_target_seconds,
        ),
        hard_max_seconds=_env_float(
            "VOICE_CLONE_REF_HARD_MAX_SECONDS",
            _DEFAULT_VOICE_CLONE_POLICY.hard_max_seconds,
        ),
        capture_auto_stop_seconds=_env_int(
            "VOICE_CLONE_REF_CAPTURE_AUTO_STOP_SECONDS",
            _DEFAULT_VOICE_CLONE_POLICY.capture_auto_stop_seconds,
        ),
        min_rms=_env_float("VOICE_CLONE_REF_MIN_RMS", _DEFAULT_VOICE_CLONE_POLICY.min_rms),
        max_silence_ratio=_env_float(
            "VOICE_CLONE_REF_MAX_SILENCE_RATIO",
            _DEFAULT_VOICE_CLONE_POLICY.max_silence_ratio,
        ),
        max_clipping_ratio=_env_float(
            "VOICE_CLONE_REF_MAX_CLIPPING_RATIO",
            _DEFAULT_VOICE_CLONE_POLICY.max_clipping_ratio,
        ),
        selection_step_seconds=_env_float(
            "VOICE_CLONE_REF_SELECTION_STEP_SECONDS",
            _DEFAULT_VOICE_CLONE_POLICY.selection_step_seconds,
        ),
        policy_version=os.environ.get(
            "VOICE_CLONE_REF_POLICY_VERSION",
            _DEFAULT_VOICE_CLONE_POLICY.policy_version,
        ),
    )

    is_valid, reason = _validate_voice_clone_policy(policy)
    if not is_valid:
        print(f"[config] Invalid voice clone policy ({reason}). Falling back to safe defaults.")
        return _DEFAULT_VOICE_CLONE_POLICY

    return policy


_voice_clone_reference_policy = _load_voice_clone_reference_policy()

def set_data_dir(path: str | Path):
    """
    Set the data directory path.

    Args:
        path: Path to the data directory
    """
    global _data_dir
    _data_dir = Path(path)
    _data_dir.mkdir(parents=True, exist_ok=True)
    print(f"Data directory set to: {_data_dir.absolute()}")

def get_data_dir() -> Path:
    """
    Get the data directory path.

    Returns:
        Path to the data directory
    """
    return _data_dir

def get_db_path() -> Path:
    """Get database file path."""
    return _data_dir / "voicebox.db"

def get_profiles_dir() -> Path:
    """Get profiles directory path."""
    path = _data_dir / "profiles"
    path.mkdir(parents=True, exist_ok=True)
    return path

def get_generations_dir() -> Path:
    """Get generations directory path."""
    path = _data_dir / "generations"
    path.mkdir(parents=True, exist_ok=True)
    return path

def get_cache_dir() -> Path:
    """Get cache directory path."""
    path = _data_dir / "cache"
    path.mkdir(parents=True, exist_ok=True)
    return path

def get_models_dir() -> Path:
    """Get models directory path."""
    path = _data_dir / "models"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_voice_clone_reference_policy() -> VoiceCloneReferencePolicy:
    """Get the validated runtime policy for voice clone references."""
    return _voice_clone_reference_policy
