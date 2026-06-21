<meta name="google-site-verification" content="1sHq-JOcCRksNSejR94-tqdhtnWhchDQ8RINRkqVgTc" />

# Project YAHL (Yet Another High-level Language)

YAHL is a loose language for writing pseudo-code that talks to AI without pretending you've invented a compiler. [GitHub](https://github.com/Zay-Dev/project-yahl/tree/develop)

This is supposed to be a fun project. As of late April 2026, AI models still feel unpredictable, even with skills — and the worst part is tracing and debugging what they did and why.

The whole idea came from a moment when I was too lazy to actually code, and also too lazy to vibe-code my way into a maintenance nightmare. If you care about a project, you'll eventually spend more time and tokens cleaning up anyway. It would be nice to casually write pseudo-code that still works. Voilà — here we are.

The way it works in spirit: write pseudo-code in a markdown file, a tiny runtime slices it into small steps, hands each step to an AI inside a sandbox, and stitches the answers back together. No magic — just a lot of small, observable handoffs. (Still kind of amazing.)

## Pain points it nudges at

I'm not pretending to solve any of these — but the shape of YAHL kind of pushes back on each one almost by accident.

- Every session starts cold. There's a workspace folder and a global context bucket — anything worth remembering can stick around.
- AI agents fall apart when their context window fills up. Here every step gets a fresh, small payload, so the rot doesn't compound.
- Agents loop forever on the same broken tool call. Loops here keep a tiny knowledge log; if the same problem shows up three times unresolved, the loop gives up loudly instead of quietly burning tokens.
- Agents hallucinate APIs they've never seen. Skills live in a tidy folder the model can actually read, and project-specific facts sit on disk in plain JSON. Anything truly invented has to be marked with a `*` — the make-believe is opt-in.
- Nobody can debug what an AI did or why. Every step is logged with the exact request that went out, and the running state is just a plain object. When the AI gets weird I can edit one line of pseudo-code (e.g. `website = null;`) and re-run. (In theory it even supports a debugger — for the AI.)

This isn't a victory lap. The shape just happens to line up with where the industry has landed in 2026.

## Status

With the tasks in `server/tasks/`, about 95% of runs follow the same path (as of mid-Jun 2026, I stopped counting this becausing it is too promising) — they'll even fail at the same line for the same reason, which is oddly comforting. I can actually debug this now: watch context move between stages, poke a line like `website = null;`, re-run. Still feels like operating a very smart but very old machine. You watch memory budget, babysit stage boundaries, and count tokens like it's 1998 and you pay per SMS. Still fun though.

But more importantly — it does feel like patching in the right direction. No more roll the dice and fingers crossed.

Stuff that already works (aka things that surprisingly do not explode):

- Redis transport between orchestrator and stage agent.
- Task catalog from `server/tasks/` via the tasks API; orchestrator loads YAML through the server with `--task-id`.
- **Tasks web UI:** browse, create, and edit `SKILL.yahl` at `/tasks`, `/tasks/new`, and `/tasks/:taskId`. In Docker, the server bind-mounts `./server/tasks` so edits persist on the host repo.
- **Tasks API:** `GET/POST /api/tasks`, `GET/PUT /api/tasks/:taskId`, `POST /api/runs`.
- Runtime `ask-user` flow is live: stages can pause for a real user decision and continue with deterministic answer ids (finally, less mind-reading). If the orchestrator times out waiting, the session saves a checkpoint; after you answer, **Resume from checkpoint** in Session Detail kicks off continuation (Redis push wakes an in-flight wait faster when `REDIS_URL` is aligned).
- Session/event tracking with replayable step history and usage/cost visibility.
- Web UI: Sessions list, Session Detail with live logs/status, jump-to-session links, and Tasks authoring.
- Session detail view includes live stream panel, model aggregate table, step details dialog, and final result dialog.
- Fork-run flow supports editing structured request snapshots (`stage` YAHL object, `context.context`, `context.stage`, `context.types`) before rerun.
- Session `Stages` documents store `stage` as structured JSON (`logic`, `contextMode`, `loopSetup`, key allowlists, etc.), not compiled pseudo-code strings. Existing Mongo rows with `currentStage` strings are incompatible; reset stage collections in dev or run a one-off migration.
- Rerun can fast-forward prefix stages from saved `contextAfter` snapshots instead of re-running everything from zero.
- VM client runs on `isolated-vm` for stronger sandbox boundaries and fewer "hope-this-is-fine" moments.
- You can attach the orchestrator to a debugger, hit breakpoints, and poke variables manually while tracing execution.
- **Mastermind stack:** gateway (port 4100) and worker in `docker compose`; orchestrator verify gates and `/mastermind(...)` in the agent (requires `CURSOR_API_KEY`).
- **Platform approvals UI:** `/platform/approvals` for reviewing notification and settings proposals from Mastermind.

