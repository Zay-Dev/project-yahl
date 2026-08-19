# nixery-design-questions

Dynamic ask-user batch design via `/nixery(design-questions, stage: …, gaps: …, priorQa: …, mission: …)`.

## Result

Inline tool returns `{ ok, data: { ok, batches, done } }`. Use `data.batches` for `/ask-user-batch(...)`.

## Rules

- Pass `mission` / `subjectContext` — subject/user goal, not task mechanics.
- Prefer `multipleChoice` when 2–6 discrete answers fit.
- Dependent questions belong in a later call (`done: false` on prior batch).

See `server/tasks/_shared/skills/nixery-design-questions/SKILL.md` for batch shape.
