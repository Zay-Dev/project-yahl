# OneCLI and its API (YAHL)

Operational notes for how [OneCLI](https://onecli.sh) fits this repo and SaaS tenants. Upstream docs win for full API detail; this page is the YAHL map.

## Ports and roles

| Port | Role | SaaS tenants |
|------|------|--------------|
| **10254** | Dashboard + REST API | Docker network only — **not** on the public gateway |
| **10255** | MITM HTTP(S) proxy that injects vault secrets | Docker network only (agents / llm-proxy) |

Local compose may publish both ports for debugging. SaaS overlays reset host ports (`ports: !reset []`).

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

YAHL server and orchestrator call this API; browsers never talk to OneCLI directly on SaaS.

## Secrets model

Secrets live in the OneCLI vault (Postgres + `/app/data`), not in YAHL Mongo.

| Field | Meaning |
|-------|---------|
| `type` | `generic` (we use this), or `openai` / `anthropic` (auto injection) |
| `hostPattern` | Hostname match, e.g. `api.deepseek.com`, `kuaipao.ai` |
| `pathPattern` | Optional path glob, e.g. `/v1/*` |
| `injectionConfig` | For generic: usually `{ headerName: "Authorization", valueFormat: "Bearer {value}" }` |
| `value` | Real API key (operators set via YAHL UI); seed uses `placeholder` |

Agents and llm-proxy send a **placeholder** `Authorization` (or empty). Traffic goes through **10255**; OneCLI matches host/path and replaces with the vault value. Never put real provider keys in agent env when OneCLI is configured.

## Endpoints we use (self-hosted `/api`)

Verified against Community ~1.19:

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/api/secrets` | List (platform UI + seed idempotency) |
| `POST` | `/api/secrets` | Create generic secret (seed / Platform custom add) |
| `PATCH` | `/api/secrets/:id` | Update value (platform UI) |
| `DELETE` | `/api/secrets/:id` | Delete custom secret only (seeded names blocked in YAHL) |
| `GET` | `/api/agents` | List agents. Seed grants every returned agent, not only the first |
| `POST` | `/api/agents` | Create `yahl-default` when no API key exists yet |
| `PUT` | `/api/agents/{agentId}/grants/secrets/{secretId}` | Attach one secret to one agent. No body. This is the secrets-tab toggle |
| `PUT` | `/api/agents/{agentId}/secrets` | Fallback when the grant route returns 404. Body `{"secretIds":["..."]}` |
| `GET` | `/api/user/api-key` | Seed may discover a key |
| `GET` | `/api/container-config` | Proxy env + CA (SDK / orchestrator) |
| `GET` | `/api/health` | Readiness |

SDK `getContainerConfig` via `@onecli-sh/sdk` also talks to the dashboard URL; keep `ONECLI_DASHBOARD_URL` correct so the SDK resolves the same host.

Upstream: [Create a secret](https://onecli.sh/docs/api-reference/secrets/create-a-secret) and [attach a secret](https://onecli.sh/docs/api-reference/grants/attach-a-secret-to-an-agent) (cloud docs still show `/v1`; self-hosted uses the same paths under `/api`), [self-hosting](https://onecli.sh/docs/self-hosting/community).

A secret can sit in the vault and still be refused. The proxy then returns `access_restricted`. The manage link in that error, `/p/{slug}/connections/apps/...`, is a OneCLI Cloud path and **404s** on this self-hosted dashboard. The toggle is `/agents/{id}?tab=secrets`. Seed turns those toggles on for every agent on every run, including when the secrets already exist. It does not log secret values.

## YAHL integration map

```text
Browser  →  gateway auth  →  YAHL web /platform/onecli
                              ↓
                         YAHL server /api/platform/onecli/secrets
                              ↓ Bearer ONECLI_API_KEY
                         onecli:10254/api

Agent / llm-proxy  →  HTTPS_PROXY  →  onecli:10255  →  provider APIs
```

| Piece | Location |
|-------|----------|
| Platform proxy | `server/src/modules/platform/-onecli-client.ts`, `use-cases/onecli-secrets.ts` |
| Web UI | `web/src/pages/platform/onecli.tsx` |
| Container config / CA | `runtime/orchestrator/-docker/clients/api.ts`, `onecli-snapshot.ts` |
| Tenant seed | `yahl-saas/yahl-tenant-infra/compose/scripts/onecli-seed.sh` (from `start-stack.sh`) |

Bootstrap seeds **Deepseek** (`api.deepseek.com`) and **KuaiPao AI** (`kuaipao.ai`, `/v1/*`) with value `placeholder`, then grants both to every agent. Replace keys in **Platform → OneCLI secrets**.

Those seeded names are **non-deletable** (`isProtected` on the list API). Operators can **add custom** secrets (name / host / optional path / value) and delete only those custom entries. Creating a secret named `Deepseek` or `KuaiPao AI` is rejected.

## Local vs SaaS

| | Local | SaaS tenant |
|--|-------|-------------|
| Dashboard | Optional `http://127.0.0.1:10254` | Not exposed — use YAHL Platform page |
| Seed | Manual or compose | `onecli-seed.sh` after product stack up |
| Keys | Set in OneCLI UI or Platform page | Platform page only |
