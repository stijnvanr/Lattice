import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  slug: text("slug").notNull(),
  metamodelId: text("metamodel_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const components = sqliteTable("components", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  tags: text("tags").notNull(),
  ownerId: text("owner_id"),
  parentId: text("parent_id"),
  extras: text("extras").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const references = sqliteTable("references", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  type: text("type").notNull(),
  sourceId: text("source_id").notNull(),
  targetId: text("target_id").notNull(),
  viaId: text("via_id"),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  parentId: text("parent_id"),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  order: integer("order").notNull(),
  doc: text("doc").notNull(),
  componentId: text("component_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const diagrams = sqliteTable("diagrams", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  query: text("query"),
  view: text("view").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
