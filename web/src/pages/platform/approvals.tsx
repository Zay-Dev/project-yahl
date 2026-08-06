import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type TProposal = {
  kind: 'notification' | 'setting' | 'knowledge_transfer';
  payload: Record<string, unknown>;
  proposalId: string;
  status: string;
};

export function PlatformApprovalsPage() {
  const [items, setItems] = useState<TProposal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/api/platform/proposals/pending`);
      const data = await res.json() as { data?: TProposal[] };

      setItems(Array.isArray(data) ? data as TProposal[] : data.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const approve = async (proposalId: string) => {
    const token = window.prompt('Approval token');

    if (!token?.trim()) {
      return;
    }

    const res = await fetch(`${apiBase}/api/platform/proposals/${proposalId}/approve`, {
      headers: { 'X-Approval-Token': token.trim() },
      method: 'POST',
    });

    if (!res.ok) {
      window.alert(`Approve failed (${res.status})`);
      return;
    }

    await load();
  };

  const reject = async (proposalId: string) => {
    await fetch(`${apiBase}/api/platform/proposals/${proposalId}/reject`, { method: 'POST' });
    await load();
  };

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading approvals…</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Platform approvals</h1>
      <p className="text-sm text-muted-foreground">
        Approve outbound notifications, setting changes, and cross-topic knowledge transfers before they apply.
      </p>

      {items.length === 0 ? (
        <p className="text-sm">No pending proposals.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const proposalId = item.proposalId ?? (item as TProposal & { id?: string }).id ?? '';

            return (
              <li className="rounded-md border p-4" key={proposalId}>
                <div className="mb-2 text-sm font-medium">{item.kind} — {proposalId}</div>
                <pre className="mb-3 overflow-auto text-xs">{JSON.stringify(item.payload, null, 2)}</pre>
                <div className="flex gap-2">
                  <Button disabled={!proposalId} onClick={() => void approve(proposalId)} size="sm">Approve</Button>
                  <Button disabled={!proposalId} onClick={() => void reject(proposalId)} size="sm" variant="outline">Reject</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
