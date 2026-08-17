import { z } from "zod";
import {
  capabilityLevelSchema,
  criticalitySchema,
  idSchema,
  isoDateSchema,
  lifecycleSchema,
  statusSchema,
  tagsSchema,
} from "./common";

const componentBase = {
  id: idSchema,
  workspaceId: idSchema,
  name: z.string().min(1),
  description: z.string(),
  status: statusSchema,
  tags: tagsSchema,
  ownerId: idSchema.optional(),
  parentId: idSchema.optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
};

export const organizationSchema = z.object({
  ...componentBase,
  type: z.literal("organization"),
});

export const capabilitySchema = z.object({
  ...componentBase,
  type: z.literal("capability"),
  level: capabilityLevelSchema,
});

export const workflowSchema = z.object({
  ...componentBase,
  type: z.literal("workflow"),
});

export const processSchema = z.object({
  ...componentBase,
  type: z.literal("process"),
});

export const applicationSchema = z.object({
  ...componentBase,
  type: z.literal("application"),
  lifecycle: lifecycleSchema,
  criticality: criticalitySchema,
  vendor: z.string().optional(),
  url: z.string().optional(),
});

export const personSchema = z.object({
  ...componentBase,
  type: z.literal("person"),
  email: z.string().optional(),
  role: z.string().optional(),
});

export const technologySchema = z.object({
  ...componentBase,
  type: z.literal("technology"),
});

export const interfaceSchema = z.object({
  ...componentBase,
  type: z.literal("interface"),
});

export const componentSchema = z.discriminatedUnion("type", [
  organizationSchema,
  capabilitySchema,
  workflowSchema,
  processSchema,
  applicationSchema,
  personSchema,
  technologySchema,
  interfaceSchema,
]);

export type Component = z.infer<typeof componentSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type Capability = z.infer<typeof capabilitySchema>;
export type Person = z.infer<typeof personSchema>;

export type ComponentDraft = {
  [K in Component["type"]]: Omit<
    Extract<Component, { type: K }>,
    "id" | "workspaceId" | "createdAt" | "updatedAt"
  >;
}[Component["type"]];
