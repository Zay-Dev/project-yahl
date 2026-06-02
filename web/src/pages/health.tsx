import { useCustom } from "@refinedev/core"

import type { TPingResponse } from "@/lib/types"

export function HealthPage() {
  const { data, query } = useCustom<TPingResponse>({
    method: "get",
    queryOptions: {
      queryKey: ["health", "ping"],
    },
    url: "/__/ping",
  })

  const ping = data?.data
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
      {ping ? <p className="mt-3 text-lg font-semibold">{ping.message}</p> : null}
    </div>
  )
}
