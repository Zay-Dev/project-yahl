export type AskUserQuestionKind = 'multipleChoice' | 'text';

export type AskUserBatchQuestionOption = {
  description?: string;
  id: string;
  label: string;
};

export type AskUserBatchQuestion = {
  allowMultiple?: boolean;
  description?: string;
  kind: AskUserQuestionKind;
  maxChoices?: number;
  minChoices?: number;
  options?: AskUserBatchQuestionOption[];
  placeholder?: string;
  questionRef: string;
  title: string;
};

export type AskUserBatchToolArguments = {
  batchId: string;
  description?: string;
  questions: AskUserBatchQuestion[];
  title: string;
  version: 'askUserBatch.v1';
};

export type AskUserBatchAnswerInput = {
  freeText?: string;
  optionIds?: string[];
  questionRef: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const parseQuestionOption = (raw: unknown): AskUserBatchQuestionOption | null => {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';

  if (!id || !label) return null;

  return {
    description: typeof raw.description === 'string' ? raw.description : undefined,
    id,
    label,
  };
};

const parseBatchQuestion = (raw: unknown): AskUserBatchQuestion | null => {
  if (!isRecord(raw)) return null;

  const questionRef = typeof raw.questionRef === 'string' ? raw.questionRef.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const kind = raw.kind === 'text' || raw.kind === 'multipleChoice' ? raw.kind : null;

  if (!questionRef || !title || !kind) return null;

  if (kind === 'text') {
    return {
      description: typeof raw.description === 'string' ? raw.description : undefined,
      kind,
      placeholder: typeof raw.placeholder === 'string' ? raw.placeholder : undefined,
      questionRef,
      title,
    };
  }

  const options = Array.isArray(raw.options)
    ? raw.options.map(parseQuestionOption).filter((item): item is AskUserBatchQuestionOption => !!item)
    : [];

  if (options.length < 2) return null;

  return {
    allowMultiple: Boolean(raw.allowMultiple),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    kind,
    maxChoices: typeof raw.maxChoices === 'number' ? raw.maxChoices : undefined,
    minChoices: typeof raw.minChoices === 'number' ? raw.minChoices : undefined,
    options,
    questionRef,
    title,
  };
};

export const parseAskUserBatchToolArguments = (
  raw: string,
): AskUserBatchToolArguments | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.version !== 'askUserBatch.v1') return null;

  const batchId = typeof parsed.batchId === 'string' ? parsed.batchId.trim() : '';
  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';

  if (!batchId || !title) return null;
  if (!Array.isArray(parsed.questions) || parsed.questions.length < 1) return null;

  const questions = parsed.questions
    .map(parseBatchQuestion)
    .filter((item): item is AskUserBatchQuestion => !!item);

  if (questions.length !== parsed.questions.length) return null;

  const refs = new Set<string>();

  for (const question of questions) {
    if (refs.has(question.questionRef)) return null;
    refs.add(question.questionRef);
  }

  return {
    batchId,
    description: typeof parsed.description === 'string' ? parsed.description : undefined,
    questions,
    title,
    version: 'askUserBatch.v1',
  };
};

export const resolveAskUserAnswerValue = (
  optionIds: string[] | undefined,
  freeText: string | undefined,
): number | string | string[] => {
  if (freeText?.trim()) {
    return freeText.trim();
  }

  const ids = optionIds ?? [];

  if (ids.length > 1) {
    return ids.map((id) => {
      if (/^-?(?:\d+|\d*\.\d+)$/.test(id)) {
        const asNumber = Number(id);
        if (Number.isFinite(asNumber)) return asNumber;
      }

      return id;
    }) as string[];
  }

  const id = ids[0] ?? '';

  if (/^-?(?:\d+|\d*\.\d+)$/.test(id)) {
    const asNumber = Number(id);
    if (Number.isFinite(asNumber)) return asNumber;
  }

  return id;
};

export const upsertAskUserEntries = (
  stage: { askUser?: { answer?: number | string | string[]; id: string; options?: AskUserBatchQuestionOption[]; question: string }[] },
  batch: AskUserBatchToolArguments,
) => {
  const byId = new Map((stage.askUser ?? []).map((entry) => [String(entry.id), entry]));

  for (const question of batch.questions) {
    byId.set(question.questionRef, {
      ...(byId.get(question.questionRef) ?? {}),
      id: question.questionRef,
      ...(question.kind === 'multipleChoice' && question.options
        ? { options: question.options }
        : {}),
      question: question.title,
    });
  }

  return {
    ...stage,
    askUser: [...byId.values()],
  };
};
