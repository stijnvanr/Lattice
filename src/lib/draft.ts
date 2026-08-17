import type { ComponentDraft, ComponentType } from "@/schema";

export function draftForType(type: ComponentType, name = ""): ComponentDraft {
  switch (type) {
    case "application":
      return {
        type: "application",
        name,
        description: "",
        status: "active",
        tags: [],
        lifecycle: "active",
        criticality: "medium",
      };
    case "capability":
      return {
        type: "capability",
        name,
        description: "",
        status: "active",
        tags: [],
        level: 1,
      };
    case "person":
      return { type: "person", name, description: "", status: "active", tags: [] };
    case "organization":
      return { type: "organization", name, description: "", status: "active", tags: [] };
    case "workflow":
      return { type: "workflow", name, description: "", status: "active", tags: [] };
    case "process":
      return { type: "process", name, description: "", status: "active", tags: [] };
    case "technology":
      return { type: "technology", name, description: "", status: "active", tags: [] };
    case "interface":
      return { type: "interface", name, description: "", status: "active", tags: [] };
  }
}
