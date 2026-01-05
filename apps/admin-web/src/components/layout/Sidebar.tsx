import { PanelLeftClose, PanelLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarNav } from "./SidebarNav";
import { menuConfig } from "@/config/menu";
import { useUIStore } from "@/stores/uiStore";

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-background transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center border-b px-4",
            sidebarCollapsed && "justify-center px-2",
          )}
        >
          {!sidebarCollapsed && (
            <span className="text-lg font-semibold">管理后台</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", !sidebarCollapsed && "ml-auto")}
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1 py-4">
          <SidebarNav items={menuConfig} collapsed={sidebarCollapsed} />
        </ScrollArea>
      </aside>
    </TooltipProvider>
  );
}
