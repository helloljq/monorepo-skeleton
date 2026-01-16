import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
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
  useRoleControllerFindAll,
  getRoleControllerFindAllQueryKey,
} from "@/api/generated/role/role";
import type { Role, RoleListResponse } from "@/features/role/types";
import { RoleTable } from "./RoleTable";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

export function RoleListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page")) || 1;
  const pageSize =
    Number(searchParams.get("pageSize") ?? searchParams.get("limit")) || 10;
  const isEnabled = searchParams.get("isEnabled");

  const [deleteItem, setDeleteItem] = useState<Role | null>(null);

  const { data, isLoading } = useRoleControllerFindAll<RoleListResponse>({
    page,
    pageSize,
  });

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
    navigate("/system/roles/create");
  };

  const handleEdit = (item: Role) => {
    navigate(`/system/roles/${item.id}/edit`);
  };

  const handleConfigPermissions = (item: Role) => {
    navigate(`/system/roles/${item.id}/permissions`);
  };

  const handleDelete = (item: Role) => {
    setDeleteItem(item);
  };

  const handleDeleteSuccess = () => {
    setDeleteItem(null);
    queryClient.invalidateQueries({
      queryKey: getRoleControllerFindAllQueryKey(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">角色管理</h1>
          <p className="text-muted-foreground">管理系统角色，配置角色权限</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增角色
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-[150px]">
              <label className="mb-2 block text-sm font-medium">状态</label>
              <Select
                value={isEnabled === null ? "all" : isEnabled || "all"}
                onValueChange={handleStatusFilterChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="true">已启用</SelectItem>
                  <SelectItem value="false">已禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <RoleTable
            data={Array.isArray(data?.items) ? data.items : []}
            isLoading={isLoading}
            pagination={{
              page,
              pageSize: data?.pagination?.pageSize ?? pageSize,
              total: data?.pagination?.total || 0,
              totalPages:
                (data?.pagination?.pageSize ?? pageSize) > 0
                  ? Math.ceil(
                      (data?.pagination?.total || 0) /
                        (data?.pagination?.pageSize ?? pageSize),
                    )
                  : 0,
            }}
            onPageChange={handlePageChange}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onConfigPermissions={handleConfigPermissions}
          />
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        item={deleteItem}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
