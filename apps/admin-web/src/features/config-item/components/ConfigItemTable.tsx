import { Pencil, Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ConfigItem } from "../types";
import { formatDateTime } from "@/lib/utils";
import { TableLoading, TableEmpty } from "@/components/common/TableStates";
import { Pagination } from "@/components/common/Pagination";
import { ValueTypeBadge } from "./ValueTypeBadge";
import { ConfigItemValue } from "./ConfigItemValue";

interface ConfigItemTableProps {
  data?: ConfigItem[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (item: ConfigItem) => void;
  onDelete: (item: ConfigItem) => void;
  onViewHistory: (item: ConfigItem) => void;
}

export function ConfigItemTable({
  data,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  onViewHistory,
}: ConfigItemTableProps) {
  if (isLoading) {
    return <TableLoading />;
  }

  if (!data || data.length === 0) {
    return <TableEmpty message="暂无配置项" />;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left text-sm font-medium">
                配置键
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                值类型
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                配置值
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">描述</th>
              <th className="px-4 py-3 text-left text-sm font-medium">版本</th>
              <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                更新时间
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id} className="border-b hover:bg-muted/50">
                <td className="px-4 py-3 font-mono text-sm">{item.key}</td>
                <td className="px-4 py-3">
                  <ValueTypeBadge type={item.valueType} />
                </td>
                <td className="px-4 py-3">
                  <ConfigItemValue
                    value={item.value}
                    isEncrypted={item.isEncrypted}
                  />
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {item.description || "-"}
                </td>
                <td className="px-4 py-3 text-sm">v{item.version}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {item.isEnabled ? (
                      <Badge variant="default">已启用</Badge>
                    ) : (
                      <Badge variant="secondary">已禁用</Badge>
                    )}
                    {item.isEncrypted && (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700"
                      >
                        加密
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDateTime(item.updatedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewHistory(item)}
                      title="查看历史"
                    >
                      <History className="h-4 w-4" />
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
