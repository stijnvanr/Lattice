import { createContext, useCallback, useContext, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  addEdge,
  Background,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  getBezierPath,
  getSmoothStepPath,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TypeDot } from "@/components/TypeBadge";
import { layoutLiveView, layoutLiveViewSync, snapPosition, alignToNeighbors, type LayoutNode } from "@/lib/layout";
import { queryLiveGraph } from "@/lib/graph";
import { draftForType } from "@/lib/draft";
import { createId } from "@/lib/ids";
import {
  componentTypeMeta,
  legalReferenceTypes,
  referenceTypeMeta,
  type Component,
  type ComponentType,
  type Diagram,
  type ReferenceType,
} from "@/schema";
import { toastErrors, useWorkspace } from "@/store/workspace";
import { cn } from "@/lib/utils";

const HandlePickContext = createContext<(nodeId: string) => void>(() => {});

function ComponentNode({ id, data }: { id: string; data: { label: string; type: ComponentType } }) {
  const onPick = useContext(HandlePickContext);
  const pick = (event: MouseEvent) => {
    event.stopPropagation();
    onPick(id);
  };
  return (
    <div className="flex h-full w-full min-h-[64px] min-w-[160px] flex-col justify-center rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable
        tabIndex={0}
        aria-label={`${data.label} target`}
        className="!-top-1 !size-2.5 !bg-neutral-400"
        onClick={pick}
      />
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <TypeDot type={data.type} />
        {componentTypeMeta[data.type].label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium">{data.label}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable
        tabIndex={0}
        aria-label={`${data.label} source`}
        className="!-bottom-1 !size-2.5 !bg-neutral-400"
        onClick={pick}
      />
    </div>
  );
}

function FrameNode({ data }: { data: { label: string; type: ComponentType; level?: number } }) {
  const workflow = data.type === "workflow";
  const tint = workflow
    ? data.level === 1
      ? "bg-[#fdf2f4] border-[#f0c4cc]"
      : "bg-white border-[#f3d5db]"
    : data.level === 1
      ? "bg-[#f3f1eb] border-[#cfcbc3]"
      : data.level === 2
        ? "bg-[#f7f6f2] border-[#ddd9d1]"
        : "bg-white border-[#e6e2da]";
  const caption = workflow
    ? data.level === 1
      ? "Workflow"
      : "Step"
    : data.level
      ? `L${data.level} capability`
      : "Capability";
  return (
    <div className={cn("h-full w-full rounded-xl border px-3 py-2", tint)}>
      <div className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {caption}
      </div>
      <div className="truncate text-sm font-semibold">{data.label}</div>
    </div>
  );
}

function ChipNode({ data }: { data: { label: string; type: ComponentType } }) {
  return (
    <div className="flex h-full w-full items-center gap-2 rounded-md border border-border bg-card px-2 text-xs shadow-sm">
      <TypeDot type={data.type} />
      <span className="truncate font-medium">{data.label}</span>
    </div>
  );
}

function LaneNode({ data }: { data: { label: string } }) {
  return (
    <div className="h-full w-full rounded-2xl border border-dashed border-border bg-[#f4f3ef] px-3 py-2">
      <div className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {data.label}
      </div>
    </div>
  );
}

function NoteNode({ data }: { data: { text: string } }) {
  return (
    <div className="w-[220px] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow-sm">
      <Handle type="target" position={Position.Top} className="!size-2 !bg-amber-400" />
      {data.text || "Note"}
      <Handle type="source" position={Position.Bottom} className="!size-2 !bg-amber-400" />
    </div>
  );
}

function GroupNode({ data }: { data: { text: string } }) {
  return (
    <div className="flex h-full min-h-28 min-w-48 items-start rounded-xl border border-dashed border-border bg-secondary/40 px-3 py-2 text-xs font-medium text-muted-foreground">
      <Handle type="target" position={Position.Top} className="!size-2 !bg-neutral-400" />
      {data.text || "Group"}
      <Handle type="source" position={Position.Bottom} className="!size-2 !bg-neutral-400" />
    </div>
  );
}

function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  style,
  type,
}: EdgeProps) {
  const [edgePath, labelX, labelY] =
    type === "default"
      ? getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
      : getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan rounded-sm border border-border bg-card px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground shadow-sm"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function componentIdOf(node: Node | undefined) {
  const data = node?.data;
  if (!data || typeof data !== "object" || !("componentId" in data)) return undefined;
  const id = (data as { componentId?: unknown }).componentId;
  return typeof id === "string" ? id : undefined;
}

