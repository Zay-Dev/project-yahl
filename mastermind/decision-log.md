# Mastermind runtime decisions

See [docs/decision-log/mastermind.md](../docs/decision-log/mastermind.md).

- SDK agent uses `model: { id: "auto" }` and `JsonlLocalAgentStore` under `/data/store`.
- Fresh `Agent.create` on each process boot — no persisted `agent-id.txt` resume. In-process singleton only; durable memory is `knowledges/` and workspace files.
- SDK prompt failures write `data/mastermind/crash-reports/yyyy-mm-dd-HHmmss.md` and trigger async self-analysis (separate `Agent.prompt`); no auto-fix.
- Process-level failures (`unhandledRejection`, `uncaughtException`) and boot auth probe failures also write crash reports (`skill: process` or `startup`); deduped within 30s by error message.
- `/health` agent status: `ready` | `unconfigured` | `auth_failed`.
- Mastermind skills live in `mastermind/skills/` and must not document `/mastermind(...)` self-calls.
- Proposals go to server API; mastermind never sends email/WhatsApp directly.
