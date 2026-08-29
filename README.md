# Project YAHL (Yet Another High-level Language)

YAHL is a loose language for writing pseudo-code that talks to AI without pretending you've invented a compiler. [GitHub](https://github.com/Zay-Dev/project-yahl/tree/develop)

## About

This is supposed to be a fun project. As of late April 2026, AI models still feel unpredictable, even with skills — and the worst part is tracing and debugging what they did and why.

The whole idea came from a moment when I was too lazy to actually code, and also too lazy to vibe-code my way into a maintenance nightmare. If you care about a project, you'll eventually spend more time and tokens cleaning up anyway. It would be nice to casually write pseudo-code that still works. Voilà — here we are.

The way it works in spirit: write pseudo-code in a YAML task file, a tiny runtime slices it into small stages, hands each step to an AI inside a sandbox, and stitches the answers back together. No magic — just a lot of small, observable handoffs. (Still kind of amazing.)

Recent shape: the old **mastermind** gateway is gone. Stage agents call **`/platform(...)`** on the server, **nixery** abilities are plug-in folders you install (empty catalog by default), and an **llm-proxy** service centralizes LLM calls with retries and usage postback.

## How it works

- **Orchestrator** loads `SKILL.yaml` from `server/tasks/`, runs the stage pipeline (loops, verify, goto), and spawns ephemeral agent containers per session.
- **Stage agents** get session scratch + read-only skills — never the full wiki. Each poll is a fresh, small payload.
- **`/platform(...)`** → server (dispatch runs, notifications, Knowledge Manager instruction).
- **`/nixery(...)`** → plug-in one-shot containers under `server/nixery/{plugin}/` ([`handbook/nixery.md`](handbook/nixery.md)).
- **LLM** → `llm-proxy` → OneCLI (retries, token usage back to the session).
- **Knowledge corpus + Knowledge Manager** — durable memory humans browse/edit in code-server; agents read session extracts and submit observations.

Pipeline detail: [`handbook/how-it-works.md`](handbook/how-it-works.md).

## Features

- **Staged pseudo-code with verify + rerun** — chop a scary prompt into stages, slap `verify` on each, re-run the one that lied.
- **`whileSetup` + `warmUp`** — orchestrator do-while for polling and monitoring. `loopSetup` counts sheep; `whileSetup` babysits traffic until the window closes. **`warmUp`** reads the manual once; later polls carry that transcript forward instead of starting cold every time.
- **`goto`** — jump-and-continue between labeled stages (`/stage(id)`) without fork-and-pray at the failure point.
- **knowledge-to-script** — default-on for AI stages (`knowledgeToScript`); narrow operation scripts under `~/data/scripts/`, with a Stagehand/`yahl-browser` bridge so agents can drive the browser from scripts. Opt out per stage with `false`.
- **`cacheMaxAge`** — AI-stage grace window (minutes) for trusting durable cache files before live-probing again — fewer token burns on cold re-reads.
- **Per-stage repair** — from Session Detail, inject a one-off instruction at an anchor stage (`kind: 'repair'`) without rewriting the whole task.
- **Plug-in nixery** — typed one-shot containers; install plugins; orchestrator materializes [`runtime/.agent-files/`](../runtime/.agent-files/) at start (or `pnpm nixery:link` locally) to grow or shrink the `/nixery` surface.
- **LLM proxy** — OpenAI-compatible hub with retries (408/429/5xx), usage postback, Anthropic translation; optional SaaS **quota** gating via `QUOTA_STATE_FILE`.
- **Platform skills** — cron jobs, notification proposals, task dispatch via `/platform(...)` on the server.
- **Knowledge Manager** — overnight multi-stage corpus review (`knowledge_manager` cron); stage agents submit observations, not direct wiki edits.
- **WhatsApp + cron** — worker owns channels; scan the QR at **`/platform/channels`**; tasks like `greets`, `whatsapp_wiki_stack`, and `traffic_monitor` propose outbound; SMTP fallback when WhatsApp ghosts you.

### Polling without prompt soup

`whileSetup` is the answer to “keep checking until X” without one giant prompt or an agent-side `while(true)`. The orchestrator owns the clock and a **per-poll** turn/bash budget (after warmUp, each iteration resets to parent max minus warmUp usage — not one pool for the whole window); the model only sees one iteration at a time. Parent **`verify`** runs once after the whole loop.

