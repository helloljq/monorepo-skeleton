import { Pencil, Trash2, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Namespace } from "../types";
import { formatDateTime } from "@/lib/utils";
import { TableLoading, TableEmpty } from "@/components/common/TableStates";
import { Pagination } from "@/components/common/Pagination";

interface NamespaceTableProps {
  data?: Namespace[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (item: Namespace) => void;
  onDelete: (item: Namespace) => void;
  onViewConfigs: (item: Namespace) => void;
}

export function NamespaceTable({
  data,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  onViewConfigs,
}: NamespaceTableProps) {
  if (isLoading) {
    return <TableLoading />;
  }

  if (!data || data.length === 0) {
    return <TableEmpty message="暂无命名空间" />;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left text-sm font-medium">
                命名空间名称
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                显示名称
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">描述</th>
              <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                创建时间
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                更新时间
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.name} className="border-b hover:bg-muted/50">
                <td className="px-4 py-3 font-mono text-sm">{item.name}</td>
                <td className="px-4 py-3 text-sm">{item.displayName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {item.description || "-"}
                </td>
                <td className="px-4 py-3">
                  {item.isEnabled ? (
                    <Badge variant="default">已启用</Badge>
                  ) : (
                    <Badge variant="secondary">已禁用</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDateTime(item.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDateTime(item.updatedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewConfigs(item)}
                      title="查看配置项"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
