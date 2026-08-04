# Mastermind runtime decisions

See [docs/decision-log/mastermind.md](../docs/decision-log/mastermind.md) and [docs/mastermind-crash-reports.md](../docs/mastermind-crash-reports.md).

- Mastermind is an HTTP-only gateway (no Cursor SDK). Skills are deterministic policy / dispatch / notification helpers.
- Process-level failures (`unhandledRejection`, `uncaughtException`) and startup failures write crash reports under `data/mastermind/crash-reports/` (`skill: process` or `startup`); deduped within 30s by error message. Write-only — no LLM analyst (requirements documented for future).
- Boot self-check requires writable data dirs; `/health` returns 503 when data dirs fail; `GET /v1/internal/self-check` for on-demand checks (loopback or `X-Internal-Token`).
- Mastermind skills live in `mastermind/skills/` and must not document `/mastermind(...)` self-calls.
- Proposals go to server API; mastermind never sends email/WhatsApp directly.
- WhatsApp: worker owns `whatsapp-web.js` (QR on console). `WHATSAPP_WHITELIST` match on propose = pre-approved. Receive/send are pure worker runtime; greet person/group (`greets`) and 4h stack (`whatsapp_wiki_stack`) are YAHL. Inbox under `data/whatsapp_inbox/` (outside agent workspace); entity knowledge under `greets/{entity}/`; WhatsApp extract + stack under `whatsapp/{slug}/` (not `topics/`). Media: log name/size, skip. Stack clears inbox after wiki upsert.
- Stage verify runs via **nixery** (`verify.defId`, default `stage-verify`, OpenAI in-def); mastermind has no verify endpoint; worker has no inbound HTTP API (WhatsApp events are client-side in-process).
- Verify infra failures return `unavailable: true` from the nixery def; orchestrator must not treat them as rubric misses for `verify.autoRetry`.
- Canonical knowledge is Wiki.js (`topics/{slug}/…`) with Local FS push export at `data/knowledge_export/`; greets entity knowledge uses `greets/{entity}/…`; WhatsApp channel extract uses `whatsapp/{slug}/…`. Task reads use nixery `get-knowledge` at `~/nixery/get-knowledge/{output}` for topics.
- **Learning model (2026-08):** stage agents submit **Observations** only; Knowledge Manager owns narrative upsert/hone/retrieval and overnight full-corpus review under a global free-text instruction (not per-topic refresh intervals). Cross-topic apply requires `knowledge_transfer` platform approval.
- Hybrid RAG: GraphQL for single-page reads; export mirror when topic exceeds page/byte thresholds (`WIKI_EXPORT_PAGE_THRESHOLD`, `WIKI_EXPORT_BYTES_THRESHOLD`). Do not edit export files — push-only.
- Topic registry at `data/mastermind/topics.json`; `resolve-topic` is a nixery def; legacy flat `knowledges/` deprecated — archive with `scripts/archive-legacy-knowledges.sh`.
- `knowledge-qa-review` is a nixery OpenAI in-def (corpus + checklist → JSON review); checklist at `server/nixery/knowledge-qa-review/checklist.md`.
- `tidy-knowledge` is a nixery audit def; QA/todo prose lives in task skills, not mastermind handlers.
- `media-to-text` is a nixery Cursor CLI def (`server/nixery/media-to-text/`); Cursor is installed in the def Dockerfile at build time (glibc bookworm final stage).
