import { MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCost, formatDuration, formatNumber } from "@/lib/format";
import type { SessionListItem } from "@/types";

type Props = {
  onHardDelete: (sessionId: string) => void | Promise<void>;
  onSoftDelete: (sessionId: string) => void | Promise<void>;
  selectedSessionId?: string | null;
  sessions: SessionListItem[];
};

export const SessionsTable = ({
  onHardDelete,
  onSoftDelete,
  selectedSessionId,
  sessions,
}: Props) => {
  const navigate = useNavigate();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Session</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Calls</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="text-right">Used time</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {sessions.map((session) => {
          const isSelected = selectedSessionId === session.sessionId;

          return (
            <TableRow
              className={`cursor-pointer ${isSelected ? "bg-slate-100 dark:bg-slate-900" : ""}`}
              key={session.sessionId}
              onClick={() => navigate(`/sessions/${session.sessionId}`)}
            >
              <TableCell className="font-mono text-xs">{session.sessionId.slice(0, 8)}</TableCell>
              <TableCell>
                <Badge variant={session.finalizedAt ? "default" : "outline"}>
                  {session.finalizedAt ? "finalized" : "active"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{formatNumber(session.totalCalls)}</TableCell>
              <TableCell className="text-right">{formatCost(session.totalCost)}</TableCell>
              <TableCell className="text-right">{formatDuration(session.totalUsedTimeMs || 0)}</TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost">
                      <MoreHorizontal />
                      <span className="sr-only">Row actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void onSoftDelete(session.sessionId)}>
                      Soft delete
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                      onClick={() => {
                        const confirmed = window.confirm("Permanently delete this session?");
                        if (!confirmed) return;
                        void onHardDelete(session.sessionId);
                      }}
                    >
                      Hard delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
