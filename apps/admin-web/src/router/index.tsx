import { Routes, Route, Navigate } from "react-router-dom";

import { LoginPage, RegisterPage } from "@/features/auth";
import { DashboardPage } from "@/features/dashboard";
import { DictionaryListPage, DictionaryFormPage } from "@/features/dictionary";
import { PermissionListPage, PermissionFormPage } from "@/features/permission";
import {
  RoleListPage,
  RoleFormPage,
  RolePermissionsPage,
} from "@/features/role";
import { UserListPage, UserRolesPage } from "@/features/user";
import { NamespaceListPage, NamespaceFormPage } from "@/features/namespace";
import {
  ConfigItemListPage,
  ConfigItemFormPage,
  ConfigItemHistoryPage,
} from "@/features/config-item";
import { ProfilePage } from "@/features/profile";
import { SettingsPage } from "@/features/settings";
import { DashboardLayout } from "@/components/layout";
import { AuthGuard, NotFoundPage } from "@/components/common";

export function AppRouter() {
  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* 需要认证的路由 */}
      <Route
        element={
          <AuthGuard>
            <DashboardLayout />
          </AuthGuard>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* 个人中心 */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* 系统管理 */}
        <Route path="/system">
          {/* 用户管理 */}
          <Route path="users" element={<UserListPage />} />
          <Route path="users/:id/roles" element={<UserRolesPage />} />

          {/* 角色管理 */}
          <Route path="roles" element={<RoleListPage />} />
          <Route path="roles/create" element={<RoleFormPage />} />
          <Route path="roles/:id/edit" element={<RoleFormPage />} />
          <Route
            path="roles/:id/permissions"
            element={<RolePermissionsPage />}
          />

          {/* 权限管理 */}
          <Route path="permissions" element={<PermissionListPage />} />
          <Route path="permissions/create" element={<PermissionFormPage />} />
          <Route path="permissions/:id/edit" element={<PermissionFormPage />} />

          {/* 字典管理 */}
          <Route path="dictionaries" element={<DictionaryListPage />} />
          <Route path="dictionaries/create" element={<DictionaryFormPage />} />
          <Route
            path="dictionaries/:id/edit"
            element={<DictionaryFormPage />}
          />
        </Route>

        {/* 配置中心 */}
        <Route path="/config">
          {/* 命名空间管理 */}
          <Route path="namespaces" element={<NamespaceListPage />} />
          <Route path="namespaces/create" element={<NamespaceFormPage />} />
          <Route path="namespaces/:name/edit" element={<NamespaceFormPage />} />

          {/* 配置项管理 */}
          <Route
            path="namespaces/:namespace/items"
            element={<ConfigItemListPage />}
          />
          <Route
            path="namespaces/:namespace/items/create"
            element={<ConfigItemFormPage />}
          />
          <Route
            path="namespaces/:namespace/items/:key/edit"
            element={<ConfigItemFormPage />}
          />
          <Route
            path="namespaces/:namespace/items/:key/history"
            element={<ConfigItemHistoryPage />}
          />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
