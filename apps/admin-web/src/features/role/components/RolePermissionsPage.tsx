import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useRoleControllerFindOne,
  useRoleControllerAssignPermissions,
  useRoleControllerFindRolePermissions,
} from "@/api/generated/role/role";
import { usePermissionControllerFindAll } from "@/api/generated/permission/permission";
import type { Role } from "../types";
import type {
  Permission,
  PermissionListResponse,
} from "@/features/permission/types";
import { PermissionTreeSelect } from "./PermissionTreeSelect";

export function RolePermissionsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>(
    [],
  );

  // 获取角色详情
  const { data: role, isLoading: isLoadingRole } =
    useRoleControllerFindOne<Role>(Number(id));

  // 获取所有权限（不分页）
  const { data: permissionsData, isLoading: isLoadingPermissions } =
    usePermissionControllerFindAll<PermissionListResponse>({
      page: 1,
      limit: 1000, // 获取所有权限
    });

  // 获取角色已有权限
  const { data: rolePermissions, isLoading: isLoadingRolePermissions } =
    useRoleControllerFindRolePermissions<Permission[]>(Number(id));

  const assignPermissionsMutation = useRoleControllerAssignPermissions();

  // 初始化已选中的权限 - 使用 useMemo 避免在 effect 中直接调用 setState
  const initialSelectedIds = useMemo(() => {
    if (!rolePermissions) return [];
    // rolePermissions 可能是 Permission[] 数组或 { id: number }[] 数组
    // 需要提取 ID
    return Array.isArray(rolePermissions)
      ? rolePermissions.map((p: Permission | { id: number }) => p.id)
      : [];
  }, [rolePermissions]);

  useEffect(() => {
    if (initialSelectedIds.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedPermissionIds(initialSelectedIds);
    }
  }, [initialSelectedIds]);

  const handleSave = async () => {
    if (!id) return;

    try {
      await assignPermissionsMutation.mutateAsync({
        id: Number(id),
        data: {
          permissionIds: selectedPermissionIds,
        },
      });
      toast.success("权限配置保存成功");
      navigate("/system/roles");
    } catch {
      toast.error("权限配置保存失败");
    }
  };

  const isLoadingPermissionConfig =
    isLoadingPermissions || isLoadingRolePermissions;

  if (isLoadingRole) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
        <Card>
          <CardHeader className="space-y-3">
            <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-20 w-full animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">角色不存在</p>
        </div>
      </div>
    );
  }

  const permissions = permissionsData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/system/roles")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">配置角色权限</h1>
          <p className="text-muted-foreground">为角色分配权限</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">角色信息</CardTitle>
          <CardDescription>当前配置的角色</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-sm text-muted-foreground">角色编码</div>
              <div className="font-mono text-sm font-medium">{role.code}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">角色名称</div>
              <div className="font-medium">{role.name}</div>
            </div>
            {role.description && (
              <div>
                <div className="text-sm text-muted-foreground">描述</div>
                <div className="text-sm">{role.description}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground">状态</div>
              <Badge variant={role.isEnabled ? "default" : "secondary"}>
                {role.isEnabled ? "启用" : "禁用"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">权限配置</CardTitle>
          <CardDescription>
            选择要分配给该角色的权限
            {!isLoadingPermissionConfig &&
              ` (已选中 ${selectedPermissionIds.length} 个权限)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPermissionConfig ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 w-full animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : permissions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              暂无权限数据
            </div>
          ) : (
            <PermissionTreeSelect
              permissions={permissions}
              selectedPermissionIds={selectedPermissionIds}
              onChange={setSelectedPermissionIds}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate("/system/roles")}>
          取消
        </Button>
        <Button
          onClick={handleSave}
          disabled={
            assignPermissionsMutation.isPending || isLoadingPermissionConfig
          }
        >
          <Save className="mr-2 h-4 w-4" />
          {assignPermissionsMutation.isPending ? "保存中..." : "保存权限配置"}
        </Button>
      </div>
    </div>
  );
}
