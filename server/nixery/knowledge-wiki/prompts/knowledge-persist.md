# Knowledge persist (all tasks)

When `~/task-skills/worth-persisting-knowledge/SKILL.md` exists, **Read it early** in AI stages — before inventing what to persist and before end-of-run knowledge decisions.

- Novel **and** evidenced lessons → `/nixery(submit-knowledge-observation, …)` per that skill.
- Soft optional `topic_hint` (content-based or omit). Wrong hint is OK — Knowledge Manager decides final topic and apply shape.
- Prefer zero submits for weak PLACE noise. Never call `upsert-knowledge-page` from stage agents.

## Tool / kind errors (recovery)

**Any tool / kind error** this stage (`browser`, `nixery`, `platform`, `run_bash`, … — `ok:false`, rejected args, bind miss, unknown how-to, …):

1. Read `~/task-skills/resolve-errors-with-knowledge/SKILL.md` when it exists, voice out if they are missing.
2. Call `/nixery(resolve-error-with-knowledge, …)` as the **first** action — before more debug or `run_bash` spelunking. It atomically records the failure and searches existing knowledge.
3. Call the resolver **once** per error signature in a stage.
4. Do **not** separately submit the same failure; `not_found` and `unavailable` already mean it was recorded.
5. Do **not** recursively invoke the resolver for an error caused by the resolver itself — use inline nixery soft-fail handling.

If a working path appears later (cited solution verified, or your own investigation succeeded): submit a **second**, separate HOWTO/TRICK observation via `/nixery(submit-knowledge-observation, …)` (top priority again). Do not merge failure and success into one note.

Read those `~/task-skills/…/SKILL.md` files when present. Do **not** invent filesystem paths. Missing SKILL.md does **not** skip `/nixery(resolve-error-with-knowledge, …)` or a later `/nixery(submit-knowledge-observation, …)`.

## The Librarian

`/nixery(resolve-error-with-knowledge, …)` is the system's **Librarian**. Ask it before inventing a search. Do **not** scan `/workspace/sessions/*`, `find /`, or other runs for a spec. It support not only error, instead, it will be able to provide most of the info, and it is your responsbility to contribute back if it failed to provide the info, so DO **NOT** feel hesitated to use it.

The ticket is `observation.observationId` (e.g. `error-a1b2c3d4e5f6`). Keep it until you post back.

Map the brief onto resolver fields — `cue`, `claim`, `example`, `evidence`:

- who I am
- what the goal is
- what I have
- what the problem is
- what I need

Skill files are the catalog (`/opt/skills/…/SKILL.md`, `~/task-skills/…`). Other sessions' workspaces are not.

### Plan / act / react

**Incorrect:** "let me first check [topic] myself" / "but let me first confirm the skill exists"

**Correct:** "let me ask the Librarian: [who I am], [what the goal is], [what I have], [what the problem is], [what I need]" — then call the resolver.

**Correct:** "the Librarian returned knowledge not exists (`status: not_found`). I will resolve it myself. It returned ticket `observation.observationId`, so I can post my finding later."

**Correct:** "I found the solution. I will post back [what to do] and [what I tried that did not work] with the ticket to the Librarian" via `/nixery(submit-knowledge-observation, …)` — put the ticket in `evidence.ticket` / `evidence.observationId`.

**Correct:** "I cannot find the solution. I will post back [what I tried that did not work] with the ticket, so the Librarian can help future agents fail or succeed faster."

**Correct:** "let me check the xxx skill for yyy"

**Incorrect:** "let me look at previous session's for xxx" without consulting the Librarian
