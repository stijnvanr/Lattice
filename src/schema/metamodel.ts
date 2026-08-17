import type { ComponentType, ReferenceType } from "./common";

export type AllowedPair = {
  source: ComponentType[];
  target: ComponentType[];
};

export const referenceRules: Record<ReferenceType, AllowedPair> = {
  contains: {
    source: ["organization", "capability", "workflow", "process"],
    target: ["organization", "capability", "workflow", "process"],
  },
  supports: {
    source: ["application"],
    target: ["capability", "workflow"],
  },
  realizes: {
    source: ["process", "workflow"],
    target: ["capability"],
  },
  uses: {
    source: ["application"],
    target: ["application", "technology"],
  },
  depends_on: {
    source: ["application"],
    target: ["application"],
  },
  owned_by: {
    source: ["application", "process", "capability", "workflow"],
    target: ["person", "organization"],
  },
  integrates_with: {
    source: ["application"],
    target: ["application"],
  },
  runs_on: {
    source: ["application"],
    target: ["technology"],
  },
};

export const componentTypeMeta: Record<
  ComponentType,
  { label: string; plural: string; color: string; hex: string }
> = {
  organization: {
    label: "Organization",
    plural: "Organizations",
    color: "indigo",
    hex: "#6366f1",
  },
  capability: {
    label: "Capability",
    plural: "Capabilities",
    color: "violet",
    hex: "#8b5cf6",
  },
  workflow: {
    label: "Workflow",
    plural: "Workflows",
    color: "rose",
    hex: "#e11d48",
  },
  process: {
    label: "Process",
    plural: "Processes",
    color: "cyan",
    hex: "#0891b2",
  },
  application: {
    label: "Application",
    plural: "Applications",
    color: "blue",
    hex: "#2563eb",
  },
  person: {
    label: "Person",
    plural: "People",
    color: "amber",
    hex: "#d97706",
  },
  technology: {
    label: "Technology",
    plural: "Technologies",
    color: "emerald",
    hex: "#059669",
  },
  interface: {
    label: "Interface",
    plural: "Interfaces",
    color: "pink",
    hex: "#db2777",
  },
};

export const referenceTypeMeta: Record<ReferenceType, { label: string }> = {
  contains: { label: "contains" },
  supports: { label: "supports" },
  realizes: { label: "realizes" },
  uses: { label: "uses" },
  depends_on: { label: "depends on" },
  owned_by: { label: "owned by" },
  integrates_with: { label: "integrates with" },
  runs_on: { label: "runs on" },
};

export function canHaveParent(type: ComponentType) {
  return referenceRules.contains.source.includes(type);
}

export function canHaveOwner(type: ComponentType) {
  return referenceRules.owned_by.source.includes(type);
}

export function isContainsPair(sourceType: ComponentType, targetType: ComponentType) {
  return sourceType === targetType && canHaveParent(sourceType);
}

export function isReferenceAllowed(
  type: ReferenceType,
  sourceType: ComponentType,
  targetType: ComponentType,
) {
  if (type === "contains") return isContainsPair(sourceType, targetType);
  const rule = referenceRules[type];
  return rule.source.includes(sourceType) && rule.target.includes(targetType);
}

export function legalReferenceTypes(
  sourceType: ComponentType,
  targetType: ComponentType,
): ReferenceType[] {
  return (Object.keys(referenceRules) as ReferenceType[]).filter((type) =>
    isReferenceAllowed(type, sourceType, targetType),
  );
}
