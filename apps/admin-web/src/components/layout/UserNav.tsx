import { LogOut, Settings, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useAuthControllerLogout } from "@/api/generated/auth/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createLogger } from "@/lib/logger";
import { useAuthStore } from "@/stores/authStore";

const logger = createLogger("[UserNav]");

export function UserNav() {
  const { user, logout, deviceId } = useAuthStore();
  const logoutMutation = useAuthControllerLogout();
  const navigate = useNavigate();

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      // 调用后端登出接口（清除服务端 session）
      await logoutMutation.mutateAsync({
        data: { deviceId },
      });
      logger.log("Logout API succeeded");
    } catch (error) {
      // 静默失败，finally 会处理清理
      logger.warn("Logout API failed:", error);
    } finally {
      // 无论 API 成功与否，都清除前端状态
      logout();
      // 使用 navigate 保持 SPA 行为，更快且更优雅
      navigate("/login", { replace: true });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{getInitials(user?.email || "U")}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-muted-foreground">管理员</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <User className="mr-2 h-4 w-4" />
            个人资料
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="mr-2 h-4 w-4" />
            设置
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {logoutMutation.isPending ? "退出中..." : "退出登录"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
