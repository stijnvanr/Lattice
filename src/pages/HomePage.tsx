import { Link } from "react-router-dom";
import { BookOpen, Box, Workflow } from "lucide-react";
import { Card } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/input";
import { toastErrors, useWorkspace, wikiPages } from "@/store/workspace";
import { componentTypeMeta } from "@/schema";
import { toast } from "sonner";

export function HomePage() {
  const graph = useWorkspace((s) => s.graph);
  const updateWorkspace = useWorkspace((s) => s.updateWorkspace);
  if (!graph) return null;

  const wiki = wikiPages(graph.pages);
  const counts = graph.components.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + 1;
    return acc;
  }, {});
  const empty =
    graph.components.length === 0 && wiki.length === 0 && graph.diagrams.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <Label>Workspace</Label>
        <Input
          className="mt-1 h-10 border-none bg-transparent px-0 text-3xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
          defaultValue={graph.workspace.name}
          key={graph.workspace.id}
          placeholder="Name this workspace"
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== graph.workspace.name) {
              const result = updateWorkspace({ name });
              if (!result.ok) toast.error(toastErrors(result.errors));
            }
          }}
        />
        <Textarea
          className="mt-2 min-h-16 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          defaultValue={graph.workspace.description}
          key={`${graph.workspace.id}-desc`}
          placeholder="What is this architecture for?"
          onBlur={(e) => {
            if (e.target.value !== graph.workspace.description) {
              const result = updateWorkspace({ description: e.target.value });
              if (!result.ok) toast.error(toastErrors(result.errors));
            }
          }}
        />
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6">
          <div className="text-sm font-medium">This workspace is empty</div>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Catalog holds the graph. Pages are prose with @mentions. Diagrams are views of the
            graph — live maps layout themselves, boards remember positions.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/catalog"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Add a component
            </Link>
            <Link
              to="/pages"
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
            >
              Write a page
            </Link>
            <Link
              to="/diagrams"
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
            >
              Create a diagram
            </Link>
          </div>
        </div>
      ) : wiki[0] ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-sm font-medium">Start with the story</div>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Pages explain the product. Catalog is the graph those pages mention. Diagrams are
            views of the same objects.
          </p>
          <Link
            to={`/pages/${wiki[0].id}`}
            className="mt-4 inline-flex rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            {wiki[0].title}
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <div className="text-xs text-muted-foreground">Components</div>
          <div className="mt-1 text-2xl font-semibold">{graph.components.length}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted-foreground">References</div>
          <div className="mt-1 text-2xl font-semibold">{graph.references.length}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted-foreground">Pages</div>
          <div className="mt-1 text-2xl font-semibold">{wiki.length}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted-foreground">Diagrams</div>
          <div className="mt-1 text-2xl font-semibold">{graph.diagrams.length}</div>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">By type</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(componentTypeMeta).map(([type, meta]) => (
            <Link
              key={type}
              to={`/catalog?type=${type}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-sm hover:bg-accent"
            >
              {meta.plural}
              <span className="ml-2 text-muted-foreground">{counts[type] ?? 0}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Workflow className="size-4" /> Diagrams
          </h2>
          <div className="space-y-2">
            {graph.diagrams.map((diagram) => (
              <Link key={diagram.id} to={`/diagrams/${diagram.id}`}>
                <Card className="hover:bg-accent/40">
                  <div className="font-medium">{diagram.name}</div>
                  <div className="text-xs text-muted-foreground">{diagram.kind} view</div>
                </Card>
              </Link>
            ))}
            {graph.diagrams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No diagrams yet.</p>
            ) : null}
          </div>
        </div>
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpen className="size-4" /> Wiki
          </h2>
          <div className="space-y-2">
            {wiki.slice(0, 6).map((page) => (
              <Link key={page.id} to={`/pages/${page.id}`}>
                <Card className="hover:bg-accent/40">
                  <div className="font-medium">{page.title}</div>
                </Card>
              </Link>
            ))}
            {wiki.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pages yet.</p>
            ) : null}
          </div>
          <Link
            to="/catalog"
            className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Box className="size-4" /> Open catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
