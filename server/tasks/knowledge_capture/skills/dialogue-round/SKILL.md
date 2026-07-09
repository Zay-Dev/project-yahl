# dialogue-round

Mastermind ↔ agent study dialogue via session filesystem.

## Paths (from `knowledge_paths`)

```
~/knowledge/{topic}/study/{source_slug}/
  raw.md                    # stagehand fetch (round 0 input)
  round-1-mastermind.md     # mastermind research output
  round-1-agent.md          # agent analysis + gaps
  round-2-mastermind.md
  round-2-agent.md
  final.md                  # merged studyMd source
```

## Per round

1. **Mastermind** — `research` with `source:` = prior round agent md or `raw.md`; write full output to `round-N-mastermind.md` via `run_bash`.
2. **Agent** — read mastermind md; analyze against `study_plan.successCriteria`; note gaps; write `round-N-agent.md`.
3. **set_context** — update `study_dialogue.sources[]` with round paths immediately after each write.

## Mastermind wait rules

- Mastermind `research` often takes **5–15 minutes**. The `mastermind` tool auto-waits up to 90 minutes — wait for the tool result; do not start the agent round until `round-N-mastermind.md` is written.
- **Do not re-POST** while request status is `queued` or `running`. Use `mastermind_status` only for debugging.
- If the tool returns `retryable: true` (rare): poll with `mastermind_status` first; only re-POST if status is `failed` or absent after waiting.
- Before re-POST, check whether `round-N-mastermind.md` already exists on disk (a prior invocation may have finished).
- **Do not** substitute Stagehand/browser for mastermind `research` on the first transport error.
- Use Stagehand only when mastermind returns explicit `unavailable: true`, health is down, or the rubric allows browser fetch for `raw.md` only (round 0).
- **Do not** claim the mastermind container is down on `mastermind_request_still_running` — that means still working. Use `mastermind_unreachable` or a health probe to confirm down.
- Error prefixes: `still_running` → wait; `unreachable` → probe health; `timeout` → escalate.

Verify failures (`unavailable: true` from stage verify) are orchestrator/worker domain — not covered here.

## Handoff rules

- Mastermind file must exist on disk before agent reads it.
- Agent file must exist before next mastermind round uses it as `source`.
- Cap `studyMd` at 12KB when persisting `study_{slug}`.
- After final round, merge rounds into `final.md` then persist.

## Gap-driven stop

If agent marks `sufficient: true` in round agent md, skip remaining rounds for that source.

## Persist capture

Every `upsert-knowledge-page` return includes `{ path }` — append to `knowledge_paths.persisted` via set_context (see `context-paths` skill).
