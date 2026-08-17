import { z } from "zod";
import { idSchema, isoDateSchema, METAMODEL_ID } from "./common";

export const workspaceSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string(),
  slug: z.string().min(1),
  metamodelId: z.literal(METAMODEL_ID),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type Workspace = z.infer<typeof workspaceSchema>;
