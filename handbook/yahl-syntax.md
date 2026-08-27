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
- `~/data/scripts/…` — per-task operation scripts when `knowledgeToScript` is enabled (default on AI stages); many narrow scripts per stage, not one script per stage id.
- `~/task-skills/…` — task-local SKILL files echoed from the session snapshot (see Authoring tasks below).
- `/opt/skills/…` — shareable catalog (platform built-ins + installed nixery plugin skills).
- `for each i of [0..100]` and `for each x of [array]` — for-loops, with an optional step like `,+2` (`loopSetup`).
- `whileSetup` — orchestrator-owned do-while. String form is a JS predicate (`context.context.{key}`) with an implicit floor of 1 body. Object form `{ condition, doAtLeast? }` runs `doAtLeast` bodies (default and min 1) then uses `condition` to gate further polls. WarmUp does not count toward `doAtLeast`.
- `warmUp` — optional one-shot prefix on `loopSetup` or `whileSetup`; Redis stage run, then the loop. While iterations and nested fragment children always prepend the warmUp chat transcript (`prefixMessages`), not prior polls. Sibling nesting history only chains when nested `mainThread: true`. On verify **autoRetry** rerun, warmUp logic is skipped by default (`verify.skipWarmUp`, default `true`); the first warmUp transcript is still reused.
- `CONTEXT: ...` — run deterministic context mutation in the VM before the next AI stage.
- `IF:` / `ELSE IF:` / `ELSE:` / `END:` — stage branching; condition decides which block runs.
- `REPLACE: ...` — system tag the runtime uses when a step needs a second pass after a tool call.
- `EXTENDS: ...` — append or merge into an existing context value without replacing it.
- `/ask-user-batch(...)` — pause for **`askUserBatch.v1`** (one or more questions per submit: text, radio, or checkbox MC).
- `/stage(id)` — end this AI stage and jump-and-continue to a labeled stage declared in `goto` (tool: `goto_stage`; injects `stage_goto_reason` / `stage_goto_from`).
- `/skill_name(...)` — call into a skill from the skills folder.
- `/platform(...)` — dispatch runs, notification/knowledge-transfer proposals, KM instruction (session API).
- `/nixery(...)` — knowledge writes, research, design-questions, extract-info, image-to-text (see `/opt/skills/nixery/SKILL.md`).
- `*do_something(...)` — the `*` means "I don't have this function, AI please figure it out" (bash is the usual fallback).
- `*set_context(key, …)` — overwrite a context key via the `set_context` tool (`global` or `types` scope).
- `*extend_context(key, value: item)` — append onto an array via the `extend_context` tool (use for poll lists, notification history, etc.).

## SKILL.yaml file format

Each task lives in `server/tasks/<id>/SKILL.yaml` (or `SKILL.yml`) as one YAML document:

- `name`, `description` — task metadata
- `types` (optional) — multiline type definitions (`|`), emitted as the first AI stage
- `stages` — ordered list of stage objects

Per-stage fields:

