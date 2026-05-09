import { ExternalLink, Eye, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDuration, formatNumber } from "@/lib/format";
import type { SessionDetail } from "@/types";

type Props = {
  a2uiHref: string | null;
  detail: SessionDetail | null;
  hasStoredResult: boolean;
  onHardDelete: () => void | Promise<void>;
  onSoftDelete: () => void | Promise<void>;
  onRenameTitle: (title: string) => void | Promise<void>;
  onViewResult: () => void;
  taskPath: string | null;
  totalUsedMs: number;
};

export const SessionSummary = ({
  a2uiHref,
  detail,
  hasStoredResult,
  onHardDelete,
  onSoftDelete,
  onRenameTitle,
  onViewResult,
  taskPath,
  totalUsedMs,
}: Props) => {
  const [draftTitle, setDraftTitle] = useState("");
  const activeTitle = detail?.title || "Untitled session";

  return (
    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
    <div className="space-y-2">
      <CardTitle>Backstage detail</CardTitle>
      <div className="flex items-center gap-2">
        <Input
          className="h-8 max-w-sm"
          onChange={(event) => setDraftTitle(event.target.value)}
          placeholder={activeTitle}
          value={draftTitle}
        />
        <Button
          disabled={!draftTitle.trim()}
          onClick={() => {
            void Promise.resolve(onRenameTitle(draftTitle)).then(() => setDraftTitle(""));
          }}
          size="sm"
          variant="outline"
        >
          Rename
        </Button>
      </div>
      {detail?.sessionId ? (
        <CardDescription className="font-mono text-xs">{detail.sessionId}</CardDescription>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">events: {formatNumber(detail?.events.length || 0)}</Badge>
        <Badge variant="secondary">used: {formatDuration(totalUsedMs)}</Badge>
        <Badge variant={detail?.finalizedAt ? "default" : "outline"}>
          {detail?.finalizedAt ? "finalized" : "active"}
        </Badge>
      </div>

      {taskPath ? (
        <p className="break-all font-mono text-xs text-slate-500 dark:text-slate-400">{taskPath}</p>
      ) : null}
    </div>

    <div className="flex items-center gap-2">
      {a2uiHref ? (
        <Button
          asChild
          size="sm"
          variant="outline"
        >
          <a href={a2uiHref} rel="noreferrer" target="_blank">
            <ExternalLink />
            Open A2UI
          </a>
        </Button>
      ) : null}

      <Button
        disabled={!hasStoredResult}
        onClick={onViewResult}
        size="sm"
        variant="outline"
      >
        <Eye />
        View result
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Trash2 />
            Delete
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void onSoftDelete()}>
            Soft delete
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            onClick={() => {
              const confirmed = window.confirm("Permanently delete this session?");
              if (!confirmed) return;
              void onHardDelete();
            }}
          >
            Hard delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </CardHeader>
  );
};
