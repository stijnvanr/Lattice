import { z } from "zod";
import { idSchema, isoDateSchema, referenceTypeSchema } from "./common";

export const referenceSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  type: referenceTypeSchema,
  sourceId: idSchema,
  targetId: idSchema,
  viaId: idSchema.optional(),
  description: z.string().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type Reference = z.infer<typeof referenceSchema>;
