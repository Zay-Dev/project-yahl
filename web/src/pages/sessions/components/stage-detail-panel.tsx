import type { TResponseStageDetail, TResponseStageModelResponseItem } from "@project-yahl/server/modules/sessions/-api-types";
import type { TParsedStage } from "@project-yahl/server/modules/sessions/-types";

import { StageContextCompare } from "@/pages/sessions/components/stage-context-compare";
import { StageRepairButton } from "@/pages/sessions/components/stage-repair-button";
import { StageRerunDialog } from "@/pages/sessions/components/stage-rerun-dialog";
import { StageLoopMeta } from "@/pages/sessions/components/stage-loop-meta";
import { StageModelResponseCard } from "@/pages/sessions/components/stage-model-response-card";
import { StageSetupJsonSheet } from "@/pages/sessions/components/stage-setup-json-sheet";

import { groupModelResponsesByNixery } from "@/pages/sessions/lib/group-model-responses";

type TStageDetailPanelProps = {
  baselineAfter?: Record<string, unknown>;
  detail: TResponseStageDetail;
  originalStages: TParsedStage[];
  sessionId: string;
};

const ModelResponseList = ({
  responses,
}: {
  responses: TResponseStageModelResponseItem[];
}) => (
  <ul className="mt-2 space-y-2">
    {responses.map((response) => (
      <StageModelResponseCard key={response._id} response={response} />
    ))}
  </ul>
);

export function StageDetailPanel({
  baselineAfter,
  detail,
  originalStages,
  sessionId,
}: TStageDetailPanelProps) {
  const sections = groupModelResponsesByNixery(detail.modelResponses);

  return (
    <div className="min-w-0 space-y-4 overflow-hidden border-t bg-background/60 px-4 py-4 text-sm">
      <div className="flex justify-end gap-2">
        <StageRepairButton detail={detail} />
        <StageRerunDialog
          detail={detail}
          originalStages={originalStages}
          sessionId={sessionId}
        />
      </div>
      {detail.loopMeta ? <StageLoopMeta loopMeta={detail.loopMeta} /> : null}
      {detail.agentMeta ? (
        <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {detail.agentMeta.isSubAgent
            ? "Sub-agent (isolated chat history)"
            : "Main thread (chat merges into parent)"}
          {detail.agentMeta.nestedPath
            ? ` · ${detail.agentMeta.nestedPath}`
            : null}
          {detail.agentMeta.parentRequestId
            ? ` · parent ${detail.agentMeta.parentRequestId}`
            : null}
        </div>
      ) : null}
      <StageContextCompare
        after={detail.contextAfter}
        baselineAfter={baselineAfter}
        before={detail.context}
        stage={detail.stage}
      />
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {detail.loopMeta?.kind === "warmup" ? "Warm-up logic" : "Stage logic"}
          </p>
          <StageSetupJsonSheet stage={detail.stage} />
        </div>
        <pre className="mt-1 max-h-96 overflow-auto rounded-md border bg-background p-2 text-xs whitespace-pre-wrap">
          {typeof detail.stage.logic === "string"
            ? detail.stage.logic
            : JSON.stringify(detail.stage.logic, null, 2)}
        </pre>
      </div>
      {sections.length > 0 ? (
        <div className="space-y-4">
          {sections.map((section) => {
            const firstId = section.responses[0]?._id ?? "";
            const key = section.kind === "nixery"
              ? `nixery:${section.defId}:${firstId}`
              : `agent:${firstId}`;
            const label = section.kind === "nixery"
              ? `nixery:${section.defId}`
              : "Model responses";

            return (
              <div key={key}>
                <p className="text-xs font-medium text-muted-foreground">
                  {label}
                </p>
                <ModelResponseList responses={section.responses} />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
