"""
Audio processing utilities.
"""

import numpy as np
import soundfile as sf
import librosa
from typing import Tuple, Optional, Dict, Any


def normalize_audio(
    audio: np.ndarray,
    target_db: float = -20.0,
    peak_limit: float = 0.85,
) -> np.ndarray:
    """
    Normalize audio to target loudness with peak limiting.
    
    Args:
        audio: Input audio array
        target_db: Target RMS level in dB
        peak_limit: Peak limit (0.0-1.0)
        
    Returns:
        Normalized audio array
    """
    # Convert to float32
    audio = audio.astype(np.float32)
    
    # Calculate current RMS
    rms = np.sqrt(np.mean(audio**2))
    
    # Calculate target RMS
    target_rms = 10**(target_db / 20)
    
    # Apply gain
    if rms > 0:
        gain = target_rms / rms
        audio = audio * gain
    
    # Peak limiting
    audio = np.clip(audio, -peak_limit, peak_limit)
    
    return audio


def load_audio(
    path: str,
    sample_rate: int = 24000,
    mono: bool = True,
) -> Tuple[np.ndarray, int]:
    """
    Load audio file with normalization.
    
    Args:
        path: Path to audio file
        sample_rate: Target sample rate
        mono: Convert to mono
        
    Returns:
        Tuple of (audio_array, sample_rate)
    """
    audio, sr = librosa.load(path, sr=sample_rate, mono=mono)
    return audio, sr


def save_audio(
    audio: np.ndarray,
    path: str,
    sample_rate: int = 24000,
) -> None:
    """
    Save audio file.
    
    Args:
        audio: Audio array
        path: Output path
        sample_rate: Sample rate
    """
    sf.write(path, audio, sample_rate)


def validate_reference_audio(
    audio_path: str,
    min_duration: float = 2.0,
    max_duration: float = 30.0,
    min_rms: float = 0.01,
) -> Tuple[bool, Optional[str]]:
    """
    Validate reference audio for voice cloning.
    
    Args:
        audio_path: Path to audio file
        min_duration: Minimum duration in seconds
        max_duration: Maximum duration in seconds
        min_rms: Minimum RMS level
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        audio, sr = load_audio(audio_path)
        duration = len(audio) / sr
        
        if duration < min_duration:
            return False, f"Audio too short (minimum {min_duration} seconds)"
        if duration > max_duration:
            return False, f"Audio too long (maximum {max_duration} seconds)"
        
        rms = np.sqrt(np.mean(audio**2))
        if rms < min_rms:
            return False, "Audio is too quiet or silent"
        
        if np.abs(audio).max() > 0.99:
            return False, "Audio is clipping (reduce input gain)"
        
        return True, None
    except Exception as e:
        return False, f"Error validating audio: {str(e)}"


def compute_quality_metrics(
    audio: np.ndarray,
    silence_threshold: float = 0.01,
    clipping_threshold: float = 0.99,
) -> Dict[str, float]:
    """
    Compute deterministic quality metrics for a mono audio segment.
    """
    if audio.size == 0:
        return {
            "duration_seconds": 0.0,
            "rms": 0.0,
            "silence_ratio": 1.0,
            "clipping_ratio": 1.0,
            "peak_abs": 0.0,
        }

    abs_audio = np.abs(audio)
    rms = float(np.sqrt(np.mean(audio**2)))
    silence_ratio = float(np.mean(abs_audio <= silence_threshold))
    clipping_ratio = float(np.mean(abs_audio >= clipping_threshold))
    peak_abs = float(abs_audio.max())

    return {
        "duration_seconds": float(audio.shape[0]),
        "rms": rms,
        "silence_ratio": silence_ratio,
        "clipping_ratio": clipping_ratio,
        "peak_abs": peak_abs,
    }


def select_best_reference_segment(
    audio: np.ndarray,
    sample_rate: int,
    recommended_target_seconds: float,
    min_rms: float,
    max_silence_ratio: float,
    max_clipping_ratio: float,
    selection_step_seconds: float,
    policy_version: str = "v1",
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Select a bounded, high-quality segment from reference audio.

    For short clips (<= target window), returns the original audio with metadata.
    For long clips, scans fixed-size windows and picks the best deterministic score.
    """
    if audio.size == 0:
        raise ValueError("Cannot select reference segment from empty audio")

    if sample_rate <= 0:
        raise ValueError("sample_rate must be > 0")

    total_duration_seconds = float(audio.shape[0] / sample_rate)
    window_samples = max(1, int(recommended_target_seconds * sample_rate))
    window_samples = min(window_samples, audio.shape[0])

    # Fast path: clip already within the recommended target window.
    if audio.shape[0] <= window_samples:
        metrics = compute_quality_metrics(audio)
        metrics["duration_seconds"] = float(audio.shape[0] / sample_rate)
        return audio, {
            "selected_start_ms": 0,
            "selected_end_ms": int(total_duration_seconds * 1000),
            "source_duration_ms": int(total_duration_seconds * 1000),
            "metrics": metrics,
            "fallback_reason": None,
            "policy_version": policy_version,
        }

    step_samples = max(1, int(selection_step_seconds * sample_rate))
    last_start = audio.shape[0] - window_samples

    # Ensure the final window is evaluated even if step does not align.
    starts = list(range(0, last_start + 1, step_samples))
    if starts[-1] != last_start:
        starts.append(last_start)

    candidates = []
    rms_norm_denom = max(min_rms * 2.0, 1e-8)

    for start in starts:
        end = start + window_samples
        segment = audio[start:end]
        metrics = compute_quality_metrics(segment)
        metrics["duration_seconds"] = float(segment.shape[0] / sample_rate)

        eligible = (
            metrics["rms"] >= min_rms
            and metrics["silence_ratio"] <= max_silence_ratio
            and metrics["clipping_ratio"] <= max_clipping_ratio
        )

        # Deterministic weighted score.
        normalized_rms = min(metrics["rms"] / rms_norm_denom, 1.5)
        score = (
            (1.0 - metrics["silence_ratio"]) * 0.45
            + normalized_rms * 0.40
            + (1.0 - metrics["clipping_ratio"]) * 0.15
        )

        if not eligible:
            score -= 1.0

        candidates.append(
            {
                "start": start,
                "end": end,
                "eligible": eligible,
                "score": score,
                "metrics": metrics,
            }
        )

    eligible_candidates = [c for c in candidates if c["eligible"]]
    fallback_reason = None

    if eligible_candidates:
        best = max(
            eligible_candidates,
            key=lambda c: (c["score"], -c["metrics"]["silence_ratio"], c["metrics"]["rms"]),
        )
    else:
        # Deterministic fallback when all windows fail thresholds:
        # prefer least silence, then highest RMS, then lowest clipping.
        best = max(
            candidates,
            key=lambda c: (-c["metrics"]["silence_ratio"], c["metrics"]["rms"], -c["metrics"]["clipping_ratio"]),
        )
        fallback_reason = "no_segment_met_quality_thresholds"

    selected = audio[best["start"]:best["end"]]
    return selected, {
        "selected_start_ms": int(best["start"] / sample_rate * 1000),
        "selected_end_ms": int(best["end"] / sample_rate * 1000),
        "source_duration_ms": int(total_duration_seconds * 1000),
        "metrics": best["metrics"],
        "fallback_reason": fallback_reason,
        "policy_version": policy_version,
    }
