import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-border bg-surface p-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "font-display text-xl font-semibold tracking-wide text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function CardDesc({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("mt-1 text-sm text-muted", className)} {...props} />;
}
