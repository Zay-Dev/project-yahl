# pickup-todo

Load todo items from nixery get-knowledge output for knowledge refresh.

## Read pattern

```text
Read ~/nixery/get-knowledge/todo.md from the session workspace.
If missing or empty, set todo_pickup to { items: [], summaryMd: '' }; otherwise derive todo_pickup from the file's markdown content.
const todoRef = { absent: !todo_pickup?.items?.length, path: '~/nixery/get-knowledge/todo.md' };
```

Use the markdown file content directly — do not assume JSON envelopes or `.extracted` fields.
