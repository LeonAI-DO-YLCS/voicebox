#!/usr/bin/env python3
"""
Download missing model files for Voicebox.
This script downloads only the configuration and tokenizer files,
skipping the large model weight files you already have.
"""

import os
import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download, list_repo_files

# Destination directory
MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

# Model configurations based on actual HuggingFace repos
MODELS = {
    "Qwen3-TTS-12Hz-1.7B-Base": {
        "repo_id": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        "local_dir": "Qwen3-TTS-12Hz-1.7B-Base",
        "existing_file": "Qwen TTS 1.7B.model.safetensors",  # File you already have
        # All files from repo (from list_repo_files):
        # .gitattributes, README.md, config.json, generation_config.json, merges.txt,
        # model.safetensors, preprocessor_config.json, speech_tokenizer/*, 
        # tokenizer_config.json, vocab.json
        "files_to_download": [
            "config.json",
            "generation_config.json", 
            "merges.txt",
            "preprocessor_config.json",
            "tokenizer_config.json",
            "vocab.json",
            # Speech tokenizer subdirectory files
            "speech_tokenizer/config.json",
            "speech_tokenizer/configuration.json",
            "speech_tokenizer/preprocessor_config.json",
            "speech_tokenizer/model.safetensors",  # This is small (~100MB), needed for tokenizer
        ],
        "skip_files": [
            ".gitattributes",
            "README.md",
            "model.safetensors",  # We have this as "Qwen TTS 1.7B.model.safetensors"
        ]
    },
    "whisper-large-v3-turbo": {
        "repo_id": "openai/whisper-large-v3-turbo",
        "local_dir": "whisper-large-v3-turbo",
        "existing_file": "Whisper Largev3..safetensors",  # File you already have
        # All files from repo (from list_repo_files):
        # .gitattributes, README.md, added_tokens.json, config.json, generation_config.json,
        # merges.txt, model.safetensors, normalizer.json, preprocessor_config.json,
        # special_tokens_map.json, tokenizer.json, tokenizer_config.json, vocab.json
        "files_to_download": [
            "added_tokens.json",
            "config.json",
            "generation_config.json",
            "merges.txt",
            "normalizer.json",
            "preprocessor_config.json",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
        ],
        "skip_files": [
            ".gitattributes",
            "README.md",
            "model.safetensors",  # We have this as "Whisper Largev3..safetensors"
        ]
    }
}


def download_file(repo_id: str, filename: str, local_dir: Path) -> bool:
    """Download a single file from HuggingFace."""
    try:
        print(f"  Downloading {filename}...")
        hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=str(local_dir),
            local_dir_use_symlinks=False
        )
        return True
    except Exception as e:
        print(f"  Warning: Could not download {filename}: {e}")
        return False


def setup_model(model_name: str, config: dict) -> Path:
    """Set up a model directory with config files and copy existing weights."""
    print(f"\n{'='*60}")
    print(f"Setting up: {model_name}")
    print(f"{'='*60}")
    
    local_dir = MODELS_DIR / config["local_dir"]
    local_dir.mkdir(exist_ok=True)
    
    # Check if existing weight file exists
    existing_file = MODELS_DIR / config["existing_file"]
    target_weight = local_dir / "model.safetensors"
    
    # Download config and tokenizer files
    print(f"\nDownloading configuration files from {config['repo_id']}...")
    downloaded = 0
    for filename in config["files_to_download"]:
        # Skip if already exists
        target_path = local_dir / filename
        if target_path.exists():
            print(f"  ✓ {filename} already exists, skipping")
            downloaded += 1
            continue
            
        # Create subdirectories if needed
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        if download_file(config["repo_id"], filename, local_dir):
            downloaded += 1
    
    print(f"\nDownloaded/verified {downloaded}/{len(config['files_to_download'])} files")
    
    # Copy existing weight file
    if existing_file.exists():
        print(f"\nCopying existing model weights...")
        print(f"  From: {existing_file}")
        print(f"  To: {target_weight}")
        print(f"  Size: {existing_file.stat().st_size / (1024*1024*1024):.2f} GB")
        
        if not target_weight.exists():
            shutil.copy2(existing_file, target_weight)
            print(f"  ✓ Model weights copied successfully!")
        else:
            existing_size = target_weight.stat().st_size
            source_size = existing_file.stat().st_size
            if existing_size == source_size:
                print(f"  ✓ Model weights already in place")
            else:
                print(f"  ! Size mismatch, re-copying...")
                shutil.copy2(existing_file, target_weight)
                print(f"  ✓ Model weights copied!")
    else:
        print(f"\n⚠ Warning: Existing weight file not found: {existing_file}")
        print(f"  You will need to download the model weights separately.")
    
    # List final directory contents
    print(f"\nFinal directory contents ({local_dir}):")
    for f in sorted(local_dir.rglob("*")):
        if f.is_file():
            size = f.stat().st_size
            if size > 1024*1024*1024:  # GB
                size_str = f"{size / (1024*1024*1024):.2f} GB"
            elif size > 1024*1024:  # MB
                size_str = f"{size / (1024*1024):.1f} MB"
            else:
                size_str = f"{size / 1024:.1f} KB"
            rel_path = f.relative_to(local_dir)
            print(f"  {str(rel_path):<40} {size_str}")
    
    return local_dir


def main():
    print("="*60)
    print("Voicebox Model Setup Script")
    print("="*60)
    print(f"\nModels directory: {MODELS_DIR.absolute()}")
    
    # Check existing files
    print("\nExisting files in models directory:")
    for f in sorted(MODELS_DIR.iterdir()):
        if f.is_file():
            size = f.stat().st_size / (1024*1024*1024)  # GB
            print(f"  {f.name:<40} {size:.2f} GB")
    
    # Set up each model
    setup_dirs = []
    for model_name, config in MODELS.items():
        setup_dirs.append(setup_model(model_name, config))
    
    # Final summary
    print("\n" + "="*60)
    print("SETUP COMPLETE!")
    print("="*60)
    print("\nModel directories created:")
    for d in setup_dirs:
        print(f"  {d}")
    
    print("\n" + "="*60)
    print("HOW TO USE WITH VOICEBOX")
    print("="*60)
    print("\nOption 1: Set environment variable before starting the server:")
    print(f"  export VOICEBOX_MODELS_DIR=\"{MODELS_DIR.absolute()}\"")
    print("  Then start the backend server")
    
    print("\nOption 2: The app will automatically download models to:")
    print("  ~/.cache/huggingface/hub/")
    
    print("\nNote: The local 'models/' directory uses a simplified structure.")
    print("For full HuggingFace compatibility, let the app download automatically.")


if __name__ == "__main__":
    main()
