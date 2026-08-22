---
name: knowledge-to-script
description: Compile and replay narrow operation scripts under ~/data/scripts/ — many per stage, not one per stage id.
---

# knowledge-to-script — Operation scripts (JIT)

**knowledgeToScript** is on for this AI stage (unless the stage YAML sets `knowledgeToScript: false`). You still execute the **entire stage logic**. Scripts accelerate **individual sub-operations** only.

**Priority** — if you have already have a previous knowledge/guideline, **replace ad-hoc free-flow bash and stage-agent `browser`** for replayable ops with durable files under `~/data/scripts/`. Inventory and execute existing scripts before inventing one-off shell or click-by-click `browser` turns. Do not “replace” scripts themselves — reuse and grow them.

**Micro-services style scripts is preferred** - instead of having one monolith script to take care everything, we prefer having a lot of small scripts that take care one step of the big picture. This enable us easier debugging and growing.

**The task orchestrator** - when you have more than one script files for the stage, start to consider a orchestrator script that used to handle multiple steps by **only calling** the exists scripts.

**The consultant** - if you have executed any bash or shell command and the consultant exist, consult the consultant for recommendations of how should you further grow/improve the scripts. Ideally group your narrow ops and submit to the consultant for quality recommendations.

**Agent decision** — you choose when a narrow op should become or reuse a script. Stage `logic` may use human `*virtual_func(...)` sugar for other work; that is separate.

**Do not re-Read this skill** when the injected YAHL `knowledge-to-script` fragment is already in the system prompt set. Prefer that fragment for day-to-day rules.

## When to script

Any **narrow, replayable** sub-op may become a script — first-class candidates include:

- **browser / Stagehand ops (agent-free)** — fill field, select/pick item, button click (via `yahl-browser` inside the script)
- looks for files (when you have the knowledge of where and how to find them by bash cmd)
- JSON parse or transform
- structured string / section format (day-page sections, report appends)
- URL bind (`encodeURIComponent` into a template)
- HTTP fetch wrapper

**Do not aim big** — do not fold the whole stage into one script; not one-liner writes; not notify/ask-user prose unless genuinely structured and replayable. Grow **one small piece at a time**.

## Scripts over ad-hoc bash / stage-agent browser

1. List `~/data/scripts/` **once per stage** when a narrow op is needed (not every while poll).
2. If a matching `.js` exists → **execute** it (`echo '{…}' | node ~/data/scripts/{scriptId}.js`). Reading/`cat` is not enough.
3. **Forbidden** when a script covers the op: `node -e`, inline python, hand-rolled formatters, bare `sleep N` that reimplements script math, and **long stage-agent `browser` turn sequences** that reimplement a scripted fetch.
4. Anti-pattern: `cat ~/data/scripts/adaptive-sleep.js` then `sleep 76`.
5. Correct: `echo '{…}' | node ~/data/scripts/adaptive-sleep.js` → use returned `sleep_sec`, then `sleep` that value.
6. Only if no script fits: invent/grow **one** small script under `~/data/scripts/`, execute it, then continue — do not stay on one-off bash or click-by-click `browser` for a replayable op.

When this skill applies, resolving a scriptable `*…` op means **check and run `~/data/scripts/` first**.

## Stage notes (required)

Before finishing the stage, write:

```text
set_context key=__knowledge-to-script__notes  value=<non-empty string>
```

Notes force a short review of **ad-hoc free-flow / one-off bash** that should become a durable `~/data/scripts/` artifact — not a ledger of scripts you already ran. Name any such candidate this attempt (or say none), and either that you created/grew one or **why no new script after consideration** (inventory already covers it / not replayable / deferred / consult said skip).

Examples:

- `free-flow SPA wait via bare sleep — deferred; adaptive-sleep.js covers poll math`
- `inline jq format for day section — grew format-fetch-section.js`
- `no ad-hoc candidate; inventory covers ops`
- literal **`reviewed`** — free-flow checked; nothing further (including no new-script candidate)

## Layout

```
~/data/scripts/
  fill-origin-input.js           # node: stdin bind → yahl-browser act/observe
  pick-origin-suggestion.js
  fetch-driving-routes.js        # compose: goto + fills + search + extract via yahl-browser
  extract-routes-normalize.js    # optional: coerce extract JSON → contract
  format-fetch-section.js
  adaptive-sleep.js
  ...
```

