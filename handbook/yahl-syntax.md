# YAHL syntax and authoring

## Catchy syntax

Examples that survive contact with reality a little better:

1. `CONTEXT` + `IF/ELSE` + inline user input (from `server/tasks/test`):
   - branch logic and ask a human for one number before the final state lands.
2. Nested loops + `EXTENDS:` + typed extraction pipeline (from `server/tasks/competitor_intel`):
   - long-form pseudo-code that still compiles into a useful run.

Quick stress test with less chaos and more signal:

```
for each i of [1..5,+2] {
  c += i;
}
```

Syntax reference:

- `~/something` — session scratch workspace (`AGENT_SESSION_HOME`); the agent can read and write here, not the whole repo.
- `~/task-skills/…` — task-local SKILL files echoed from the session snapshot (see Authoring tasks below).
- `for each i of [0..100]` and `for each x of [array]` — loops, with an optional step like `,+2`.
- `CONTEXT: ...` — run deterministic context mutation in the VM before the next AI stage.
- `IF:` / `ELSE IF:` / `ELSE:` / `END:` — stage branching; condition decides which block runs.
- `REPLACE: ...` — system tag the runtime uses when a step needs a second pass after a tool call.
- `EXTENDS: ...` — append or merge into an existing context value without replacing it.
- `/ask-user-batch(...)` — pause for **`askUserBatch.v1`** (one or more questions per submit: text, radio, or checkbox MC).
- `/skill_name(...)` — call into a skill from the skills folder.
- `/mastermind(...)` — topic registry, policies, tidy, notifications (deterministic + platform ops).
- `/nixery(...)` — knowledge writes, research, design-questions, extract-info (see `/opt/skills/nixery/SKILL.md`).
- `*do_something(...)` — the `*` means "I don't have this function, AI please figure it out" (bash is the usual fallback).

`SKILL.yahl` is a single YAML document (`name`, `description`, optional `types`, and a `stages` list). Each stage has a `logic: |` block; the runtime compiles stages into the agent-facing script (loops, `CONTEXT:`, `IF:` branches, and brace-wrapped AI blocks). See `server/tasks/test/SKILL.yahl` for the canonical shape.

## Authoring tasks

Tasks can ship their own SKILL files — handy when you want assess/synthesize rules without bloating `mastermind/skills/`. At run start the server snapshots `taskYahl` + `taskSkills` onto the session; the orchestrator echoes that bundle into the session workspace and the agent reads it under `~/task-skills/`. (Forget `task-mission/SKILL.md` and the run dies before stage 1 — ask me how I know.)

- **Layout:** `server/tasks/{taskId}/SKILL.yahl` + optional `server/tasks/{taskId}/skills/**/*.md`
- **Snapshot:** `createRun` / `registerSession` persist `taskYahl` + `taskSkills` on the session document
- **Echo:** orchestrator writes the session snapshot → `data/workspace/sessions/{sessionId}/task-skills/` (agent `~/task-skills/`)
- **Hard requirement:** if `SKILL.yahl` contains `~/task-skills/` anywhere, you **must** ship `skills/task-mission/SKILL.md` — verified at run start; missing file → `task-skills echo incomplete`
- **System prompt:** orchestrator injects `task-mission` content via `mergeTaskSystemAppend`
- **Mastermind:** optional `guidelinePath: ~/task-skills/…/SKILL.md` on `research` (untrusted hints banner). Planning via orchestrator `nixeryRun: plan` / `plan-study`.
- **Examples:** `user_onboarding`, `knowledge_capture`, `knowledge_refresh` (see [`server/tasks/_shared/skills/nixery-get-knowledge/SKILL.md`](server/tasks/_shared/skills/nixery-get-knowledge/SKILL.md) for the read path)

```
server/tasks/my_task/
  SKILL.yahl
  skills/
    task-mission/SKILL.md   ← required when YAML references ~/task-skills/
    my-helper/SKILL.md
```
