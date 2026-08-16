# Knowledge persist (all tasks)

When `~/task-skills/worth-persisting-knowledge/SKILL.md` exists, **Read it early** in AI stages — before inventing what to persist and before end-of-run knowledge decisions.

- Novel **and** evidenced lessons → `/nixery(submit-knowledge-observation, …)` per that skill.
- Soft optional `topic_hint` (content-based or omit). Wrong hint is OK — Knowledge Manager decides final topic and apply shape.
- Prefer zero submits for weak PLACE noise. Never call `upsert-knowledge-page` from stage agents.

## Tool / kind errors (recovery)

**Any tool / kind error** this stage (`browser`, `nixery`, `platform`, `run_bash`, … — `ok:false`, rejected args, bind miss, …):

1. Read `~/task-skills/resolve-errors-with-knowledge/SKILL.md`.
2. Call `/nixery(resolve-error-with-knowledge, …)` as the **first** action — before more debug or `run_bash` spelunking. It atomically records the failure and searches existing knowledge.
3. Call the resolver **once** per error signature in a stage.
4. Do **not** separately submit the same failure; `not_found` and `unavailable` already mean it was recorded.
5. Do **not** recursively invoke the resolver for an error caused by the resolver itself — use inline nixery soft-fail handling.

If a working path appears later (cited solution verified, or your own investigation succeeded): submit a **second**, separate HOWTO/TRICK observation via `/nixery(submit-knowledge-observation, …)` (top priority again). Do not merge failure and success into one note.

If the skill file is missing, skip — do not invent paths.
