"""
Helpers to resolve Hugging Face cache locations across app/runtime contexts.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable, Optional

from huggingface_hub import constants as hf_constants


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_candidate_cache_roots() -> list[Path]:
    """
    Return cache roots to search for Hugging Face repos.

    Includes default HF cache plus project-local `models/` cache used by this app.
    """
    roots: list[Path] = []
    seen: set[str] = set()

    def add(path: Optional[str | Path]) -> None:
        if not path:
            return
        p = Path(path).expanduser()
        key = str(p)
        if key in seen:
            return
        seen.add(key)
        roots.append(p)

    # Explicit override for voicebox if provided.
    add(os.environ.get("VOICEBOX_HF_CACHE_DIR"))
    # Standard HF cache configuration.
    add(os.environ.get("HF_HUB_CACHE"))
    add(getattr(hf_constants, "HF_HUB_CACHE", None))

    # Project-local caches (repo-rooted dev/download scripts).
    project_root = _project_root()
    add(project_root / "models")
    add(project_root / ".cache" / "huggingface" / "hub")

    return roots


def _repo_cache_dir(cache_root: Path, repo_id: str) -> Path:
    return cache_root / ("models--" + repo_id.replace("/", "--"))


def iter_existing_repo_cache_dirs(repo_id: str) -> list[Path]:
    return [
        repo_dir
        for root in get_candidate_cache_roots()
        for repo_dir in [_repo_cache_dir(root, repo_id)]
        if repo_dir.exists()
    ]


def _has_incomplete_blobs(repo_cache_dir: Path) -> bool:
    blobs_dir = repo_cache_dir / "blobs"
    return blobs_dir.exists() and any(blobs_dir.glob("*.incomplete"))


def _snapshot_contains_weights(snapshot_dir: Path, weight_patterns: Iterable[str]) -> bool:
    return any(any(snapshot_dir.rglob(pattern)) for pattern in weight_patterns)


def find_local_snapshot_path(
    repo_id: str,
    weight_patterns: Iterable[str] = ("*.safetensors", "*.bin"),
) -> Optional[Path]:
    """
    Return a local snapshot dir for the repo if present and complete, else None.
    """
    for repo_cache in iter_existing_repo_cache_dirs(repo_id):
        if _has_incomplete_blobs(repo_cache):
            continue

        snapshots_dir = repo_cache / "snapshots"
        if not snapshots_dir.exists():
            continue

        # Prefer ref target (main) if present.
        ref_main = repo_cache / "refs" / "main"
        if ref_main.exists():
            revision = ref_main.read_text(encoding="utf-8").strip()
            if revision:
                pinned = snapshots_dir / revision
                if pinned.exists() and _snapshot_contains_weights(
                    pinned, weight_patterns
                ):
                    return pinned

        # Fallback: newest snapshot with valid weights.
        candidates = sorted(
            [p for p in snapshots_dir.iterdir() if p.is_dir()],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for snapshot in candidates:
            if _snapshot_contains_weights(snapshot, weight_patterns):
                return snapshot

    return None


def is_repo_cached(
    repo_id: str,
    weight_patterns: Iterable[str] = ("*.safetensors", "*.bin"),
) -> bool:
    return find_local_snapshot_path(repo_id, weight_patterns) is not None
