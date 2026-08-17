import { customAlphabet } from "nanoid";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 12);

export const idPrefixes = {
  workspace: "ws",
  component: "cmp",
  reference: "ref",
  page: "pg",
  diagram: "dia",
} as const;

export function createId(prefix: keyof typeof idPrefixes | string) {
  const value = typeof prefix === "string" && prefix in idPrefixes
    ? idPrefixes[prefix as keyof typeof idPrefixes]
    : prefix;
  return `${value}_${nanoid()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "untitled";
}
