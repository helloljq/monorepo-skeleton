import { Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function DashboardLayout() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <Header />

      <main
        className={cn(
          "min-h-[calc(100vh-3.5rem)] p-4 transition-all duration-300 md:p-6",
          sidebarCollapsed ? "md:ml-16" : "md:ml-64",
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
