-- Enable UUID generation for public_id
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums (snake_case object names, values kept as stable constants)
CREATE TYPE "config_change_type" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ROLLBACK');
CREATE TYPE "config_value_type" AS ENUM ('JSON', 'STRING', 'NUMBER', 'BOOLEAN');
CREATE TYPE "identity_provider" AS ENUM ('EMAIL', 'PHONE', 'WECHAT_OPEN', 'WECHAT_UNION', 'WECHAT_MINI', 'WECHAT_MP');
CREATE TYPE "role_type" AS ENUM ('SYSTEM', 'CUSTOM');
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'DISABLED', 'PENDING');

-- Users
CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "name" TEXT,
  "password" TEXT NOT NULL,
  "avatar" VARCHAR(500),
  "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
  "deleted_at" TIMESTAMPTZ(3),
  "deleted_by_id" INTEGER,
  "delete_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Roles
CREATE TABLE "roles" (
  "id" SERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "type" "role_type" NOT NULL DEFAULT 'CUSTOM',
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(3),
  "deleted_by_id" INTEGER,
  "delete_reason" VARCHAR(500),
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- Permissions
CREATE TABLE "permissions" (
  "id" SERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(100) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "resource" VARCHAR(50) NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "module" VARCHAR(50),
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- Dictionaries
CREATE TABLE "dictionaries" (
  "id" SERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" VARCHAR(50) NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "value" JSONB NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "sort" INTEGER NOT NULL DEFAULT 0,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMPTZ(3),
  "deleted_by_id" INTEGER,
  "delete_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" VARCHAR(20),
  "config_hash" VARCHAR(64),
  CONSTRAINT "dictionaries_pkey" PRIMARY KEY ("id")
);

-- Config namespaces
CREATE TABLE "config_namespaces" (
  "id" SERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(50) NOT NULL,
  "display_name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMPTZ(3),
  "deleted_by_id" INTEGER,
  "delete_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "config_namespaces_pkey" PRIMARY KEY ("id")
);

-- Config items
CREATE TABLE "config_items" (
  "id" SERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "namespace_id" INTEGER NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "value" JSONB NOT NULL,
  "value_type" "config_value_type" NOT NULL DEFAULT 'JSON',
  "description" VARCHAR(500),
  "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
  "is_public" BOOLEAN NOT NULL DEFAULT false,
  "json_schema" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "config_hash" VARCHAR(64) NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMPTZ(3),
  "deleted_by_id" INTEGER,
  "delete_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "config_items_pkey" PRIMARY KEY ("id")
);

-- Config histories
CREATE TABLE "config_histories" (
  "id" SERIAL NOT NULL,
  "config_id" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "value" JSONB NOT NULL,
  "config_hash" VARCHAR(64) NOT NULL,
  "change_type" "config_change_type" NOT NULL,
  "change_note" VARCHAR(500),
  "changed_by_id" INTEGER,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "config_histories_pkey" PRIMARY KEY ("id")
);

-- User identities
CREATE TABLE "user_identities" (
  "id" SERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" INTEGER NOT NULL,
  "provider" "identity_provider" NOT NULL,
  "provider_id" VARCHAR(255) NOT NULL,
  "credential" VARCHAR(500),
  "credential_exp" TIMESTAMPTZ(3),
  "metadata" JSONB,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verified_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- User roles
CREATE TABLE "user_roles" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "role_id" INTEGER NOT NULL,
  "granted_by_id" INTEGER,
  "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3),
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- Role permissions
CREATE TABLE "role_permissions" (
  "id" SERIAL NOT NULL,
  "role_id" INTEGER NOT NULL,
  "permission_id" INTEGER NOT NULL,
  "granted_by_id" INTEGER,
  "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- Audit logs (append-only)
CREATE TABLE "audit_logs" (
  "id" SERIAL NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "action" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "actor_user_id" INTEGER,
  "ip" TEXT,
  "user_agent" TEXT,
  "request_id" TEXT,
  "before" JSONB,
  "after" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "users"
  ADD CONSTRAINT "fk_users_deleted_by_id" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "roles"
  ADD CONSTRAINT "fk_roles_deleted_by_id" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dictionaries"
  ADD CONSTRAINT "fk_dictionaries_deleted_by_id" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "config_namespaces"
  ADD CONSTRAINT "fk_config_namespaces_deleted_by_id" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "config_items"
  ADD CONSTRAINT "fk_config_items_deleted_by_id" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "config_items"
  ADD CONSTRAINT "fk_config_items_namespace_id" FOREIGN KEY ("namespace_id") REFERENCES "config_namespaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "config_histories"
  ADD CONSTRAINT "fk_config_histories_config_id" FOREIGN KEY ("config_id") REFERENCES "config_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "config_histories"
  ADD CONSTRAINT "fk_config_histories_changed_by_id" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_identities"
  ADD CONSTRAINT "fk_user_identities_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles"
  ADD CONSTRAINT "fk_user_roles_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles"
  ADD CONSTRAINT "fk_user_roles_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles"
  ADD CONSTRAINT "fk_user_roles_granted_by_id" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "fk_role_permissions_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions"
  ADD CONSTRAINT "fk_role_permissions_permission_id" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions"
  ADD CONSTRAINT "fk_role_permissions_granted_by_id" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "fk_audit_logs_actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique constraints / indexes (naming: uniq_* / idx_*)
CREATE UNIQUE INDEX "uniq_users_public_id" ON "users"("public_id");
CREATE UNIQUE INDEX "uniq_users_email_deleted_at" ON "users"("email", "deleted_at");

CREATE UNIQUE INDEX "uniq_roles_public_id" ON "roles"("public_id");
CREATE UNIQUE INDEX "uniq_roles_code" ON "roles"("code");

CREATE UNIQUE INDEX "uniq_permissions_public_id" ON "permissions"("public_id");
CREATE UNIQUE INDEX "uniq_permissions_code" ON "permissions"("code");
CREATE INDEX "idx_permissions_module" ON "permissions"("module");
CREATE INDEX "idx_permissions_resource_action" ON "permissions"("resource", "action");

CREATE UNIQUE INDEX "uniq_dictionaries_public_id" ON "dictionaries"("public_id");
CREATE UNIQUE INDEX "uniq_dictionaries_type_key" ON "dictionaries"("type", "key");
CREATE INDEX "idx_dictionaries_type" ON "dictionaries"("type");
CREATE INDEX "idx_dictionaries_type_is_enabled" ON "dictionaries"("type", "is_enabled");

CREATE UNIQUE INDEX "uniq_config_namespaces_public_id" ON "config_namespaces"("public_id");
CREATE UNIQUE INDEX "uniq_config_namespaces_name" ON "config_namespaces"("name");
CREATE INDEX "idx_config_namespaces_is_enabled" ON "config_namespaces"("is_enabled");

CREATE UNIQUE INDEX "uniq_config_items_public_id" ON "config_items"("public_id");
CREATE UNIQUE INDEX "uniq_config_items_namespace_id_key" ON "config_items"("namespace_id", "key");
CREATE INDEX "idx_config_items_namespace_id" ON "config_items"("namespace_id");
CREATE INDEX "idx_config_items_namespace_id_is_enabled" ON "config_items"("namespace_id", "is_enabled");

CREATE INDEX "idx_config_histories_config_id" ON "config_histories"("config_id");
CREATE INDEX "idx_config_histories_config_id_version" ON "config_histories"("config_id", "version");

CREATE UNIQUE INDEX "uniq_user_identities_public_id" ON "user_identities"("public_id");
CREATE UNIQUE INDEX "uniq_user_identities_provider_provider_id" ON "user_identities"("provider", "provider_id");
CREATE INDEX "idx_user_identities_user_id" ON "user_identities"("user_id");

CREATE UNIQUE INDEX "uniq_user_roles_user_id_role_id" ON "user_roles"("user_id", "role_id");
CREATE INDEX "idx_user_roles_user_id" ON "user_roles"("user_id");
CREATE INDEX "idx_user_roles_role_id" ON "user_roles"("role_id");

CREATE UNIQUE INDEX "uniq_role_permissions_role_id_permission_id" ON "role_permissions"("role_id", "permission_id");
CREATE INDEX "idx_role_permissions_role_id" ON "role_permissions"("role_id");
CREATE INDEX "idx_role_permissions_permission_id" ON "role_permissions"("permission_id");

CREATE UNIQUE INDEX "uniq_audit_logs_public_id" ON "audit_logs"("public_id");
CREATE INDEX "idx_audit_logs_actor_user_id_created_at" ON "audit_logs"("actor_user_id", "created_at");
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at");
CREATE INDEX "idx_audit_logs_entity_type_entity_id_created_at" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ConfigHistory_configId_idx" ON "ConfigHistory"("configId");

-- CreateIndex
CREATE INDEX "ConfigHistory_configId_version_idx" ON "ConfigHistory"("configId", "version");

-- CreateIndex
CREATE INDEX "ConfigItem_namespaceId_idx" ON "ConfigItem"("namespaceId");

-- CreateIndex
CREATE INDEX "ConfigItem_namespaceId_isEnabled_idx" ON "ConfigItem"("namespaceId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigItem_namespaceId_key_key" ON "ConfigItem"("namespaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigNamespace_name_key" ON "ConfigNamespace"("name");

-- CreateIndex
CREATE INDEX "ConfigNamespace_isEnabled_idx" ON "ConfigNamespace"("isEnabled");

-- CreateIndex
CREATE INDEX "Dictionary_type_idx" ON "Dictionary"("type");

-- CreateIndex
CREATE INDEX "Dictionary_type_isEnabled_idx" ON "Dictionary"("type", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Dictionary_type_key_key" ON "Dictionary"("type", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "Permission"("module");

-- CreateIndex
CREATE INDEX "Permission_resource_action_idx" ON "Permission"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_deletedAt_key" ON "User"("email", "deletedAt");

-- CreateIndex
CREATE INDEX "UserIdentity_userId_idx" ON "UserIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_provider_providerId_key" ON "UserIdentity"("provider", "providerId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigHistory" ADD CONSTRAINT "ConfigHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigHistory" ADD CONSTRAINT "ConfigHistory_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ConfigItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigItem" ADD CONSTRAINT "ConfigItem_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigItem" ADD CONSTRAINT "ConfigItem_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "ConfigNamespace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigNamespace" ADD CONSTRAINT "ConfigNamespace_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dictionary" ADD CONSTRAINT "Dictionary_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