| Concept | Rule |
|---------|------|
| `scriptId` | Operation slug `[a-zA-Z][a-zA-Z0-9_-]*` — verb-noun, describes the sub-task |
| Who names it | You at compile time; reuse stable ids across polls |
| Stage relationship | One stage may run 0..N scripts per iteration |

## Workflow per sub-op

1. Pick a stable `scriptId` (or use the id returned by a consult gate when one was used).
2. If `~/data/scripts/{scriptId}.js` exists → run **once** with args from context.
3. Validate output against the op contract (sidecar `requiredFields` / `outputSchema`, or the contract you declared when writing the script).
4. **First-try success** → use result, continue stage; **do not** re-read HOWTO prose or re-drive the same Stagehand chain via stage-agent `browser` this iteration.
5. **Miss or exec error** → finish the op **inline** once if needed (stage-agent `browser` allowed for recovery); **rewrite** `~/data/scripts/{scriptId}.js` from what worked **before** sleep / next poll; re-run the script.

Failures of one script do not disable others in the same stage run.

## Browser scriptables (`yahl-browser`)

Replayable Stagehand work must be **agent-free**: the stage agent runs a node script; the script drives Stagehand through the localhost bridge CLI **`yahl-browser`** (same session as the `browser` tool).

```bash
echo '{"mode":"act","instruction":"Type the origin into the From field and wait for autocomplete"}' | yahl-browser
```

- stdin: one JSON object — `{ mode, instruction, url?, schema? }` (`url` only with `mode: "goto"`)
- stdout: `{ ok: true, data }` or `{ ok: false, error }` (exit 1 on failure)
- Bridge is started by the agent daemon (`YAHL_BROWSER_BRIDGE_URL` / `$HOME/.yahl-browser-bridge.json`)

**Stage-agent `browser` tool:** explore / first discovery / one-shot recovery only. After a working chain exists, **compile into `~/data/scripts/*.js`** that call `yahl-browser`, and on later polls run those scripts — do **not** re-loop `browser` for each click.

**STOP:** `cat` a recipe/script into the chat then free-form `browser` — incorrect.

**MUST after recovery:** if stage-agent `browser` / free-flow completed an op that a script should own, grow/rewrite that script **this poll** before sleep.

A lean poll: bind → `echo … | node ~/data/scripts/fetch-….js` → normalize/format → sleep — not a skill-reading or click-by-click tour.

## Non-negotiables

| Rule | Do |
|------|-----|
| **No session literals** | Scripts take args on stdin JSON (`bind_origin`, …). Never bake one run’s place names into the file. |
| **Agent-free browser replay** | Prefer `node ~/data/scripts/…` + `yahl-browser` over stage-agent `browser` turn sequences for known ops. |
| **Crib-sheet ban** | `cat` script/recipe then free-form browse is **incorrect**. |
| **Extract schema hygiene** | Minimal `required` (only true required keys). Optional strings **not** in `required`. |
| **Companion normalize** | When extract is flaky, add `{scriptId}-normalize.js`: stdin extract JSON → stdout coerced object. |
| **Execute node scripts** | Writing a `.js` without a successful `node ~/data/scripts/…` + validate **this run** counts as a miss. |
| **Miss → rewrite same poll** | Patch the failing browser script before sleep; the next poll must use the new file. |
| **One piece** | Do not ship whole-fetch monoliths in one turn unless composing already-stable small ops. |
| **Notes** | Always set `__knowledge-to-script__notes` before finish: ad-hoc free-flow / stage-agent `browser` → script consideration (or why none); do not list scripts already run; `reviewed` only when free-flow checked and nothing further. |

## Node script contract

```bash
echo '{"origin":"…","destination":"…"}' | node ~/data/scripts/{scriptId}.js
```

- stdin: single JSON object (op-specific args)
- stdout: single JSON object matching the op contract
- exit 0 on success; stderr on failure
- Browser scripts: call `yahl-browser` (or `fetch($YAHL_BROWSER_BRIDGE_URL/v1/browser)`) for each Stagehand step
