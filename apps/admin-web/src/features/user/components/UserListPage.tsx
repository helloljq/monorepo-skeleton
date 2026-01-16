import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Users as UsersIcon,
  Search,
  RotateCcw,
  CheckCircle,
  XCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import { useUserControllerFindAll } from "@/api/generated/user/user";
import { useRoleControllerFindAll } from "@/api/generated/role/role";
import type { RoleListResponse } from "@/features/role";
import type { User, UserListResponse } from "@/features/user/types";
import { UserTable } from "./UserTable";

export function UserListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page")) || 1;
  const pageSize =
    Number(searchParams.get("pageSize") ?? searchParams.get("limit")) || 10;
  const status = searchParams.get("status");

  // 从 URL 读取筛选参数
  const id = searchParams.get("id");
  const email = searchParams.get("email");
  const name = searchParams.get("name");
  const roleId = searchParams.get("roleId");

  // 本地状态管理输入值，直接从 URL 参数初始化
  const [idFilter, setIdFilter] = useState(id || "");
  const [emailFilter, setEmailFilter] = useState(email || "");
  const [nameFilter, setNameFilter] = useState(name || "");

  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 当 URL 参数变化时同步本地状态
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdFilter(id || "");

    setEmailFilter(email || "");

    setNameFilter(name || "");
  }, [id, email, name]);

  // 获取角色列表
  const { data: rolesData } = useRoleControllerFindAll<RoleListResponse>({
    page: 1,
    pageSize: 100,
    isEnabled: "true",
  });
  const roles = rolesData?.items || [];

  const { data, isLoading } = useUserControllerFindAll<UserListResponse>({
    page,
    pageSize,
    id: id || undefined,
    email: email || undefined,
    name: name || undefined,
    roleId: roleId || undefined,
    status: status as "ACTIVE" | "DISABLED" | "PENDING" | undefined,
  });

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams);

    if (idFilter) params.set("id", idFilter);
    else params.delete("id");

    if (emailFilter) params.set("email", emailFilter);
    else params.delete("email");

    if (nameFilter) params.set("name", nameFilter);
    else params.delete("name");

    params.set("page", "1");
    setSearchParams(params);
  };

  const handleReset = () => {
    setIdFilter("");
    setEmailFilter("");
    setNameFilter("");
    setSearchParams({ page: "1", pageSize: String(pageSize) });
  };

  const handleRoleFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("roleId");
    } else {
      params.set("roleId", value);
    }
    params.set("page", "1");
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  const handleStatusFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    params.set("page", "1");
    setSearchParams(params);
  };

  const handleAssignRoles = (user: User) => {
    navigate(`/system/users/${user.id}/roles`);
  };

  // 批量操作（待后端 API 支持）
  const handleBatchEnable = () => {
    toast.info(`批量启用功能开发中，已选择 ${selectedIds.length} 个用户`);
    // TODO: 等后端提供 API 后实现
    // 示例: mutation.mutate({ ids: selectedIds, status: 'ACTIVE' })
  };

  const handleBatchDisable = () => {
    toast.info(`批量禁用功能开发中，已选择 ${selectedIds.length} 个用户`);
    // TODO: 等后端提供 API 后实现
    // 示例: mutation.mutate({ ids: selectedIds, status: 'DISABLED' })
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground">管理系统用户，分配用户角色</p>
        </div>
        <div className="flex items-center gap-2">
          <UsersIcon className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {/* 用户 ID */}
            <div className="w-[150px]">
              <label className="mb-2 block text-sm font-medium">用户 ID</label>
              <Input
                placeholder="输入用户ID（UUID）"
                value={idFilter}
                onChange={(e) => setIdFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            {/* 邮箱 */}
            <div className="min-w-[200px] flex-1">
              <label className="mb-2 block text-sm font-medium">邮箱</label>
              <Input
                placeholder="输入邮箱"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            {/* 姓名 */}
            <div className="min-w-[200px] flex-1">
              <label className="mb-2 block text-sm font-medium">姓名</label>
              <Input
                placeholder="输入姓名"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            {/* 角色筛选 */}
            <div className="w-[200px]">
              <label className="mb-2 block text-sm font-medium">角色</label>
              <Select
                value={roleId || "all"}
                onValueChange={handleRoleFilterChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部角色</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 用户状态 */}
            <div className="w-[150px]">
              <label className="mb-2 block text-sm font-medium">用户状态</label>
              <Select
                value={status === null ? "all" : status || "all"}
                onValueChange={handleStatusFilterChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="ACTIVE">正常</SelectItem>
                  <SelectItem value="DISABLED">禁用</SelectItem>
                  <SelectItem value="PENDING">待激活</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button onClick={handleSearch}>
                <Search className="mr-2 h-4 w-4" />
                搜索
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        {/* 批量操作栏 */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between border-b bg-muted/50 px-6 py-3">
            <span className="text-sm text-muted-foreground">
              已选择{" "}
              <span className="font-medium text-foreground">
                {selectedIds.length}
              </span>{" "}
              个用户
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleBatchEnable}>
                <CheckCircle className="mr-1 h-4 w-4" />
                批量启用
              </Button>
              <Button size="sm" variant="outline" onClick={handleBatchDisable}>
                <XCircle className="mr-1 h-4 w-4" />
                批量禁用
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClearSelection}>
                <X className="mr-1 h-4 w-4" />
                取消选择
              </Button>
            </div>
          </div>
        )}
        <CardContent className="p-0">
          <UserTable
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
            onAssignRoles={handleAssignRoles}
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
          />
        </CardContent>
      </Card>
    </div>
  );
}
