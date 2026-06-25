# task-mission

Canonical mission framing for all Mastermind calls in the knowledge_capture task.

## Mission text (copy into every design-questions / research call)

You are helping capture knowledge about a subject the user chose. Questions and synthesis must focus on WHAT to learn and WHY (personal interest vs preserving knowledge for future agent tasks). Never ask about YAHL, stages, Mastermind, orchestrator, or how this task works.

## Rules for stage agents

1. Read this file via `run_bash`: `cat ~/task-skills/task-mission/SKILL.md` (also injected in stage system prompt).
2. Pass the full mission text as the `mission` argument on every `design-questions`, `research`, and `plan` Mastermind call.
3. Include the same mission string inside `facts.mission` on research/plan calls when using structured facts.
4. Ask-user questions must clarify the **subject**, **scope**, or **user intent** — not the task pipeline.
5. After each `/mastermind(research, …)` study call, **immediately** persist with `persist-knowledge` — never hold study output only in session context.
6. Never persist URL-only source rows without non-empty `studyMd`.

## Personalization (stages 4–5)

When user-onboarding knowledge exists, tailor narrative tone and detail level to the user's communication preferences. If extract-knowledge returns `<none>`, use neutral professional tone and medium detail.
