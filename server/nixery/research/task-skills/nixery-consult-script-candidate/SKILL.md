# nixery-consult-script-candidate

Ask before inventing or growing an operation script. **LLM consultant** — prefers session `scripts/` (falls back to task `scripts/` via `taskId`) and can read session knowledge under `/session`. Returns **at most one** next `scriptId`.

Use this gate only when knowledge-to-script leads you here (agent decision) — not because stage YAML baked a call.

## Tool call

Pass real stage intent — never one-word pains like `monitor warmUp`.

```json
{
  "defId": "consult-script-candidate",
  "args": {
    "taskId": "traffic_monitor",
    "existingScripts": "extract-routes.recipe.json,format-report-run.js",
    "mission": "Private-car route poll: fetch, format day-page section, adaptive sleep.",
    "need": "Advise the next single small script for upcoming monitor polls, or skip if inventory already covers fetch/format/sleep.",
    "stageBrief": "Monitor while-loop warmUp / first polls: bind OD labels, then fetch driving routes and format sections.",
    "plan": "1) Reuse or add extract/format helpers 2) Validate with node/recipe 3) Continue poll without inventing a monolith",
    "stageHint": "monitor-warmUp",
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
| `need` | Why consult now (preferred over `pain`) |
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
  "scriptId": "extract-routes-normalize",
  "kind": "normalize",
  "contract": "…",
  "reasons": ["…"],
  "existingScripts": ["extract-routes"]
}
```

or `{ "action": "skip", "scriptId": null, "kind": null, "contract": null, … }`.

## Rules for the stage agent

- Call **once** before writing a new script or expanding a fat recipe (warmUp or on miss), when you decide a consult is warranted.
- When calling this gate, include `taskId`, `mission`, `need`, `stageBrief`, `plan`, `guidelinePath`, and `existingScripts`.
- If `advise` → implement **only** that `scriptId` / `kind` this turn.
- If `skip` → reuse existing scripts; do not invent a multi-op monolith.
- Still execute scripts yourself (`node …` / ordered `browser` recipe steps). This def does not run Stagehand.
