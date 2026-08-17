import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TypeBadge } from "@/components/TypeBadge";
import { DocEditor } from "@/components/editor/DocEditor";
import {
  canHaveOwner,
  canHaveParent,
  componentTypeMeta,
  legalReferenceTypes,
  referenceTypeMeta,
  statusSchema,
  type Component,
  type ReferenceType,
} from "@/schema";
import { autoPageFor, toastErrors, useWorkspace } from "@/store/workspace";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function CatalogDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const graph = useWorkspace((s) => s.graph);
  const updateComponent = useWorkspace((s) => s.updateComponent);
  const deleteComponent = useWorkspace((s) => s.deleteComponent);
  const createReference = useWorkspace((s) => s.createReference);
  const deleteReference = useWorkspace((s) => s.deleteReference);
  const updatePage = useWorkspace((s) => s.updatePage);
  const createDiagram = useWorkspace((s) => s.createDiagram);
  const [confirm, setConfirm] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [refType, setRefType] = useState<ReferenceType>("supports");
  const [viaId, setViaId] = useState("none");

  const component = graph?.components.find((c) => c.id === id);
  const autoPage = graph && component ? autoPageFor(graph.pages, component.id) : undefined;

  const related = useMemo(() => {
    if (!graph || !component) return { incoming: [], outgoing: [] };
    return {
      outgoing: graph.references.filter((r) => r.sourceId === component.id),
      incoming: graph.references.filter((r) => r.targetId === component.id),
    };
  }, [graph, component]);

  if (!graph || !component) {
    return <div className="p-8 text-sm text-muted-foreground">Component not found.</div>;
  }

  const parents = graph.components.filter(
    (c) => c.id !== component.id && c.type === component.type,
  );
  const owners = graph.components.filter((c) => c.type === "person" || c.type === "organization");
  const save = (patch: Record<string, unknown>) => {
    const result = updateComponent(component.id, patch);
    if (!result.ok) toast.error(toastErrors(result.errors));
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <TypeBadge type={component.type} />
          <Input
            className="mt-2 h-10 border-none bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
            defaultValue={component.name}
            key={component.id}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== component.name) save({ name });
            }}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const existing = graph.diagrams.find(
                (d) => d.kind === "live" && d.query?.preset === "neighborhood" && d.query.rootId === component.id,
              );
              if (existing) {
                navigate(`/diagrams/${existing.id}`);
                return;
              }
              const result = createDiagram({
                name: `${component.name} neighborhood`,
                kind: "live",
                query: { preset: "neighborhood", rootId: component.id },
                view: { nodes: [], elk: { direction: "RIGHT" }, edgeStyle: "smoothstep" },
              });
              if (!result.ok) toast.error(toastErrors(result.errors));
              else navigate(`/diagrams/${result.data.id}`);
            }}
          >
            Neighborhood
          </Button>
          <Button variant="outline" onClick={() => setConfirm(true)}>
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="docs">Docs</TabsTrigger>
          <TabsTrigger value="refs">References</TabsTrigger>
        </TabsList>
        <TabsContent value="fields" className="grid gap-4 md:grid-cols-2">
          <Field label="Description">
            <Textarea
              defaultValue={component.description}
              key={`${component.id}-desc`}
              onBlur={(e) => {
                if (e.target.value !== component.description) save({ description: e.target.value });
              }}
            />
          </Field>
          <Field label="Status">
            <Select value={component.status} onValueChange={(status) => save({ status })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusSchema.options.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tags">
            <Input
              defaultValue={component.tags.join(", ")}
              key={`${component.id}-tags`}
              onBlur={(e) =>
                save({
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          {canHaveParent(component.type) ? (
            <Field label="Parent">
              <Select
                value={component.parentId ?? "none"}
                onValueChange={(value) => save({ parentId: value === "none" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {parents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {canHaveOwner(component.type) ? (
            <Field label="Owner">
              <Select
                value={component.ownerId ?? "none"}
                onValueChange={(value) => save({ ownerId: value === "none" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {component.type === "application" ? (
            <>
              <Field label="Lifecycle">
                <Select value={component.lifecycle} onValueChange={(lifecycle) => save({ lifecycle })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["plan", "active", "sunset", "retired"].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Criticality">
                <Select
                  value={component.criticality}
                  onValueChange={(criticality) => save({ criticality })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "critical"].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Vendor">
                <Input
                  key={`${component.id}-vendor`}
                  defaultValue={component.vendor ?? ""}
                  onBlur={(e) => save({ vendor: e.target.value || undefined })}
                />
              </Field>
              <Field label="URL">
                <Input
                  key={`${component.id}-url`}
                  defaultValue={component.url ?? ""}
                  onBlur={(e) => save({ url: e.target.value || undefined })}
                />
              </Field>
            </>
          ) : null}
          {component.type === "capability" ? (
            <Field label="Level">
              <Select
                value={String(component.level)}
                onValueChange={(value) => save({ level: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {component.type === "person" ? (
            <>
              <Field label="Email">
                <Input
                  defaultValue={component.email ?? ""}
                  onBlur={(e) => save({ email: e.target.value || undefined })}
                />
              </Field>
              <Field label="Role">
                <Input
                  defaultValue={component.role ?? ""}
                  onBlur={(e) => save({ role: e.target.value || undefined })}
                />
              </Field>
            </>
          ) : null}
        </TabsContent>
        <TabsContent value="docs">
          {autoPage ? (
            <DocEditor
              key={autoPage.id}
              doc={autoPage.doc}
              components={graph.components}
              pages={graph.pages}
              onChange={(doc) => {
                const result = updatePage(autoPage.id, { doc });
                if (!result.ok) toast.error(toastErrors(result.errors));
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No documentation page.</p>
          )}
        </TabsContent>
        <TabsContent value="refs">
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3">
            <div className="min-w-40 flex-1">
              <Label>Target</Label>
              <Select
                value={targetId}
                onValueChange={(value) => {
                  setTargetId(value);
                  setViaId("none");
                  const target = graph.components.find((c) => c.id === value);
                  if (!target) return;
                  const legal = legalReferenceTypes(component.type, target.type);
                  if (!legal.includes(refType)) setRefType(legal[0] ?? "supports");
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose object" />
                </SelectTrigger>
                <SelectContent>
                  {graph.components
                    .filter((c) => c.id !== component.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label>Type</Label>
              <Select
                value={refType}
                onValueChange={(v) => {
                  setRefType(v as ReferenceType);
                  if (v !== "integrates_with") setViaId("none");
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(targetId
                    ? legalReferenceTypes(
                        component.type,
                        graph.components.find((c) => c.id === targetId)?.type ?? component.type,
                      )
                    : Object.keys(referenceTypeMeta)
                  ).map((type) => (
                    <SelectItem key={type} value={type}>
                      {referenceTypeMeta[type as ReferenceType].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {refType === "integrates_with" ? (
              <div className="w-48">
                <Label>Via interface</Label>
                <Select value={viaId} onValueChange={setViaId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {graph.components
                      .filter((c) => c.type === "interface")
                      .map((iface) => (
                        <SelectItem key={iface.id} value={iface.id}>
                          {iface.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Button
              onClick={() => {
                if (!targetId) return;
                const result = createReference({
                  type: refType,
                  sourceId: component.id,
                  targetId,
                  viaId: refType === "integrates_with" && viaId !== "none" ? viaId : undefined,
                });
                if (!result.ok) toast.error(toastErrors(result.errors));
                else {
                  setTargetId("");
                  setViaId("none");
                }
              }}
            >
              Add
            </Button>
          </div>
          <RefList
            title="Outgoing"
            items={related.outgoing}
            components={graph.components}
            side="target"
            onDelete={deleteReference}
          />
          <RefList
            title="Incoming"
            items={related.incoming}
            components={graph.components}
            side="source"
            onDelete={deleteReference}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete {component.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            References, board nodes, and the auto page will be removed.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const result = deleteComponent(component.id);
                if (!result.ok) toast.error(toastErrors(result.errors));
                else navigate("/catalog");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RefList({
  title,
  items,
  components,
  side,
  onDelete,
}: {
  title: string;
  items: Array<{ id: string; type: ReferenceType; sourceId: string; targetId: string; viaId?: string }>;
  components: Component[];
  side: "source" | "target";
  onDelete: (id: string) => { ok: boolean; errors?: { path: string; message: string }[] };
}) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="rounded-xl border border-border bg-card">
        {items.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">None</div>
        ) : (
          items.map((item) => {
            const otherId = side === "target" ? item.targetId : item.sourceId;
            const other = components.find((c) => c.id === otherId);
            const via = item.viaId ? components.find((c) => c.id === item.viaId) : undefined;
            return (
              <div key={item.id} className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    {referenceTypeMeta[item.type].label}{" "}
                    <Link className="font-medium hover:underline" to={`/catalog/${otherId}`}>
                      {other?.name ?? otherId}
                    </Link>
                    {via ? <span className="text-muted-foreground"> via {via.name}</span> : null}
                  </div>
                  {other ? (
                    <div className="text-[11px] text-muted-foreground">
                      {componentTypeMeta[other.type].label}
                    </div>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const result = onDelete(item.id);
                    if (!result.ok && result.errors) toast.error(toastErrors(result.errors));
                  }}
                >
                  Remove
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
