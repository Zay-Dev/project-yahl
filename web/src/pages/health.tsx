import { useCustom } from "@refinedev/core"

import type { TServerHealthResponse } from "@/lib/types"

export function HealthPage() {
  const { query, result } = useCustom<TServerHealthResponse>({
    method: "get",
    queryOptions: {
      queryKey: ["health"],
    },
    url: "/__/health",
  })

  const health = result?.data
  const error = query.error
  const isLoading = query.isLoading

  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="text-sm text-muted-foreground">Server health check</p>
      {isLoading ? <p className="mt-3 text-sm">Loading...</p> : null}
      {error ? (
        <p className="mt-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Request failed"}
        </p>
      ) : null}
      {health ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-lg font-semibold">{health.ok ? "Healthy" : "Degraded"}</p>
          <p>Mongo: {health.mongo.ok ? "ok" : `failed (state ${health.mongo.readyState})`}</p>
          <p>
            Mastermind: {health.mastermind.ok ? "ok" : "failed"}
            {health.mastermind.agent ? ` (${health.mastermind.agent})` : ""}
          </p>
          {health.mastermind.error ? (
            <p className="text-destructive">{health.mastermind.error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
