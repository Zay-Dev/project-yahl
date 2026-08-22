import type { TResponseStageDetail } from "@project-yahl/server/modules/sessions/-api-types";

import { Button } from "@/components/ui/button";
import { useSessionRepair } from "@/pages/sessions/hooks/session-repair-context";

type TStageRepairButtonProps = {
  detail: TResponseStageDetail;
};

export function StageRepairButton({ detail }: TStageRepairButtonProps) {
  const {
    anchorStageId,
    barOpen,
    openRepairBar,
  } = useSessionRepair();

  if (detail.status !== "finished") {
    return null;
  }

  const isAnchored = barOpen && anchorStageId === detail.stageId;

  return (
    <Button
      onClick={() => {
        openRepairBar({
          requestId: detail.requestId,
          stageId: detail.stageId,
        });
      }}
      size="sm"
      type="button"
      variant={isAnchored ? "secondary" : "outline"}
    >
      Repair
    </Button>
  );
}
