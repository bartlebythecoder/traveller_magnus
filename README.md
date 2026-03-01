# traveller_magnus

An AI-orchestrated workflow system built on a 3-layer architecture that separates human intent from deterministic execution.

## Architecture

```
directives/   ← SOPs in Markdown — the "what to do"
execution/    ← Deterministic Python scripts — the "how to do it"
.tmp/         ← Intermediate files (gitignored, always regenerable)
.env          ← Secrets & API keys (gitignored)
```

### The 3 Layers

| Layer | Role | Location |
|-------|------|----------|
| **1 – Directive** | Defines goals, inputs, tools, outputs, edge cases | `directives/` |
| **2 – Orchestration** | AI agent reads directives and routes execution | (this agent) |
| **3 – Execution** | Deterministic Python scripts do the actual work | `execution/` |

## Getting Started

1. **Clone** the repo.
2. **Copy** `.env.example` → `.env` and fill in your API keys.
3. **Install** dependencies: `pip install -r requirements.txt` (add as needed).
4. **Run** — ask the AI agent to execute a directive, or run a script directly:
   ```bash
   python execution/my_script.py --help
   ```

## Deliverables

All final outputs are cloud-based (Google Sheets, Google Slides, etc.) so they're accessible without local access. Files in `.tmp/` are intermediates and can always be deleted and regenerated.

## Adding Workflows

1. Create a directive in `directives/my_workflow.md`.
2. Create (or reuse) a script in `execution/my_script.py`.
3. Ask the agent to run it.

See `agent.md` for the full operating principles.
