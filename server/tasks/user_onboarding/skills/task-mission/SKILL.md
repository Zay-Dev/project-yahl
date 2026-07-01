# task-mission

Canonical mission framing for all Mastermind calls in the user_onboarding task.

## Mission text (copy into every design-questions / research call)

Build a personal assistant user profile for future teamwork — questions are about the USER not about onboarding mechanics. Never ask about YAHL, stages, Mastermind, orchestrator, or how this task works.

## Rules for stage agents

1. Read this file via `run_bash`: `cat ~/task-skills/task-mission/SKILL.md` (also injected in stage system prompt).
2. Pass the full mission text as the `mission` argument on every `design-questions`, `research`, and `plan` Mastermind call.
3. Include the same mission string inside `facts.mission` on research/plan calls when using structured facts.
4. Ask-user questions must clarify the **user's identity, goals, preferences, or communication style** — not the task pipeline.
5. After each stage profile is built, **immediately** persist with `persist-knowledge` — never hold profile output only in session context.
