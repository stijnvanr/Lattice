import { z } from "zod";
import { SCHEMA_VERSION } from "./common";
import { componentSchema } from "./component";
import { diagramSchema } from "./diagram";
import { pageSchema } from "./page";
import { referenceSchema } from "./reference";
import { workspaceSchema } from "./workspace";

export const bundleSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: z.string().min(1),
  workspace: workspaceSchema,
  components: z.array(componentSchema),
  references: z.array(referenceSchema),
  pages: z.array(pageSchema),
  diagrams: z.array(diagramSchema),
});

export type Bundle = z.infer<typeof bundleSchema>;
