import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TypeBadge } from "@/components/TypeBadge";
import {
  canHaveOwner,
  canHaveParent,
  componentTypeMeta,
  componentTypeSchema,
  type Component,
  type ComponentType,
} from "@/schema";
import { toastErrors, useWorkspace } from "@/store/workspace";
import { draftForType } from "@/lib/draft";
import { cn } from "@/lib/utils";

const types = componentTypeSchema.options;

function tree(components: Component[], type: ComponentType) {
  const items = components.filter((c) => c.type === type);
  const byParent = new Map<string | undefined, Component[]>();
  for (const item of items) {
    const key = item.parentId;
    const list = byParent.get(key) ?? [];
    list.push(item);
    byParent.set(key, list);
  }
  const roots = items.filter((c) => !c.parentId || !items.some((o) => o.id === c.parentId));
  const rows: Array<{ component: Component; depth: number }> = [];
  const walk = (node: Component, depth: number) => {
    rows.push({ component: node, depth });
    for (const child of byParent.get(node.id) ?? []) walk(child, depth + 1);
  };
  for (const root of roots) walk(root, 0);
  return rows;
}

export function CatalogPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const graph = useWorkspace((s) => s.graph);
  const createComponent = useWorkspace((s) => s.createComponent);
  const type = (params.get("type") as ComponentType | null) ?? null;
  const [open, setOpen] = useState(false);
  const [draftType, setDraftType] = useState<ComponentType>(type ?? "application");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("none");
  const [ownerId, setOwnerId] = useState("none");

  const items = useMemo(() => {
    if (!graph) return [];
    const filtered = type ? graph.components.filter((c) => c.type === type) : graph.components;
    if (type && (type === "organization" || type === "capability" || type === "workflow" || type === "process")) {
      return tree(graph.components, type);
    }
    return filtered
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((component) => ({ component, depth: 0 }));
  }, [graph, type]);

  if (!graph) return null;

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-52 shrink-0 overflow-auto border-r border-border bg-card p-3">
        <button
          type="button"
          className={cn(
            "mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm",
            !type ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-accent",
          )}
          onClick={() => setParams({})}
        >
          All
        </button>
        {types.map((item) => (
          <button
            key={item}
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
              type === item ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-accent",
            )}
            onClick={() => setParams({ type: item })}
          >
            {componentTypeMeta[item].plural}
            <span className="text-[11px]">
              {graph.components.filter((c) => c.type === item).length}
            </span>
          </button>
        ))}
      </aside>
      <div className="min-w-0 flex-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {type ? componentTypeMeta[type].plural : "Catalog"}
            </h1>
            <p className="text-sm text-muted-foreground">{items.length} objects</p>
          </div>
          <Button
            onClick={() => {
              setDraftType(type ?? "application");
              setName("");
              setDescription("");
              setParentId("none");
              setOwnerId("none");
              setOpen(true);
            }}
          >
            <Plus /> New
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {items.map(({ component, depth }) => (
            <Link
              key={component.id}
              to={`/catalog/${component.id}`}
              className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-accent/40"
              style={{ paddingLeft: 16 + depth * 16 }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{component.name}</div>
                {component.description ? (
                  <div className="truncate text-xs text-muted-foreground">{component.description}</div>
                ) : null}
              </div>
              <TypeBadge type={component.type} />
              <span className="text-[11px] text-muted-foreground">{component.status}</span>
            </Link>
          ))}
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nothing here yet.</div>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>New component</DialogTitle>
          <DialogDescription>Type cannot be changed later.</DialogDescription>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Type</Label>
              <Select
                value={draftType}
                onValueChange={(v) => {
                  setDraftType(v as ComponentType);
                  setParentId("none");
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((item) => (
                    <SelectItem key={item} value={item}>
                      {componentTypeMeta[item].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Name</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {canHaveParent(draftType) ? (
              <div>
                <Label>Parent</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {graph.components
                      .filter((c) => c.type === draftType)
                      .map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {canHaveOwner(draftType) ? (
              <div>
                <Label>Owner</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {graph.components
                      .filter((c) => c.type === "person" || c.type === "organization")
                      .map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const result = createComponent({
                  ...draftForType(draftType),
                  name: name.trim() || "Untitled",
                  description,
                  parentId: canHaveParent(draftType) && parentId !== "none" ? parentId : undefined,
                  ownerId: canHaveOwner(draftType) && ownerId !== "none" ? ownerId : undefined,
                });
                if (!result.ok) {
                  toast.error(toastErrors(result.errors));
                  return;
                }
                setOpen(false);
                navigate(`/catalog/${result.data.id}`);
              }}
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
