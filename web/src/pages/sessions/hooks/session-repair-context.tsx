import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type TRepairAnchor = {
  requestId: string;
  stageId: string;
};

type TSessionRepairContextValue = {
  anchorRequestId: string | null;
  anchorStageId: string | null;
  barOpen: boolean;
  barRef: RefObject<HTMLDivElement | null>;
  clearValidationError: () => void;
  closeRepairBar: () => void;
  instruction: string;
  openRepairBar: (anchor: TRepairAnchor) => void;
  scrollBarIntoView: () => void;
  setInstruction: (value: string) => void;
  setValidationError: (message: string | null) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  validationError: string | null;
};

const SessionRepairContext = createContext<TSessionRepairContextValue | null>(null);

const storageKey = (sessionId: string) => `yahl:session-repair:${sessionId}`;

const readStoredInstruction = (sessionId: string) => {
  try {
    return sessionStorage.getItem(storageKey(sessionId)) ?? "";
  } catch {
    return "";
  }
};

type TSessionRepairProviderProps = {
  children: ReactNode;
  sessionId: string;
};

export function SessionRepairProvider({ children, sessionId }: TSessionRepairProviderProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [barOpen, setBarOpen] = useState(false);
  const [anchorStageId, setAnchorStageId] = useState<string | null>(null);
  const [anchorRequestId, setAnchorRequestId] = useState<string | null>(null);
  const [instruction, setInstructionState] = useState(() => readStoredInstruction(sessionId));
  const [validationError, setValidationError] = useState<string | null>(null);

  const setInstruction = useCallback((value: string) => {
    setInstructionState(value);
    setValidationError(null);

    try {
      if (value.trim()) {
        sessionStorage.setItem(storageKey(sessionId), value);
      } else {
        sessionStorage.removeItem(storageKey(sessionId));
      }
    } catch {
      // ignore storage errors
    }
  }, [sessionId]);

  const scrollBarIntoView = useCallback(() => {
    barRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const clearValidationError = useCallback(() => {
    setValidationError(null);
  }, []);

  const closeRepairBar = useCallback(() => {
    setBarOpen(false);
    setValidationError(null);
  }, []);

  const openRepairBar = useCallback((anchor: TRepairAnchor) => {
    setAnchorStageId(anchor.stageId);
    setAnchorRequestId(anchor.requestId);
    setBarOpen(true);
    setValidationError(null);

    requestAnimationFrame(() => {
      scrollBarIntoView();
      textareaRef.current?.focus();
    });
  }, [scrollBarIntoView]);

  const value = useMemo(
    () => ({
      anchorRequestId,
      anchorStageId,
      barOpen,
      barRef,
      clearValidationError,
      closeRepairBar,
      instruction,
      openRepairBar,
      scrollBarIntoView,
      setInstruction,
      setValidationError,
      textareaRef,
      validationError,
    }),
    [
      anchorRequestId,
      anchorStageId,
      barOpen,
      clearValidationError,
      closeRepairBar,
      instruction,
      openRepairBar,
      scrollBarIntoView,
      setInstruction,
      validationError,
    ],
  );

  return (
    <SessionRepairContext.Provider value={value}>
      {children}
    </SessionRepairContext.Provider>
  );
};

export const useSessionRepair = () => {
  const context = useContext(SessionRepairContext);

  if (!context) {
    throw new Error("useSessionRepair must be used within SessionRepairProvider");
  }

  return context;
};