| Field | Purpose |
|-------|---------|
| `logic` | Stage body: **string** (`logic: \|` multiline pseudo-code), **inline fragment** (`logic: { stages: [...] }`), or **`$ref`** (`logic: { $ref: stages/foo.yahl }`). Non-text forms run as nested YAHL — see Inline / `$ref` below. |
| `id` | Optional authoring id (`^[a-zA-Z][a-zA-Z0-9_-]*$`); unique within the document when set |
| `mainThread` | Optional boolean on **nested fragment stages only**. Default **`false`**: isolated chat (own `requestId`; warmUp prefix only). Set `true` to join the fragment main thread (receive prior main-thread transcript and append after success). Invalid on fragment/`$ref` shells and top-level string stages. |
| `parallelGroup` | Optional string. **Reserved / NOT IMPLEMENTED** — future concurrent stage groups. Validated and persisted only. |
| `parallelAfter` | Optional non-empty string array of stage ids. **Reserved / NOT IMPLEMENTED** — future join barriers. |
| `goto` | Optional AI-stage transfer list: `{ command: '/stage(<id>)', description: '…' }[]` — agent may call `goto_stage` for a declared target |
| `contextMode` | VM-only stage; read prior keys via `context.context.{key}`; return `(() => ({ ... }))` to write `produceContextKeys` |
| `conditionMode` | `IF:` / `ELSE IF:` / `ELSE:` / `END:` branching in `logic` (same `context.context.{key}` reads as `contextMode`) |
| `loopSetup` | Orchestrator-only for-loop (e.g. `for each i of [1..5,+2]`); persisted on session stages, not sent to the agent |
| `whileSetup` | Orchestrator-only do-while. String = predicate (floor 1). Object `{ condition, doAtLeast? }` runs at least `doAtLeast` bodies (default and min 1), then `condition` gates further iterations. Mutually exclusive with `loopSetup` / `conditionMode` / `nixeryRun`. Parent `verify` runs once after the loop. Each body segment gets a filtered `contextKeys` copy; `updateContextKeys` merge replaces parent keys — keep `extend_context` accumulators on `contextKeys` (see `updateContextKeys`). |
| `warmUp` | Optional one-shot logic before the first `loopSetup` or `whileSetup` iteration (Redis run; stripped from the agent envelope). The warmUp chat transcript is always preloaded as `prefixMessages` for later while iterations **and** nested fragment children (so agents are not cold each poll). Sibling nesting history still only chains when nested `mainThread: true`. On verify `autoRetry` rerun, warmUp logic is skipped by default — see `verify.skipWarmUp`. |
| `maxBashCalls` | Optional cap on `run_bash` calls for this AI stage (default 24) |
| `maxTurns` | Optional cap on chat turns for this AI stage (default 60) |
| `agentOverrides` | Optional agent knobs for this stage. **Only** `bashTimeoutMs` (positive int ms) is accepted — unknown keys fail validation. Used by `run_bash` instead of the shared 60s default. |
| `stagehand` | Optional Stagehand knobs for this AI stage: `model`, `apiBaseUrl` (both optional; default to agent `LLM_*` / `STAGEHAND_MODEL`), `preferScreenshot` (optional boolean, default `false` — excludes Stagehand `screenshot` tool on `browser` `mode: agent`). Unknown keys fail validation. |
| `knowledgeToScript` | Optional boolean. **Default on** for AI stages (omit field). Set `false` to opt out. Enables narrow operation scripts under `~/data/scripts/` — many per stage, not one per stage id. Invalid on `contextMode`, `conditionMode`, and `nixeryRun` stages (explicit `true` fails validation). Phase 1: boolean only — no `knowledgeKeys`. |
| `cacheMaxAge` | Optional positive integer **minutes**. AI stages only. Grace period for trusting durable cache files (e.g. explorer `~/data/{traffic_source_file}`): trust only when file age ≤ this value; older → live-probe. |
| `temperature` | Model temperature for AI stages (0–2) |
| `contextKeys` | Allowlist of context/stage keys passed into the runner |
| `updateContextKeys` | Write allowlist on plain AI stages; on loops, keys merged back after each iteration. **While caveat:** each `whileSetup` body runs on a **filtered copy** of `contextKeys`, then merge **replaces** parent values for listed keys. Any array you `extend_context` across polls (e.g. poll history) must also stay on `contextKeys`, or the next segment starts empty and wipe prior items on merge. |
| `produceContextKeys` | Allowlist for VM / `set_context` / `extend_context` writes to global context |
| `produceTypeKeys` | Allowlist for VM / `set_context` / `extend_context` writes to the types bucket |
| `nixeryRun` | Orchestrator-direct nixery def id (e.g. `get-knowledge`, `plan`, `plan-study`); read `~/nixery/{defId}/{output}` in a following AI stage |
| `verify` | Object gate after stage finish — see below. Shorthand `verify: true` → `{ defId: stage-verify }` |

### Inline YAHL / `$ref` (polymorphic `logic`)

`logic` may be a nested mini-pipeline instead of a pseudo-script string:

```yaml
# External fragment (OpenAPI-style $ref; path relative to server/tasks/{taskId}/)
- id: monitor
  whileSetup: ...
  warmUp: |
    Read ~/task-skills/monitor-loop/SKILL.md.
  logic:
    $ref: stages/monitor.yahl

# Inline fragment — nested stages control threading
- id: batch
  logic:
    stages:
      - id: step_a
        logic: |
          ...
      - id: step_b
        mainThread: true
        logic: |
          ...
```

Fragment file shape (`stages/monitor.yahl`):

