import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Plus, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useNamespaceControllerFindAll,
  getNamespaceControllerFindAllQueryKey,
} from "@/api/generated/config-center-namespaces/config-center-namespaces";
import type {
  Namespace,
  NamespaceListResponse,
} from "@/features/namespace/types";
import { NamespaceTable } from "./NamespaceTable";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

export function NamespaceListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page")) || 1;
  const pageSize =
    Number(searchParams.get("pageSize") ?? searchParams.get("limit")) || 10;
  const isEnabled = searchParams.get("isEnabled");

  const [deleteItem, setDeleteItem] = useState<Namespace | null>(null);

  const { data, isLoading } =
    useNamespaceControllerFindAll<NamespaceListResponse>({
      page,
      pageSize,
      isEnabled:
        isEnabled === "true"
          ? "true"
          : isEnabled === "false"
            ? "false"
            : undefined,
    });

  const handleReset = () => {
    // 重置筛选条件，保留分页设置
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

  const handleCreate = () => {
    navigate("/config/namespaces/create");
  };

  const handleEdit = (item: Namespace) => {
    navigate(`/config/namespaces/${item.name}/edit`);
  };

  const handleDelete = (item: Namespace) => {
    setDeleteItem(item);
  };

  const handleDeleteSuccess = () => {
    setDeleteItem(null);
    queryClient.invalidateQueries({
      queryKey: getNamespaceControllerFindAllQueryKey(),
    });
  };

  const handleViewConfigs = (item: Namespace) => {
    navigate(`/config/namespaces/${item.name}/items`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">配置命名空间</h1>
          <p className="text-muted-foreground">
            管理配置命名空间，用于隔离不同环境或模块的配置
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新建命名空间
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full md:w-48">
              <label className="mb-2 block text-sm font-medium">状态</label>
              <Select
                value={isEnabled || "all"}
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
          <CardTitle>命名空间列表</CardTitle>
        </CardHeader>
        <CardContent>
          <NamespaceTable
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
            onViewConfigs={handleViewConfigs}
          />
        </CardContent>
      </Card>

      {deleteItem && (
        <DeleteConfirmDialog
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