Stuff to build:

- Direct user ↔ mastermind chat (deferred for v1; skills stay stateless for now).
- **A2UI done properly** — we tried bolting A2UI and it was a big fail; want real structured UI payloads, not another half-measure.
- **Go to stage (`go to stage <id>`)** — today when a stage fails, resume only picks up at that same stage. We want Mastermind (or the UI) to restart a session at an *earlier* stage so you can fix poisoned context upstream instead of fork-and-pray at the failure point.

Always want to improve:

- Per-stage input/output visibility — good enough to debug most days, never quite "done."
- OneCLI integration polish for safer secret handling.
- UI polish around authoring and inspecting YAHL scripts.

## Some catchy syntax

Examples that survive contact with reality a little better:

1. `CONTEXT` + `IF/ELSE` + inline user input (from `server/tasks/test`):
   - branch logic and ask a human for one number before the final state lands.
2. Nested loops + `EXTENDS:` + typed extraction pipeline (from `server/tasks/competitor_intel`):
   - long-form pseudo-code that still compiles into a useful run.

Quick stress test with less chaos and more signal:

```
for each i of [1..5,+2] {
  c += i;
}
```

Syntax reference:

- `~/something` — the workspace; the AI can read and write here, but only here.
- `for each i of [0..100]` and `for each x of [array]` — loops, with an optional step like `,+2`.
- `CONTEXT: ...` — run deterministic context mutation in the VM before the next AI stage.
- `IF:` / `ELSE IF:` / `ELSE:` / `END:` — stage branching; condition decides which block runs.
- `REPLACE: ...` — system tag the runtime uses when a step needs a second pass after a tool call.
- `EXTENDS: ...` — append or merge into an existing context value without replacing it.
- `/ask-user(...)` — pause the run, ask one multiple-choice question, then resume with the selected answer.
- `/skill_name(...)` — call into a skill from the skills folder.
- `/mastermind(...)` — call the Mastermind gateway (research, verify, notifications, etc.).
- `*do_something(...)` — the `*` means "I don't have this function, AI please figure it out" (bash is the usual fallback).

`SKILL.yahl` is a single YAML document (`name`, `description`, optional `types`, and a `stages` list). Each stage has a `logic: |` block; the runtime compiles stages into the agent-facing script (loops, `CONTEXT:`, `IF:` branches, and brace-wrapped AI blocks). See `server/tasks/test/SKILL.yahl` for the canonical shape.

## How it works under the hood

- A YAHL task file is YAML; stage `logic` holds the pseudo-code the agent or VM runs.
- The runtime reads it, slices it into stages, runs VM-evaluable control blocks (`CONTEXT` / `IF` family) inside `isolated-vm`, then hands AI stages to the model in a sandboxed agent container.
- Anything worth keeping goes into a shared context bucket; everything else is forgotten between stages.
- Each stage declares **key allowlists** in YAML so context stays bounded and debuggable:
  - `contextKeys` — which shared context (and loop-local) keys the stage/agent may read
  - `produceContextKeys` — which keys the stage must write via `set_context` before it can finish (runtime retries if any are missing)
  - `updateContextKeys` — which produced keys get merged back into global context after the stage (on loops, after each iteration)
- The AI talks back through structured tools — set a variable, run a shell command, ask user choices, ask for chunked extraction, call Mastermind.

```mermaid
flowchart LR
  Script["YAHL script"] --> Runtime["Runtime"]
  Runtime -->|stage payload| Agent["Stage agent (sandboxed)"]
  Agent -->|tools| Runtime
  Runtime --> Result["Final result + cost summary"]
```

## Run it

**Prerequisites:** Node, pnpm, Docker.

**Monorepo layout** (Omniflex workspace member; install packages from `../`):

| Path | Package / role |
|------|----------------|
| `runtime/` | `@project-yahl/runtime` — YAHL runtime + orchestrator |
| `server/` | `@project-yahl/server` — Express + Mongoose session/tasks API |
| `web/` | Vite + shadcn — Sessions, Tasks, platform approvals |
| `mastermind/` | Personal assistant gateway (Cursor SDK skills, verify gates) |
| `worker/` | Cron worker for approved platform side effects |

