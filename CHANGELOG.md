# Changelog

All notable changes to Voicebox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-25

### Added

#### Core Features
- **Voice Cloning** - Clone voices from audio samples using Qwen3-TTS (1.7B and 0.6B models)
- **Voice Profile Management** - Create, edit, and organize voice profiles with multiple samples
- **Speech Generation** - Generate high-quality speech from text using cloned voices
- **Generation History** - Track all generations with search and filtering capabilities
- **Audio Transcription** - Automatic transcription powered by Whisper
- **In-App Recording** - Record audio samples directly in the app with waveform visualization

#### Desktop App
- **Tauri Desktop App** - Native desktop application for macOS, Windows, and Linux
- **Local Server Mode** - Embedded Python server runs automatically
- **Remote Server Mode** - Connect to a remote Voicebox server on your network
- **Auto-Updates** - Automatic update notifications and installation

#### API
- **REST API** - Full REST API for voice synthesis and profile management
- **OpenAPI Documentation** - Interactive API docs at `/docs` endpoint
- **Type-Safe Client** - Auto-generated TypeScript client from OpenAPI schema

#### Technical
- **Voice Prompt Caching** - Fast regeneration with cached voice prompts
- **Multi-Sample Support** - Combine multiple audio samples for better voice quality
- **GPU/CPU/MPS Support** - Automatic device detection and optimization
- **Model Management** - Lazy loading and VRAM management
- **SQLite Database** - Local data persistence

### Technical Details

- Built with Tauri v2 (Rust + React)
- FastAPI backend with async Python
- TypeScript frontend with React Query and Zustand
- Qwen3-TTS for voice cloning
- Whisper for transcription

### Platform Support

- macOS (Apple Silicon and Intel)
- Windows
- Linux (AppImage)

---

## [Unreleased]

### Fixed
- Audio export failing when Tauri save dialog returns object instead of string path

### Added
- **Makefile** - Comprehensive development workflow automation with commands for setup, development, building, testing, and code quality checks
  - Includes Python version detection and compatibility warnings
  - Self-documenting help system with `make help`
  - Colored output for better readability
  - Supports parallel development server execution
- **Configurable voice clone reference policy** with backend-owned limits and frontend synchronization
  - New `GET /voice-clone/policy` endpoint for effective policy values
  - Bounded quality-aware segment selection for long reference samples
  - Selection metadata persisted for traceability (`selection_*` fields)

### Changed
- **README** - Added Makefile reference and updated Quick Start with Makefile-based setup instructions alongside manual setup
- **Voice sample validation** - Replaced fixed 30-second behavior with configurable `hard_min`, `recommended_target`, and `hard_max` policy controls

### Compatibility
- Existing profile and generation APIs remain backward compatible; response payloads only add optional sample metadata fields.
- Default runtime behavior remains conservative with startup-time fallback to safe defaults on invalid policy config.

### Rollback
- To quickly revert to stricter legacy behavior, set:
  - `VOICE_CLONE_REF_HARD_MIN_SECONDS=2`
  - `VOICE_CLONE_REF_RECOMMENDED_TARGET_SECONDS=15`
  - `VOICE_CLONE_REF_HARD_MAX_SECONDS=30`
  - `VOICE_CLONE_REF_CAPTURE_AUTO_STOP_SECONDS=29`
- Restart backend after policy changes.

---

## [Unreleased - Planned]

### Planned
- Real-time streaming synthesis
- Conversation mode with multiple speakers
- Voice effects (pitch shift, reverb, M3GAN-style)
- Timeline-based audio editor
- Additional voice models (XTTS, Bark)
- Voice design from text descriptions
- Project system for saving sessions
- Plugin architecture

---

[0.1.0]: https://github.com/jamiepine/voicebox/releases/tag/v0.1.0