```yaml
stages:
  - id: bind
    contextKeys: [traffic_source, origin, ...]
    updateContextKeys: [bind_origin, bound_url, ...]
    logic: |
      ...
  - id: goto
    ...
  - id: extract
    updateContextKeys: [poll_miss, last_fetch, ...]
    logic: |
      ...
  - id: analyze
    contextKeys: [poll_miss, last_fetch, ...]
    updateContextKeys: [fetches, prev_routes]
    logic: |
      ...
```

Rules (v1):

- `$ref` is ref-only (`{ $ref }` alone); no sibling overrides; no remote URLs; no `..`; extensions `.yahl` / `.yaml` / `.yml`.
- Fragment must not set top-level `name` / `description`.
- Nested fragment stages use **string** `logic` only (no recursive `$ref` / fragment inside nested stages). Max `$ref` depth 3.
- `whileSetup` / `loopSetup` / `warmUp` stay on the **shell** stage (not inside fragments).
- Nested children declare their own `contextKeys` / `updateContextKeys` / `produceContextKeys` — they do **not** inherit the shell allowlists. Omit/empty `contextKeys` → platform keys only.
- Nested `mainThread: true` joins the fragment main thread; default omit/`false` is isolated. WarmUp transcript is always prefixed. Session UI uses `agentMeta` (`isMainThread`, `nestedPath`, `parentRequestId`).
- `parallelGroup` / `parallelAfter` are schema placeholders only — orchestrator does not schedule concurrent stages yet.

### Stage `id` + `goto`

Optional labels enable in-process jump-and-continue (not a new resume entry):

```yaml
- id: explorer
  logic: |
    # lock traffic_source …
- id: monitor
  goto:
    - command: '/stage(explorer)'
      description: 'when the locked source is no longer usable'
  logic: |
    # on dead source:
    # call goto_stage { stageId: "explorer", reason: "…" }
```

Rules:

- `id` unique within the document; `goto[].command` must reference an existing id.
- `goto` only on AI stages (not `contextMode` / `conditionMode` / `nixeryRun`).
- On success: current stage finishes **without verify**; orchestrator continues from the target index onward; `stage_goto_reason` and `stage_goto_from` are platform context keys (always visible like `now_iso`).
- Session max transfers: 5.

### `knowledgeToScript`

Default **on** for AI stages (omit the field). Opt out per stage:

```yaml
- id: monitor
  knowledgeToScript: false
  logic: |
    ...
```

Many **operation** scripts may live under `~/data/scripts/` (`extract-routes`, `parse-notify-json`, …) — not one script per stage `id`. The agent still runs full stage logic; scripts replay narrow sub-ops. Invalid on `contextMode`, `conditionMode`, and `nixeryRun` stages.

Behavior contract lives in `/opt/skills/knowledge-to-script/SKILL.md` (and the injected YAHL fragment): parameterized recipes (`{{…}}`, no session literals), ordered replay (not crib-sheet browse), execute node scripts before treating them as done, rewrite on miss same poll. No platform helper APIs — agent-owned files under `~/data/scripts/` only. Pre-contract recipes with baked-in literals are obsolete until agents rewrite them.

### `verify` object

| Field | Purpose |
|-------|---------|
| `defId` | Nixery def that scores the stage (default `stage-verify`; swappable) |
| `rubric` | Named file under `data/mastermind/rules/verify/` or inline Pass/Fail checklist |
| `minScore` | Minimum pass score (0–1, default 0.75) |
| `autoRetry` | Orchestrator in-process verify retry loop on rubric fail |
| `skipWarmUp` | On `autoRetry` rerun of a `whileSetup` stage with `warmUp`, skip re-running warmUp when omitted or `true` (default); set `false` to re-run warmUp on retry |
| `resume` | When `false`, skip resumeAction classification |

```yaml
verify:
  defId: stage-verify
  autoRetry: true
  skipWarmUp: true   # optional; default true on while+warmUp — skip warmUp body on retry, reuse prefix
  minScore: 0.75
  rubric: |
    Pass when learning_contract has non-empty topic OR at least one seedUrl.
    Fail when topic and seedUrls both empty.
```

### Context tools (`set_context` / `extend_context`)

Stage agents persist durable state through orchestrator-handled tools (not bash):

| Tool | YAHL sugar | Behavior |
|------|------------|----------|
| `set_context` | `*set_context(key, …)` | Overwrite a key (`global` or `types` scope) |
| `extend_context` | `*extend_context(key, value: item)` | Append onto an array; missing key starts a one-item array |

Rules:

