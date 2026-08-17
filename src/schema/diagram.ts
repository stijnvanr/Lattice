import { z } from "zod";
import { idSchema, isoDateSchema } from "./common";

export const diagramKindSchema = z.enum(["live", "board"]);
export const livePresetSchema = z.enum([
  "capability_map",
  "workflow_map",
  "application_landscape",
  "neighborhood",
]);
export const diagramNodeKindSchema = z.enum(["component", "note", "group"]);
export const edgeStyleSchema = z.enum(["bezier", "smoothstep"]);
export const elkDirectionSchema = z.enum(["RIGHT", "DOWN"]);

export const diagramQuerySchema = z.object({
  preset: livePresetSchema,
  rootId: idSchema.optional(),
});

export const diagramNodeSchema = z.object({
  id: idSchema,
  kind: diagramNodeKindSchema,
  componentId: idSchema.optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  size: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  collapsed: z.boolean().optional(),
  text: z.string().optional(),
});

export const diagramViewSchema = z.object({
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .optional(),
  elk: z
    .object({
      direction: elkDirectionSchema,
    })
    .optional(),
  nodes: z.array(diagramNodeSchema),
  edgeStyle: edgeStyleSchema.optional(),
});

export const diagramSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  name: z.string().min(1),
  kind: diagramKindSchema,
  query: diagramQuerySchema.optional(),
  view: diagramViewSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type Diagram = z.infer<typeof diagramSchema>;
export type DiagramView = z.infer<typeof diagramViewSchema>;
export type DiagramNode = z.infer<typeof diagramNodeSchema>;
export type DiagramQuery = z.infer<typeof diagramQuerySchema>;
export type LivePreset = z.infer<typeof livePresetSchema>;
