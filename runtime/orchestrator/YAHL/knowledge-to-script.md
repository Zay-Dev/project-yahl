# knowledgeToScript — operation scripts

This AI stage has **knowledgeToScript** enabled (default for AI stages). You still run the **full stage logic** line by line. For **narrow, replayable sub-operations**, prefer compiled scripts under `~/data/scripts/` instead of re-improvising the same steps every poll.

## Rules

- **Many scripts per stage** — keyed by **operation**, not by stage `id`. Format / parse / compare / sleep-math / URL-bind are first-class, not only browser recipes.
- **One small piece at a time** — before inventing or growing a script, if the current nixery catalog or an available `~/task-skills/` skill documents a consult gate for new scripts, Read and follow it once; otherwise grow one piece and do not invent a `/nixery` defId.
- **No session literals** — recipes use `{{origin}}`, `{{destination}}`, etc.; substitute from context before each `browser` call.
- **Ordered replay** — after substitution, run recipe steps as written (`mode` / `url` / `instruction` / `schema`). Do not rephrase. `cat` then free-form browse is incorrect.
- **First-try success** — run once; if output validates, use it and continue. Skip re-reading HOWTO for that op this iteration.
- **Extract schemas** — minimal `required`; optional strings not required; do not rely on `null`. Prefer `{scriptId}-normalize.js` when extract is flaky.
- **Execute node scripts** — writing `.js` without a successful `node …` + validate this run is a miss.
- **On miss** — finish inline if needed; **rewrite** the script/recipe **this poll**; retry before sleep.
- **While polls** — reuse scripts; do not re-read this fragment or `/opt/skills/knowledge-to-script/SKILL.md` if already in transcript.

See `/opt/skills/knowledge-to-script/SKILL.md` for naming, contracts, and debug workflow.
