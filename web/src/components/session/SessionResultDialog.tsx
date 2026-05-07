import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { stringifyValue } from "@/lib/format";
import type { SessionDetail } from "@/types";

type Props = {
  detail: SessionDetail | null;
  onClose: () => void;
  open: boolean;
};

export const SessionResultDialog = ({ detail, onClose, open }: Props) => (
  <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
    <DialogContent className="flex max-h-[90vh] w-full flex-col gap-4 sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Session result</DialogTitle>
        {detail?.sessionId ? (
          <DialogDescription className="font-mono text-xs">{detail.sessionId}</DialogDescription>
        ) : null}
      </DialogHeader>

      <div className="grid max-h-[70vh] gap-3 overflow-auto">
        <pre className="rounded-md border p-3 text-xs">
          {stringifyValue((detail?.result as { raw?: unknown; ui?: unknown } | undefined)?.raw ?? detail?.result)}
        </pre>

        {(detail?.result as { ui?: unknown } | undefined)?.ui !== undefined ? (
          <pre className="rounded-md border p-3 text-xs">
            {stringifyValue((detail?.result as { ui?: unknown }).ui)}
          </pre>
        ) : null}
      </div>
    </DialogContent>
  </Dialog>
);
