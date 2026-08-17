import { z } from "zod";
import { idSchema, isoDateSchema } from "./common";

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export const tiptapMarkSchema: z.ZodType<TiptapMark> = z.object({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

export const tiptapNodeSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(tiptapNodeSchema).optional(),
    marks: z.array(tiptapMarkSchema).optional(),
    text: z.string().optional(),
  }),
);

export const tiptapDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(tiptapNodeSchema).optional(),
});

export type TiptapDoc = z.infer<typeof tiptapDocSchema>;

export const mentionTypeSchema = z.enum(["component", "page"]);

export const mentionAttrsSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  mentionType: mentionTypeSchema,
});

export const pageSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  parentId: idSchema.optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  order: z.number().int(),
  doc: tiptapDocSchema,
  componentId: idSchema.optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type Page = z.infer<typeof pageSchema>;

export function emptyDoc(): TiptapDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function paragraphDoc(text: string): TiptapDoc {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : undefined,
      },
    ],
  };
}

export function walkTiptap(
  node: TiptapNode | TiptapDoc,
  visit: (node: TiptapNode) => void,
) {
  visit(node as TiptapNode);
  for (const child of node.content ?? []) {
    walkTiptap(child, visit);
  }
}

export function collectMentions(doc: TiptapDoc) {
  const mentions: Array<z.infer<typeof mentionAttrsSchema>> = [];
  walkTiptap(doc, (node) => {
    if (node.type !== "mention") return;
    const parsed = mentionAttrsSchema.safeParse(node.attrs);
    if (parsed.success) mentions.push(parsed.data);
  });
  return mentions;
}

export function assertMentions(doc: TiptapDoc) {
  const errors: string[] = [];
  walkTiptap(doc, (node) => {
    if (node.type !== "mention") return;
    const parsed = mentionAttrsSchema.safeParse(node.attrs);
    if (!parsed.success) {
      errors.push("mention is missing id, label, or mentionType");
    }
  });
  return errors;
}

export function assertHttpsImages(doc: TiptapDoc) {
  const errors: string[] = [];
  walkTiptap(doc, (node) => {
    if (node.type !== "image") return;
    const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
    if (!src.startsWith("https://") && !src.startsWith("http://")) {
      errors.push("images must use http(s) URLs");
    }
    if (src.startsWith("data:") || src.startsWith("blob:")) {
      errors.push("images must use http(s) URLs");
    }
  });
  return errors;
}

export function remapMentionIds(
  doc: TiptapDoc,
  mapping: Map<string, string>,
): TiptapDoc {
  const clone = structuredClone(doc);
  walkTiptap(clone, (node) => {
    if (node.type !== "mention" || !node.attrs) return;
    const id = node.attrs.id;
    if (typeof id === "string" && mapping.has(id)) {
      node.attrs.id = mapping.get(id);
    }
  });
  return clone;
}
