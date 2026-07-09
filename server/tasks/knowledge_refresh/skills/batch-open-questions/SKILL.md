# batch-open-questions

Run ask-user batches from `design-questions` output (todo-driven refresh).

## Steps

1. `/ask-user-batch(batches)` from expand-open-questions stage.
2. Merge answers into `open_questions_qa` via `answer-open-questions` skill helpers.
3. Persist:

```text
/mastermind(upsert-knowledge-page, topic: knowledge_topic, key: open_questions_qa, value: { items: open_questions_qa })
```

4. Mark matching `expand_questions` todo items `done` when their gaps are closed.

## MC-first

When batches include `multipleChoice`, present options before free-text. Users may pick "Other" for custom text in the UI.
