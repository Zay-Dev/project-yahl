import type { ParsedStage } from './orchestrator-types';

type SessionStagesResponse = {
  stages: ParsedStage[];
  events: {
    contextAfter?: ForkrunFormResponse['requestSnapshotOverride']['context'];
    executionMeta?: {
      stageIndex: number;
      loopRef: {
        arraySnapshot: unknown[];
        index: number;
        value: unknown;
      };
    };
    requestId: string;
  }[];
};

type ForkrunFormResponse = {
  requestSnapshotOverride: {
    context: {
      context: Record<string, unknown>;
      stage: Record<string, unknown>;
      types: Record<string, unknown>;
    };
    currentStage: string;
  };
  sourceRequestId: string;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const resolveBaseUrl = () => normalizeBaseUrl(process.env.SESSION_API_BASE_URL || "http://localhost:4000");

const fetchSessionStages = async (sessionId: string) => {
  const baseUrl = resolveBaseUrl();
  const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch source session: ${response.status}`);
  }

  return await response.json() as SessionStagesResponse;
};

const fetchForkrunForm = async (forkrunFormId: string) => {
  const baseUrl = resolveBaseUrl();
  const url = `${baseUrl}/api/forkrun-forms/${encodeURIComponent(forkrunFormId)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch forkrun form: ${response.status}`);
  }

  return await response.json() as ForkrunFormResponse;
};

class ForkRunManager {
  private readonly _allEvents: SessionStagesResponse['events'];
  private readonly _forkMeta: NonNullable<SessionStagesResponse['events'][number]['executionMeta']>;

  private readonly _forkForm: ForkrunFormResponse['requestSnapshotOverride'];

  constructor(
    private readonly _sessionId: string,
    private readonly _savedSession: SessionStagesResponse,
    _forkrunForm: ForkrunFormResponse,
  ) {
    this._allEvents = _savedSession.events;
    this._forkMeta = _savedSession.events.find(event =>
      event.requestId === _forkrunForm.sourceRequestId)?.executionMeta!;

    this._forkForm = _forkrunForm.requestSnapshotOverride;

    if (!this._forkMeta) {
      throw new Error("Fork meta not found");
    }
  }

  get reportPath() {
    return `session-stages://${this._sessionId || "unknown"}`;
  }

  get aiLogic() {
    return `\`\`\`ai.logic\n${this._savedSession.stages.map((stage) => stage.lines).join("\n\n")}\n\`\`\``;
  }

  getOverride(stageIndex: number, iterationIndex?: number) {
    return stageIndex === this._forkMeta.stageIndex &&
      (
        iterationIndex === undefined ||
        iterationIndex === this._forkMeta.loopRef.index
      ) ? this._forkForm : undefined;
  }

  isFastForward(stageIndex: number, iterationIndex?: number) {
    if (stageIndex < this._forkMeta.stageIndex) {
      return true;
    }

    if (stageIndex > this._forkMeta.stageIndex) {
      return false;
    }

    return iterationIndex === undefined ||
      iterationIndex < this._forkMeta.loopRef.index;
  }

  getContextAfter(stageIndex: number, iterationIndex?: number) {
    return this._allEvents
      .find(event => {
        return event.executionMeta?.stageIndex === stageIndex &&
          (
            iterationIndex === undefined ||
            iterationIndex === event.executionMeta.loopRef.index
          );
      })
      ?.contextAfter;
  }
}

export const initForkRunManager = async (sessionId: string, forkrunFormId: string) => {
  if (!forkrunFormId.trim()) {
    throw new Error("Missing forkrun form id");
  }

  const [savedSession, forkrunForm] = await Promise.all([
    fetchSessionStages(sessionId),
    fetchForkrunForm(forkrunFormId),
  ]);

  return new ForkRunManager(sessionId, savedSession, forkrunForm);
};