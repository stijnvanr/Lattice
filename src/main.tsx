import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { BootGate } from "@/components/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CatalogDetailPage } from "@/pages/CatalogDetailPage";
import { CatalogPage } from "@/pages/CatalogPage";
import { HomePage } from "@/pages/HomePage";
import { MetamodelSettingsPage } from "@/pages/MetamodelSettingsPage";
import { PagesPage } from "@/pages/PagesPage";
import "./index.css";

const DiagramsPage = lazy(() =>
  import("@/pages/DiagramsPage").then((module) => ({ default: module.DiagramsPage })),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <BrowserRouter>
          <Routes>
            <Route element={<BootGate />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/catalog/:id" element={<CatalogDetailPage />} />
              <Route path="/pages" element={<PagesPage />} />
              <Route path="/pages/:id" element={<PagesPage />} />
              <Route path="/settings/metamodel" element={<MetamodelSettingsPage />} />
              <Route
                path="/diagrams"
                element={
                  <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading canvas…</div>}>
                    <DiagramsPage />
                  </Suspense>
                }
              />
              <Route
                path="/diagrams/:id"
                element={
                  <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading canvas…</div>}>
                    <DiagramsPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  </StrictMode>,
);
