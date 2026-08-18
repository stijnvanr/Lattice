import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Box,
  Download,
  Home,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Upload,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toastErrors, useWorkspace, wikiPages } from "@/store/workspace";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/catalog", label: "Catalog", icon: Box },
  { to: "/pages", label: "Pages", icon: BookOpen },
  { to: "/diagrams", label: "Diagrams", icon: Workflow },
];

const settingsNav = [{ to: "/settings/metamodel", label: "Metamodel", icon: Settings }];

export function AppShell() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    workspaces,
    currentId,
    graph,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    resetLocalData,
    exportBundle,
    importBundle,
  } = useWorkspace();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("Untitled");
  const [importOpen, setImportOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<unknown>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const results = useMemo(() => {
    if (!graph || query.trim().length < 1) return [];
    const q = query.toLowerCase();
    const components = graph.components
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((c) => ({ kind: "component" as const, id: c.id, label: c.name, hint: c.type }));
    const pages = wikiPages(graph.pages)
      .filter((p) => p.title.toLowerCase().includes(q))
      .slice(0, 4)
      .map((p) => ({ kind: "page" as const, id: p.id, label: p.title, hint: "page" }));
    return [...components, ...pages];
  }, [graph, query]);

  function onExport() {
    const result = exportBundle();
    if (!result.ok) {
      toast.error(toastErrors(result.errors));
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.data.workspace.slug}.lattice.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workspace exported");
  }

  function onPickFile(file: File) {
    void file.text().then((text) => {
      try {
        setPendingImport(JSON.parse(text));
        setImportOpen(true);
      } catch {
        toast.error("File is not valid JSON");
      }
    });
  }

  function runImport(mode: "new" | "replace") {
    if (!pendingImport) return;
    const result = importBundle(pendingImport, mode);
    setImportOpen(false);
    setPendingImport(null);
    if (!result.ok) {
      toast.error(toastErrors(result.errors));
      return;
    }
    if (result.warnings?.length) toast.message(result.warnings.join("\n"));
    toast.success(mode === "new" ? "Imported as a new workspace" : "Replaced current workspace");
    navigate("/");
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="px-4 py-4">
          <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Lattice
          </div>
          <div className="mt-1 text-sm text-muted-foreground">Architecture studio</div>
        </div>
        <nav className="flex flex-1 flex-col px-2">
          <div className="flex flex-col gap-0.5">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
                    isActive ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-accent",
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-auto border-t border-border pt-3">
            <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Settings
            </div>
            <div className="flex flex-col gap-0.5">
              {settingsNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
                      isActive ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-accent",
                    )
                  }
                >
                  <item.icon className="size-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
        <div className="p-3 text-[11px] text-muted-foreground">Graph is source of truth</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-3 border-b border-border bg-card px-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="max-w-64 truncate font-medium">
                {graph?.workspace.name ?? "Workspace"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onSelect={() => {
                    switchWorkspace(workspace.id);
                    navigate("/");
                  }}
                >
                  {workspace.name}
                  {workspace.id === currentId ? (
                    <span className="ml-auto text-[11px] text-muted-foreground">current</span>
                  ) : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                <Plus className="size-4" /> New workspace
              </DropdownMenuItem>
              {currentId && workspaces.length > 1 ? (
                <DropdownMenuItem
                  onSelect={() => {
                    const result = deleteWorkspace(currentId);
                    if (!result.ok) toast.error(toastErrors(result.errors));
                  }}
                >
                  Delete current
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              placeholder="Search catalog and pages"
              className="pl-8"
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
            />
            {searchOpen && results.length > 0 ? (
              <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-popover p-1 shadow-md">
                {results.map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onMouseDown={() => {
                      navigate(item.kind === "page" ? `/pages/${item.id}` : `/catalog/${item.id}`);
                      setQuery("");
                    }}
                  >
                    <span>{item.label}</span>
                    <span className="text-[11px] text-muted-foreground">{item.hint}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload /> Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPickFile(file);
              e.target.value = "";
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setResetOpen(true)}>Reset to sample</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>Creates a blank workspace.</DialogDescription>
          <Input className="mt-3" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const result = createWorkspace(newName);
                if (!result.ok) toast.error(toastErrors(result.errors));
                else {
                  setCreateOpen(false);
                  navigate("/");
                }
              }}
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogTitle>Import workspace</DialogTitle>
          <DialogDescription>
            Import as a new workspace (safe) or replace the current one.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => runImport("replace")}>
              Replace current
            </Button>
            <Button onClick={() => runImport("new")}>Import as new</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Reset to the Northstar sample?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes every workspace in this browser and loads the sample invoicing product again.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void resetLocalData().then(() => {
                  toast.success("Sample workspace loaded");
                  navigate("/");
                });
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function BootGate() {
  const boot = useWorkspace((s) => s.boot);
  const ready = useWorkspace((s) => s.ready);
  const error = useWorkspace((s) => s.error);

  useEffect(() => {
    void boot();
  }, [boot]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Lattice
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Opening local workspace…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Could not open the local database</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return <AppShell />;
}