Install and build framework packages from the **Omniflex repo root**:

```bash
cd ..
pnpm install
pnpm -r --filter "./infras/**" run build
```

Copy [`.env.example`](.env.example) to `.env`. Set at minimum:

- `HOST_REPO_ROOT` — absolute path to this repo (required for agent workspace bind mounts)
- `ONECLI_DASHBOARD_URL` and `ONECLI_API_KEY` — OneCLI proxy for LLM keys
- `CURSOR_API_KEY` — required for Mastermind SDK skills (research, verify, etc.)

Copy `server/.env.example` to `server/.env` if you run the server standalone.

### Docker Compose

| File | Purpose |
|------|---------|
| [`docker-compose.yml`](docker-compose.yml) | Infra and optional built server/web |
| [`docker-compose.agent.yml`](docker-compose.agent.yml) | Per-session agent container (orchestrator only) |

**`pnpm run compose:up`** starts local infra: mongo, redis, onecli, onecli_postgres, **mastermind** (4100), **worker**.

**`pnpm run compose:up:all`** builds and starts mongo, redis, onecli, onecli_postgres, **server** (4000), **web** (5173). Does not start mastermind/worker — use `compose:up` for those, or start them manually from the same compose file.

Image build context is the **Omniflex monorepo root** (`..` from project-yahl). App paths use `OMNIFLEX_APP_DIR` (default `project-yahl`). `COMPOSE_PROJECT_NAME` is independent (Docker naming only).

The agent compose file sets `MASTERMIND_API_URL=http://mastermind:4100` for stage agents.

**Local volume data** (gitignored): [`data/`](data/) (mongo, onecli, mastermind), [`workspace/`](workspace/) (agent files), [`runtime/.onecli/`](runtime/.onecli/) (OneCLI CA overrides).

**Dockerfiles:** [`server/Dockerfile`](server/Dockerfile), [`web/Dockerfile`](web/Dockerfile), [`runtime/Dockerfile.agent`](runtime/Dockerfile.agent) (built on the host when orchestrator runs).

#### Why it feels safe (roles and boundaries)

This is about **blast-radius design**, not a formal security audit. It assumes you trust the **server control plane** (host in local dev, `server` container in Docker prod) and your OneCLI vault config.

Runs are started by the server via [`spawn-orchestrate.ts`](server/src/modules/sessions/use-cases/spawn-orchestrate.ts) (`POST /api/runs`, fork, ask-user/verify resume). In **local dev** that orchestrator child process runs on your **host** (alongside `pnpm run dev`); you can still run `pnpm run orchestrate` manually for debugging. In **Docker prod** (`compose:up:all`) the same spawn happens **inside the server container** (built orchestrator + `docker.sock` to bring up agents). The orchestrator is not its own long-lived compose service — it is a per-run process the server (or you, in dev) starts.

| Role | Runs as | Can touch | Cannot / should not |
|------|---------|-----------|---------------------|
| **Human (web UI)** | Browser | Sessions, tasks, ask-user answers, platform approvals | Spawn agents, read vault keys, bypass approval queue |
| **Server** | Host (`pnpm run dev:server`) or `server` container (prod) | Mongo, task files (`server/tasks/`), spawn orchestrator per run; `docker.sock` in container for agent containers | Run stage logic; control plane only |
| **Orchestrator** | Child process spawned by server (host in dev, inside `server` container in Docker prod); optional manual `pnpm run orchestrate` on host | Stage pipeline, context filtering, verify gates, agent lifecycle | Expose full repo or whole task YAML to the agent; VM control flow stays on orchestrator via `isolated-vm` |
| **Stage agent** | Ephemeral `agent-{sessionId}` container | Session scratch `~/` → `/root/sessions/{sessionId}/`, read-only skills, Redis stage queue, typed HTTP to mastermind / OneCLI proxy | Repo source, Mongo, direct vault — tools API only |
| **Mastermind** | `mastermind` container (4100) | `data/mastermind/`, workspace `/root`, Cursor SDK skills | Side effects without approval — proposals go to server first |
| **Worker** | `worker` container | Approved platform jobs, cron batch runs | Send notifications or apply settings until approval |
| **OneCLI** | `onecli` container | Provider secrets in vault; MITM proxy (10255) | Keys are scoped by dashboard host/path rules you configure |

Concurrent sessions each get their own agent container and scratch dir (agent `~/` = session subdir; see [docs/decision-log/mastermind.md](docs/decision-log/mastermind.md)).

