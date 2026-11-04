"""Compare transcription models on real voice notes (03-C9).

Sends every recording in a folder to each candidate model, through the same
OpenAITranscriber the app uses (Spanish, 60s timeout, no retries), and prints the
texts one under the other with each file's size and each model's time.

Usage, from the repo root:
    OPENAI_API_KEY=sk-... uv run --project backend python scripts/transcribe_trial.py FOLDER
    ... scripts/transcribe_trial.py FOLDER --models gpt-4o-transcribe whisper-1

Keep the recordings outside the repo: they are real kitchen audio. Each recording
costs one API call per model.
"""

import argparse
import os
import sys
import textwrap
import time
from collections.abc import Callable
from pathlib import Path
from typing import TextIO

from backend.transcription import (
    MAX_AUDIO_BYTES,
    OpenAITranscriber,
    Transcriber,
    TranscriptionError,
    TranscriptionTimeout,
)

DEFAULT_MODELS = ("gpt-4o-mini-transcribe", "gpt-4o-transcribe")

# What the phones record: Chrome writes .webm, iOS Safari .mp4 (.m4a once shared).
CONTENT_TYPES = {".webm": "audio/webm", ".mp4": "audio/mp4", ".m4a": "audio/mp4"}

WRAP = 100


def find_recordings(folder: Path) -> list[Path]:
    """Audio files directly in `folder`, sorted by name."""
    return sorted(
        path
        for path in folder.iterdir()
        if path.is_file() and path.suffix.lower() in CONTENT_TYPES
    )


def format_size(size: int) -> str:
    return f"{size / (1024 * 1024):.2f} MB"


def run_trial(
    recordings: list[Path],
    models: list[str],
    make_transcriber: Callable[[str], Transcriber],
    out: TextIO = sys.stdout,
) -> None:
    transcribers = {model: make_transcriber(model) for model in models}
    largest = 0

    for path in recordings:
        audio = path.read_bytes()
        content_type = CONTENT_TYPES[path.suffix.lower()]
        largest = max(largest, len(audio))
        over = (
            "  OVER THE 5 MB CAP: the app would reject it"
            if len(audio) > MAX_AUDIO_BYTES
            else ""
        )
        print(
            f"\n=== {path.name}  ({format_size(len(audio))}, {content_type}){over}",
            file=out,
        )

        for model, transcriber in transcribers.items():
            started = time.perf_counter()
            try:
                text = transcriber.transcribe(audio, content_type)
            except TranscriptionTimeout:
                text = "[ERROR: timed out]"
            except TranscriptionError:
                text = "[ERROR: the API call failed]"
            else:
                text = text.strip() or "[empty: no speech detected]"
            seconds = time.perf_counter() - started
            print(f"\n  {model}  ({seconds:.1f} s)", file=out)
            print(textwrap.indent(textwrap.fill(text, WRAP), "    "), file=out)

    print(
        f"\n{len(recordings)} recording(s), {len(models)} model(s). "
        f"Largest file: {format_size(largest)} (cap {format_size(MAX_AUDIO_BYTES)}).",
        file=out,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "folder", type=Path, help="folder with .webm / .mp4 / .m4a recordings"
    )
    parser.add_argument(
        "--models",
        nargs="+",
        default=list(DEFAULT_MODELS),
        help=f"models to compare (default: {' '.join(DEFAULT_MODELS)})",
    )
    args = parser.parse_args(argv)

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("Set OPENAI_API_KEY to run the trial.", file=sys.stderr)
        return 1
    if not args.folder.is_dir():
        print(f"Not a folder: {args.folder}", file=sys.stderr)
        return 1

    recordings = find_recordings(args.folder)
    if not recordings:
        print(f"No .webm, .mp4 or .m4a files in {args.folder}", file=sys.stderr)
        return 1

    run_trial(
        recordings,
        args.models,
        lambda model: OpenAITranscriber(api_key=api_key, model=model),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
