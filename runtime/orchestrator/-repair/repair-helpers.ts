export const buildRepairSystemAppend = (instruction: string) => {
  const trimmed = instruction.trim();

  return [
    'The user requested a targeted repair of this stage.',
    'Follow the instruction below while keeping every other stage requirement unchanged.',
    'Use set_context to write all required context keys before finishing.',
    trimmed,
  ].filter(Boolean).join('\n\n');
};
