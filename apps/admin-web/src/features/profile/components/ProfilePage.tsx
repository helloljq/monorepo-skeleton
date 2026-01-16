import { useState } from "react";
import { ArrowLeft, Mail, Phone, Trash2, Shield, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useIdentityControllerListIdentities,
  useIdentityControllerUnbindIdentity,
  getIdentityControllerListIdentitiesQueryKey,
} from "@/api/generated/identity/identity";
import { useAuthStore } from "@/stores/auth-store";
import { useQueryClient } from "@tanstack/react-query";
import { getProviderDisplayName } from "@/features/profile/types";
import { BindEmailDialog } from "./BindEmailDialog";
import { BindPhoneDialog } from "./BindPhoneDialog";

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [unbindId, setUnbindId] = useState<string | null>(null);
  const [bindEmailOpen, setBindEmailOpen] = useState(false);
  const [bindPhoneOpen, setBindPhoneOpen] = useState(false);

  const { data: identitiesData, isLoading } =
    useIdentityControllerListIdentities();
  const unbindMutation = useIdentityControllerUnbindIdentity();

  const identities = identitiesData?.identities || [];

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  const handleUnbind = async () => {
    if (!unbindId) return;

    try {
      await unbindMutation.mutateAsync({ id: unbindId });
      toast.success("解绑成功");
      queryClient.invalidateQueries({
        queryKey: getIdentityControllerListIdentitiesQueryKey(),
      });
    } catch {
      toast.error("解绑失败");
    } finally {
      setUnbindId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "EMAIL":
        return <Mail className="h-4 w-4" />;
      case "PHONE":
        return <Phone className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const hasEmail = identities.some((i) => i.provider === "EMAIL");
  const hasPhone = identities.some((i) => i.provider === "PHONE");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">个人资料</h1>
          <p className="text-muted-foreground">查看和管理您的个人信息</p>
        </div>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>您的账户基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {getInitials(user?.email || "U")}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-medium">
                {user?.name || user?.email}
              </h3>
              <p className="text-sm text-muted-foreground">
                用户 ID: {user?.id}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">邮箱</p>
              <p className="font-medium">{user?.email || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">用户名</p>
              <p className="font-medium">{user?.name || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 身份绑定 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>身份绑定</CardTitle>
              <CardDescription>管理您的登录方式和身份验证</CardDescription>
            </div>
            <div className="flex gap-2">
              {!hasEmail && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBindEmailOpen(true)}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  绑定邮箱
                </Button>
              )}
              {!hasPhone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBindPhoneOpen(true)}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  绑定手机
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : identities.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              暂无绑定的身份
            </div>
          ) : (
            <div className="space-y-3">
              {identities.map((identity) => (
                <div
                  key={identity.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      {getProviderIcon(identity.provider)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {getProviderDisplayName(identity.provider)}
                        </span>
                        {identity.verified ? (
                          <Badge variant="secondary" className="text-xs">
                            已验证
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            未验证
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {identity.providerId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        绑定于 {formatDate(identity.createdAt)}
                      </p>
                    </div>
                  </div>
                  {identities.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setUnbindId(identity.id)}
                      disabled={unbindMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 解绑确认对话框 */}
      <AlertDialog open={!!unbindId} onOpenChange={() => setUnbindId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认解绑</AlertDialogTitle>
            <AlertDialogDescription>
              确定要解绑此身份吗？解绑后将无法使用此方式登录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnbind}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unbindMutation.isPending ? "解绑中..." : "确认解绑"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 绑定邮箱对话框 */}
      <BindEmailDialog open={bindEmailOpen} onOpenChange={setBindEmailOpen} />

      {/* 绑定手机对话框 */}
      <BindPhoneDialog open={bindPhoneOpen} onOpenChange={setBindPhoneOpen} />
    </div>
  );
}