```yaml
whileSetup:
  condition: "(Date.now() - Date.parse(String(context.context.started_at))) < Number(context.context.monitor_minutes) * 60 * 1000"
  doAtLeast: 2
warmUp: |
  Read ~/task-skills/monitor-loop/SKILL.md.
  Read /opt/skills/worth-persisting-knowledge/SKILL.md.
```

Full schema: [`handbook/yahl-syntax.md`](handbook/yahl-syntax.md).

## Pain points it nudges at

I'm not pretending to solve any of these — but the shape of YAHL kind of pushes back on each one almost by accident.

- Every session starts cold. There's a workspace folder and a global context bucket — anything worth remembering can stick around.
- AI agents fall apart when their context window fills up. Here every step gets a fresh, small payload, so the rot doesn't compound.
- Agents loop forever on the same broken tool call. **`resolve-error-with-knowledge`** records failures and searches existing knowledge first; inline nixery soft-fails so a stage can recover instead of quietly burning tokens.
- Agents hallucinate APIs they've never seen. Skills live in a tidy folder the model can actually read, and project-specific facts sit on disk in plain JSON. Anything truly invented has to be marked with a `*` — the make-believe is opt-in.
- Nobody can debug what an AI did or why. Every step is logged with the exact request that went out, and the running state is just a plain object. When the AI gets weird I can shrink a stage to one line, keep `verify` honest, and re-run. (In theory it even supports a debugger — for the AI.)

This isn't a victory lap. The shape just happens to line up with where the industry has landed in 2026.

## Status

With the tasks in `server/tasks/`, about 95% of runs follow the same path (as of mid-Jun 2026, I stopped counting because it is too promising) — they'll even fail at the same line for the same reason, which is oddly comforting. I can actually debug this now: chop the scary long prompt into stages (down to one line), slap `verify` on each, re-run the one that lied. Still feels like operating a very smart but very old machine. You watch memory budget, babysit stage boundaries, and count tokens like it's 1998 and you pay per SMS. Still fun though.

But more importantly — it does feel like patching in the right direction. No more roll the dice and fingers crossed.

**`traffic_monitor`** is the living proof task on this branch — cron-friendly, real `runInput`, and the integration test for `whileSetup`, `goto`, knowledge-to-script, and knowledge persist. The worker can talk WhatsApp: scan the QR at **`/platform/channels`**, run `greets`, let `whatsapp_wiki_stack` vacuum inbox text into the knowledge store on a cron. Setup and env knobs live in the handbook — this paragraph is just the victory dance.

What works / what's next: [`handbook/status-and-roadmap.md`](handbook/status-and-roadmap.md).

### Case study: `traffic_monitor` (and why debugging AI tasks finally feels sane)

We landed `traffic_monitor` as a cron-friendly YAHL task, then spent a stretch of commits actually *using* it — the boring kind of progress that used to be impossible when the whole job was one giant prompt.

The **monitor stage** runs on **`whileSetup`**: a time-window predicate plus `doAtLeast: 2`, with **`warmUp`** reading skills once and carrying that transcript into each poll. When the explorer stage needs a redo, **`goto`** jumps back without restarting the whole pipeline — the while loop and the jump compose instead of fighting.

Knowledge errors flow through **`resolve-error-with-knowledge`** and **`submit-knowledge-observation`** — not ad-hoc wiki edits from stage agents. Cron **`runInput`** carries real origin, destination, and who to nag. Optional **`source_instruction`** is a this-run free-text override (e.g. one-off revisit) so you need not patch durable ops knowledge — see [`handbook/tricks.md`](handbook/tricks.md).

The meta-win is the workflow. When something lied, we chopped the stage, re-ran *that* slice, fixed the skill or knowledge file, and moved on — no full-pipeline archaeology, no “re-roll and pray.” For an AI task of this size, that loop was weirdly easy and efficient: same failure at the same line, patch the offender, ship the next commit. That is the whole point of YAHL showing up in practice, not just in the pitch deck.

## Why knowledge matters (and why we invest here)

Models change; your curated knowledge doesn't. YAHL's value compounds when the assistant remembers *your* subjects, goals, and context — not when it one-shots a clever reply.

**User first.** Knowledge is what you browse, trust, edit, and link. Markdown pages under `topics/{slug}/` are the product surface, not a debug dump of JSON keys. The **Knowledge Manager** cron keeps the corpus current without re-running full capture pipelines.

