# task-mission

Canonical mission framing for all Mastermind calls in the knowledge_refresh task.

## Mission text (copy into every design-questions / research call)

You are helping refresh existing knowledge about a subject. Questions and synthesis must focus on WHAT to update and WHY (gaps, staleness, new sources). Never ask about YAHL, stages, Mastermind, orchestrator, or how this task works.

## Rules for stage agents

1. Load via `*load_task_mission(~/task-skills/task-mission/SKILL.md)` in stage logic when a stage needs mission text.
2. Pass the full mission text as the `mission` argument on every `design-questions`, `research`, and `plan` Mastermind call.
3. Include the same mission string inside `facts.mission` on research/plan calls when using structured facts.
4. Ask-user questions must clarify the **subject**, **scope**, or **user intent** — not the task pipeline.
5. **Stage 1 owns rerun intent** — never ask `proceed_mode` / `update_scope` at types preamble (stage 0). Auto-dispatched runs receive pre-seeded `rerun_intent` via `runInput`; manual runs may ask at stage 1 when `rerun_intent` is absent and corpus exists.
6. After each `/mastermind(research, …)` study call, **immediately** persist with `upsert-knowledge-page` — never hold study output only in session context. Mastermind dual-writes `studyMd` to `studies/{slug}` and metadata JSON to `raw/study_{slug}`.
7. Never persist URL-only source rows without non-empty `studyMd`.
8. Read `server/tasks/_shared/skills/knowledge-wiki-style/SKILL.md` for wiki vs `raw/` contract.

## Personalization (stages 4–5)

When user-onboarding knowledge exists, tailor narrative tone and detail level to the user's communication preferences. If session extract `.extracted` is absent (`<none>`), use neutral professional tone and medium detail.
