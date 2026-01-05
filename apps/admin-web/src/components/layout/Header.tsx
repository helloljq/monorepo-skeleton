import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserNav } from "./UserNav";
import { SidebarNav } from "./SidebarNav";
import { menuConfig } from "@/config/menu";
import { useUIStore } from "@/stores/uiStore";

export function Header() {
  const { sidebarCollapsed, sidebarMobileOpen, setSidebarMobileOpen } =
    useUIStore();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 transition-all duration-300",
        sidebarCollapsed ? "md:ml-16" : "md:ml-64",
      )}
    >
      <Sheet open={sidebarMobileOpen} onOpenChange={setSidebarMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">打开菜单</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-14 items-center border-b px-4">
            <span className="text-lg font-semibold">管理后台</span>
          </div>
          <ScrollArea className="h-[calc(100vh-3.5rem)] py-4">
            <TooltipProvider>
              <SidebarNav items={menuConfig} collapsed={false} />
            </TooltipProvider>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <UserNav />
    </header>
  );
}
