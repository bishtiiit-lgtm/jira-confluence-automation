# Validate Markdown Files

- Use this instruction to check every Markdown file under the project root for consistent formatting.
- Process files individually so one malformed file does not hide findings in the others.
- Apply these checks to each file:
  - Read as UTF-8.
  - Require a final newline.
  - Reject trailing whitespace outside fenced code blocks.
  - Require ATX headings (`# Heading`) with no skipped heading levels.
  - Require exactly one H1 heading for non-empty documents.
  - Require a blank line before headings and after headings when followed by prose; allow a list to begin immediately after a heading for compact templates.
- Ignore Markdown content inside fenced code blocks when checking headings and whitespace.
- Emit JSON with one result per file containing `path`, `status`, and `issues`, followed by a `summary` containing file and issue counts.
- Return exit code 0 when all files pass and a non-zero exit code when any file has an issue.
- When a file fails, fix the document or refine this instruction only when the rule is unsuitable for the project’s Markdown style.
