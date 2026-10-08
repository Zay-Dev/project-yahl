# OneCLI and its API (YAHL)

Operational notes for how [OneCLI](https://onecli.sh) fits this local stack. Upstream docs win for full API detail; this page is the YAHL map.

## Ports and roles

| Port | Role |
|------|------|
| **10254** | Dashboard + REST API (published locally for debugging) |
| **10255** | MITM HTTP(S) proxy that injects vault secrets (agents / llm-proxy) |

## Auth and base URL

Env (see [`.env.example`](../.env.example)):

- `ONECLI_DASHBOARD_URL` — e.g. `http://onecli:10254` in Docker, `http://127.0.0.1:10254` locally
- `ONECLI_API_KEY` — API / agent key used as `Authorization: Bearer …`
- `ONECLI_API_PREFIX` — path segment after the dashboard host (default **`api`** for self-hosted Community ~1.19; set `v1` only if calling OneCLI Cloud)

| Target | API root |
|--------|----------|
| **Self-hosted** (our default) | `{ONECLI_DASHBOARD_URL}/api` |
| Cloud (docs) | `https://api.onecli.sh/v1` |

On Community images, `/v1/secrets` is a Next.js HTML 404 — use **`/api/...`**.

YAHL server and orchestrator call this API. You can also manage secrets in the OneCLI dashboard at `http://127.0.0.1:10254`, or via **Platform → OneCLI** in the YAHL web UI.

## Secrets model

Secrets live in the OneCLI vault (Postgres + `/app/data`), not in YAHL Mongo.

| Field | Meaning |
|-------|---------|
| `type` | `generic` (we use this), or `openai` / `anthropic` (auto injection) |
| `hostPattern` | Hostname match, e.g. `api.deepseek.com` |
| `pathPattern` | Optional path glob, e.g. `/v1/*` |
| `injectionConfig` | For generic: usually `{ headerName: "Authorization", valueFormat: "Bearer {value}" }` |
| `value` | Real API key (operators set via YAHL UI or OneCLI dashboard) |

This stack routes stage, Stagehand, and nixery LLM traffic to **DeepSeek**. Configure a **Deepseek** secret with `hostPattern` `api.deepseek.com`. You may add custom secrets for other hosts; the stock provider for this app is Deepseek.

Agents and llm-proxy send a **placeholder** `Authorization` (or empty). Traffic goes through **10255**; OneCLI matches host/path and replaces with the vault value. Never put real provider keys in agent env when OneCLI is configured.

## Endpoints we use (self-hosted `/api`)

Verified against Community ~1.19:

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/api/secrets` | List (platform UI) |
| `POST` | `/api/secrets` | Create generic secret (Platform custom add) |
| `PATCH` | `/api/secrets/:id` | Update value (platform UI) |
| `DELETE` | `/api/secrets/:id` | Delete custom secret only (stock names may be blocked in YAHL) |
| `GET` | `/api/agents` | List agents |
| `POST` | `/api/agents` | Create `yahl-default` when no API key exists yet |
| `PUT` | `/api/agents/{agentId}/grants/secrets/{secretId}` | Attach one secret to one agent. No body. This is the secrets-tab toggle |
| `PUT` | `/api/agents/{agentId}/secrets` | Fallback when the grant route returns 404. Body `{"secretIds":["..."]}` |
| `GET` | `/api/user/api-key` | May discover a key |
| `GET` | `/api/container-config` | Proxy env + CA (SDK / orchestrator) |
| `GET` | `/api/health` | Readiness |

SDK `getContainerConfig` via `@onecli-sh/sdk` also talks to the dashboard URL; keep `ONECLI_DASHBOARD_URL` correct so the SDK resolves the same host.

Upstream: [Create a secret](https://onecli.sh/docs/api-reference/secrets/create-a-secret) and [attach a secret](https://onecli.sh/docs/api-reference/grants/attach-a-secret-to-an-agent) (cloud docs still show `/v1`; self-hosted uses the same paths under `/api`), [self-hosting](https://onecli.sh/docs/self-hosting/community).

A secret can sit in the vault and still be refused. The proxy then returns `access_restricted`. The manage link in that error, `/p/{slug}/connections/apps/...`, is a OneCLI Cloud path and **404s** on this self-hosted dashboard. The toggle is `/agents/{id}?tab=secrets`. Grant the Deepseek secret to your agent so injection works.

## YAHL integration map

```text
Browser  →  YAHL web /platform/onecli
                    ↓
               YAHL server /api/platform/onecli/secrets
                    ↓ Bearer ONECLI_API_KEY
               onecli:10254/api

Agent / llm-proxy  →  HTTPS_PROXY  →  onecli:10255  →  api.deepseek.com
```

| Piece | Location |
|-------|----------|
| Platform proxy | `server/src/modules/platform/-onecli-client.ts`, `use-cases/onecli-secrets.ts` |
| Web UI | `web/src/pages/platform/onecli.tsx` |
| Container config / CA | `runtime/orchestrator/-docker/clients/api.ts`, `onecli-snapshot.ts` |

## Local setup checklist

| Step | Where |
|------|-------|
| Dashboard | Optional `http://127.0.0.1:10254` |
| Keys | OneCLI UI or **Platform → OneCLI secrets** |
| Env | `ONECLI_DASHBOARD_URL`, `ONECLI_API_KEY` in `.env` |

See [how-to-run.md](how-to-run.md) for the full run path and smoke tests.
