import type { z } from "zod";

export type FieldError = {
  path: string;
  message: string;
};

export function formatPath(path: PropertyKey[]) {
  let out = "";
  for (const part of path) {
    if (typeof part === "number") out += `[${part}]`;
    else out += out ? `.${String(part)}` : String(part);
  }
  return out;
}

export function fieldPathErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
  }));
}

export class ValidationError extends Error {
  errors: FieldError[];

  constructor(errors: FieldError[]) {
    super(errors.map((e) => `${e.path || "(root)"}: ${e.message}`).join("\n"));
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export type Result<T> =
  | { ok: true; data: T; warnings?: string[] }
  | { ok: false; errors: FieldError[] };
