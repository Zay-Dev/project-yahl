import type { TRequestPatchKnowledgePolicyBody, TResponseTopicPolicy } from "@project-yahl/server/modules/platform/-api-types";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  listKnowledgePolicies,
  patchKnowledgePolicy,
  REFRESH_INTERVAL_OPTIONS,
} from "@/pages/platform/lib/knowledge-policies-api";

export function KnowledgePoliciesPage() {
  const [items, setItems] = useState<TResponseTopicPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      setItems(await listKnowledgePolicies());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load policies");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const savePolicy = async (slug: string, patch: TRequestPatchKnowledgePolicyBody) => {
    setSavingSlug(slug);
    setError(null);

    try {
      const updated = await patchKnowledgePolicy(slug, patch);
      setItems((current) => current.map((item) => (
        item.canonical === slug ? updated : item
      )));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save policy");
    } finally {
      setSavingSlug(null);
    }
  };

  const toggleEnabled = async (item: TResponseTopicPolicy) => {
    const enabled = !(item.refresh?.enabled ?? false);

    await savePolicy(item.canonical, {
      enabled,
      interval: enabled ? (item.refresh?.interval ?? "weekly") : null,
    });
  };

  const setInterval = async (item: TResponseTopicPolicy, interval: typeof REFRESH_INTERVAL_OPTIONS[number]["value"]) => {
    await savePolicy(item.canonical, {
      enabled: interval !== null,
      interval,
    });
  };

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading knowledge policies…</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Knowledge refresh policies</h1>
          <p className="text-sm text-muted-foreground">
            Per-topic scheduled refresh settings. Corpus content is not shown here.
          </p>
        </div>
        <Button onClick={() => void load()} size="sm" variant="outline">
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm">No knowledge topics found.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">Topic</th>
                <th className="p-3 text-left font-medium">Enabled</th>
                <th className="p-3 text-left font-medium">Interval</th>
                <th className="p-3 text-left font-medium">Last run</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-t" key={item.canonical}>
                  <td className="p-3 font-medium">{item.canonical}</td>
                  <td className="p-3">
                    <Button
                      disabled={savingSlug === item.canonical}
                      onClick={() => void toggleEnabled(item)}
                      size="sm"
                      variant="outline"
                    >
                      {item.refresh?.enabled ? "On" : "Off"}
                    </Button>
                  </td>
                  <td className="p-3">
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-sm"
                      disabled={savingSlug === item.canonical}
                      onChange={(event) => {
                        const value = event.target.value;
                        const interval = value === "off"
                          ? null
                          : value as "daily" | "weekly" | "biweekly" | "monthly";

                        void setInterval(item, interval);
                      }}
                      value={item.refresh?.interval ?? "off"}
                    >
                      {REFRESH_INTERVAL_OPTIONS.map((option) => (
                        <option key={option.label} value={option.value ?? "off"}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {item.refresh?.lastRunAt ?? "—"}
                  </td>
                  <td className="p-3">{item.refresh?.lastRunStatus ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{item.updatedAt ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
