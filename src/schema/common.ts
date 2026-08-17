import { z } from "zod";

export const SCHEMA_VERSION = "1.0.0" as const;
export const METAMODEL_ID = "starter-v1" as const;

export const statusSchema = z.enum(["draft", "active", "deprecated"]);
export type Status = z.infer<typeof statusSchema>;

export const componentTypeSchema = z.enum([
  "organization",
  "capability",
  "workflow",
  "process",
  "application",
  "person",
  "technology",
  "interface",
]);
export type ComponentType = z.infer<typeof componentTypeSchema>;

export const referenceTypeSchema = z.enum([
  "contains",
  "supports",
  "realizes",
  "uses",
  "depends_on",
  "owned_by",
  "integrates_with",
  "runs_on",
]);
export type ReferenceType = z.infer<typeof referenceTypeSchema>;

export const lifecycleSchema = z.enum(["plan", "active", "sunset", "retired"]);
export type Lifecycle = z.infer<typeof lifecycleSchema>;

export const criticalitySchema = z.enum(["low", "medium", "high", "critical"]);
export type Criticality = z.infer<typeof criticalitySchema>;

export const capabilityLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type CapabilityLevel = z.infer<typeof capabilityLevelSchema>;

export const isoDateSchema = z.string().min(1);
export const idSchema = z.string().min(1);
export const tagsSchema = z.array(z.string());
