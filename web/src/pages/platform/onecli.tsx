import type { TResponseOneCliSecret } from "@project-yahl/server/modules/platform/-api-types";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listOneCliSecrets, updateOneCliSecret } from "@/pages/platform/lib/platform-api";

type TDrafts = Record<string, string>;

export function PlatformOneCliPage() {
  const [items, setItems] = useState<TResponseOneCliSecret[]>([]);
  const [drafts, setDrafts] = useState<TDrafts>({});
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const next = await listOneCliSecrets();
      setItems(next);
      setDrafts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load secrets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (item: TResponseOneCliSecret) => {
    const value = drafts[item.id]?.trim();
    if (!value) {
      setError("Enter a secret value before saving");
      return;
    }

    setSavingId(item.id);
    setError(null);

    try {
      const updated = await updateOneCliSecret(item.id, { value });
      setItems((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update secret");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">OneCLI secrets</h1>
        <p className="text-sm text-muted-foreground">
          Provider keys stored in OneCLI. Agents send a placeholder; the gateway injects the real
          value for matching host/path rules. Replace bootstrap placeholders with real API keys.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No secrets yet. Tenant bootstrap seeds Deepseek and KuaiPao AI with value
          {" "}
          <code className="text-xs">placeholder</code>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <section
              className="rounded-xl border bg-card p-5"
              key={item.id}
            >
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <h2 className="text-lg font-medium">{item.name}</h2>
                <span className="text-xs text-muted-foreground">{item.type}</span>
              </div>

              <dl className="mb-4 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                <div>
                  <dt className="inline text-foreground/70">Host</dt>
                  {" "}
                  <dd className="inline font-mono text-xs">{item.hostPattern}</dd>
                </div>
                {item.pathPattern ? (
                  <div>
                    <dt className="inline text-foreground/70">Path</dt>
                    {" "}
                    <dd className="inline font-mono text-xs">{item.pathPattern}</dd>
                  </div>
                ) : null}
                {item.headerName ? (
                  <div>
                    <dt className="inline text-foreground/70">Header</dt>
                    {" "}
                    <dd className="inline font-mono text-xs">{item.headerName}</dd>
                  </div>
                ) : null}
                {item.preview ? (
                  <div>
                    <dt className="inline text-foreground/70">Preview</dt>
                    {" "}
                    <dd className="inline font-mono text-xs">{item.preview}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  autoComplete="off"
                  className="font-mono text-sm"
                  onChange={(event) => {
                    const next = event.target.value;
                    setDrafts((prev) => ({ ...prev, [item.id]: next }));
                  }}
                  placeholder="New secret value"
                  type="password"
                  value={drafts[item.id] ?? ""}
                />
                <Button
                  disabled={savingId === item.id || !(drafts[item.id]?.trim())}
                  onClick={() => void onSave(item)}
                  type="button"
                >
                  {savingId === item.id ? "Saving…" : "Update"}
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}

      <div>
        <Button
          disabled={loading}
          onClick={() => void load()}
          type="button"
          variant="outline"
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
