import { useMemo } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocEditor } from "@/components/editor/DocEditor";
import { toastErrors, useWorkspace, wikiPages } from "@/store/workspace";
import { cn } from "@/lib/utils";
import type { Page } from "@/schema/page";

function pageTree(pages: Page[]) {
  const wiki = wikiPages(pages).slice().sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const byParent = new Map<string | undefined, Page[]>();
  for (const page of wiki) {
    const list = byParent.get(page.parentId) ?? [];
    list.push(page);
    byParent.set(page.parentId, list);
  }
  const rows: Array<{ page: Page; depth: number }> = [];
  const walk = (page: Page, depth: number) => {
    rows.push({ page, depth });
    for (const child of byParent.get(page.id) ?? []) walk(child, depth + 1);
  };
  for (const root of wiki.filter((p) => !p.parentId || !wiki.some((o) => o.id === p.parentId))) {
    walk(root, 0);
  }
  return rows;
}

export function PagesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const graph = useWorkspace((s) => s.graph);
  const createPage = useWorkspace((s) => s.createPage);
  const updatePage = useWorkspace((s) => s.updatePage);
  const deletePage = useWorkspace((s) => s.deletePage);

  const rows = useMemo(() => (graph ? pageTree(graph.pages) : []), [graph]);
  const selected = graph?.pages.find((p) => p.id === id) ?? rows[0]?.page;

  if (!graph) return null;

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between px-3 py-3">
          <div className="text-sm font-medium">Pages</div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              const result = createPage({ title: "Untitled", parentId: selected?.parentId });
              if (result.ok) navigate(`/pages/${result.data.id}`);
              else toast.error(toastErrors(result.errors));
            }}
          >
            <Plus />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {rows.map(({ page, depth }) => (
            <NavLink
              key={page.id}
              to={`/pages/${page.id}`}
              className={({ isActive }) =>
                cn(
                  "block truncate rounded-md px-2 py-1.5 text-sm",
                  isActive || page.id === selected?.id
                    ? "bg-secondary font-medium"
                    : "text-muted-foreground hover:bg-accent",
                )
              }
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              {page.title}
            </NavLink>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-auto p-8">
        {selected ? (
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex items-center gap-2">
              <Input
                className="h-10 border-none bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
                defaultValue={selected.title}
                key={selected.id}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== selected.title) {
                    const result = updatePage(selected.id, { title: next });
                    if (!result.ok) toast.error(toastErrors(result.errors));
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const result = createPage({ title: "Untitled", parentId: selected.id });
                  if (result.ok) navigate(`/pages/${result.data.id}`);
                  else toast.error(toastErrors(result.errors));
                }}
              >
                <Plus />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const result = deletePage(selected.id);
                  if (!result.ok) toast.error(toastErrors(result.errors));
                  else navigate("/pages");
                }}
              >
                <Trash2 />
              </Button>
            </div>
            <DocEditor
              key={selected.id}
              doc={selected.doc}
              components={graph.components}
              pages={graph.pages}
              onChange={(doc) => {
                const result = updatePage(selected.id, { doc });
                if (!result.ok) toast.error(toastErrors(result.errors));
              }}
            />
          </div>
        ) : (
          <div className="p-8 text-sm text-muted-foreground">Create a page to start writing.</div>
        )}
      </div>
    </div>
  );
}
