export const APPLY_PLAN_OPS = [
  'merge',
  'replace_section',
  'append_raw',
  'discard',
  'todo',
  'transfer',
] as const;

export type TApplyPlanOpKind = (typeof APPLY_PLAN_OPS)[number];

export type TApplyPlanOp = {
  claim?: string;
  content?: string;
  example?: string;
  evidence?: Record<string, unknown>;
  mode?: 'append' | 'create' | 'replace';
  observationIds?: string[];
  op: TApplyPlanOpKind;
  page?: string;
  rationale?: string;
  section?: string;
  targetTopic?: string;
};

export type TApplyPlan = {
  ops: TApplyPlanOp[];
  topic: string;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

export const validateApplyPlan = (
  value: unknown,
  expectedTopic?: string,
): { ok: true; plan: TApplyPlan } | { ok: false; error: string } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'apply plan must be an object' };
  }

  const raw = value as Record<string, unknown>;
  const topic = asNonEmptyString(raw.topic) ?? expectedTopic?.trim() ?? null;

  if (!topic) {
    return { ok: false, error: 'topic is required' };
  }

  if (!Array.isArray(raw.ops)) {
    return { ok: false, error: 'ops must be an array' };
  }

  const ops: TApplyPlanOp[] = [];

  for (const item of raw.ops) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: 'each op must be an object' };
    }

    const row = item as Record<string, unknown>;
    const op = asNonEmptyString(row.op);

    if (!op || !(APPLY_PLAN_OPS as readonly string[]).includes(op)) {
      return { ok: false, error: `op must be one of ${APPLY_PLAN_OPS.join('|')}` };
    }

    const modeRaw = asNonEmptyString(row.mode);
    const mode = modeRaw === 'append' || modeRaw === 'create' || modeRaw === 'replace'
      ? modeRaw
      : undefined;

    if (op === 'transfer') {
      const targetTopic = asNonEmptyString(row.targetTopic);
      const claim = asNonEmptyString(row.claim);
      const rationale = asNonEmptyString(row.rationale);

      if (!targetTopic || targetTopic === topic) {
        return { ok: false, error: 'transfer requires different targetTopic' };
      }

      if (!claim || !rationale) {
        return { ok: false, error: 'transfer requires claim and rationale' };
      }
    }

    if (op === 'discard') {
      ops.push({
        op: 'discard',
        observationIds: Array.isArray(row.observationIds)
          ? row.observationIds.filter((id): id is string => typeof id === 'string')
          : undefined,
        rationale: asNonEmptyString(row.rationale) ?? undefined,
      });
      continue;
    }

    ops.push({
      claim: asNonEmptyString(row.claim) ?? undefined,
      content: asNonEmptyString(row.content) ?? undefined,
      example: asNonEmptyString(row.example) ?? undefined,
      evidence: row.evidence && typeof row.evidence === 'object' && !Array.isArray(row.evidence)
        ? row.evidence as Record<string, unknown>
        : undefined,
      mode,
      observationIds: Array.isArray(row.observationIds)
        ? row.observationIds.filter((id): id is string => typeof id === 'string')
        : undefined,
      op: op as TApplyPlanOpKind,
      page: asNonEmptyString(row.page) ?? undefined,
      rationale: asNonEmptyString(row.rationale) ?? undefined,
      section: asNonEmptyString(row.section) ?? undefined,
      targetTopic: asNonEmptyString(row.targetTopic) ?? undefined,
    });
  }

  return { ok: true, plan: { ops, topic } };
};

export const formatObservationApplyBody = (params: {
  claim: string;
  cue?: string;
  example?: string;
  quote?: string;
}): string => {
  const lines = [
    params.cue ? `### ${params.cue}` : null,
    '',
    params.claim.trim(),
  ].filter((line): line is string => line !== null);

  if (params.example?.trim()) {
    lines.push('', 'Example:', '', params.example.trim());
  }

  if (params.quote?.trim()) {
    lines.push('', 'Quote:', '', params.quote.trim());
  }

  return `${lines.join('\n').trim()}\n`;
};
