import type { HTMLAttributes } from "react";

import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "border-transparent bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900",
        outline: "border-slate-200 text-slate-900 dark:border-slate-800 dark:text-slate-100",
        secondary: "border-transparent bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
      },
    },
  },
);

export const Badge = ({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "outline" | "secondary" }) => (
  <div className={cn(badgeVariants({ variant }), className)} {...props} />
);
