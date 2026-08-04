export const resolveAgentExecuteOptions = (input: {
  instruction: string;
  maxSteps: number;
  preferScreenshot?: boolean;
}) => ({
  instruction: input.instruction,
  maxSteps: input.maxSteps,
  ...(input.preferScreenshot === true ? {} : { excludeTools: ["screenshot"] }),
});