**Local dev:** server on host spawns orchestrator on host; agents still run in Docker via `docker-compose.agent.yml`. Manual `pnpm run orchestrate` bypasses the server spawn path but uses the same agent isolation.

**Docker prod:** server container spawns orchestrator inside the container (`dist/orchestrator` when `NODE_ENV=production`); the server’s `docker.sock` mount starts per-session agent containers on the shared network.

**How the agent container is restricted:**

- **Ephemeral and scoped** — orchestrator brings up one agent per run ([`compose-onecli.ts`](runtime/orchestrator/-docker/compose-onecli.ts), project `agent-{sessionId}`), then tears it down.
- **Minimal mounts** — only [`workspace/`](workspace/) (writable) and [`runtime/orchestrator/SKILLS`](runtime/orchestrator/SKILLS) (`:ro` at `/opt/skills`). No server code, tasks tree, or `.env` in the agent image.
- **Session scratch** — `AGENT_SESSION_HOME=/root/sessions/{sessionId}`; shared knowledges via symlink only ([`docker-entrypoint.sh`](runtime/agent/docker-entrypoint.sh)).
- **Structured tools only** — `run_bash`, `browser`, `set_context`, `ask_user`, `mastermind`; orchestrator applies writes and enforces `produceContextKeys` / `contextKeys` allowlists.
- **One stage at a time** — Redis envelope carries filtered context + a single stage payload; the model does not see full task YAML or future stages.
- **LLM keys sanitized** — with OneCLI, orchestrator injects **proxy env + CA** into the agent override; keep `LLM_API_KEY` as placeholder on the host. Internal services stay on `NO_PROXY` (direct, not through the proxy). See **OneCLI setup** below for vault rules.
- **Mastermind is HTTP** — agent calls `MASTERMIND_API_URL` with named skills; `CURSOR_API_KEY` stays in the mastermind container. Outbound notifications/settings are **proposals** until someone approves at `/platform/approvals`.
- **VM control flow off-agent** — `CONTEXT` / `IF` blocks run in `isolated-vm` on the orchestrator process, not inside the agent.

`docker.sock` on **server** and **worker** is intentional: trusted control-plane components that spawn runs. It is not mounted into agent containers.

```mermaid
flowchart TB
  human[Human_web_UI]
  server[Server_host_or_container]
  orch[Orchestrator_per_run_process]
  agent[Agent_container]
  mm[Mastermind]
  onecli[OneCLI_vault_proxy]
  worker[Worker]

  human -->|sessions_tasks_approvals| server
  server -->|spawn_orchestrate| orch
  orch -->|docker_compose_agent| agent
  orch -->|filtered_stage_via_Redis| agent
  orch -->|verify_gate| mm
  agent -->|typed_skills| mm
  agent -->|LLM_via_proxy| onecli
  mm -->|proposals_only| server
  human -->|approve| server
  worker -->|approved_jobs| server
```

### Local development

1. Start infra: `pnpm run compose:up`
2. Run API + runtime: `pnpm run dev` (server + runtime hot reload)
3. Run web (separate terminal): `pnpm run dev:web`
4. Run a session: `pnpm run orchestrate`

Individual commands:

| Command | What it does |
|---------|--------------|
| `pnpm run compose:up` | Infra only (mongo, redis, onecli, mastermind, worker) |
| `pnpm run compose:up:all` | Full Docker stack (infra + built server + web) |
| `pnpm run dev` | Server + runtime on the host |
| `pnpm run dev:server` | API server only |
| `pnpm run dev:web` | Web UI only |
| `pnpm run orchestrate` | Run orchestrator (spawns agent containers) |

The server container bind-mounts `./server/tasks` so Tasks UI edits persist on the host repo.

### Advanced orchestrate flags

| Flag | Purpose |
|------|---------|
| `--task-id <id>` | Run a specific task (e.g. `test`) |
| `--session-id <id>` | Pin session id for debugging |
| `--resume-source-session-id <sessionId>` | Resume from a prior session |
| `--resume-source-request-id <requestId>` | Resume from a specific request |
| `--forkrun-id <forkSessionId>` | Fork-run continuation |

Example: `pnpm run orchestrate -- --task-id test --session-id my-debug-session`

### OneCLI setup

