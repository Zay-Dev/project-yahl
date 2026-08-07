# Knowledge persist (all tasks)

When `~/task-skills/worth-persisting-knowledge/SKILL.md` exists, **Read it early** in AI stages — before inventing what to persist and before end-of-run knowledge decisions.

- Novel **and** evidenced lessons → `/nixery(submit-knowledge-observation, …)` per that skill.
- Soft optional `topic_hint` (content-based or omit). Wrong hint is OK — Knowledge Manager decides final topic and apply shape.
- Prefer zero submits for weak PLACE noise. Never call `upsert-knowledge-page` from stage agents.
- **Any tool / kind error** this stage (`browser`, `nixery`, `platform`, `run_bash`, … — `ok:false`, rejected args, bind miss, …): the **first** action is `/nixery(submit-knowledge-observation, …)` for that failure (`observed`) — top priority before more debug or `run_bash` spelunking.
- If a working path appears later: submit a **second**, separate HOWTO/TRICK observation the same way (top priority again). Do not merge failure and success into one note.

If the skill file is missing, skip — do not invent paths.
