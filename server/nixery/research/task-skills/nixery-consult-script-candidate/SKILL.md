# nixery-consult-script-candidate

Ask before inventing or growing an operation script. Deterministic — no LLM. Returns **at most one** next `scriptId`.

## Tool call

```json
{
  "defId": "consult-script-candidate",
  "args": {
    "existingScripts": "extract-routes.recipe.json,format-report-run.js",
    "pain": "extract schema ok:false No object generated",
    "stageHint": "monitor"
  }
}
```

`existingScripts`: comma/newline list or JSON string array of files or ids under `~/data/scripts/`.

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

- Call **once** before writing a new script or expanding a fat recipe.
- If `advise` → implement **only** that `scriptId` / `kind` this turn.
- If `skip` → reuse existing scripts; do not invent a multi-op monolith.
- Still execute scripts yourself (`node …` / ordered `browser` recipe steps). This def does not run Stagehand.
