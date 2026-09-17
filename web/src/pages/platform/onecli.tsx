import type {
  TRequestCreateOneCliSecretBody,
  TResponseOneCliSecret,
} from "@project-yahl/server/modules/platform/-api-types";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createOneCliSecret,
  deleteOneCliSecret,
  listOneCliSecrets,
  updateOneCliSecret,
} from "@/pages/platform/lib/platform-api";

type TDrafts = Record<string, string>;

type TCreateForm = {
  hostPattern: string;
  name: string;
  pathPattern: string;
  value: string;
};

const emptyCreateForm = (): TCreateForm => ({
  hostPattern: "",
  name: "",
  pathPattern: "",
  value: "",
});

export function PlatformOneCliPage() {
  const [items, setItems] = useState<TResponseOneCliSecret[]>([]);
  const [drafts, setDrafts] = useState<TDrafts>({});
  const [createForm, setCreateForm] = useState<TCreateForm>(emptyCreateForm);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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

  const onCreate = async () => {
    const name = createForm.name.trim();
    const hostPattern = createForm.hostPattern.trim();
    const pathPattern = createForm.pathPattern.trim();
    const value = createForm.value.trim();

    if (!name || !hostPattern || !value) {
      setError("Name, host, and value are required");
      return;
    }

    const body: TRequestCreateOneCliSecretBody = {
      hostPattern,
      name,
      value,
    };

    if (pathPattern) {
      body.pathPattern = pathPattern;
    }

    setCreating(true);
    setError(null);

    try {
      await createOneCliSecret(body);
      setCreateForm(emptyCreateForm());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create secret");
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (item: TResponseOneCliSecret) => {
    if (item.isProtected) {
      return;
    }

    if (!window.confirm(`Delete secret “${item.name}”?`)) {
      return;
    }

    setDeletingId(item.id);
    setError(null);

    try {
      await deleteOneCliSecret(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete secret");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">OneCLI secrets</h1>
        <p className="text-sm text-muted-foreground">
          Provider keys stored in OneCLI. Agents send a placeholder; the gateway injects the real
          value for matching host/path rules. Seeded Deepseek and KuaiPao AI cannot be deleted;
          custom secrets can.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-medium">Add secret</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            autoComplete="off"
            onChange={(event) => {
              const next = event.target.value;
              setCreateForm((prev) => ({ ...prev, name: next }));
            }}
            placeholder="Name"
            value={createForm.name}
          />
          <Input
            autoComplete="off"
            className="font-mono text-sm"
            onChange={(event) => {
              const next = event.target.value;
              setCreateForm((prev) => ({ ...prev, hostPattern: next }));
            }}
            placeholder="Host (e.g. api.example.com)"
            value={createForm.hostPattern}
          />
          <Input
            autoComplete="off"
            className="font-mono text-sm"
            onChange={(event) => {
              const next = event.target.value;
              setCreateForm((prev) => ({ ...prev, pathPattern: next }));
            }}
            placeholder="Path pattern (optional, e.g. /v1/*)"
            value={createForm.pathPattern}
          />
          <Input
            autoComplete="off"
            className="font-mono text-sm"
            onChange={(event) => {
              const next = event.target.value;
              setCreateForm((prev) => ({ ...prev, value: next }));
            }}
            placeholder="Secret value"
            type="password"
            value={createForm.value}
          />
        </div>
        <div className="mt-3">
          <Button
            disabled={
              creating
              || !createForm.name.trim()
              || !createForm.hostPattern.trim()
              || !createForm.value.trim()
            }
            onClick={() => void onCreate()}
            type="button"
          >
            {creating ? "Creating…" : "Create"}
          </Button>
        </div>
      </section>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No secrets yet. Tenant bootstrap seeds Deepseek and KuaiPao AI with value
          {" "}
          <code className="text-xs">placeholder</code>
          , or add a custom secret above.
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
                {item.isProtected ? (
                  <span className="text-xs text-muted-foreground">seeded</span>
                ) : null}
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
                {!item.isProtected ? (
                  <Button
                    disabled={deletingId === item.id}
                    onClick={() => void onDelete(item)}
                    type="button"
                    variant="outline"
                  >
                    {deletingId === item.id ? "Deleting…" : "Delete"}
                  </Button>
                ) : null}
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
