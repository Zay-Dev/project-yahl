---
name: dispatch-task-run
description: Start a YAHL task run via server POST /api/runs
---

# dispatch-task-run

Start any YAHL task via server `POST /api/runs`.

`/mastermind(dispatch-task-run, taskId: hk_weather)`

With runInput (must match target task's declared `runInput:` keys in SKILL.yahl):

`/mastermind(dispatch-task-run, taskId: knowledge_refresh, runInput: { knowledge_topic: my-topic-slug })`

Returns `{ sessionId, taskId }`.
