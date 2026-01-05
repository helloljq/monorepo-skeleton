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
import { Checkbox } from "@/components/ui/checkbox";
import {
  useUserControllerFindOne,
  useUserControllerAssignRoles,
  useUserControllerFindUserRoles,
} from "@/api/generated/user/user";
import { useRoleControllerFindAll } from "@/api/generated/role/role";
import type { User, UserRole } from "../types";
import type { RoleListResponse } from "@/features/role/types";

export function UserRolesPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

  // 获取用户详情
  const { data: user, isLoading: isLoadingUser } =
    useUserControllerFindOne<User>(Number(id));

  // 获取所有角色（不分页）
  const { data: rolesData, isLoading: isLoadingRoles } =
    useRoleControllerFindAll<RoleListResponse>({
      page: 1,
      limit: 1000, // 获取所有角色
    });

  // 获取用户已有角色
  const { data: userRoles, isLoading: isLoadingUserRoles } =
    useUserControllerFindUserRoles<UserRole[]>(Number(id));

  const assignRolesMutation = useUserControllerAssignRoles();

  // 初始化已选中的角色
  const initialSelectedIds = useMemo(() => {
    if (!userRoles) return [];
    return Array.isArray(userRoles) ? userRoles.map((r: UserRole) => r.id) : [];
  }, [userRoles]);

  useEffect(() => {
    if (initialSelectedIds.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedRoleIds(initialSelectedIds);
    }
  }, [initialSelectedIds]);

  const handleToggleRole = (roleId: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
  };

  const handleSave = async () => {
    if (!id) return;

    try {
      await assignRolesMutation.mutateAsync({
        id: Number(id),
        data: {
          roleIds: selectedRoleIds,
        },
      });
      toast.success("角色配置保存成功");
      navigate("/system/users");
    } catch {
      toast.error("角色配置保存失败");
    }
  };

  const isLoading = isLoadingUser || isLoadingRoles || isLoadingUserRoles;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
        <Card>
          <CardHeader className="space-y-3">
            <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-10 w-full animate-pulse rounded-md bg-muted"
              />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">用户不存在</p>
        </div>
      </div>
    );
  }

  const roles = rolesData?.data || [];

  const getStatusBadge = (status: User["status"]) => {
    const variants = {
      ACTIVE: { variant: "default" as const, label: "正常" },
      DISABLED: { variant: "secondary" as const, label: "禁用" },
      PENDING: { variant: "outline" as const, label: "待激活" },
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/system/users")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">配置用户角色</h1>
          <p className="text-muted-foreground">为用户分配角色</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">用户信息</CardTitle>
          <CardDescription>当前配置的用户</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-sm text-muted-foreground">用户ID</div>
              <div className="font-mono text-sm font-medium">{user.id}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">邮箱</div>
              <div className="font-medium">{user.email}</div>
            </div>
            {user.name && (
              <div>
                <div className="text-sm text-muted-foreground">姓名</div>
                <div className="text-sm">{user.name}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground">状态</div>
              {getStatusBadge(user.status)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">角色配置</CardTitle>
          <CardDescription>
            选择要分配给该用户的角色（已选中 {selectedRoleIds.length} 个角色）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              暂无角色数据
            </div>
          ) : (
            <div className="space-y-4">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50"
                >
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={selectedRoleIds.includes(role.id)}
                    onCheckedChange={() => handleToggleRole(role.id)}
                  />
                  <label
                    htmlFor={`role-${role.id}`}
                    className="flex flex-1 cursor-pointer items-center gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{role.name}</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          {role.code}
                        </Badge>
                        <Badge
                          variant={role.isEnabled ? "default" : "secondary"}
                        >
                          {role.isEnabled ? "启用" : "禁用"}
                        </Badge>
                      </div>
                      {role.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {role.description}
                        </p>
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate("/system/users")}>
          取消
        </Button>
        <Button onClick={handleSave} disabled={assignRolesMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {assignRolesMutation.isPending ? "保存中..." : "保存角色配置"}
        </Button>
      </div>
    </div>
  );
}
