---
name: knowledge-to-script
description: Compile and replay narrow operation scripts under ~/data/scripts/ — many per stage, not one per stage id.
---

# knowledge-to-script — Operation scripts (JIT)

**knowledgeToScript** is on for this AI stage (unless the stage YAML sets `knowledgeToScript: false`). You still execute the **entire stage logic**. Scripts accelerate **individual sub-operations** only.

**Agent decision** — you choose when a narrow op should become or reuse a script under `~/data/scripts/`. Stage `logic` may use human `*virtual_func(...)` sugar for other work; that is separate from this feature. Do not wait for baked `/nixery` consult calls in YAML.

## When to script

Any **narrow, replayable** sub-op may become a script — first-class candidates include:

- browser extract / navigation recipe
- JSON parse or transform
- structured string / section format (day-page sections, report appends)
- compare / gate math (ETA %, sleep seconds)
- URL bind (`encodeURIComponent` into a template)
- HTTP fetch wrapper

**Do not aim big** — not whole-stage replacement, not one-liner writes, not notify/ask-user prose unless genuinely structured and replayable. Grow **one small piece at a time**.

## Consult before inventing

Before writing a **new** script or expanding a fat recipe:

1. If this install’s nixery catalog (`/opt/skills/nixery/SKILL.md`) or an already-available `~/task-skills/` skill documents a **consult gate for new operation scripts**, Read that skill once and follow it (advise → implement only that piece; skip → reuse existing artifacts). When calling the gate, briefly supply a **stage logic summary** (what this stage is doing) and a **short completion plan** (ordered steps you intend), plus purpose/need — not one-word pains.
2. If no such gate is present: invent **one small piece** this turn; **do not invent a `/nixery` defId** or a multi-op monolith.

## Layout

```
~/data/scripts/
  extract-routes.recipe.json     # browser: ordered steps + output contract
  extract-routes-normalize.js    # optional: coerce extract JSON → contract
  format-fetch-section.js        # node: JSON stdin → JSON stdout
  parse-notify-target.js
  extract-routes.meta.json       # optional sidecar
  ...
```

| Concept | Rule |
|---------|------|
| `scriptId` | Operation slug `[a-zA-Z][a-zA-Z0-9_-]*` — verb-noun, describes the sub-task |
| Who names it | You at compile time; reuse stable ids across polls |
| Stage relationship | One stage may run 0..N scripts per iteration |

## Workflow per sub-op

1. Pick a stable `scriptId` (or use the id returned by a consult gate when one was used).
2. If `~/data/scripts/{scriptId}.js` or `{scriptId}.recipe.json` exists → run **once** with args from context.
3. Validate output against the op contract (sidecar `requiredFields` / `outputSchema`, or the contract you declared when writing the script).
4. **First-try success** → use result, continue stage; **do not** re-read HOWTO prose or re-derive the same browser chain for that op this iteration.
5. **Miss or exec error** → finish the op **inline** if needed; **rewrite** `~/data/scripts/{scriptId}.*` from what worked **before** sleep / next poll; retry. Prefer a companion normalize script over bloating the recipe.

Failures of one script do not disable others in the same stage run.

## Non-negotiables

| Rule | Do |
|------|-----|
| **No session literals** | Recipes and scripts use `{{origin}}`, `{{destination}}`, etc. Substitute from context before each call. Never bake one run’s place names or other session-specific strings into the file. |
| **Ordered replay** | After substitution, call `browser` with each recipe step’s `mode` / `url` / `instruction` / `schema` **as written**. Do not rephrase instructions. |
| **Crib-sheet ban** | `cat` the recipe then free-form browse is **incorrect**. |
| **Extract schema hygiene** | Minimal `required` (only true required keys). Optional strings **not** in `required`. Do not rely on the model emitting `null` for optional strings. |
| **Companion normalize** | When extract is flaky, add `{scriptId}-normalize.js`: stdin extract JSON → stdout coerced object. First-try = extract then normalize. |
| **Execute node scripts** | Writing a `.js` without a successful `node ~/data/scripts/…` + validate **this run** counts as a miss. |
| **Miss → rewrite same poll** | Patch recipe / schema / normalize before sleep; the next poll must use the new file. |
| **One piece** | Do not ship multi-op recipes or whole-fetch super scripts in one turn. |

Recipes that already contain session literals are obsolete — rewrite them to placeholders on the next miss or before reuse.

## Node script contract

```bash
echo '{"origin":"…","destination":"…"}' | node ~/data/scripts/{scriptId}.js
```

- stdin: single JSON object (op-specific args)
- stdout: single JSON object matching the op contract
- exit 0 on success; stderr on failure

## Browser recipe contract

`{scriptId}.recipe.json` — ordered `browser` tool payloads plus `outputSchema` / expected shape.

Example step instruction (parameterized):

Use `{{bind_origin}}` / `{{bind_destination}}` placeholders; substitute from context before each `browser` call.
