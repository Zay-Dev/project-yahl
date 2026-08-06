import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getKnowledgeManagerInstruction,
  putKnowledgeManagerInstruction,
} from "@/pages/platform/lib/knowledge-instruction-api";

export function KnowledgePoliciesPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      setText(await getKnowledgeManagerInstruction());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load instruction");
      setText("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    const token = window.prompt("Approval token");

    if (!token?.trim()) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const next = await putKnowledgeManagerInstruction({ text }, token);
      setText(next);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save instruction");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading Knowledge Manager instruction…</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Knowledge Manager instruction</h1>
          <p className="text-sm text-muted-foreground">
            Global free-text do / don&apos;t / focus for overnight review of every topic.
            Save requires PLATFORM_APPROVAL_TOKEN.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void load()} size="sm" variant="outline">
            Reload
          </Button>
          <Button disabled={saving} onClick={() => void save()} size="sm">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {saved ? (
        <p className="text-sm text-muted-foreground">Saved.</p>
      ) : null}

      <textarea
        className="min-h-[320px] w-full rounded-md border bg-background p-3 font-mono text-sm"
        onChange={(event) => setText(event.target.value)}
        value={text}
      />
    </div>
  );
}
