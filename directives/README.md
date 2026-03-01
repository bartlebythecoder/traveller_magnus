# Directives

This directory contains SOPs (Standard Operating Procedures) written in Markdown.

Each directive defines:
- **Goal** – What this workflow accomplishes
- **Inputs** – What data/parameters are required
- **Tools/Scripts** – Which `execution/` scripts to call and in what order
- **Outputs** – Expected deliverables (typically Google Sheets, Slides, or other cloud outputs)
- **Edge Cases** – Known issues, API limits, timing expectations, and how to handle them

## Adding a New Directive

Create a new `.md` file in this directory, e.g. `directives/my_workflow.md`.  
Follow the structure above. The orchestration layer (the AI agent) reads these files and routes execution accordingly.

## Principles

- Directives are **living documents** — update them as you learn.
- Do **not** delete or overwrite directives without user confirmation.
- When a script breaks or a new edge case is discovered, update the relevant directive.