**Agents second (downstream).** Stage agents never read the full corpus; they get session extracts from orchestrator `nixeryRun: get-knowledge` at `~/nixery/get-knowledge/{output}.md`. Writes go through **`submit-knowledge-observation`** — overnight **`knowledge_manager`** decides topic and apply shape. Better pages → better extracts → better behavior on every task that reads knowledge. Garbage summaries → repeated questions and wrong assumptions — that's a knowledge problem, not a model problem.

**Why so much effort.** Knowledge quality is the primary lever on product quality — more than picking a slightly newer model. Filesystem corpus + Knowledge Manager + observation inbox are the investment.

## Syntax snapshot

For-loop (`loopSetup`):

```
for each i of [1..5,+2] {
  c += i;
}
```

Do-while (`whileSetup` + optional `warmUp`):

```yaml
whileSetup:
  condition: "context.context.keep_going === true"
  doAtLeast: 2
warmUp: |
  Read ~/task-skills/setup/SKILL.md.
```

- `~/…` — session scratch; `~/task-skills/…` — task-local skills only; `/opt/skills/…` — shareable catalog (platform + installed nixery plugins)
- `CONTEXT:` / `IF:` / `ELSE:` / `END:` / `EXTENDS:` — VM and stage control
- **`loopSetup`** — for-loops; **`whileSetup`** — do-while + optional **`warmUp`**
- **`goto`** — `/stage(id)` jump-and-continue between labeled stages
- **`knowledgeToScript`** / **`cacheMaxAge`** — script recipes + durable-cache trust window (see [yahl-syntax](handbook/yahl-syntax.md))
- `/ask-user-batch(...)`, `/platform(...)`, `/nixery(...)` — platform tools
- `*do_something(...)` — invent with the model (opt-in)

Full syntax and authoring: [`handbook/yahl-syntax.md`](handbook/yahl-syntax.md).

## Trust boundary

Stage agents never mount the export corpus — only session scratch and read-only skills. Knowledge reads go through nixery session extracts; writes go through observation submit (not direct upsert). Nixery is **plugin-scoped** — zero plugins means an empty `/nixery` catalog, which is a valid deployment.

Full roles, mounts, and blast-radius design: [`handbook/security.md`](handbook/security.md).

## Getting started

**Packages (Omniflex member):** `runtime/` · `server/` · `web/` · `worker/` · `llm-proxy/` — install from `../`.

```bash
cd ..
pnpm install
pnpm -r --filter "./infras/**" run build
```

Copy [`.env.example`](.env.example) → `.env` (`HOST_REPO_ROOT`, OneCLI), and [`.env.nixery.example`](.env.nixery.example) → `.env.nixery` for nixery LLM defaults. Then:

```bash
cd project-yahl
pnpm run compose:up          # mongo, redis, onecli, code-server, worker, llm-proxy
pnpm run compose:up:all      # optional: built server + web + code-server
# or: pnpm run dev && pnpm run dev:web
curl -sS -X POST "http://127.0.0.1:4000/api/runs" \
  -H 'Content-Type: application/json' \
  -d '{"taskId":"who_am_i"}'
```

Optional: set `WHATSAPP_ENABLED=true` (and friends) in `.env`, restart worker, scan the QR — full channel setup in the handbook.

Full compose, WhatsApp/SMTP, local flags, OneCLI, API, and ask-user recovery: [`handbook/how-to-run.md`](handbook/how-to-run.md). Docker image builds use the Omniflex monorepo as context — keep a root `.dockerignore` there (see how-to-run).

## Documentation

| Doc | Contents |
|-----|----------|
| [handbook/status-and-roadmap.md](handbook/status-and-roadmap.md) | What works, what's next, platform UI, WhatsApp / cron |
| [handbook/yahl-syntax.md](handbook/yahl-syntax.md) | `SKILL.yaml` schema, syntax, authoring tasks |
| [handbook/nixery.md](handbook/nixery.md) | Plug-in abilities, layout, philosophy |
| [handbook/security.md](handbook/security.md) | Knowledge store protection + outbound channel boundaries |
| [handbook/how-to-run.md](handbook/how-to-run.md) | Compose, WhatsApp/SMTP, local, OneCLI, API, ask-user recovery |
| [handbook/how-it-works.md](handbook/how-it-works.md) | Runtime / stage pipeline |
| [handbook/tricks.md](handbook/tricks.md) | Operator tips (`source_instruction`, greets / WhatsApp, …) |

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
