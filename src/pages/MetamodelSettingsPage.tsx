import { TypeBadge } from "@/components/TypeBadge";
import {
  componentTypeMeta,
  componentTypeSchema,
  METAMODEL_ID,
  referenceRules,
  referenceTypeMeta,
  type ComponentType,
  type ReferenceType,
} from "@/schema";

const componentTypes = componentTypeSchema.options;
const referenceTypes = Object.keys(referenceRules) as ReferenceType[];

function typeLabels(types: ComponentType[]) {
  return types.map((type) => componentTypeMeta[type].label).join(", ");
}

export function MetamodelSettingsPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Metamodel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Current model: <span className="font-medium text-foreground">{METAMODEL_ID}</span>
          </p>
        </div>

        <section>
          <div className="mb-3">
            <h2 className="font-semibold">Component types</h2>
            <p className="text-sm text-muted-foreground">The objects available in every workspace.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {componentTypes.map((type) => (
              <div key={type} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3">
                <TypeBadge type={type} />
                <span className="text-sm text-muted-foreground">{componentTypeMeta[type].plural}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="font-semibold">Reference types</h2>
            <p className="text-sm text-muted-foreground">The relationships that can connect components.</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[minmax(9rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              <span>Reference</span>
              <span>Source types</span>
              <span>Target types</span>
            </div>
            {referenceTypes.map((type) => {
              const rule = referenceRules[type];
              const isContains = type === "contains";
              return (
                <div
                  key={type}
                  className="grid grid-cols-[minmax(9rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0"
                >
                  <span className="font-medium">{referenceTypeMeta[type].label}</span>
                  <span className="text-muted-foreground">{typeLabels(rule.source)}</span>
                  <span className="text-muted-foreground">
                    {isContains ? "Same type only" : typeLabels(rule.target)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Contains is limited to same-type pairs of Organization, Capability, Workflow, and Process.
          </p>
        </section>
      </div>
    </div>
  );
}