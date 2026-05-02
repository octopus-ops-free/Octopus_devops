## Learned User Preferences
- **Language & format**: Prefers Chinese responses with actionable, step-by-step commands (especially for Windows/PowerShell).
- **Local dev expectation**: When working on this repo, expects a direct local FastAPI start command (e.g., via `uvicorn`) rather than assuming Docker is the primary path.
- **Scope control**: When a target folder is specified (e.g., `claude_code`), prefers changes confined to that scope instead of broadly modifying unrelated areas.
- **Skill-driven workflow**: Frequently uses slash-style skill triggers (e.g., `/context7-mcp`) and expects manually attached skills to be followed strictly in the current request.
- **Brainstorm → spec → plan**: For substantive UI/feature work, expects the brainstorm to end with a written spec under `docs/superpowers/specs/` (dated filename), then 「spec 确认」, then a receiving-code-review-style technical review of that spec (resolve blocking issues), then `writing-plans` before implementation—same flow for future similar requests.

## Learned Workspace Facts
- **Project**: `Octopus_devops` is a FastAPI-based ops platform with an `app/` backend and an `AiOps_Agent/` area for a separately runnable agent UI/service.
- **Config precedence gotcha**: For Claude/Anthropic-compatible tooling, a global user config (e.g., `~/.claude/settings.json`) can override `.env` values like `ANTHROPIC_BASE_URL`, causing unexpected endpoint/auth behavior.
- **Current UI implementation**: Legacy built-in pages live in `app/ui/*.html` (static HTML + inline JS) via FastAPI `FileResponse` and `/api/*`; there is also a React frontend (e.g. overview/dashboard under `frontend/src/features/overview/`). When the user picks the React stack for dashboard work, implement there—not only in `app/ui/`.
- **Monitoring metrics host key**: `/api/monitoring/metrics` expects the `host` query parameter to match **`Host.name`** (hostname string), not the numeric host id; using the wrong value can produce empty charts.
- **Windows + Docker + SSH keys**: When running the app in Docker on Windows, SSH key paths/permissions from host mounts can break remote collection; prefer container-accessible key paths and/or text-based key material handling that can enforce `chmod 600` inside the container.
- **Image build workflow**: The project uses Docker Buildx with registry cache for image builds/pushes, commonly with image `octopusops/octopus-ops:latest` and cache ref `octopusops/octopus-ops:buildcache`.
