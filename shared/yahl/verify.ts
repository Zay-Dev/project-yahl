export const DEFAULT_VERIFY_DEF_ID = 'stage-verify';

export type TYahlVerifySpec = {
  autoRetry?: boolean;
  defId: string;
  minScore?: number;
  resume?: boolean;
  rubric?: string;
};
