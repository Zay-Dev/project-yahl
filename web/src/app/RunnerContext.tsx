import { createContext, useContext, type ReactNode } from "react";

import { useRunner } from "@/hooks/useRunner";

type RunnerContextValue = ReturnType<typeof useRunner>;

const RunnerContext = createContext<RunnerContextValue | null>(null);

export const RunnerProvider = ({ children }: { children: ReactNode }) => {
  const runner = useRunner();

  return <RunnerContext.Provider value={runner}>{children}</RunnerContext.Provider>;
};

export const useRunnerContext = () => {
  const ctx = useContext(RunnerContext);
  if (!ctx) {
    throw new Error("useRunnerContext must be used within RunnerProvider");
  }

  return ctx;
};
