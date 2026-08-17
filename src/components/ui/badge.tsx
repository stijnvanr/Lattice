import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Badge({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}

function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}
      {...props}
    />
  );
}

function Separator({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("h-px w-full bg-border", className)} {...props} />;
}

export { Badge, Card, Separator };
