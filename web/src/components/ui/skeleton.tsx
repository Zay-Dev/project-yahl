import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Skeleton = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("animate-pulse rounded-md bg-slate-100 dark:bg-slate-800", className)} {...props} />
);
