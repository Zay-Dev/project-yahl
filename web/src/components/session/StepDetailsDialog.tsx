import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EMPTY_VALUE,
  JSON_SPACING,
  formatCost,
  formatNumber,
  stringifyValue,
} from "@/lib/format";
import {
  getContextAfterForDisplay,
  getContextBeforeForDisplay,
  getStageChatDisplay,
  getCurrentStageDisplay,
  getInputTokens,
  getRequestGlobalStage,
  isLoopStep,
  type SessionEventGroup,
} from "@/lib/session-events";
import { cn } from "@/lib/utils";
import type { SessionStepEvent } from "@/types";

type Props = {
  groupedEvents: SessionEventGroup[];
  modalStep: { event: SessionStepEvent; index: number } | null;
  onClose: () => void;
  onNavigate: (event: SessionStepEvent, index: number) => void;
  onOpenRerun: () => void;
};

export const StepDetailsDialog = ({
  groupedEvents,
  modalStep,
  onClose,
  onNavigate,
  onOpenRerun,
}: Props) => {
  if (!modalStep) return null;

  const requestId = modalStep.event.requestId;
  const requestRows = groupedEvents.find(([id]) => id === requestId)?.[1] ?? [];
  const requestIndex = groupedEvents.findIndex(([id]) => id === requestId);
  const canPrev = requestIndex > 0;
  const canNext = requestIndex >= 0 && requestIndex < groupedEvents.length - 1;

  const globalStage = getRequestGlobalStage(requestRows);
  const globalStageEvent = globalStage?.event ?? modalStep.event;
  const globalStageIndex = globalStage?.index ?? modalStep.index;

  const goRequest = (delta: number) => {
    const target = groupedEvents[requestIndex + delta];
    if (!target) return;
    const firstRow = target[1][0];
    if (!firstRow) return;
    onNavigate(firstRow.event, firstRow.index);
  };

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open>
      <DialogContent
        className={cn(
          "flex max-h-[95vh] w-[90vw] max-w-[90vw] flex-col gap-0 p-0 sm:max-w-[90vw]",
        )}
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-start justify-between gap-2 border-b p-4">
          <div className="space-y-1">
            <DialogTitle>Step full details</DialogTitle>
            <DialogDescription>
              Session {modalStep.event.sessionId} · Step #{modalStep.index}
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button disabled={!canPrev} onClick={() => goRequest(-1)} size="sm" variant="outline">
              <ChevronLeft />
              Prev
            </Button>
            <Button disabled={!canNext} onClick={() => goRequest(1)} size="sm" variant="outline">
              Next
              <ChevronRight />
            </Button>
            <Button onClick={onClose} size="sm" variant="outline">
              Close
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>request: {requestId}</Badge>
            <Badge variant="secondary">steps: {formatNumber(requestRows.length || 1)}</Badge>
            <Badge variant="outline">session: {modalStep.event.sessionId}</Badge>

            <Button onClick={onOpenRerun} size="sm" variant="outline">
              <RotateCcw />
              Rerun from here
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Context before (request-global anchor)</CardTitle>
                <CardDescription className="text-xs">
                  source step #{globalStageIndex}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-72 overflow-auto rounded border p-2 text-xs">
                  {stringifyValue(getContextBeforeForDisplay(globalStageEvent))}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Execution metadata (request-global)</CardTitle>
                <CardDescription className="text-xs">
                  source step #{globalStageIndex}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-72 overflow-auto rounded border p-2 text-xs">
                  {stringifyValue(globalStageEvent.executionMeta)}
                </pre>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Context after (request-global anchor)</CardTitle>
              <CardDescription className="text-xs">
                source step #{globalStageIndex}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-72 overflow-auto rounded border p-2 text-xs">
                {stringifyValue(getContextAfterForDisplay(globalStageEvent))}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span>Current stage (request-global)</span>
                <Badge variant={isLoopStep(globalStageEvent) ? "default" : "outline"}>
                  {isLoopStep(globalStageEvent) ? "loop" : "non-loop"}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                source step #{globalStageIndex} · full text
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="max-h-[min(70vh,48rem)] overflow-auto rounded border p-3 font-mono text-xs whitespace-pre-wrap">
                {getCurrentStageDisplay(globalStageEvent)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Request steps</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion
                className="w-full"
                defaultValue={requestRows.map(({ index }) => `step-${index}`)}
                type="multiple"
              >
                {requestRows.map(({ event, index }) => (
                  <AccordionItem key={`${event.requestId}-${index}`} value={`step-${index}`}>
                    <AccordionTrigger className="my-1 rounded-md bg-slate-900 px-3 text-xs text-slate-50 no-underline hover:no-underline dark:bg-slate-100 dark:text-slate-900">
                      <div className="flex w-full items-center justify-between gap-2 pr-2">
                        <span className="font-mono">Step #{index}</span>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-white/10 text-current" variant="outline">{event.model}</Badge>
                          <Badge className="bg-white/20 text-current" variant="secondary">
                            {typeof event.response?.durationMs === "number"
                              ? `${formatNumber(event.response.durationMs)}ms`
                              : EMPTY_VALUE}
                          </Badge>
                          <Badge className="bg-white/20 text-current" variant="secondary">
                            {formatCost(event.cost ?? 0)}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Step details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs">
                              <p><span className="font-medium">Request ID:</span> {event.requestId}</p>
                              <p><span className="font-medium">Session ID:</span> {event.sessionId}</p>
                              <p><span className="font-medium">Timestamp:</span> {event.timestamp || EMPTY_VALUE}</p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Model and timing</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs">
                              <p><span className="font-medium">Model:</span> {event.model}</p>
                              <p>
                                <span className="font-medium">Duration:</span>{" "}
                                {typeof event.response?.durationMs === "number"
                                  ? `${formatNumber(event.response.durationMs)}ms`
                                  : EMPTY_VALUE}
                              </p>
                              <p><span className="font-medium">Cost:</span> {formatCost(event.cost ?? 0)}</p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Usage flags</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs">
                              <p><span className="font-medium">Thinking mode:</span> {event.thinkingMode ? "true" : "false"}</p>
                              <p><span className="font-medium">Has execution meta:</span> {event.executionMeta ? "true" : "false"}</p>
                            </CardContent>
                          </Card>
                        </div>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Current stage (this step)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="max-h-96 overflow-auto rounded border p-3 font-mono text-xs whitespace-pre-wrap">
                              {getCurrentStageDisplay(event)}
                            </p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Stage chat transcript (this step)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="max-h-96 overflow-auto rounded border p-3 font-mono text-xs whitespace-pre-wrap">
                              {getStageChatDisplay(event)}
                            </p>
                          </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Context before (this step)</CardTitle>
                              <CardDescription className="text-xs">
                                {event.contextBeforeTruncated
                                  ? "Truncated at source"
                                  : "As stored"}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <pre className="max-h-72 overflow-auto rounded border p-2 text-xs">
                                {stringifyValue(getContextBeforeForDisplay(event))}
                              </pre>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Context after (this step)</CardTitle>
                              <CardDescription className="text-xs">
                                {event.contextAfterTruncated ? "Truncated at source" : "As stored"}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <pre className="max-h-72 overflow-auto rounded border p-2 text-xs">
                                {stringifyValue(getContextAfterForDisplay(event))}
                              </pre>
                            </CardContent>
                          </Card>
                        </div>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Token usage breakdown</CardTitle>
                          </CardHeader>
                          <CardContent className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                            <Badge className="justify-center" variant="secondary">
                              cache hit: {formatNumber(event.usage.cacheHitTokens)}
                            </Badge>
                            <Badge className="justify-center" variant="secondary">
                              cache miss: {formatNumber(event.usage.cacheMissTokens)}
                            </Badge>
                            <Badge className="justify-center" variant="secondary">
                              completion: {formatNumber(event.usage.completionTokens)}
                            </Badge>
                            <Badge className="justify-center" variant="secondary">
                              reasoning: {formatNumber(event.usage.reasoningTokens)}
                            </Badge>
                            <Badge className="justify-center" variant="outline">
                              input total: {formatNumber(getInputTokens(event))}
                            </Badge>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Response payload</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-xs">
                            <div className="space-y-1">
                              <p className="font-medium">Reply</p>
                              <p className="max-h-72 overflow-auto rounded border p-2 font-mono text-xs whitespace-pre-wrap">
                                {stringifyValue(event.response?.reply)}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium">Reasoning</p>
                              <p className="max-h-72 overflow-auto rounded border p-2 font-mono text-xs whitespace-pre-wrap">
                                {stringifyValue(event.response?.reasoning)}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium">Tool calls</p>
                              <pre className="max-h-72 overflow-auto rounded border p-2 text-xs">
                                {stringifyValue(event.response?.toolCalls)}
                              </pre>
                            </div>
                          </CardContent>
                        </Card>

                        <details className="rounded-md border">
                          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">
                            Raw event JSON
                          </summary>
                          <div className="p-3 pt-0">
                            <pre className="max-h-[40vh] overflow-auto rounded border p-2 text-xs">
                              {JSON.stringify(event, null, JSON_SPACING)}
                            </pre>
                          </div>
                        </details>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
