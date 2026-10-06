---
name: cf:ai-multimodal
description: Analyze images/audio/video/documentation with Gemini API. Use for vision analysis, transcription, OCR, design extraction, and deep multimodal understanding.
license: MIT
user-invocable: true
when_to_use: "Invoke to analyze or generate images, audio, or mixed-media content."
category: utilities
keywords: [multimodal, image, audio, vision]
argument-hint: "[file-path] [prompt]"
metadata:
  author: haposoft
  version: "1.0.0"
---
# AI Multimodal

Process audio, images, videos, documents using Gemini. Purely focused on robust analysis, transcription, and contextual extraction.

## Setup

```bash
# Google Gemini (Analysis)
export GEMINI_API_KEY="your-key"  # https://aistudio.google.com/apikey
pip install google-genai python-dotenv pillow requests
```

### API Key Rotation (Optional)

For high-volume Gemini usage, configure multiple keys:

```bash
export GEMINI_API_KEY="key1"
export GEMINI_API_KEY_2="key2"  # auto-rotates on rate limit
```

## Quick Start

**Verify setup**: `python scripts/check_setup.py`
**Analyze media**: `python scripts/gemini_batch_process.py --files <file> --task <analyze|transcribe|extract>`
  - TIP: When you're asked to analyze an image, check if `gemini` command is available, then use `echo "<prompt to analyze image>" | gemini -y -m "${GEMINI_MODEL:-gemma-4-31b-it}"`. If `gemini` command is not available, use `python scripts/gemini_batch_process.py --files <file> --task analyze` command.

> **Stdin support**: Pipe files via stdin for Gemini analysis (auto-detects PNG/JPG/PDF/WAV/MP3).

## Models

### Google Gemini
- **Analysis**: `gemma-4-31b-it` (recommended), `gemma-4-31b-it` (advanced)

## Scripts

- **`gemini_batch_process.py`**: Gemini CLI for `transcribe|analyze|extract`. Auto-resolves API keys logic.
- **`media_optimizer.py`**: ffmpeg/Pillow preflight: compress/resize/convert media to stay within API limits.
- **`document_converter.py`**: Gemini-powered PDF/image/Office → markdown converter.
- **`check_setup.py`**: Setup checker for API keys and dependencies.

Use `--help` for options.

## References

Load for detailed guidance:

| Topic | File | Description |
|-------|------|-------------|
| Audio | `references/audio-processing.md` | Audio formats and limits, transcription (timestamps, speakers, segments), non-speech analysis, File API vs inline input. |
| Images | `references/vision-understanding.md` | Vision capabilities overview, supported formats and models, captioning/classification/VQA, detection and segmentation, OCR. |
| Video | `references/video-analysis.md` | Video analysis capabilities and supported formats, model/context choices, local/inline/YouTube inputs, clipping and FPS control. |

## Limits

**Formats**: Audio (WAV/MP3/AAC, 9 hours 30 minutes), Images (PNG/JPEG/WEBP, 3.6k), Video (MP4/MOV, 6h), PDF (1k pages)
**Size**: 20MB inline, 2GB File API
**Important:** 
- If you are going to generate a transcript of the audio, and the audio length is longer than 15 minutes, the transcript often gets truncated due to output token limits in the Gemini API response. To get the full transcript, you need to split the audio into smaller chunks (max 15 minutes per chunk) and transcribe each segment for a complete transcript.
- If you are going to generate a transcript of the video and the video length is longer than 15 minutes, use ffmpeg to extract the audio from the video, truncate the audio to 15 minutes, transcribe all audio segments, and then combine the transcripts into a single transcript.
**Transcription Output Requirements:**
- Format: Markdown
- Metadata: Duration, file size, generated date, description, file name, topics covered, etc.
- Parts: from-to (e.g., 00:00-00:15), audio chunk name, transcript, status, etc.
- Transcript format: 
  ```
  [HH:MM:SS -> HH:MM:SS] transcript content
  [HH:MM:SS -> HH:MM:SS] transcript content
  ...
  ```

## Outputs

**IMPORTANT:** Save extracted outputs next to the active task/spec report or under an obvious project artifact folder. Include exact output paths in the final report.

## Resources

- [Gemini API Docs](https://ai.google.dev/gemini-api/docs/)
- [Gemini Pricing](https://ai.google.dev/pricing)