function textOf(node: Node | undefined) {
  const data = node?.data;
  if (!data || typeof data !== "object" || !("text" in data)) return undefined;
  const text = (data as { text?: unknown }).text;
  return typeof text === "string" ? text : undefined;
}

const nodeTypes: NodeTypes = {
  component: ComponentNode,
  note: NoteNode,
  group: GroupNode,
  frame: FrameNode,
  chip: ChipNode,
  lane: LaneNode,
};

const edgeTypes: EdgeTypes = {
  smoothstep: LabeledEdge,
  default: LabeledEdge,
};

function toFlowNodes(layoutNodes: LayoutNode[], draggable: boolean): Node[] {
  return layoutNodes.map((node) => ({
    id: node.id,
    type: node.kind === "component" ? "component" : node.kind,
    position: node.position,
    parentId: node.parentId,
    extent: node.parentId ? ("parent" as const) : undefined,
    draggable,
    selectable: node.kind !== "lane",
    connectable: node.kind === "component",
    zIndex: node.zIndex,
    style: { width: node.size.width, height: node.size.height },
    data: {
      label: node.label,
      type: node.type === "lane" ? "application" : node.type,
      componentId: node.componentId,
      level: node.level,
    },
  }));
}

export function DiagramsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const graph = useWorkspace((s) => s.graph);
  const createDiagram = useWorkspace((s) => s.createDiagram);
  const deleteDiagram = useWorkspace((s) => s.deleteDiagram);
  const [createOpen, setCreateOpen] = useState(false);
  const [kind, setKind] = useState<"live" | "board">("board");
  const [preset, setPreset] = useState<"capability_map" | "workflow_map" | "application_landscape">(
    "capability_map",
  );
  const [name, setName] = useState("New diagram");

  const selected = graph?.diagrams.find((d) => d.id === id) ?? graph?.diagrams[0];

  useEffect(() => {
    if (!id && selected) navigate(`/diagrams/${selected.id}`, { replace: true });
  }, [id, selected, navigate]);

  if (!graph) return null;

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 shrink-0 overflow-auto border-r border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">Diagrams</div>
          <Button size="icon" variant="ghost" onClick={() => setCreateOpen(true)}>
            <Plus />
          </Button>
        </div>
        {graph.diagrams.map((diagram) => (
          <Link
            key={diagram.id}
            to={`/diagrams/${diagram.id}`}
            className={cn(
              "mb-1 block rounded-md px-2 py-1.5 text-sm",
              diagram.id === selected?.id ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <div>{diagram.name}</div>
            <div className="text-[11px] capitalize">{diagram.kind}</div>
          </Link>
        ))}
      </aside>
      <div className="min-w-0 flex-1">
        {selected ? (
          <DiagramCanvas
            key={selected.id}
            diagram={selected}
            components={graph.components}
            references={graph.references}
            onDelete={() => {
              const result = deleteDiagram(selected.id);
              if (!result.ok) toast.error(toastErrors(result.errors));
              else navigate("/diagrams");
            }}
          />
        ) : (
          <div className="p-8 text-sm text-muted-foreground">Create a live view or a board.</div>
        )}
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogTitle>New diagram</DialogTitle>
          <DialogDescription>Live views layout from the graph. Boards remember positions.</DialogDescription>
          <div className="mt-3 space-y-3">
            <div>
              <Label>Name</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "live" | "board")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="board">Board</SelectItem>
                  <SelectItem value="live">Live view</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {kind === "live" ? (
              <div>
                <Label>Preset</Label>
                <Select value={preset} onValueChange={(v) => setPreset(v as typeof preset)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="capability_map">Capability map</SelectItem>
                    <SelectItem value="workflow_map">Workflow map</SelectItem>
                    <SelectItem value="application_landscape">Application landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const result = createDiagram({
                  name,
                  kind,
                  query: kind === "live" ? { preset } : undefined,
                  view: { nodes: [], elk: { direction: kind === "live" ? "DOWN" : "RIGHT" }, edgeStyle: "smoothstep" },
                });
                if (!result.ok) toast.error(toastErrors(result.errors));
                else {
                  setCreateOpen(false);
                  navigate(`/diagrams/${result.data.id}`);
                }
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

function DiagramCanvas({
  diagram,
  components,
  references,
  onDelete,
}: {
  diagram: Diagram;
  components: Component[];
  references: Array<{
    id: string;
    type: ReferenceType;
    sourceId: string;
    targetId: string;
  }>;
  onDelete: () => void;
}) {
  const updateDiagram = useWorkspace((s) => s.updateDiagram);
  const createReference = useWorkspace((s) => s.createReference);
  const createComponent = useWorkspace((s) => s.createComponent);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [pending, setPending] = useState<Connection | null>(null);
  const [refType, setRefType] = useState<ReferenceType>();
  const [viaId, setViaId] = useState("none");
  const [addMode, setAddMode] = useState<"existing" | "new" | "note" | "group">("existing");
  const [componentId, setComponentId] = useState("");
  const [newName, setNewName] = useState("New application");
  const [newType, setNewType] = useState<ComponentType>("application");
  const [noteText, setNoteText] = useState("Note");

  const byId = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);
  const direction = diagram.view.elk?.direction ?? "DOWN";
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const liveLayout = useMemo(() => {
    if (diagram.kind !== "live" || !diagram.query || diagram.query.preset === "neighborhood") return null;
    return layoutLiveViewSync(diagram.query.preset, components, references, direction);
  }, [diagram.kind, diagram.query, components, references, direction]);

  const live = useMemo(() => {
    if (diagram.kind !== "live" || !diagram.query) return null;
    if (liveLayout) return liveLayout;
    return queryLiveGraph(diagram.query.preset, components, references, diagram.query.rootId);
  }, [diagram.kind, diagram.query, components, references, liveLayout]);

  const initialNodes: Node[] = useMemo(() => {
    if (diagram.kind === "live" && liveLayout) {
      return toFlowNodes(liveLayout.nodes, false);
    }
    if (diagram.kind === "live" && live) {
      const positions = new Map(diagram.view.nodes.map((n) => [n.componentId ?? n.id, n.position]));
      return live.nodes.map((node, index) => {
        const componentId = "componentId" in node && node.componentId ? node.componentId : node.id;
        const component = byId.get(componentId);
        const cached = positions.get(componentId);
        return {
          id: node.id,
          type: "component",
          position: cached ?? { x: 80 + (index % 4) * 240, y: 80 + Math.floor(index / 4) * 120 },
          data: {
            label: component?.name ?? componentId,
            type: component?.type ?? "application",
            componentId,
          },
        };
      });
    }
    return diagram.view.nodes.map((node) => {
      const component = node.componentId ? byId.get(node.componentId) : undefined;
      return {
        id: node.id,
        type: node.kind,
        position: node.position,
        style: node.size ? { width: node.size.width, height: node.size.height } : undefined,
        data: {
          label: component?.name ?? node.text ?? "Node",
          type: component?.type ?? "application",
          componentId: node.componentId,
          text: node.text ?? "",
        },
      };
    });
  }, [diagram, live, liveLayout, byId]);

  const initialEdges: Edge[] = useMemo(() => {
    const style = diagram.view.edgeStyle === "bezier" ? "default" : "smoothstep";
    const toEdge = (id: string, source: string, target: string, type: ReferenceType): Edge => ({
      id,
      source,
      target,
      label: referenceTypeMeta[type].label,
      type: style,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#73736c" },
      style: { stroke: "#73736c", strokeWidth: 1.5 },
    });
    if (diagram.kind === "live" && liveLayout) {
      return liveLayout.edges.map((edge) => toEdge(edge.id, edge.source, edge.target, edge.type));
    }
    if (diagram.kind === "live" && live) {
      return live.edges.map((edge) => toEdge(edge.id, edge.source, edge.target, edge.type));
    }
    const componentNodes = diagram.view.nodes.filter((n) => n.kind === "component" && n.componentId);
    const nodeByComponent = new Map(componentNodes.map((n) => [n.componentId!, n.id]));
    return references
      .filter((r) => nodeByComponent.has(r.sourceId) && nodeByComponent.has(r.targetId))
      .map((r) =>
        toEdge(r.id, nodeByComponent.get(r.sourceId) ?? r.sourceId, nodeByComponent.get(r.targetId) ?? r.targetId, r.type),
      );
  }, [diagram, live, liveLayout, references]);

  const defaultEdgeOptions = useMemo(
    () => ({
      type: (diagram.view.edgeStyle === "bezier" ? "default" : "smoothstep") as Edge["type"],
      style: { stroke: "#73736c", strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#73736c" },
    }),
    [diagram.view.edgeStyle],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const persistBoard = useCallback(
    (next: Node[]) => {
      if (diagram.kind !== "board") return;
      updateDiagram(diagram.id, {
        view: {
          ...diagram.view,
          nodes: next.map((node) => ({
            id: node.id,
            kind: (node.type as "component" | "note" | "group") ?? "component",
            componentId: componentIdOf(node),
            position: node.position,
            size: node.style?.width
              ? { width: Number(node.style.width), height: Number(node.style.height ?? 64) }
              : undefined,
            text: textOf(node),
          })),
        },
      });
    },
    [diagram, updateDiagram],
  );

  const onNodeDrag = useCallback(
    (_event: unknown, node: Node) => {
      if (diagram.kind !== "board") return;
      const others = nodes.filter((n) => n.id !== node.id && !n.parentId).map((n) => n.position);
      const aligned = alignToNeighbors(snapPosition(node.position, 24), others, 10);
      setGuides({ x: aligned.guideX, y: aligned.guideY });
    },
    [diagram.kind, nodes],
  );

  const alignBoard = useCallback(() => {
    const next = nodes.map((node) => ({ ...node, position: snapPosition(node.position, 24) }));
    setNodes(next);
    persistBoard(next);
  }, [nodes, persistBoard, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const source = nodes.find((n) => n.id === connection.source);
      const target = nodes.find((n) => n.id === connection.target);
      const sourceCmp = componentIdOf(source);
      const targetCmp = componentIdOf(target);
      if (!sourceCmp || !targetCmp) {
        setEdges((eds) => addEdge({ ...connection, type: "smoothstep" }, eds));
        return;
      }
      setPending(connection);
      const sType = byId.get(sourceCmp)?.type;
      const tType = byId.get(targetCmp)?.type;
      const legal = sType && tType ? legalReferenceTypes(sType, tType) : [];
      setRefType(legal[0]);
      setViaId("none");
      setConnectOpen(true);
    },
    [nodes, byId, setEdges],
  );

  const [pickSource, setPickSource] = useState<string | null>(null);
  const onHandlePick = useCallback(
    (nodeId: string) => {
      if (!pickSource) {
        setPickSource(nodeId);
        toast.message("Click another handle to create a reference");
        return;
      }
      if (pickSource === nodeId) {
        setPickSource(null);
        return;
      }
      onConnect({
        source: pickSource,
        target: nodeId,
        sourceHandle: null,
        targetHandle: null,
      });
      setPickSource(null);
    },
    [pickSource, onConnect],
  );

  const regenerate = useCallback(async () => {
    if (diagram.kind !== "live" || !diagram.query) return;
    const laidOut = await layoutLiveView(
      diagram.query.preset,
      components,
      references,
      direction,
      diagram.query.rootId,
    );
    setNodes(toFlowNodes(laidOut.nodes, false));
    setEdges(
      laidOut.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: referenceTypeMeta[edge.type].label,
        type: diagram.view.edgeStyle === "bezier" ? "default" : "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#73736c" },
        style: { stroke: "#73736c", strokeWidth: 1.5 },
      })),
    );
  }, [diagram, components, references, direction, setNodes, setEdges]);

  useEffect(() => {
    if (diagram.kind === "live" && diagram.query?.preset === "neighborhood") {
      void regenerate();
    }
  }, [diagram.id, diagram.kind, diagram.query?.preset, diagram.query?.rootId, direction, regenerate]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <div className="font-medium">{diagram.name}</div>
        <Badge className="capitalize">{diagram.kind}</Badge>
        {diagram.query ? (
          <span className="text-xs text-muted-foreground">{diagram.query.preset.replaceAll("_", " ")}</span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {nodes.length} objects
        </span>
        <div className="ml-auto flex gap-2">
          {diagram.kind === "live" &&
          diagram.query?.preset !== "capability_map" &&
          diagram.query?.preset !== "workflow_map" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                updateDiagram(diagram.id, {
                  view: {
                    ...diagram.view,
                    elk: { direction: direction === "DOWN" ? "RIGHT" : "DOWN" },
                  },
                })
              }
            >
              {direction === "DOWN" ? "Top–bottom" : "Left–right"}
            </Button>
          ) : null}
          {diagram.kind === "live" ? (
            <Button size="sm" variant="outline" onClick={() => void regenerate()}>
              Optimize layout
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={alignBoard}>
                Align to grid
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPaletteOpen(true)}>
                Add to board
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <HandlePickContext.Provider value={onHandlePick}>
          <ReactFlowProvider>
            <ReactFlow
            className={
              diagram.query?.preset === "capability_map" || diagram.query?.preset === "workflow_map"
                ? "lattice-map"
                : undefined
            }
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={(_e, _node, draggedNodes) => {
              setGuides({ x: null, y: null });
              const moved = new Map(
                draggedNodes.map((node) => [node.id, snapPosition(node.position, 24)] as const),
              );
              const snapped = nodes.map((node) =>
                moved.has(node.id) ? { ...node, position: moved.get(node.id)! } : node,
              );
              setNodes(snapped);
              persistBoard(snapped);
            }}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            nodesDraggable={diagram.kind === "board"}
            nodesConnectable={diagram.kind === "board"}
            snapToGrid={diagram.kind === "board"}
            snapGrid={[24, 24]}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            minZoom={0.15}
            defaultEdgeOptions={defaultEdgeOptions}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} size={1} />
            <ViewportPortal>
              {guides.x != null ? (
                <div
                  className="pointer-events-none absolute w-px bg-blue-500/60"
                  style={{ left: guides.x, top: -4000, height: 8000 }}
                />
              ) : null}
              {guides.y != null ? (
                <div
                  className="pointer-events-none absolute h-px bg-blue-500/60"
                  style={{ top: guides.y, left: -4000, width: 8000 }}
                />
              ) : null}
            </ViewportPortal>
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
          </ReactFlowProvider>
        </HandlePickContext.Provider>
      </div>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogTitle>Create reference</DialogTitle>
          <DialogDescription>Connecting nodes writes a typed edge to the graph.</DialogDescription>
          <Select
            value={refType}
            onValueChange={(v) => {
              setRefType(v as ReferenceType);
              if (v !== "integrates_with") setViaId("none");
            }}
          >
            <SelectTrigger className="mt-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                const source = nodes.find((n) => n.id === pending?.source);
                const target = nodes.find((n) => n.id === pending?.target);
                const s = byId.get(componentIdOf(source) ?? "");
                const t = byId.get(componentIdOf(target) ?? "");
                const legal = s && t ? legalReferenceTypes(s.type, t.type) : [];
                if (legal.length === 0) {
                  return (
                    <SelectItem value="none" disabled>
                      No legal type for this pair
                    </SelectItem>
                  );
                }
                return legal.map((type) => (
                  <SelectItem key={type} value={type}>
                    {referenceTypeMeta[type].label}
                  </SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>
          {refType === "integrates_with" ? (
            <div className="mt-3">
              <Label>Via interface</Label>
              <Select value={viaId} onValueChange={setViaId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {components
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
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConnectOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!pending || !refType) return;
                const source = nodes.find((n) => n.id === pending.source);
                const target = nodes.find((n) => n.id === pending.target);
                const sourceId = componentIdOf(source);
                const targetId = componentIdOf(target);
                if (!sourceId || !targetId) return;
                const result = createReference({
                  type: refType,
                  sourceId,
                  targetId,
                  viaId: refType === "integrates_with" && viaId !== "none" ? viaId : undefined,
                });
                if (!result.ok) {
                  toast.error(toastErrors(result.errors));
                  return;
                }
                setEdges((eds) =>
                  addEdge(
                    {
                      ...pending,
                      id: result.data.id,
                      label: referenceTypeMeta[refType].label,
                      type: "smoothstep",
                    },
                    eds,
                  ),
                );
                setConnectOpen(false);
              }}
              disabled={!refType}
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent>
          <DialogTitle>Add to board</DialogTitle>
          <Select value={addMode} onValueChange={(v) => setAddMode(v as typeof addMode)}>
            <SelectTrigger className="mt-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="existing">Existing component</SelectItem>
              <SelectItem value="new">New component</SelectItem>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="group">Group</SelectItem>
            </SelectContent>
          </Select>
          {addMode === "existing" ? (
            <Select value={componentId} onValueChange={setComponentId}>
              <SelectTrigger className="mt-3">
                <SelectValue placeholder="Choose component" />
              </SelectTrigger>
              <SelectContent>
                {components.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {addMode === "new" ? (
            <div className="mt-3 space-y-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Select value={newType} onValueChange={(v) => setNewType(v as ComponentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(componentTypeMeta).map(([type, meta]) => (
                    <SelectItem key={type} value={type}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {addMode === "note" || addMode === "group" ? (
            <Input className="mt-3" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          ) : null}
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                const position = { x: 80 + nodes.length * 24, y: 80 + nodes.length * 16 };
                if (addMode === "note" || addMode === "group") {
                  const node = {
                    id: createId("n"),
                    kind: addMode,
                    position,
                    text: noteText,
                    size:
                      addMode === "group"
                        ? { width: 280, height: 160 }
                        : { width: 220, height: 90 },
                  };
                  updateDiagram(diagram.id, {
                    view: { ...diagram.view, nodes: [...diagram.view.nodes, node] },
                  });
                } else if (addMode === "existing" && componentId) {
                  updateDiagram(diagram.id, {
                    view: {
                      ...diagram.view,
                      nodes: [
                        ...diagram.view.nodes,
                        { id: createId("n"), kind: "component", componentId, position },
                      ],
                    },
                  });
                } else if (addMode === "new") {
                  const created = createComponent({
                    ...draftForType(newType, newName),
                  });
                  if (!created.ok) {
                    toast.error(toastErrors(created.errors));
                    return;
                  }
                  updateDiagram(diagram.id, {
                    view: {
                      ...diagram.view,
                      nodes: [
                        ...diagram.view.nodes,
                        {
                          id: createId("n"),
                          kind: "component",
                          componentId: created.data.id,
                          position,
                        },
                      ],
                    },
                  });
                }
                setPaletteOpen(false);
              }}
            >
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
