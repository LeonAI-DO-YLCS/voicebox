#!/bin/bash
# Download missing model files for Voicebox
# This script downloads config and tokenizer files, then copies your existing model weights

set -e

MODELS_DIR="$(cd "$(dirname "$0")" && pwd)/models"
cd "$MODELS_DIR"

echo "============================================================"
echo "Voicebox Model Setup Script"
echo "============================================================"
echo ""
echo "Models directory: $MODELS_DIR"
echo ""

# ============================================
# Qwen3-TTS-12Hz-1.7B-Base
# ============================================
echo "============================================================"
echo "Setting up: Qwen3-TTS-12Hz-1.7B-Base"
echo "============================================================"

QWEN_DIR="$MODELS_DIR/Qwen3-TTS-12Hz-1.7B-Base"
mkdir -p "$QWEN_DIR"
mkdir -p "$QWEN_DIR/speech_tokenizer"

QWEN_REPO="https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base/resolve/main"

echo "Downloading config and tokenizer files..."
wget -q -O "$QWEN_DIR/config.json" "$QWEN_REPO/config.json" && echo "  ✓ config.json"
wget -q -O "$QWEN_DIR/generation_config.json" "$QWEN_REPO/generation_config.json" && echo "  ✓ generation_config.json"
wget -q -O "$QWEN_DIR/merges.txt" "$QWEN_REPO/merges.txt" && echo "  ✓ merges.txt"
wget -q -O "$QWEN_DIR/preprocessor_config.json" "$QWEN_REPO/preprocessor_config.json" && echo "  ✓ preprocessor_config.json"
wget -q -O "$QWEN_DIR/tokenizer_config.json" "$QWEN_REPO/tokenizer_config.json" && echo "  ✓ tokenizer_config.json"
wget -q -O "$QWEN_DIR/vocab.json" "$QWEN_REPO/vocab.json" && echo "  ✓ vocab.json"

# Speech tokenizer files
echo "Downloading speech tokenizer files..."
wget -q -O "$QWEN_DIR/speech_tokenizer/config.json" "$QWEN_REPO/speech_tokenizer/config.json" && echo "  ✓ speech_tokenizer/config.json"
wget -q -O "$QWEN_DIR/speech_tokenizer/configuration.json" "$QWEN_REPO/speech_tokenizer/configuration.json" && echo "  ✓ speech_tokenizer/configuration.json"
wget -q -O "$QWEN_DIR/speech_tokenizer/preprocessor_config.json" "$QWEN_REPO/speech_tokenizer/preprocessor_config.json" && echo "  ✓ speech_tokenizer/preprocessor_config.json"
wget -q -O "$QWEN_DIR/speech_tokenizer/model.safetensors" "$QWEN_REPO/speech_tokenizer/model.safetensors" && echo "  ✓ speech_tokenizer/model.safetensors"

# Copy existing model weights
echo ""
echo "Copying existing model weights..."
if [ -f "$MODELS_DIR/Qwen TTS 1.7B.model.safetensors" ]; then
    cp "$MODELS_DIR/Qwen TTS 1.7B.model.safetensors" "$QWEN_DIR/model.safetensors"
    echo "  ✓ Model weights copied (3.6 GB)"
else
    echo "  ⚠ Warning: Qwen TTS 1.7B.model.safetensors not found!"
    echo "    Downloading from HuggingFace (this will take a while)..."
    wget -q --show-progress -O "$QWEN_DIR/model.safetensors" "$QWEN_REPO/model.safetensors" && echo "  ✓ model.safetensors downloaded"
fi

# ============================================
# Whisper Large V3 Turbo
# ============================================
echo ""
echo "============================================================"
echo "Setting up: whisper-large-v3-turbo"
echo "============================================================"

WHISPER_DIR="$MODELS_DIR/whisper-large-v3-turbo"
mkdir -p "$WHISPER_DIR"

WHISPER_REPO="https://huggingface.co/openai/whisper-large-v3-turbo/resolve/main"

echo "Downloading config and tokenizer files..."
wget -q -O "$WHISPER_DIR/added_tokens.json" "$WHISPER_REPO/added_tokens.json" && echo "  ✓ added_tokens.json"
wget -q -O "$WHISPER_DIR/config.json" "$WHISPER_REPO/config.json" && echo "  ✓ config.json"
wget -q -O "$WHISPER_DIR/generation_config.json" "$WHISPER_REPO/generation_config.json" && echo "  ✓ generation_config.json"
wget -q -O "$WHISPER_DIR/merges.txt" "$WHISPER_REPO/merges.txt" && echo "  ✓ merges.txt"
wget -q -O "$WHISPER_DIR/normalizer.json" "$WHISPER_REPO/normalizer.json" && echo "  ✓ normalizer.json"
wget -q -O "$WHISPER_DIR/preprocessor_config.json" "$WHISPER_REPO/preprocessor_config.json" && echo "  ✓ preprocessor_config.json"
wget -q -O "$WHISPER_DIR/special_tokens_map.json" "$WHISPER_REPO/special_tokens_map.json" && echo "  ✓ special_tokens_map.json"
wget -q -O "$WHISPER_DIR/tokenizer.json" "$WHISPER_REPO/tokenizer.json" && echo "  ✓ tokenizer.json"
wget -q -O "$WHISPER_DIR/tokenizer_config.json" "$WHISPER_REPO/tokenizer_config.json" && echo "  ✓ tokenizer_config.json"
wget -q -O "$WHISPER_DIR/vocab.json" "$WHISPER_REPO/vocab.json" && echo "  ✓ vocab.json"

# Copy existing model weights
echo ""
echo "Copying existing model weights..."
if [ -f "$MODELS_DIR/Whisper Largev3..safetensors" ]; then
    cp "$MODELS_DIR/Whisper Largev3..safetensors" "$WHISPER_DIR/model.safetensors"
    echo "  ✓ Model weights copied (1.5 GB)"
else
    echo "  ⚠ Warning: Whisper Largev3..safetensors not found!"
    echo "    Downloading from HuggingFace..."
    wget -q --show-progress -O "$WHISPER_DIR/model.safetensors" "$WHISPER_REPO/model.safetensors" && echo "  ✓ model.safetensors downloaded"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "============================================================"
echo "SETUP COMPLETE!"
echo "============================================================"
echo ""
echo "Model directories created:"
echo "  $QWEN_DIR"
echo "  $WHISPER_DIR"
echo ""
echo "Directory contents:"
echo ""
echo "Qwen3-TTS:"
ls -lh "$QWEN_DIR"
echo ""
echo "Whisper:"
ls -lh "$WHISPER_DIR"
echo ""
echo "============================================================"
echo "HOW TO USE WITH VOICEBOX"
echo "============================================================"
echo ""
echo "Option 1: Set environment variable before starting:"
echo "  export VOICEBOX_MODELS_DIR=\"$MODELS_DIR\""
echo ""
echo "Option 2: Let the app download automatically to:"
echo "  ~/.cache/huggingface/hub/"
echo ""
