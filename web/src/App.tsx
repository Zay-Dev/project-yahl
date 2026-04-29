import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";

import { fetchSessionById, fetchSessions } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SessionDetail, SessionListItem } from "@/types";

const formatNumber = (value: number) => Intl.NumberFormat().format(value);
const formatCost = (value: number) => `$${value.toFixed(5)}`;

const App = () => {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadSessions = async () => {
    setSessionsLoading(true);
    setError(null);
    try {
      const rows = await fetchSessions();
      setSessions(rows);
      if (!selectedId && rows[0]) setSelectedId(rows[0].sessionId);
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    setError(null);
    void fetchSessionById(selectedId)
      .then(setDetail)
      .catch((loadError) => setError(String(loadError)))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const modelRows = useMemo(() => {
    if (!detail) return [];
    return Object.entries(detail.modelAggregates || {}).sort((a, b) => a[0].localeCompare(b[0]));
  }, [detail]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 p-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Session Records</CardTitle>
            <CardDescription>Runtime usage logs persisted from orchestrator events</CardDescription>
          </div>
          <Button onClick={() => void loadSessions()} size="sm" variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
      </Card>

      {error ? <Card><CardContent className="pt-6 text-sm text-red-500">{error}</CardContent></Card> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow
                      className={selectedId === session.sessionId ? "bg-slate-100 dark:bg-slate-900" : ""}
                      key={session.sessionId}
                      onClick={() => setSelectedId(session.sessionId)}
                    >
                      <TableCell className="font-mono text-xs">{session.sessionId.slice(0, 8)}...</TableCell>
                      <TableCell>{formatNumber(session.totalCalls)}</TableCell>
                      <TableCell>{formatCost(session.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Detail</CardTitle>
            {detail?.sessionId ? <CardDescription className="font-mono text-xs">{detail.sessionId}</CardDescription> : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {detailLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Badge variant="secondary">events: {formatNumber(detail?.events.length || 0)}</Badge>
                  <Badge variant={detail?.finalizedAt ? "default" : "outline"}>
                    {detail?.finalizedAt ? "finalized" : "active"}
                  </Badge>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Calls</TableHead>
                      <TableHead>Input</TableHead>
                      <TableHead>Output</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelRows.map(([model, row]) => (
                      <TableRow key={model}>
                        <TableCell className="font-mono text-xs">{model}</TableCell>
                        <TableCell>{formatNumber(row.calls)}</TableCell>
                        <TableCell>{formatNumber(row.cacheHitTokens + row.cacheMissTokens)}</TableCell>
                        <TableCell>{formatNumber(row.completionTokens)}</TableCell>
                        <TableCell>{formatCost(row.cost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default App;
