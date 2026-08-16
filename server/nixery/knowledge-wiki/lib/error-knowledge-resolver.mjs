export const INVESTIGATE_MESSAGE = 'No known solution was found. Investigate and verify a working solution, then submit a separate HOWTO/TRICK observation.';

const normalizeCitations = (value, excludedPath) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((citation) =>
      citation
      && typeof citation === 'object'
      && !Array.isArray(citation)
      && typeof citation.path === 'string'
      && citation.path.trim()
      && typeof citation.excerpt === 'string'
      && citation.excerpt.trim())
    .map((citation) => ({
      path: citation.path.trim(),
      excerpt: citation.excerpt.trim().slice(0, 1_500),
    }))
    .filter((citation) =>
      citation.path !== excludedPath
      && !citation.path.endsWith(`/${excludedPath}`))
    .slice(0, 5);
};

export const normalizeKnowledgeLookup = (value, excludedPath) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('lookup result must be a JSON object');
  }

  const citations = normalizeCitations(value.citations, excludedPath);
  const solution = typeof value.solution === 'string' ? value.solution.trim() : '';

  if (value.status === 'found') {
    if (!solution || citations.length === 0) {
      throw new Error('found lookup requires a solution and at least one citation');
    }

    return {
      status: 'found',
      solution,
      citations,
      message: 'Apply and verify the cited solution. If it succeeds, submit a separate HOWTO/TRICK observation.',
    };
  }

  if (value.status === 'not_found') {
    return {
      status: 'not_found',
      solution: null,
      citations: [],
      message: INVESTIGATE_MESSAGE,
    };
  }

  throw new Error('lookup status must be found or not_found');
};

export const resolveErrorWithKnowledge = async (params) => {
  const normalized = params.buildObservationInput(params.input);
  const validated = params.validateKnowledgeObservation(normalized);

  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const incidentId = params.resolveObservationIncidentId(
    params.input,
    validated.observation,
  );
  let submission;

  try {
    submission = await params.submitKnowledgeObservation({
      incidentId,
      input: params.input,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (!submission.gate.ok) {
    return submission.gate;
  }

  try {
    const lookup = normalizeKnowledgeLookup(
      await params.lookupKnowledge({
        incidentId,
        observation: validated.observation,
        observationGate: submission.gate,
      }),
      submission.gate.path,
    );

    return {
      ok: true,
      observation: submission.gate,
      ...lookup,
    };
  } catch (error) {
    return {
      ok: true,
      status: 'unavailable',
      solution: null,
      citations: [],
      message: INVESTIGATE_MESSAGE,
      lookupError: error instanceof Error ? error.message : String(error),
      observation: submission.gate,
    };
  }
};
