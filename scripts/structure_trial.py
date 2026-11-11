"""Compare structuring models on real transcripts (04-C8).

Sends every transcript in a folder to each candidate model, through the same
OpenAIStructurer the app uses (strict schema, prompt, 45s timeout, no retries), and
validates each answer with the endpoint's own code. For each one it prints the sheet
and its missing data, or why it failed, with the time, the tokens and the text length.

Usage, from the repo root:
    OPENAI_API_KEY=sk-... uv run --project backend python scripts/structure_trial.py FOLDER
    ... scripts/structure_trial.py FOLDER --models gpt-5-mini gpt-4.1-mini

The transcripts are .txt files, for example the texts printed by transcribe_trial.py,
one note per file. Keep them outside the repo: they are real kitchen recipes. Each
transcript costs one API call per model. Check the default models against the
current model list before running it.
"""

import argparse
import os
import sys
import textwrap
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import TextIO

from fastapi import HTTPException
from pydantic import ValidationError

from backend.sheets import Sheet
from backend.structuring import (
    MAX_TEXT_CHARS,
    DraftOutput,
    OpenAIStructurer,
    Structurer,
    StructuringError,
    StructuringTimeout,
    draft_from_output,
)

DEFAULT_MODELS = ("gpt-5-nano", "gpt-5-mini", "gpt-4.1-mini")

WRAP = 100


def find_transcripts(folder: Path) -> list[Path]:
    """Text files directly in `folder`, sorted by name."""
    return sorted(
        path for path in folder.iterdir() if path.is_file() and path.suffix.lower() == ".txt"
    )


def format_amount(quantity: float | None, unit: str | None, estimated: bool) -> str:
    text = f"{quantity:g}" if quantity is not None else "?"
    text += f" {unit}" if unit is not None else " ?"
    return text + (" (estimated)" if estimated else "")


def format_sheet(sheet: Sheet, missing: list[str]) -> list[str]:
    lines = [
        f"Name: {sheet.name}",
        "Yield: "
        + format_amount(sheet.yield_.quantity, sheet.yield_.unit, sheet.yield_.estimated),
        "Covers: "
        + (str(sheet.covers.value) if sheet.covers.value is not None else "?")
        + (" (estimated)" if sheet.covers.estimated else ""),
        f"Ingredients ({len(sheet.ingredients)}):",
    ]
    lines += [
        f"  - {item.name}: {format_amount(item.quantity, item.unit, item.estimated)}"
        for item in sheet.ingredients
    ]
    lines.append("Missing: " + (", ".join(missing) if missing else "nothing"))
    return lines


def why_invalid(raw: str) -> str:
    """Why the endpoint rejected `raw`. The endpoint drops the details (they hold the
    recipe); this is a local run on your own transcripts, so they are shown here."""
    try:
        DraftOutput.model_validate_json(raw)
    except ValidationError as error:
        return str(error)
    return "is_preparation is true but the sheet is null"


@dataclass
class ModelTotals:
    sheets: int = 0
    not_preparation: int = 0
    invalid: int = 0
    failed: int = 0
    seconds: list[float] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0


def run_trial(
    transcripts: list[Path],
    models: list[str],
    make_structurer: Callable[[str], Structurer],
    out: TextIO = sys.stdout,
) -> None:
    structurers = {model: make_structurer(model) for model in models}
    totals = {model: ModelTotals() for model in models}
    longest = 0

    for path in transcripts:
        text = path.read_text(encoding="utf-8").strip()
        longest = max(longest, len(text))
        note = ""
        if not text:
            note = "  EMPTY: the app would not structure it"
        elif len(text) > MAX_TEXT_CHARS:
            note = f"  OVER THE {MAX_TEXT_CHARS:,}-CHAR CAP: the app would reject it"
        print(f"\n=== {path.name}  ({len(text):,} chars){note}", file=out)
        if not text:
            continue

        for model, structurer in structurers.items():
            total = totals[model]
            started = time.perf_counter()
            tokens = ""
            try:
                result = structurer.structure(text)
            except StructuringTimeout:
                lines = ["[ERROR: timed out]"]
                total.failed += 1
            except StructuringError:
                lines = ["[ERROR: the API call failed, was refused or was incomplete]"]
                total.failed += 1
            else:
                tokens = f", {result.input_tokens} in / {result.output_tokens} out tokens"
                total.input_tokens += result.input_tokens or 0
                total.output_tokens += result.output_tokens or 0
                try:
                    draft = draft_from_output(result.raw)
                except HTTPException:
                    lines = ["[INVALID: the app would answer 502]", why_invalid(result.raw)]
                    total.invalid += 1
                else:
                    if draft.sheet is None:
                        lines = ["[Not a preparation]"]
                        total.not_preparation += 1
                    else:
                        lines = format_sheet(draft.sheet, draft.missing)
                        total.sheets += 1
            seconds = time.perf_counter() - started
            total.seconds.append(seconds)

            print(f"\n  {model}  ({seconds:.1f} s{tokens})", file=out)
            # Pydantic's messages span several lines: wrap each line on its own.
            for line in (part for entry in lines for part in entry.splitlines()):
                print(
                    textwrap.indent(textwrap.fill(line, WRAP, subsequent_indent="    "), "    "),
                    file=out,
                )

    print(
        f"\n{len(transcripts)} transcript(s), {len(models)} model(s). "
        f"Longest text: {longest:,} chars (cap {MAX_TEXT_CHARS:,}).",
        file=out,
    )
    for model, total in totals.items():
        average = sum(total.seconds) / len(total.seconds) if total.seconds else 0.0
        print(
            f"  {model}: {total.sheets} sheet(s), {total.not_preparation} not a preparation, "
            f"{total.invalid} invalid, {total.failed} failed; "
            f"average {average:.1f} s; {total.input_tokens} in / {total.output_tokens} out tokens",
            file=out,
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("folder", type=Path, help="folder with .txt transcripts")
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

    transcripts = find_transcripts(args.folder)
    if not transcripts:
        print(f"No .txt files in {args.folder}", file=sys.stderr)
        return 1

    run_trial(
        transcripts,
        args.models,
        lambda model: OpenAIStructurer(api_key=api_key, model=model),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
