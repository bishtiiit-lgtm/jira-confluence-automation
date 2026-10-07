# Module 10 Completion Report

## Instruction Files

Name                                      FullName
----                                      --------
create-status-report.agent.md             C:\workspace\hello-genai\work\modu...
creating-instructions.agent.md            C:\workspace\hello-genai\work\modu...
main.agent.md                             C:\workspace\hello-genai\work\modu...
update-confluence-project-status.agent.md C:\workspace\hello-genai\work\modu...

## main.agent.md Contents

### Instructions Catalog

- [./instructions/create-status-report.agent.md](./create-status-report.agent.md) — Generate a concise weekly status report in Markdown with sections for accomplishments, blockers, and next week.
  + Keywords: status report, weekly report, status update, progress summary
  + Target: `**/*.md`
  + Exceptions: not for technical specs, backlog files, or long-form design docs

- [./instructions/creating-instructions.agent.md](./creating-instructions.agent.md) — Create and maintain instruction files, catalogs, and IDE entry points for the project.
  + Keywords: create instruction, add instruction, instruction file, setup instructions, agent instruction
  + Target: `**/*.md`
  + Exceptions: not for code implementation tasks or business logic work

- [./instructions/update-confluence-project-status.agent.md](./update-confluence-project-status.agent.md) — Update a Confluence project status page with a concise summary of accomplishments, blockers, and next steps.
  + Keywords: Confluence update, project status page, update project status, status page update
  + Target: `**/*.md`
  + Exceptions: not for code changes, architecture docs, or unstructured meeting notes

## Sample Instruction
- File: create-status-report.agent.md
- Contents:

### Create Weekly Status Report

Generate a weekly engineering status report in Markdown format.

Requirements:
- Use only Markdown headings and bullet points.
- Include these sections in order: accomplishments, blockers, next week.
- Use professional tone.
- Remove fluff words and filler language.
- Keep the report concise and factual.
- Limit the document to 20 lines maximum.
- Use bullet points only for content under each section.
- Do not include tables, paragraphs, or long explanations.

Output format:
- `# Weekly Status Report`
- `## Accomplishments`
- `- ...`
- `## Blockers`
- `- ...`
- `## Next Week`
- `- ...`

Do not add commentary outside the report body.
