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
- Nobody can debug what an AI did or why. Every step is logged with the exact request that went out, and the running state is just a plain object. When the AI gets weird I can shrink a stage to one line, keep `verify` honest, and re-run. (In theory it even supports a debugger — for the AI.)

This isn't a victory lap. The shape just happens to line up with where the industry has landed in 2026.

## Status

With the tasks in `server/tasks/`, about 95% of runs follow the same path (as of mid-Jun 2026, I stopped counting this becausing it is too promising) — they'll even fail at the same line for the same reason, which is oddly comforting. I can actually debug this now: chop the scary long prompt into stages (down to one line), slap `verify` on each, re-run the one that lied. Still feels like operating a very smart but very old machine. You watch memory budget, babysit stage boundaries, and count tokens like it's 1998 and you pay per SMS. Still fun though.

But more importantly — it does feel like patching in the right direction. No more roll the dice and fingers crossed.

And yes — the worker can actually talk WhatsApp now. Scan a QR in the console, run `greets` so a chat has a face and a wiki folder, let `whatsapp_wiki_stack` vacuum inbox text into the knowledge store on a cron. Morning traffic (`traffic_monitor`) takes a real `runInput` (origin, destination, who to nag) instead of a forever-dummy recipient. When WhatsApp ghosts you mid-send, SMTP can yell at the system admin. Setup and env knobs live in the handbook — this paragraph is just the victory dance.

### Case study: `traffic_monitor` (and why debugging AI tasks finally feels sane)

We landed `traffic_monitor` as a cron-friendly YAHL task, then spent a stretch of small commits actually *using* it — the boring kind of progress that used to be impossible when the whole job was one giant prompt.

Recent polish included: readable report copy for humans, dropping accidental region bias, stopping the task from treating every `notify_to` as “the user,” capping probe sources (try a couple, then fall back to Google), making stages respect source-ops knowledge instead of inventing their own adventure, and tightening the knowledge format the monitor reads. Optional `source_instruction` is a this-run free-text override (e.g. one-off revisit) so you need not patch durable ops knowledge — see [`handbook/tricks.md`](handbook/tricks.md).

The meta-win is the workflow. When something lied, we chopped the stage, re-ran *that* slice, fixed the skill or knowledge file, and moved on — no full-pipeline archaeology, no “re-roll and pray.” For an AI task of this size, that loop was weirdly easy and efficient: same failure at the same line, patch the offender, ship the next commit. That is the whole point of YAHL showing up in practice, not just in the pitch deck.

What works / what’s next: [`handbook/status-and-roadmap.md`](handbook/status-and-roadmap.md).

## Why knowledge matters (and why we invest here)

Models change; your curated knowledge doesn't. YAHL's value compounds when the assistant remembers *your* subjects, goals, and context — not when it one-shots a clever reply.

**User first.** Knowledge is what you browse, trust, edit, and link. Wiki pages under `topics/{slug}/` are the product surface, not a debug dump of JSON keys. Refresh keeps knowledge current without re-running full capture.

**Agents second (downstream).** Stage agents never read the full corpus; they get session extracts from orchestrator `nixeryRun: get-knowledge` at `~/nixery/get-knowledge/{output}.md`. Better pages → better extracts → better behavior on every task that reads knowledge. Garbage summaries → repeated questions and wrong assumptions — that's a knowledge problem, not a model problem.

**Why so much effort.** Knowledge quality is the primary lever on product quality — more than picking a slightly newer model. Wiki.js + export mirror + capture/refresh + topic governance are the investment.

## Why this suits an agentic personal assistant

1. **Industrial AI functions, not a chat black box.** Unlike general conversational agents, YAHL is a cloud-native, determinism-bounded AI *function* runtime. Human-authored guardrails (`run.mjs`, `validation.mjs`, stage YAHL) are the typed shell; the model only does fuzzy reasoning and extraction. Spend a little upfront to author and debug; later runs execute with high determinism.
2. **Defense in depth.** Outer nixery one-shot containers with read-only mounts, plus inner human filters (command/path allowlists, shell metachar deny), shrink blast radius so prompt injection cannot threaten the host. Details: [`handbook/security.md`](handbook/security.md).
3. **Prefetch kills cold start.** Prefetch common toolchains via Docker layer cache so sandbox spin-up is milliseconds-to-seconds — low mental model, high stability and privacy, low run cost versus generic agent platforms.

More depth: [`handbook/status-and-roadmap.md`](handbook/status-and-roadmap.md), [`handbook/how-it-works.md`](handbook/how-it-works.md), [`handbook/tricks.md`](handbook/tricks.md).

## Some catchy syntax

```
for each i of [1..5,+2] {
  c += i;
}
```

- `~/…` — session scratch; `~/task-skills/…` — task-local skills
- `CONTEXT:` / `IF:` / `ELSE:` / `END:` / `EXTENDS:` — VM and stage control
- `/ask-user-batch(...)`, `/mastermind(...)`, `/nixery(...)` — platform tools
- `*do_something(...)` — invent with the model (opt-in)

Full syntax and authoring: [`handbook/yahl-syntax.md`](handbook/yahl-syntax.md).

## Trust boundary (slim)

Stage agents never mount the wiki or export corpus — only session scratch and read-only skills. Knowledge reads go through nixery session extracts; writes go through typed nixery upserts. Full roles, mounts, and blast-radius design: [`handbook/security.md`](handbook/security.md).

## Run it (happy path)

**Packages (Omniflex member):** `runtime/` · `server/` · `web/` · `mastermind/` · `worker/` — install from `../`.

```bash
cd ..
pnpm install
pnpm -r --filter "./infras/**" run build
```

Copy [`.env.example`](.env.example) → `.env` (`HOST_REPO_ROOT`, OneCLI, optional `CURSOR_API_KEY`). Then:

```bash
cd project-yahl
pnpm run compose:up          # mongo, redis, onecli, mastermind, worker
pnpm run doctor
pnpm run compose:up:all      # optional: built server + web
# or: pnpm run dev && pnpm run dev:web
curl -sS -X POST "http://127.0.0.1:4000/api/runs" \
  -H 'Content-Type: application/json' \
  -d '{"taskId":"who_am_i"}'
```

Optional: set `WHATSAPP_ENABLED=true` (and friends) in `.env`, restart worker, scan the QR — full channel setup in the handbook.

Full compose, WhatsApp/SMTP, local flags, OneCLI, API, and ask-user recovery: [`handbook/how-to-run.md`](handbook/how-to-run.md).

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
