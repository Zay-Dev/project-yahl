# nixery-upsert-knowledge-page

**Deprecated for stage agents.** Narrative wiki writes are Knowledge Manager–only (`knowledge_manager` / `knowledge_refresh` via orchestrator `nixeryRun`).

Stage agents must use `/nixery(submit-knowledge-observation, …)` — see `~/task-skills/submit-knowledge-observation/SKILL.md`.

Calling `upsert-knowledge-page` from a non-manager task returns `knowledge_write_forbidden`.
