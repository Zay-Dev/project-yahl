# knowledgeToScript — operation scripts

This AI stage has **knowledgeToScript** enabled (default for AI stages). You still run the **full stage logic** line by line. For **narrow, replayable sub-operations**, **you decide** when to reuse or compile scripts under `~/data/scripts/`. Priority: **eventually replace ad-hoc free-flow bash/browser calls for those ops with durable scripts**. Do not retire or “replace” existing scripts — reuse and grow them.

## Rules

- **`*get_or_create(path, Instruction: …)`** — stage sugar: if `path` exists under `~/data/scripts/`, **run** it (do not `cat` the body). If missing, compile a narrow script from the Instruction (stdin/stdout contract + yahl-browser when browser), write it, then run. Prefer `{source_scripts_slug}/` subdirs for source-specific browser ops; shared formatters may live at `~/data/scripts/` root. Never bake session POIs into the file.
- **Scripts over ad-hoc bash** — list `~/data/scripts/` once per stage when a narrow op is needed. If a matching `.js` exists, **run it** (`echo '{…}' | node ~/data/scripts/…`). `cat` alone does not count unless you have the knowledge of where and how to find something. Do not reimplement the same op with `node -e`, inline python, hand-rolled formatters, or bare one-off shell when a script covers it.
- **Browser scriptables (agent-free)** — replayable Stagehand work belongs in `~/data/scripts/*.js` that drive the browser via **`yahl-browser`** (JSON stdin → same Stagehand session). Prefer `echo '{…}' | node ~/data/scripts/{op}.js` over stage-agent `browser` turns for each click. Stage-agent `browser` is for explore / one-shot recovery only; after a chain works, compile into scripts and replay via scripts next poll.
- **`*func` that is scriptable** — format / parse / sleep-math / URL-bind / browser fetch: check and run `~/data/scripts/` first; do not default to a fresh bash one-liner or a long `browser` tool loop.
- **Many scripts per stage** — keyed by **operation**, not by stage `id` (e.g. fill-origin, pick-suggestion, extract-routes).
- **One small piece at a time** — before inventing or growing, if a consult gate skill is available under `/opt/skills/`, follow it once (stage-logic summary + short plan + need); otherwise grow one piece and do not invent a `/nixery` defId. Inventory reuse needs no consult.
- **Never re-Read** `/opt/skills/knowledge-to-script/SKILL.md` when this fragment is already in the system prompt set.
- **No session literals** — scripts bind args on stdin JSON; never bake one run’s place names into the file.
- **First-try success** — run the script once; if output validates, continue. Skip re-reading HOWTO for that op this iteration.
- **While / later polls** — re-run the same script with fresh stdin; do not re-`cat` script bodies every poll.
- **Notes (required)** — before finishing, `set_context` key `__knowledge-to-script__notes` to a short non-empty string: name any **ad-hoc free-flow / one-off bash or stage-agent `browser`** this attempt that should become a script (or say none), and either that you created/grew one or **why no new script after consideration**. Do **not** list scripts you already ran. The literal `reviewed` is valid only when free-flow was checked and there is nothing further. Empty / null / false fails the stage and forces retry.
- **On miss** — finish inline if needed (one-shot `browser` / free-flow allowed once); **rewrite** the failing `~/data/scripts/{scriptId}.js` **this poll** from what worked; re-run the script before sleep to validate your fix/patch.

See `/opt/skills/knowledge-to-script/SKILL.md` for naming, contracts, `yahl-browser`, and debug workflow (Read once only when this fragment is absent).
