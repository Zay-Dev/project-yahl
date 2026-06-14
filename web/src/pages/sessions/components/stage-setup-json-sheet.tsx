import type { TYahlStage } from "@project-yahl/server/modules/sessions/-types";

import { Button } from "@/components/ui/button";
import { SESSION_SHEET_WIDTH } from "@/pages/sessions/lib/session-sheet";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type TStageSetupJsonSheetProps = {
  stage: TYahlStage;
};

export function StageSetupJsonSheet({ stage }: TStageSetupJsonSheetProps) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button size="sm" type="button" variant="outline">
            Stage setup
          </Button>
        }
      />
      <SheetContent className={SESSION_SHEET_WIDTH} side="right">
        <SheetHeader>
          <SheetTitle>Stage setup</SheetTitle>
        </SheetHeader>
        <pre className="overflow-auto px-6 pb-6 text-xs">
          {JSON.stringify(stage, null, 2)}
        </pre>
      </SheetContent>
    </Sheet>
  );
}
