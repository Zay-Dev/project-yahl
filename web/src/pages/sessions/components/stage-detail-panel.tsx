import type {
  TResponseStageDetail,
  TResponseStageListItem,
} from "@project-yahl/server/modules/sessions/-api-types";

import { StageContextCompare } from "@/pages/sessions/components/stage-context-compare";
import { StageRerunDialog } from "@/pages/sessions/components/stage-rerun-dialog";
import { StageLoopMeta } from "@/pages/sessions/components/stage-loop-meta";
import { StageModelResponseCard } from "@/pages/sessions/components/stage-model-response-card";
import { StageSetupJsonSheet } from "@/pages/sessions/components/stage-setup-json-sheet";
import { ToolCallList } from "@/pages/sessions/components/tool-calls/tool-call-list";

type TStageDetailPanelProps = {
  baselineAfter?: Record<string, unknown>;
  detail: TResponseStageDetail;
  sessionId: string;
  stages: TResponseStageListItem[];
};

export function StageDetailPanel({
  baselineAfter,
  detail,
  sessionId,
  stages,
}: TStageDetailPanelProps) {
  return (
    <div className="space-y-4 border-t bg-background/60 px-4 py-4 text-sm">
      <div className="flex justify-end">
        <StageRerunDialog detail={detail} sessionId={sessionId} stages={stages} />
      </div>
      {detail.loopMeta ? <StageLoopMeta loopMeta={detail.loopMeta} /> : null}
      <StageContextCompare
        after={detail.contextAfter}
        baselineAfter={baselineAfter}
        before={detail.context}
        stage={detail.stage}
      />
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Stage logic</p>
          <StageSetupJsonSheet stage={detail.stage} />
        </div>
        <pre className="mt-1 max-h-96 overflow-auto rounded-md border bg-background p-2 text-xs whitespace-pre-wrap">
          {detail.stage.logic}
        </pre>
      </div>
      {detail.modelResponses.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Model responses</p>
          <ul className="mt-2 space-y-2">
            {detail.modelResponses.map((response) => (
              <StageModelResponseCard key={response._id} response={response} />
            ))}
          </ul>
        </div>
      ) : null}
      <ToolCallList toolCalls={detail.toolCalls} />
    </div>
  );
}
