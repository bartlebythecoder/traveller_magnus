# Execution Scripts

This directory contains the deterministic Python scripts that do the actual work.

## Design Principles

- **Deterministic & testable** — same inputs always produce same outputs.
- **Single responsibility** — each script does one well-defined thing.
- **Well-commented** — include docstrings and inline comments explaining the "why".
- **Environment-aware** — read secrets from `.env` via `python-dotenv`; never hardcode credentials.

## Conventions

| Pattern | Details |
|---------|---------|
| Naming | `verb_noun.py`, e.g. `scrape_single_site.py`, `export_to_sheets.py` |
| Args | Accept CLI args via `argparse` or read from `.tmp/` input files |
| Output | Write results to `.tmp/` for intermediate data; final output goes to cloud |
| Errors | Exit with non-zero code and print clear error messages to stderr |

## Adding a New Script

1. Check this directory first — a suitable script may already exist.
2. If not, create `execution/my_script.py`.
3. Reference the script in the relevant `directives/` file.
4. Add or update any required environment variables in `.env.example`.
