export const INLINE_VALUE_CHARS = 8_000;

export const TOOL_OUTPUT_CHARS = 12_000;

export const REBUTTAL_KEYS = [
  'verify_failed_checks',
  'verify_rebuttal',
  'verify_rebuttal_count',
];

export const jsonBytes = (value) => {
  const text = JSON.stringify(value);

  if (typeof text !== 'string') {
    return 0;
  }

  return Buffer.byteLength(text, 'utf8');
};

export const clipText = (text, maxChars) => {
  if (typeof text !== 'string') {
    return { text: '', truncated: false };
  }

  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  return {
    text: `${text.slice(0, maxChars)}\n...[truncated]`,
    truncated: true,
  };
};

export const clipJsonValue = (value, maxChars = INLINE_VALUE_CHARS) => {
  const text = JSON.stringify(value) ?? 'null';

  return clipText(text, maxChars);
};

export const resolveSnapshotBuckets = (snapshot) => {
  const context = snapshot?.context && typeof snapshot.context === 'object'
    && !Array.isArray(snapshot.context)
    ? snapshot.context
    : {};
  const types = snapshot?.types && typeof snapshot.types === 'object'
    && !Array.isArray(snapshot.types)
    ? snapshot.types
    : {};

  return { context, types };
};

export const buildKeyCatalog = (record) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return [];
  }

  return Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => ({
      bytes: jsonBytes(record[key]),
      key,
    }));
};

export const pickInlineProduceValues = (
  context,
  produceContextKeys,
  maxChars = INLINE_VALUE_CHARS,
) => {
  const inline = {};
  const omitted = [];
  const keys = Array.isArray(produceContextKeys) ? produceContextKeys : [];

  for (const key of keys) {
    if (typeof key !== 'string' || !key.trim()) {
      continue;
    }

    if (!Object.hasOwn(context, key)) {
      continue;
    }

    const text = JSON.stringify(context[key]) ?? 'null';

    if (text.length <= maxChars) {
      inline[key] = context[key];
      continue;
    }

    omitted.push(key);
  }

  return { inline, omitted };
};

export const formatStageSnapshotBlock = (stageSnapshot, maxChars = INLINE_VALUE_CHARS) => {
  if (!stageSnapshot || typeof stageSnapshot !== 'object') {
    return '';
  }

  const clipped = clipJsonValue(stageSnapshot, maxChars);

  return `## Stage snapshot\n${clipped.text}`;
};

export const formatRebuttalBlock = (context, maxChars = INLINE_VALUE_CHARS) => {
  const record = context && typeof context === 'object' ? context : {};
  const present = REBUTTAL_KEYS.filter((key) => Object.hasOwn(record, key));

  if (present.length === 0) {
    return '';
  }

  const lines = ['## Prior verify fail / agent rebuttal'];

  for (const key of present) {
    const clipped = clipJsonValue(record[key], maxChars);

    if (clipped.truncated) {
      lines.push(`${key}: too large (${jsonBytes(record[key])} bytes) — read_context_key`);
      continue;
    }

    lines.push(`${key}: ${clipped.text}`);
  }

  return lines.join('\n');
};

export const buildVerifyUserMessage = (params) => {
  const context = params.context ?? {};
  const types = params.types ?? {};
  const produceKeys = params.stageSnapshot?.produceContextKeys;
  const { inline, omitted } = pickInlineProduceValues(
    context,
    produceKeys,
    params.maxChars ?? INLINE_VALUE_CHARS,
  );
  const sections = [
    '## Rubric\n',
    params.rubricText,
    formatStageSnapshotBlock(params.stageSnapshot, params.maxChars ?? INLINE_VALUE_CHARS),
    `## Context key catalog\n${JSON.stringify(buildKeyCatalog(context))}`,
    `## Type key catalog\n${JSON.stringify(buildKeyCatalog(types))}`,
  ];

  if (Object.keys(inline).length > 0) {
    sections.push(`## Produce context (inline)\n${JSON.stringify(inline)}`);
  }

  if (omitted.length > 0) {
    sections.push(
      `## Produce context omitted (too large; use read_context_key)\n${JSON.stringify(omitted)}`,
    );
  }

  const rebuttal = formatRebuttalBlock(context, params.maxChars ?? INLINE_VALUE_CHARS);

  if (rebuttal) {
    sections.push(rebuttal);
  }

  return sections.filter(Boolean).join('\n\n');
};
