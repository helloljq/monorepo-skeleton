import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Permission } from "@/features/permission";

interface PermissionTreeNode {
  id: string;
  label: string;
  type: "module" | "resource" | "permission";
  checked: boolean;
  indeterminate?: boolean;
  children?: PermissionTreeNode[];
}

interface PermissionTreeSelectProps {
  permissions: Permission[];
  selectedPermissionIds: string[];
  onChange: (permissionIds: string[]) => void;
}

export function PermissionTreeSelect({
  permissions,
  selectedPermissionIds,
  onChange,
}: PermissionTreeSelectProps) {
  const [treeData, setTreeData] = useState<PermissionTreeNode[]>([]);

  // 将扁平权限列表转换为树形结构
  useEffect(() => {
    const updateNodeState = (node: PermissionTreeNode) => {
      if (!node.children || node.children.length === 0) {
        return;
      }

      const checkedCount = node.children.filter(
        (child) => child.checked,
      ).length;
      const indeterminateCount = node.children.filter(
        (child) => child.indeterminate,
      ).length;
      const totalCount = node.children.length;

      if (checkedCount === totalCount) {
        node.checked = true;
        node.indeterminate = false;
      } else if (checkedCount > 0 || indeterminateCount > 0) {
        node.checked = false;
        node.indeterminate = true;
      } else {
        node.checked = false;
        node.indeterminate = false;
      }
    };

    const moduleMap = new Map<string, PermissionTreeNode>();

    permissions.forEach((permission) => {
      const moduleName = permission.module || "未分类";

      // 创建或获取模块节点
      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, {
          id: `module-${moduleName}`,
          label: moduleName,
          type: "module",
          checked: false,
          indeterminate: false,
          children: [],
        });
      }

      const moduleNode = moduleMap.get(moduleName)!;

      // 查找或创建资源节点
      let resourceNode = moduleNode.children?.find(
        (n) => n.label === permission.resource,
      );
      if (!resourceNode) {
        resourceNode = {
          id: `resource-${permission.resource}`,
          label: permission.resource,
          type: "resource",
          checked: false,
          indeterminate: false,
          children: [],
        };
        moduleNode.children!.push(resourceNode);
      }

      // 添加权限节点
      resourceNode.children!.push({
        id: permission.id,
        label: `${permission.action} - ${permission.name}`,
        type: "permission",
        checked: selectedPermissionIds.includes(permission.id),
      });
    });

    // 计算父节点的选中状态
    const tree = Array.from(moduleMap.values());
    tree.forEach((moduleNode) => {
      moduleNode.children?.forEach((resourceNode) => {
        updateNodeState(resourceNode);
      });
      updateNodeState(moduleNode);
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTreeData(tree);
  }, [permissions, selectedPermissionIds]);

  const handleNodeToggle = (node: PermissionTreeNode) => {
    const newChecked = !node.checked;

    // 收集所有受影响的权限ID
    const affectedPermissionIds = collectPermissionIds(node);

    // 更新选中的权限ID列表
    let newSelectedIds = [...selectedPermissionIds];

    if (newChecked) {
      // 选中：添加所有子权限
      affectedPermissionIds.forEach((id) => {
        if (!newSelectedIds.includes(id)) {
          newSelectedIds.push(id);
        }
      });
    } else {
      // 取消选中：移除所有子权限
      newSelectedIds = newSelectedIds.filter(
        (id) => !affectedPermissionIds.includes(id),
      );
    }

    onChange(newSelectedIds);
  };

  const collectPermissionIds = (node: PermissionTreeNode): string[] => {
    if (node.type === "permission") {
      return [node.id];
    }

    if (!node.children) {
      return [];
    }

    return node.children.flatMap((child) => collectPermissionIds(child));
  };

  return (
    <div className="space-y-2">
      {treeData.map((moduleNode) => (
        <TreeNode
          key={moduleNode.id}
          node={moduleNode}
          onToggle={handleNodeToggle}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: PermissionTreeNode;
  onToggle: (node: PermissionTreeNode) => void;
  level?: number;
}

function TreeNode({ node, onToggle, level = 0 }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted",
          level > 0 && "ml-6",
        )}
      >
        {hasChildren ? (
          <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="flex flex-1 items-center"
          >
            <CollapsibleTrigger asChild>
              <button className="flex h-6 w-6 items-center justify-center rounded-sm hover:bg-accent">
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isOpen && "rotate-90",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <div className="flex flex-1 items-center gap-2">
              <Checkbox
                checked={node.checked}
                // @ts-expect-error - indeterminate is a valid prop but not in the type definition
                indeterminate={node.indeterminate}
                onCheckedChange={() => onToggle(node)}
              />
              <span
                className={cn(
                  "flex-1 text-sm",
                  node.type === "module" && "font-semibold",
                  node.type === "resource" && "font-medium",
                )}
              >
                {node.label}
                {hasChildren && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({node.children!.length})
                  </span>
                )}
              </span>
            </div>
          </Collapsible>
        ) : (
          <>
            <div className="h-6 w-6" />
            <Checkbox
              checked={node.checked}
              onCheckedChange={() => onToggle(node)}
            />
            <span className="flex-1 text-sm">{node.label}</span>
          </>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="ml-6 mt-1 space-y-1">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
