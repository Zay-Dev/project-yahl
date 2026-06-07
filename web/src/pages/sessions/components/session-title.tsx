type TSessionTitleProps = {
  sessionId: string;
  taskId?: string;
  className?: string;
};

export function SessionTitle({ className, sessionId, taskId }: TSessionTitleProps) {
  const label = taskId?.trim() || "Unknown task";

  return (
    <div className={className}>
      <p className="font-medium">{label}</p>
      <p className="font-mono text-xs text-muted-foreground">{sessionId}</p>
    </div>
  );
}
