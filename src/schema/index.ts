export { SCHEMA_VERSION, METAMODEL_ID } from "./common";
export type {
  Status,
  ComponentType,
  ReferenceType,
  Lifecycle,
  Criticality,
  CapabilityLevel,
} from "./common";
export {
  statusSchema,
  componentTypeSchema,
  referenceTypeSchema,
  lifecycleSchema,
  criticalitySchema,
  capabilityLevelSchema,
} from "./common";

export { workspaceSchema } from "./workspace";
export type { Workspace } from "./workspace";

export { componentSchema } from "./component";
export type { Component, Application, Capability, Person, ComponentDraft } from "./component";

export { referenceSchema } from "./reference";
export type { Reference } from "./reference";

export {
  pageSchema,
  tiptapDocSchema,
  emptyDoc,
  paragraphDoc,
  collectMentions,
  assertMentions,
  assertHttpsImages,
  remapMentionIds,
} from "./page";
export type { Page, TiptapDoc, TiptapNode } from "./page";

export { diagramSchema, diagramViewSchema, livePresetSchema } from "./diagram";
export type {
  Diagram,
  DiagramView,
  DiagramNode,
  DiagramQuery,
  LivePreset,
} from "./diagram";

export { bundleSchema } from "./bundle";
export type { Bundle } from "./bundle";

export {
  referenceRules,
  componentTypeMeta,
  referenceTypeMeta,
  isReferenceAllowed,
  legalReferenceTypes,
  isContainsPair,
  canHaveParent,
  canHaveOwner,
} from "./metamodel";

export { fieldPathErrors, formatPath, ValidationError } from "./result";
export type { FieldError, Result } from "./result";
