import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, RotateCcw, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useConfigItemControllerFindAll,
  getConfigItemControllerFindAllQueryKey,
} from "@/api/generated/config-center-config-items/config-center-config-items";
import { useNamespaceControllerFindOne } from "@/api/generated/config-center-namespaces/config-center-namespaces";
import type { Namespace } from "@/features/namespace";
import type {
  ConfigItem,
  ConfigItemListResponse,
} from "@/features/config-item/types";
import { ConfigItemTable } from "./ConfigItemTable";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

export function ConfigItemListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { namespace } = useParams<{ namespace: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page")) || 1;
  const pageSize =
    Number(searchParams.get("pageSize") ?? searchParams.get("limit")) || 10;
  const isEnabled = searchParams.get("isEnabled") || "all";
  const keyFilter = searchParams.get("key") || "";
  const [deleteItem, setDeleteItem] = useState<ConfigItem | null>(null);
  const [keyInput, setKeyInput] = useState(keyFilter);

  const { data: namespaceData } = useNamespaceControllerFindOne<Namespace>(
    namespace || "",
    {
      query: { enabled: !!namespace },
    },
  );

  // 由于后端 Swagger 缺失响应 schema 和 key 查询参数，需手动指定泛型类型并使用类型断言
  const { data, isLoading } = useConfigItemControllerFindAll<
    ConfigItemListResponse,
    unknown
  >(
    namespace || "",
    {
      page,
      pageSize,
      isEnabled:
        isEnabled === "true"
          ? "true"
          : isEnabled === "false"
            ? "false"
            : undefined,
      key: keyFilter || undefined,
    } as Parameters<typeof useConfigItemControllerFindAll>[1],
    {
      query: { enabled: !!namespace },
    },
  );

  // 参数校验：namespace 必须存在
  if (!namespace) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">缺少命名空间参数</p>
          <Button
            className="mt-4"
            onClick={() => navigate("/config/namespaces")}
          >
            返回命名空间列表
          </Button>
        </div>
      </div>
    );
  }

  const handleReset = () => {
    setKeyInput("");
    setSearchParams({ page: "1", pageSize: String(pageSize) });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  const handleStatusFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("isEnabled");
    } else {
      params.set("isEnabled", value);
    }
    params.set("page", "1");
    setSearchParams(params);
  };

  const handleKeySearch = () => {
    const params = new URLSearchParams(searchParams);
    if (keyInput.trim()) {
      params.set("key", keyInput.trim());
    } else {
      params.delete("key");
    }
    params.set("page", "1");
    setSearchParams(params);
  };

  const handleKeyInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleKeySearch();
    }
  };

  const handleCreate = () => {
    navigate(`/config/namespaces/${namespace}/items/create`);
  };

  const handleEdit = (item: ConfigItem) => {
    navigate(`/config/namespaces/${namespace}/items/${item.key}/edit`);
  };

  const handleDelete = (item: ConfigItem) => {
    setDeleteItem(item);
  };

  const handleDeleteSuccess = () => {
    setDeleteItem(null);
    if (namespace) {
      queryClient.invalidateQueries({
        queryKey: getConfigItemControllerFindAllQueryKey(namespace),
      });
    }
  };

  const handleViewHistory = (item: ConfigItem) => {
    navigate(`/config/namespaces/${namespace}/items/${item.key}/history`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/config/namespaces")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">配置项管理</h1>
          <p className="text-muted-foreground">
            命名空间:{" "}
            <span className="font-mono font-semibold">{namespace}</span>
            {namespaceData && ` (${namespaceData.displayName})`}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新建配置项
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full md:w-64">
              <label className="mb-2 block text-sm font-medium">配置键</label>
              <div className="flex gap-2">
                <Input
                  placeholder="输入配置键关键字..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={handleKeyInputKeyDown}
                  className="font-mono"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleKeySearch}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="w-full md:w-48">
              <label className="mb-2 block text-sm font-medium">状态</label>
              <Select
                value={isEnabled}
                onValueChange={handleStatusFilterChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="true">已启用</SelectItem>
                  <SelectItem value="false">已禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>配置项列表</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigItemTable
            data={data?.items}
            isLoading={isLoading}
            currentPage={page}
            totalPages={
              (data?.pagination?.pageSize ?? pageSize) > 0
                ? Math.ceil(
                    (data?.pagination?.total || 0) /
                      (data?.pagination?.pageSize ?? pageSize),
                  )
                : 0
            }
            onPageChange={handlePageChange}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onViewHistory={handleViewHistory}
          />
        </CardContent>
      </Card>

      {deleteItem && namespace && (
        <DeleteConfirmDialog
          item={deleteItem}
          namespace={namespace}
          onClose={() => setDeleteItem(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
