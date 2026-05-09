---
name: a2ui
description: USE WHEN the YAHL stage text includes /a2ui(...) to build A2UI v0.8 envelopes from structured data already in global context, without duplicating large JSON in chat. Session UI stores the last successful render at finalize.
---

# A2UI (structured result surfaces)

Use this skill when the current `currentStage` contains a **`/a2ui(<key>)`** call (e.g. `/a2ui(result)`).

The `render_a2ui_plan` tool is available only in that case. If `/a2ui(...)` is not present, do not call or simulate `render_a2ui_plan`.

## When to use

- Canonical JSON already exists under **global** context at `<key>` (usually `result`), typically written by a prior **`CONTEXT:`** block or an earlier `set_context` with `scope: "global"`.
- This stage is an **AI (plain) stage** that should end by invoking the **`render_a2ui_plan`** API tool (same mechanism as `set_context` / `ask_user`), not prose-only.

`CONTEXT:` stages run in the VM only and never invoke tools. Put **`/a2ui(result)`** in the **next** AI stage after the data exists.

## Steps

1. Confirm `context.context.<key>` (global bucket) holds the JSON you want to visualize. If missing, use `set_context` with `scope: "global"` first. Do not attempt to verify persisted writeback from inside the same sandbox run; runtime context mutation is finalized outside the sandbox.
2. Prefer translator-first planning: infer a compact **`a2uiPlan.v1`** from schema shape (not payload literals), then emit `surfaceId`, `ui_kind`, `bindings` as JSON pointers (`/` or `/path/...`), optional `column_bindings` for `table`, optional `limits.maxItems`.
3. Call the registered function tool **`render_a2ui_plan`** with JSON arguments (see below). You may call it multiple times in one run. The orchestrator persists merged successful renders on the **session** at finalize (not on stage runtime snapshots).

## Supported components (canonical)

Use only these `ui_kind` values and binding shapes. Do not invent component names.

- `summary_card`
  - required: `bindings.title`, `bindings.body`
  - optional: `bindings.subtitle`
- `detail_card`
  - required: `bindings.title`, `bindings.body`
  - optional: `bindings.subtitle`
- `list_cards`
  - required: `bindings.items`, `bindings.item_title`
  - optional: `bindings.item_subtitle`
- `metric_cards`
  - required: `bindings.items`
  - optional: `bindings.item_label` (default `/label`), `bindings.item_value` (default `/value`)
- `table`
  - required: `bindings.rows`, `column_bindings`
  - optional: none
  - link column extension: `{"header":"Source","path":"/source_url","kind":"link","urlPath":"/source_url","labelPath":"/title"}`

All binding values must be JSON Pointers.

## Markdown mapping guide

Choose `ui_kind` by data shape, not by preferred visual style:

- Full markdown document/string (for example `brief_markdown`) -> `summary_card` or `detail_card` with `bindings.title` + `bindings.body` (optional `subtitle`).
- Array of repeated textual sections -> `list_cards` with `items` + `item_title` (+ optional `item_subtitle`).
- Array of KPI rows (`label/value`) -> `metric_cards`.
- Array of tabular rows with stable columns -> `table` + `column_bindings`.

If markdown is already final, bind the whole markdown field into `body`. Do not re-parse markdown into synthetic arrays inside `plan`.
Avoid putting long markdown or row literals in the plan itself.

## Do not

- Do **not** use **`run_bash`** to `echo` or print a JSON line that looks like `{"type":"tool_call","tool":"render_a2ui_plan",...}`. Shell output is not consumed as a tool call; A2UI will not attach to the session.
- Do **not** paste large literals inside `plan`; only pointers and short headers.

Optional: use **`run_bash`** only to **read** skill text from disk (e.g. `cat /opt/skills/a2ui/SKILL.md`) if you need the file on disk. That does **not** replace calling **`render_a2ui_plan`** as a real tool.

## Wrong vs right

**Wrong** (stored as a normal `run_bash` tool call; does not run A2UI):

```json
{ "command": "echo '{\"type\":\"tool_call\",\"tool\":\"render_a2ui_plan\",...}'" }
```

**Right** — Chat Completions **function** tool: name **`render_a2ui_plan`**, arguments a single JSON object (no outer `type` / `tool` wrapper in the function arguments string):

```json
{
  "version": "renderA2uiPlan.v1",
  "dataRef": { "scope": "global", "key": "result" },
  "plan": {
    "version": "a2uiPlan.v1",
    "surfaceId": "session-result",
    "ui_kind": "summary_card",
    "bindings": {
      "title": "/title",
      "body": "/summary"
    }
  }
}
```

If your stack also shows an internal envelope shape `{ "type": "tool_call", "tool": "render_a2ui_plan", "arguments": { ... } }`, that is documentation shorthand; the model must still emit the **function tool** `render_a2ui_plan`, not bash.

Replace pointers and `ui_kind` to match the actual shape of your `<key>` value.

## Validity examples

Valid markdown-oriented call (single document):

```json
{
  "version": "renderA2uiPlan.v1",
  "dataRef": { "scope": "global", "key": "result" },
  "plan": {
    "version": "a2uiPlan.v1",
    "surfaceId": "ev-daily-brief",
    "ui_kind": "summary_card",
    "bindings": {
      "title": "/title",
      "body": "/brief_markdown",
      "subtitle": "/generated_at"
    }
  }
}
```

Valid append call (same surface incremental update):

```json
{
  "version": "renderA2uiPlan.v1",
  "dataRef": { "scope": "global", "key": "result" },
  "mode": "append",
  "plan": {
    "version": "a2uiPlan.v1",
    "surfaceId": "ev-daily-brief",
    "ui_kind": "metric_cards",
    "bindings": {
      "items": "/raw_intel",
      "item_label": "/title",
      "item_value": "/summary_zh"
    }
  }
}
```

Invalid (missing required `items` for metric cards):

```json
{
  "version": "renderA2uiPlan.v1",
  "dataRef": { "scope": "global", "key": "result" },
  "plan": {
    "version": "a2uiPlan.v1",
    "surfaceId": "ev-daily-brief",
    "ui_kind": "metric_cards",
    "bindings": { "body": "/brief_markdown" }
  }
}
```

## Rules

- `dataRef.scope` should be **`global`** for session-final surfaces unless the task intentionally uses another bucket.
- `mode` is optional. Default is `replace` (replace only the same `surfaceId`). Set `mode: "append"` to keep existing envelopes and append new ones for the same `surfaceId`.
- Use a unique `surfaceId` per distinct section/component tree. Reuse the same `surfaceId` only when continuing the same surface (same UI intent/kind), not for unrelated blocks.
- **`metric_cards`**: `bindings.items` must resolve to a **JSON array** of row objects (each row uses `item_label` / `item_value` pointers, defaulting to `/label` and `/value`). If `<key>` is a single object (not an array), use **`summary_card`** or **`detail_card`** with `title` / `body` (and optional `subtitle`) pointers instead.
- Shorthand: **`/a2ui(result)`** means `key: "result"`.
- For `table`, do not flatten headers/rows into one `Text` string like `A | B | C`. Keep headers and row cells as structured components.
