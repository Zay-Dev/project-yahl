# task-mission

Thin dispatcher for overnight Knowledge Manager.

1. Orchestrator runs `nixeryRun: run-knowledge-manager` only.
2. That def owns hone, ApplyPlan JSON (optional LLM), deterministic upsert apply, transfer proposals, and approved transfer apply.
3. Do not invent `/nixery(upsert…)` / `/nixery(dedup…)` / research / extract-info from stage logic.
