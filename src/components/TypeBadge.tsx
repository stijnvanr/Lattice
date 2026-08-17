import { componentTypeMeta, type ComponentType } from "@/schema";
import { cn } from "@/lib/utils";

export function TypeDot({ type, className }: { type: ComponentType; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 rounded-full", className)}
      style={{ background: componentTypeMeta[type].hex }}
    />
  );
}

export function TypeBadge({ type }: { type: ComponentType }) {
  const meta = componentTypeMeta[type];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium">
      <TypeDot type={type} />
      {meta.label}
    </span>
  );
}
