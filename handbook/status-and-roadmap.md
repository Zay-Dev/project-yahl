# Status and roadmap

With the tasks in `server/tasks/`, about 95% of runs follow the same path (as of mid-Jun 2026, I stopped counting this becausing it is too promising) — they'll even fail at the same line for the same reason, which is oddly comforting. I can actually debug this now: chop the scary long prompt into stages (down to one line), slap `verify` on each, re-run the one that lied. Still feels like operating a very smart but very old machine. You watch memory budget, babysit stage boundaries, and count tokens like it's 1998 and you pay per SMS. Still fun though.

But more importantly — it does feel like patching in the right direction. No more roll the dice and fingers crossed.

| Feature | Status | Description |
|---------|--------|-------------|
| Redis transport | Works | Transport between orchestrator and stage agent. |
| Task catalog | Works | Tasks from `server/tasks/` via the tasks API; orchestrator loads YAML through the server with `--task-id`. |
| Tasks web UI | Works | Browse, create, and edit `SKILL.yahl` at `/tasks`, `/tasks/new`, and `/tasks/:taskId`. In Docker, the server bind-mounts `./server/tasks` so edits persist on the host repo. |
| Tasks API | Works | `GET/POST /api/tasks`, `GET/PUT /api/tasks/:taskId`, `POST /api/runs`. |
| askUserBatch.v1 | Works | Multi-question ask-user pauses (text + radio/checkbox MC); scrollable drawer UI. Stages pause for a real user decision and continue with deterministic answer ids. If the orchestrator times out waiting, the session saves a checkpoint; after you answer, **Resume from checkpoint** in Session Detail kicks off continuation (Redis push wakes an in-flight wait faster when `REDIS_URL` is aligned). |
| Session / event tracking | Works | Replayable step history and usage/cost visibility. |
| Web UI | Works | Sessions list, Session Detail with live logs/status, jump-to-session links, and Tasks authoring. |
| Session Detail view | Works | Live stream panel, model aggregate table, step details dialog, and final result dialog. |
| Fork-run flow | Works | Edit structured request snapshots (`stage` YAHL object, `context.context`, `context.stage`, `context.types`) before rerun. |
| Structured Stages JSON | Works | Session `Stages` documents store `stage` as structured JSON (`logic`, `contextMode`, `loopSetup`, key allowlists, etc.), not compiled pseudo-code strings. Existing Mongo rows with `currentStage` strings are incompatible; reset stage collections in dev or run a one-off migration. |
| Rerun fast-forward | Works | Rerun can fast-forward prefix stages from saved `contextAfter` snapshots instead of re-running everything from zero. |
| isolated-vm | Works | VM client runs on `isolated-vm` for stronger sandbox boundaries. |
| Orchestrator debugger | Works | Attach the orchestrator to a debugger, hit breakpoints, and poke variables while tracing execution. |
| Platform + worker | Works | Worker (cron/approvals + channels) in `docker compose`; stage agents use `/platform(...)` → server for dispatch/proposals/KM instruction; stage verify via nixery `verify.defId`; `/nixery(...)` for knowledge, topic resolve, media-to-text, LLM helpers. |
| WhatsApp channel | Works | Worker owns `whatsapp-web.js` (QR in console when `WHATSAPP_ENABLED=true`); send/receive are pure runtime. `WHATSAPP_WHITELIST` match on propose = pre-approved. Volumes `data/whatsapp_auth` / `data/whatsapp_inbox` (outside agent workspace). Nixery: `whatsapp-register-channel`, `whatsapp-inbox`, get/upsert greets & whatsapp pages, `resolve-notification-target`. |
| Greets + wiki stack | Works | Task `greets` writes `greets/{entity}/` + `whatsapp/{slug}/` and optionally registers inbox capture; cron `whatsapp_wiki_stack` stacks onboarded inbox text into wiki then clears (media logged/skipped). Not under `topics/`. |
| Outbound email (SMTP) | Works | Real SMTP on the worker (`SMTP_*`, `EMAIL_WHITELIST`). When WhatsApp is unavailable mid-send, worker can email `SYSTEM_ADMIN_EMAIL` if SMTP is configured. |
| Cron `runInput` | Works | Cron jobs accept a string-map `runInput` validated against the task’s defaults; web cron form has schedule presets (daily / hourly / every N minutes / weekday / custom). |
| Nixery tools | Works | Orchestrator-direct reads (`nixeryRun: get-knowledge`, `list-knowledge-pages`, `search-knowledge`, `plan-study`); inline defs (`resolve-topic`, `upsert-knowledge-page`, `dedup-knowledge`, `research`, `design-questions`, `extract-info`, `consult-breaking-change`, `submit-knowledge-observation`); manager defs (`apply-manager-topic`, …); stage gate `stage-verify` via YAHL `verify.defId`. |
| design-questions | Works | Nixery inline def for dynamic ask-user batches (pass `mission:` for subject framing). |
| verify.autoRetry | Works | Orchestrator in-process verify loop on stages with `verify.autoRetry: true`. |
| Task-local skills | Works | Echoed from session snapshot to agent `~/task-skills/`; see [yahl-syntax.md](yahl-syntax.md). |
| Knowledge store | Works | Wiki.js canonical pages + `data/knowledge_export` Local FS export; agents read session extracts only — see the root README and [security.md](security.md). |
| Topic governance | Works | Global Knowledge Manager instruction + overnight cron `knowledge_manager` (full corpus); observations inbox; cross-topic `knowledge_transfer` approvals. |
| Background sessions | Works | Cron/utility runs hidden by default on `/sessions` (toggle to show). |
| Platform UI | Works | `/platform/approvals` (`PLATFORM_APPROVAL_TOKEN` / `X-Approval-Token`); `/platform/cron-jobs` create/edit/delete (worker ticks via `POST /api/runs`). Example: `traffic_monitor` at `0 8 * * *` / `Asia/Hong_Kong` with `runInput` — see [how-to-run.md](how-to-run.md). |
| Direct user ↔ assistant chat | Planned | Deferred for v1; skills stay stateless for now. |
| A2UI | Planned | Real structured UI payloads — earlier bolt-on attempt failed; avoid another half-measure. |
| Go to stage | Planned | Today resume only picks up at the failed stage. Want Mastermind (or the UI) to restart a session at an earlier stage so you can fix poisoned context upstream instead of fork-and-pray at the failure point (`go to stage <id>`). |
| Per-stage I/O visibility | Ongoing | Good enough to debug most days, never quite "done." |
| OneCLI integration | Ongoing | Polish for safer secret handling. |
| YAHL authoring UI | Ongoing | Polish around authoring and inspecting YAHL scripts. |
