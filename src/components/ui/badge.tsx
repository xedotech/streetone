import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"span"> & { tone?: "default" | "danger" | "ok" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
        tone === "default" && "bg-elevated text-muted",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "ok" && "bg-ok/15 text-ok",
        className,
      )}
      {...props}
    />
  );
}
