import argparse
import json
import re
import sys
from pathlib import Path

HEADING_PATTERN = re.compile(r"^(#{1,6})(?:\s+)(.+?)\s*$")
FENCE_PATTERN = re.compile(r"^\s*(```|~~~)")


def markdown_files(root: Path) -> list[Path]:
    return sorted(path for path in root.rglob("*.md") if path.is_file())


def validate_file(path: Path, root: Path) -> dict:
    issues: list[dict[str, int | str]] = []
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        return {
            "path": path.relative_to(root).as_posix(),
            "status": "fail",
            "issues": [{"line": 1, "message": f"not valid UTF-8: {error}"}],
        }

    lines = text.splitlines(keepends=True)
    if text and not text.endswith("\n"):
        issues.append({"line": len(lines), "message": "file must end with a newline"})

    in_fence = False
    fence_marker = ""
    headings: list[tuple[int, int]] = []
    visible_lines: list[tuple[int, str]] = []

    for line_number, raw_line in enumerate(lines, start=1):
        content = raw_line.rstrip("\r\n")
        fence_match = FENCE_PATTERN.match(content)
        if fence_match:
            marker = fence_match.group(1)
            if not in_fence:
                in_fence = True
                fence_marker = marker
            elif marker == fence_marker:
                in_fence = False
            continue
        if in_fence:
            continue

        visible_lines.append((line_number, content))
        if content.rstrip() != content:
            issues.append({"line": line_number, "message": "trailing whitespace"})

        heading_match = HEADING_PATTERN.match(content)
        if heading_match:
            headings.append((line_number, len(heading_match.group(1))))

    if text.strip() and len([level for _, level in headings if level == 1]) != 1:
        issues.append({"line": 1, "message": "document must contain exactly one H1 heading"})

    previous_level = 0
    for line_number, level in headings:
        if previous_level and level > previous_level + 1:
            issues.append({"line": line_number, "message": f"heading level skips from H{previous_level} to H{level}"})
        previous_level = level

        before = next((content for number, content in reversed(visible_lines) if number < line_number), "")
        after = next((content for number, content in visible_lines if number > line_number), "")
        if before and before.strip():
            issues.append({"line": line_number, "message": "heading must have a blank line before it"})
        if after and after.strip() and not after.lstrip().startswith(("- ", "* ", "+ ")):
            issues.append({"line": line_number, "message": "heading must have a blank line after it"})

    return {
        "path": path.relative_to(root).as_posix(),
        "status": "pass" if not issues else "fail",
        "issues": issues,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Markdown formatting file by file.")
    parser.add_argument("root", nargs="?", default=".", help="Project root to scan")
    parser.add_argument("--output", help="Write the JSON report to this path")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    results = [validate_file(path, root) for path in markdown_files(root)]
    report = {
        "files": results,
        "summary": {
            "files_checked": len(results),
            "files_passed": sum(result["status"] == "pass" for result in results),
            "files_failed": sum(result["status"] == "fail" for result in results),
            "issues": sum(len(result["issues"]) for result in results),
        },
    }
    rendered = json.dumps(report, indent=2)
    print(rendered)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    return 0 if report["summary"]["files_failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
