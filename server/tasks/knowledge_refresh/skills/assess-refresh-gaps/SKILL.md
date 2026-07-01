# assess-refresh-gaps

Unattended refresh defaults for `knowledge_refresh` — no ask-user.

## Inputs

- `refresh_policy` row from `list-topic-policies` for `knowledge_topic`
- Extracted corpus from `extract-knowledge`

## Build `rerun_intent`

```typescript
{
  isRerun: true,
  proceedMode: 'update_selected',
  updateScope: refresh_policy.refresh?.scopes ?? ['studies', 'facts', 'synthesis', 'summary'],
  addressOpenQuestions: false,
}
```

When `refresh_policy.refresh.enabled` is false or `interval` is null, set `refresh_skipped: true` and short-circuit downstream stages.

## Profile / no-seed topics

When `seedUrlCount === 0`, drop `studies` from `updateScope` unless corpus has `study_*` keys.

## `*find_refresh_policy(policies, knowledge_topic)`

Match `canonical` on policy rows; tolerate `{ ok, data }` wrapper from mastermind tool.

## `*default_learning_contract(knowledge_topic)`

Minimal contract when corpus absent: `{ intent: 'preserve_for_future_tasks', topic: knowledge_topic, seedUrls: [], depth: 'overview' }`.