1. Start infra: `pnpm run compose:up`
2. Open OneCLI dashboard at `http://127.0.0.1:10254`
3. Create an agent identity and copy its token
4. Add provider credentials to OneCLI vault with correct host/path patterns
5. Set `ONECLI_DASHBOARD_URL` and `ONECLI_API_KEY` in `.env`
6. Run one orchestrator session to bootstrap shared override files under `runtime/.onecli/`
7. Keep `LLM_API_KEY` / `DEEPSEEK_API_KEY` as placeholders only. Browser automation uses Stagehand (local Chromium in the agent container); see [docs/stagehand-integration.md](docs/stagehand-integration.md)

### Smoke tests

```bash
# OneCLI dashboard
curl -sf http://127.0.0.1:10254/

# OneCLI proxy route
curl -x http://127.0.0.1:10255 -H "Authorization: Bearer placeholder" https://api.deepseek.com/models

# Mastermind health
curl -sf http://127.0.0.1:4100/health

# Runtime
pnpm run orchestrate
```

### Troubleshooting OneCLI

| Symptom | Check |
|---------|-------|
| `gateway unreachable` | Root stack is up; `onecli` container is healthy |
| `sdk config fetch failed` | `ONECLI_DASHBOARD_URL` and `ONECLI_API_KEY` are set and valid |
| `certificate rejected` | `runtime/.onecli/` contains refreshed CA files and compose override |
| `provider key not injected` | Host/path matching and agent permissions in OneCLI dashboard |

### API reference

**Tasks**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List discovered YAHL tasks |
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks/:taskId` | Get task YAML/metadata |
| PUT | `/api/tasks/:taskId` | Update a task |
| POST | `/api/runs` | Start an orchestrator run |

**Sessions**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List sessions (add `?includeArchived=true` for archived) |
| GET | `/api/sessions/:sessionId` | Get session |
| PATCH | `/api/sessions/:sessionId` | Patch session |
| DELETE | `/api/sessions/:sessionId` | Soft- or hard-delete |
| GET | `/api/sessions/:sessionId/events/stream` | SSE live events |
| GET | `/api/sessions/:sessionId/stages/replay` | Stage rows for prefix fast-forward |
| POST | `/api/sessions/:sessionId/fork-sessions` | Create fork session and spawn orchestrator |
| POST | `/api/sessions/:sessionId/verify-checkpoints/:verifyId/resume` | Resume from ask-user timeout checkpoint |

**Fork sessions**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/fork-sessions/:forkSessionId` | Load fork setup for orchestrator |

**Platform** (Mastermind proposals and worker queue)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/platform/proposals/pending` | List pending proposals |
| POST | `/api/platform/proposals/:proposalId/approve` | Approve a proposal |
| POST | `/api/platform/proposals/:proposalId/reject` | Reject a proposal |
| POST | `/api/platform/proposals/notifications` | Draft notification proposal |
| POST | `/api/platform/proposals/settings` | Draft settings proposal |
| GET | `/api/platform/work/pending` | List pending worker jobs |

SSE streams expose live run logs (`meta` / `log` / `status`) and session events for the web UI.

Session persistence uses normalized Mongo collections (`Sessions`, `Stages`, `SessionToolCalls`, `SessionModelResponses`, `SessionAskUserQuestions`, `SessionVerifyCheckpoints`, `ForkSessions`, and related rows). After upgrading schema, wipe the database or drop those collections so old single-document `sessions` rows do not conflict with the new layout.

### Ask-user timeout and recovery

Orchestrator waits at most `YAHL_ASK_USER_MAX_WAIT_MS` (default `600000`) and polls every `YAHL_ASK_USER_POLL_MS` (default `250`). After a timeout it stores a verify checkpoint on the session; the web UI **Resume from checkpoint** POSTs `/api/sessions/:sessionId/verify-checkpoints/:verifyId/resume`.

With `REDIS_URL` set consistently on **server** and **orchestrator/agent**, answering an ask-user question publishes to `yahl:ask-user-answered:<sessionId>` so an in-flight wait can wake before the next poll interval.

## License

This project is licensed under the OmniFlex Source-Available License 1.0. See `LICENSE` for full terms.

Free use is granted for personal, educational, and non-profit research purposes.

Any profitable activity requires a separate commercial license, included but not limited to:
- integrating this software into a paid product or service;
- using this software in revenue-generating operations;
- offering hosting, consulting, support, or managed services based on this software;
- use by any company or corporate group with annual revenue above USD 500,000.

Commercial licensing contact:
- license@omniflex.io
- contact@zay-dev.com

No warranty is provided. No responsibility is assumed by the Licensor to the maximum extent permitted by law.
