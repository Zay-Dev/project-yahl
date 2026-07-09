# Mastermind runtime decisions

See [docs/decision-log/mastermind.md](../docs/decision-log/mastermind.md).

- SDK agent uses `model: { id: "auto" }` and `JsonlLocalAgentStore` under `/data/store`.
- Fresh `Agent.create` on each process boot — no persisted `agent-id.txt` resume. In-process singleton only; durable memory is `knowledges/` and workspace files.
- SDK prompt failures write `data/mastermind/crash-reports/yyyy-mm-dd-HHmmss.md` and trigger async self-analysis (separate `Agent.prompt`); no auto-fix.
- Process-level failures (`unhandledRejection`, `uncaughtException`) and boot auth probe failures also write crash reports (`skill: process` or `startup`); deduped within 30s by error message.
- `/health` agent status: `ready` | `unconfigured` | `auth_failed`.
- Boot requires `agent: ready`; process exits on failed startup self-check (missing `CURSOR_API_KEY` or auth probe failure).
- `/health` returns 503 when agent is not `ready`; `GET /v1/internal/self-check` for on-demand checks (loopback or `X-Internal-Token`).
- Mastermind skills live in `mastermind/skills/` and must not document `/mastermind(...)` self-calls.
- Proposals go to server API; mastermind never sends email/WhatsApp directly.
- All Cursor SDK `agent.send` calls are serialized through a single in-process prompt queue (one active run per agent).
- Crash analyst uses the same queued prompt (injected via `initCrashReports`); no static `Agent.prompt` bypass.
- Stage verify runs on **worker** (`POST /v1/verify`, `agent --yolo`, file context under `workspace/sessions/.../verify/`); mastermind has no verify endpoint.
- Verify infra failures return `unavailable: true` from worker; orchestrator must not treat them as rubric misses for verifyAutoRetry.
- Canonical knowledge is Wiki.js (`topics/{slug}/…`) with Local FS push export at `data/knowledge_export/`; agents read session extracts at `~/knowledge/{key}.json` after `get-knowledge`.
- Hybrid RAG: GraphQL for single-page reads; export mirror when topic exceeds page/byte thresholds (`WIKI_EXPORT_PAGE_THRESHOLD`, `WIKI_EXPORT_BYTES_THRESHOLD`). Do not edit export files — push-only.
- Topic registry at `data/mastermind/topics.json`; `resolve-topic` skill; legacy flat `knowledges/` deprecated — archive with `scripts/archive-legacy-knowledges.sh`.
- Knowledges HTTP: `POST /v1/internal/knowledges/persisted-index` only (orchestrator verify); no public topics/resolve/tidy routes.
- `persist-knowledge` hybrid format: narrative keys (`*_md`, summaries, string/`{content}`/`{mastermind,agent}` values) → `.md`; structured keys (`sources`, `facts`, `study_*`, profiles) → `.json`.
- `knowledge-qa-review` mastermind skill is transport-only (corpus → worker `POST /v1/knowledge-qa-review`); checklist rubric in `server/tasks/_shared/skills/knowledge-qa-checklist/SKILL.md`.
- `tidy-knowledge` extended: wiki audit/migrate per topic + duplicate folder merge; QA/todo prose lives in task skills, not mastermind handlers.
