# pickup-todo

Load refresh backlog from wiki `todo` page at start of `knowledge_refresh`.

## Load

```text
const todoRef = /mastermind(get-knowledge, topic: knowledge_topic, need: todo);
const todo_pickup = todoRef.absent
  ? { items: [], summaryMd: '' }
  : (*read(todoRef.path)).extracted;
```

Expect `todo_pickup.items[]` with `{ id, kind, priority, summary, detail?, status? }`.

## Work order

1. `expand_questions` — open-questions + ask-user stages
2. `plan_study` — honor in `plan-study` skill before default plan
3. `research_source` + `elaborate_section` — study pipeline + synthesis stages

Skip items with `status: done`.

## Mark done

After completing an item's work, upsert todo with that item `status: done` and move bullet to **Done** section in `summaryMd` (see `write-todo-page` shape).

```text
/mastermind(upsert-knowledge-page, topic: knowledge_topic, key: todo, value: <updated>)
```
