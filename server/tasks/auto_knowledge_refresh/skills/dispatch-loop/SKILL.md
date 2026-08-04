# dispatch-loop

Unattended `auto_knowledge_refresh` contract.

1. `/mastermind(dispatch-task-run, taskId: knowledge_manager, runInput: {})`
2. Persist dispatch result as `result` (`sessionId`, `taskId`).

No per-topic loop. No stale evaluation.
