# dispatch-loop

Unattended `auto_knowledge_refresh` contract.

## After `evaluate-knowledge-refresh`

1. `set_context` key `refresh_eval` — full mastermind tool result `{ ok, data }`.
2. `set_context` key `stale_topics` — `data.staleTopics` array (empty array when none).

## Each loop iteration (`dispatch-task-run`)

1. `/mastermind(dispatch-task-run, taskId: knowledge_refresh, runInput: { knowledge_topic: topic.canonical, rerun_intent: { isRerun: true, proceedMode: update_selected, updateScope: topic.scopes, addressOpenQuestions: false } })`
2. `set_context` scope `global`, key `dispatched`, **operation `extend`**, value:

```json
{
  "canonical": "<topic.canonical>",
  "sessionId": "<dispatch.data.sessionId>",
  "taskId": "knowledge_refresh"
}
```

Initialize `dispatched` as `[]` before the loop if absent.

Pre-seed `rerun_intent` on every dispatch so child `knowledge_refresh` runs skip stage-1 ask-user (`proceed_mode`, `update_scope`). `topic.scopes` comes from `evaluate-knowledge-refresh` stale-topic rows.

Do not use clarify ask-user. Do not read knowledges corpus.
