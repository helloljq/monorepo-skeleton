import { Undo, Eye, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ConfigItemHistory } from "../types";
import { formatDateTime } from "@/lib/utils";
import { TableLoading, TableEmpty } from "@/components/common/TableStates";
import { ValueTypeBadge } from "./ValueTypeBadge";

interface ConfigItemHistoryTableProps {
  data?: ConfigItemHistory[];
  isLoading: boolean;
  onRollback: (version: number) => void;
  onViewValue: (item: ConfigItemHistory) => void;
  onCompare: () => void;
}

export function ConfigItemHistoryTable({
  data,
  isLoading,
  onRollback,
  onViewValue,
  onCompare,
}: ConfigItemHistoryTableProps) {
  if (isLoading) {
    return <TableLoading />;
  }

  if (!data || data.length === 0) {
    return <TableEmpty message="暂无历史记录" />;
  }

  // 前端排序确保按版本倒序排列（最新版本在前）
  const sortedData = [...data].sort((a, b) => b.version - a.version);
  const latestVersion = sortedData[0]?.version || 0;

  const formatValue = (value: unknown): string => {
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const truncateValue = (value: unknown, maxLength: number = 100): string => {
    const str = formatValue(value);
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + "...";
    }
    return str;
  };

  return (
    <div className="space-y-4">
      {sortedData.length > 1 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onCompare}>
            <GitCompare className="mr-2 h-4 w-4" />
            版本对比
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left text-sm font-medium">版本</th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                值类型
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                配置值
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                操作人
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                操作时间
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item) => (
              <tr key={item.id} className="border-b hover:bg-muted/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">v{item.version}</span>
                    {item.version === latestVersion && (
                      <Badge variant="default" className="text-xs">
                        当前版本
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ValueTypeBadge type={item.valueType} />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="max-w-md cursor-pointer text-left"
                    onClick={() => onViewValue(item)}
                    title="点击查看全文"
                  >
                    <pre className="overflow-hidden rounded bg-muted p-2 font-mono text-xs transition-colors hover:bg-muted/80">
                      {truncateValue(item.value)}
                    </pre>
                  </button>
                </td>
                <td className="px-4 py-3 text-sm">
                  {item.operatorName}
                  <span className="ml-2 text-xs text-muted-foreground">
                    (ID: {item.operatorId})
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDateTime(item.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewValue(item)}
                      title="查看全文"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {item.version !== latestVersion && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRollback(item.version)}
                        title="回滚到此版本"
                      >
                        <Undo className="mr-2 h-4 w-4" />
                        回滚
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
