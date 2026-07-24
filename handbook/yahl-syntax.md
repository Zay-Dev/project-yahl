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

## SKILL.yahl file format

Each task lives in `server/tasks/<id>/SKILL.yahl` as one YAML document:

- `name`, `description` — task metadata
- `types` (optional) — multiline type definitions (`|`), emitted as the first AI stage
- `stages` — ordered list of stage objects

Per-stage fields:

| Field | Purpose |
|-------|---------|
| `logic` | Stage body (use `logic: \|` for multiline pseudo-code) |
| `contextMode` | VM-only stage; read prior keys via `context.context.{key}`; return `(() => ({ ... }))` to write `produceContextKeys` |
| `conditionMode` | `IF:` / `ELSE IF:` / `ELSE:` / `END:` branching in `logic` (same `context.context.{key}` reads as `contextMode`) |
| `loopSetup` | Orchestrator-only (e.g. `for each i of [1..5,+2]`); persisted on session stages, not sent to the agent |
| `maxBashCalls` | Optional cap on `run_bash` calls for this AI stage (default 24) |
| `maxTurns` | Optional cap on chat turns for this AI stage (default 60) |
| `agentOverrides` | Optional agent knobs for this stage. **Only** `bashTimeoutMs` (positive int ms) is accepted — unknown keys fail validation. Used by `run_bash` instead of the shared 60s default. |
| `temperature` | Model temperature for AI stages (0–2) |
| `contextKeys` | Allowlist of context/stage keys passed into the runner |
| `updateContextKeys` | Write allowlist on plain AI stages; on loops, keys merged back after each iteration |
| `produceContextKeys` | Allowlist for VM / `set_context` writes to global context |
| `produceTypeKeys` | Allowlist for VM / `set_context` writes to the types bucket |
| `nixeryRun` | Orchestrator-direct nixery def id (e.g. `get-knowledge`, `plan`, `plan-study`); read `~/nixery/{defId}/{output}` in a following AI stage |
| `verify` | Object gate after stage finish — see below. Shorthand `verify: true` → `{ defId: stage-verify }` |

### `verify` object

| Field | Purpose |
|-------|---------|
| `defId` | Nixery def that scores the stage (default `stage-verify`; swappable) |
| `rubric` | Named file under `data/mastermind/rules/verify/` or inline Pass/Fail checklist |
| `minScore` | Minimum pass score (0–1, default 0.75) |
| `autoRetry` | Orchestrator in-process verify retry loop on rubric fail |
| `resume` | When `false`, skip resumeAction classification |

```yaml
verify:
  defId: stage-verify
  autoRetry: true
  minScore: 0.75
  rubric: |
    Pass when learning_contract has non-empty topic OR at least one seedUrl.
    Fail when topic and seedUrls both empty.
```

### VM stages (`contextMode`, `conditionMode`)

Runs in isolated-vm — **not** the agent. Prior context keys are **not** bare variables; read them as `context.context.{key}`.

```yaml
# Reference: server/tasks/test/SKILL.yahl
- contextMode: true
  contextKeys: [c, i]
  updateContextKeys: [c]
  logic: |
    (() => ({
      c: context.context.c + context.context.i,
    }));
```

AI stages (no `contextMode`) may use bare names listed in `contextKeys` — the agent sees them in Input.

The runtime compiles stages into the agent-facing script (loops, `CONTEXT:`, `IF:` branches, and brace-wrapped AI blocks). Agent-facing language lives under `runtime/orchestrator/YAHL/` (every file in that folder is concatenated into the agent system prompt). Keep orchestrator/author schema in this handbook — not in that folder.

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
