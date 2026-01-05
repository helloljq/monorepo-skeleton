import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { MenuItem } from "@/types/menu";

interface SidebarNavProps {
  items: MenuItem[];
  collapsed: boolean;
}

interface NavItemProps {
  item: MenuItem;
  collapsed: boolean;
  depth?: number;
}

function NavItem({ item, collapsed, depth = 0 }: NavItemProps) {
  const location = useLocation();
  const [open, setOpen] = useState(() => {
    if (item.children) {
      return item.children.some((child) => location.pathname === child.path);
    }
    return false;
  });

  const Icon = item.icon;
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.path === location.pathname;

  const content = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">
              {item.badge}
            </Badge>
          )}
          {hasChildren && (
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                open && "rotate-180",
              )}
            />
          )}
        </>
      )}
    </>
  );

  const itemClass = cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    "hover:bg-accent hover:text-accent-foreground",
    isActive && "bg-accent text-accent-foreground",
    collapsed && "w-full justify-center px-2",
    depth > 0 && !collapsed && "ml-4",
  );

  if (hasChildren) {
    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button className={itemClass}>{content}</button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex flex-col gap-1 p-2">
            <p className="font-medium">{item.label}</p>
            {item.children?.map((child) => (
              <NavLink
                key={child.key}
                to={child.path || "#"}
                className={({ isActive }) =>
                  cn(
                    "rounded px-2 py-1 text-sm hover:bg-accent",
                    isActive && "bg-accent",
                  )
                }
              >
                {child.label}
              </NavLink>
            ))}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className={itemClass}>{content}</button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-1 space-y-1">
          {item.children?.map((child) => (
            <NavItem
              key={child.key}
              item={child}
              collapsed={collapsed}
              depth={depth + 1}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const linkElement = (
    <NavLink to={item.path || "#"} className={itemClass}>
      {content}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return linkElement;
}

export function SidebarNav({ items, collapsed }: SidebarNavProps) {
  return (
    <nav className="space-y-1 px-2">
      {items.map((item) => (
        <NavItem key={item.key} item={item} collapsed={collapsed} />
      ))}
    </nav>
  );
}