- `set_context` with `operation: extend` is **retired** — use `extend_context` for list accumulation (e.g. `fetches` poll history).
- Writes are allowlisted via `produceContextKeys`, `produceTypeKeys`, and `updateContextKeys`.
- On `whileSetup`, keep every `extend_context` accumulator on `contextKeys` as well as `updateContextKeys` — segments start from a filtered copy and merge replaces parent values.
- Platform keys (`now_iso`, `today`, verify recovery keys, `stage_goto_*`, …) are orchestrator-owned. Each **`whileSetup` poll segment** refreshes `now_iso` (and `today`) before the body runs — use `now_iso` + task `timezone` for poll timestamps instead of inventing clock values.

**While + warmUp + verify retry:**

- First pass always runs `warmUp` when defined.
- On verify **`autoRetry` rerun**, `skipWarmUp` defaults to **`true`**: warmUp logic is not re-executed, but the first warmUp chat transcript is still prepended to polls. Set `skipWarmUp: false` to re-run warmUp on retry (opt-in).

```yaml
# Reference: server/tasks/traffic_monitor/SKILL.yaml (monitor stage)
whileSetup:
  condition: "(Date.now() - Date.parse(String(context.context.started_at))) < …"
  doAtLeast: 2
warmUp: |
  Read ~/task-skills/monitor-loop/SKILL.md.
logic: |
  …
  *extend_context(fetches, value: fetch_with_status);
verify:
  autoRetry: true
  skipWarmUp: true
```

### VM stages (`contextMode`, `conditionMode`)

Runs in isolated-vm — **not** the agent. Prior context keys are **not** bare variables; read them as `context.context.{key}`.

```yaml
# Reference: server/tasks/test/SKILL.yaml
- contextMode: true
  contextKeys: [c, i]
  updateContextKeys: [c]
  logic: |
    (() => ({
      c: context.context.c + context.context.i,
    }));
```

AI stages (no `contextMode`) may use bare names listed in `contextKeys` — the agent sees them in Input.

On AI stages, `IF:` / `ELSE:` / `END:` are **agent scaffolding** (soft). Only `conditionMode: true` evaluates conditions in isolated-vm (hard). Do not nest `IF:` inside a `conditionMode` stage body during arm picking.

The runtime compiles stages into the agent-facing script (loops, `CONTEXT:`, `IF:` branches, and brace-wrapped AI blocks). Agent-facing language lives under `runtime/orchestrator/YAHL/` (every file in that folder is concatenated into the agent system prompt). Keep orchestrator/author schema in this handbook — not in that folder.

## Authoring tasks

Tasks can ship their own SKILL files under `server/tasks/{taskId}/skills/` — task-local workflow rules echoed to `~/task-skills/`. Shareable skills (platform + nixery plugins) live in `/opt/skills/` via orchestrator materialization — see [nixery.md](nixery.md). At run start the server snapshots task-local skills + `taskYahl` onto the session; the orchestrator echoes task skills into the session workspace. (Forget `task-mission/SKILL.md` and the run dies before stage 1 — ask me how I know.)

- **Layout:** `server/tasks/{taskId}/SKILL.yaml` (or `SKILL.yml`) + optional `server/tasks/{taskId}/skills/**/*.md`
- **Snapshot:** `createRun` / `registerSession` persist `taskYahl` + `taskSkills` on the session document
- **Echo:** orchestrator writes the session snapshot → `data/workspace/sessions/{sessionId}/task-skills/` (agent `~/task-skills/`)
- **Hard requirement:** if the task YAML contains `~/task-skills/` anywhere, you **must** ship `skills/task-mission/SKILL.md` — verified at run start; missing file → `task-skills echo incomplete`
- Stage logic must `Read ~/task-skills/…` explicitly (system prompt does not inject `task-mission`)
- **Mastermind:** optional `guidelinePath: ~/task-skills/…/SKILL.md` on `research` (untrusted hints banner). Planning via orchestrator `nixeryRun: plan` / `plan-study`.
- **Examples:** `user_onboarding`, `knowledge_manager`, `traffic_monitor` (nixery workflow skills: `/opt/skills/worth-persisting-knowledge/SKILL.md`, etc.)

```
server/tasks/my_task/
  SKILL.yaml
  skills/
    task-mission/SKILL.md   ← required when YAML references ~/task-skills/
    my-helper/SKILL.md
```
