# dialogue-round

Nixery ↔ agent study dialogue via session filesystem.

## Paths (from `knowledge_paths`)

```
~/nixery/study/{topic}/{source_slug}/
  raw.md                    # stagehand fetch (round 0 input)
  round-1-research.md       # nixery research output
  round-1-agent.md          # agent analysis + gaps
  round-2-research.md
  round-2-agent.md
  final.md                  # merged studyMd source
```

## Per round

1. **Nixery** — `/nixery(research, source:, output:, topic:, mission:, …)` writes full output to `round-N-research.md`.
2. **Agent** — read research md; analyze against `study_plan.successCriteria`; note gaps; write `round-N-agent.md`.
3. **set_context** — update `study_dialogue.sources[]` with round paths immediately after each write.

## Nixery wait rules

- `research` often takes **5–15 minutes**. The `nixery` tool auto-waits up to 90 minutes — wait for the tool result; do not start the agent round until `round-N-research.md` is written.
- Before re-calling, check whether `round-N-research.md` already exists on disk (a prior invocation may have finished).
- **Do not** substitute Stagehand/browser for nixery `research` on the first transport error.
- Use Stagehand only when nixery returns explicit failure, health is down, or the rubric allows browser fetch for `raw.md` only (round 0).

Verify failures (`unavailable: true` from stage verify) are orchestrator/worker domain — not covered here.

## Handoff rules

- Research file must exist on disk before agent reads it.
- Agent file must exist before next research round uses it as `source`.
- Cap `studyMd` at 12KB when persisting `study_{slug}`.
- After final round, merge rounds into `final.md` then persist.

## Gap-driven stop

If agent marks `sufficient: true` in round agent md, skip remaining rounds for that source.

## Persist capture

Every `upsert-knowledge-page` return includes `data.path` — append to `knowledge_paths.persisted` via set_context (see `context-paths` skill).
