# nixery-consult-script-candidate

Ask before inventing or growing an operation script, and **before drafting `__knowledge-to-script__notes`** after Stagehand recovery / free-flow. **LLM consultant** — prefers session `scripts/` (falls back to task `scripts/` via `taskId`) and can read session knowledge under `/session`. Returns **at most one** next `scriptId` plus a **`notesHint`** for KTS notes.

Use this gate when you decide to invent or grow an operation script, **or** when finishing a k2s-enabled AI stage after browser miss/recovery/free-flow / stage-agent `browser` loops, or when you are about to claim “no new script”.

Browser scriptables should be **agent-free**: advise `kind: "js"` scripts that call **`yahl-browser`**, not stage-agent click loops.

## Tool call

Pass real stage intent — never one-word pains like `monitor warmUp`. For KTS-notes consults, put what failed, what recovery worked, and whether stage-agent `browser` vs `yahl-browser` scripts ran into `need` / `stageBrief`.

```json
{
  "defId": "consult-script-candidate",
  "args": {
    "taskId": "traffic_monitor",
    "existingScripts": "fill-origin-input.js,fetch-driving-routes.js,format-report-run.js",
    "mission": "Private-car route poll: fetch via agent-free scripts, format day-page, adaptive sleep.",
    "need": "Stage-agent browser recover after extract miss. Advise grow/rewrite of a yahl-browser script vs skip, and draft __knowledge-to-script__notes.",
    "stageBrief": "Monitor poll: no fetch-driving-routes.js yet; used stage-agent browser for OD bind + extract; observe recovery filled routes.",
    "plan": "1) Consult 2) grow advised js that calls yahl-browser 3) set_context notes from notesHint 4) sleep",
    "stageHint": "monitor-kts-notes",
    "guidelinePath": "~/task-skills/monitor-loop/SKILL.md",
    "source": ""
  }
}
```

| Arg | Role |
|-----|------|
| `taskId` | Task workspace id — fallback inventory under `/tasks/{taskId}/scripts` when session scripts empty |
| `existingScripts` | Comma/newline/JSON list of ids under `~/data/scripts/` |
| `mission` | What this stage/task is doing |
| `need` | Why consult now (preferred over `pain`) — include recovery/free-flow facts for notes |
| `stageBrief` | Brief stage-logic summary (preferred) |
| `plan` | Short ordered completion plan for the stage |
| `pain` | Legacy alias; used only when `need` empty |
| `stageHint` | Stage role label |
| `guidelinePath` | Session path to a task skill (e.g. `~/task-skills/monitor-loop/SKILL.md`) |
| `source` | Optional session path to howto / source-ops excerpt |

## Result

```json
{
  "action": "advise",
  "scriptId": "fill-origin-input",
  "kind": "js",
  "contract": "stdin {bind_origin} → yahl-browser act/observe → stdout suggestions JSON",
  "reasons": ["…"],
  "existingScripts": ["fetch-driving-routes"],
  "notesHint": "stage-agent browser OD bind — grew fill-origin-input.js via yahl-browser"
}
```

or `{ "action": "skip", "scriptId": null, "kind": null, "contract": null, "notesHint": "…", … }`.

`notesHint` is always required: paraphrase it into `set_context` key `__knowledge-to-script__notes` (do not invent a thin “inventory covers / reviewed” when recovery used stage-agent `browser`).

## Rules for the stage agent

- Call **once** before writing a new script or expanding a fat one (warmUp or on miss), when you decide a consult is warranted.
- Also call **once** before `set_context` `__knowledge-to-script__notes` when this poll had browser miss / observe-recovery / stage-agent `browser` free-flow, or when considering “no new script”.
- When calling this gate, include `taskId`, `mission`, `need`, `stageBrief`, `plan`, `guidelinePath`, and `existingScripts`.
- If `advise` → implement **only** that `scriptId` / `kind` this turn when possible (before sleep). Browser ops: script must call **`yahl-browser`**.
- If `skip` → reuse existing scripts; do not invent a multi-op monolith — still set notes from `notesHint`.
- Still execute scripts yourself (`node …` / `yahl-browser`). This def does not run Stagehand.
