import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  copyVncAddress,
  formatVncDeeplink,
  VNC_CLIENT_OPTIONS,
} from '@/pages/sessions/lib/vnc-clients';

type TSessionLiveViewMenuProps = {
  port: number;
};

export function SessionLiveViewMenu({ port }: TSessionLiveViewMenuProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (optionId: string) => {
    await copyVncAddress(port);
    setCopiedId(optionId);
    window.setTimeout(() => {
      setCopiedId((current) => (current === optionId ? null : current));
    }, 2_000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm" variant="outline" />
        }
      >
        Live view
        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums">
          {port}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Connect VNC</DropdownMenuLabel>
          {VNC_CLIENT_OPTIONS.map((option) => (
            <DropdownMenuItem
              className={option.hint ? 'flex-col items-start gap-1' : undefined}
              key={option.id}
              onClick={() => {
                if (option.action === 'deeplink') {
                  window.location.href = formatVncDeeplink(port);
                  return;
                }

                void handleCopy(option.id);
              }}
            >
              <span className="flex w-full items-center gap-2">
                <span>{option.label}</span>
                {option.action === 'copy' && copiedId === option.id ? (
                  <span className="ml-auto text-xs text-muted-foreground">Copied</span>
                ) : null}
              </span>
              {option.hint && copiedId !== option.id ? (
                <span className="text-xs text-muted-foreground">{option.hint}</span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
