import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { bundleSchema } from "../src/schema/bundle";
import { componentSchema } from "../src/schema/component";
import { diagramSchema } from "../src/schema/diagram";
import { pageSchema } from "../src/schema/page";
import { referenceSchema } from "../src/schema/reference";
import { workspaceSchema } from "../src/schema/workspace";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "schemas");

const schemas = {
  workspace: workspaceSchema,
  component: componentSchema,
  reference: referenceSchema,
  page: pageSchema,
  diagram: diagramSchema,
  bundle: bundleSchema,
} as const;

mkdirSync(outDir, { recursive: true });

for (const [name, schema] of Object.entries(schemas)) {
  const json = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    reused: "ref",
    unrepresentable: "any",
  }) as Record<string, unknown>;
  json.$id = `https://lattice.local/schemas/${name}.schema.json`;
  json.title = name;
  writeFileSync(join(outDir, `${name}.schema.json`), `${JSON.stringify(json, null, 2)}\n`);
}

console.log(`Wrote ${Object.keys(schemas).length} schemas to /schemas`);
