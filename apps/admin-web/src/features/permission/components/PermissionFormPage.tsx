import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  usePermissionControllerCreate,
  usePermissionControllerUpdate,
  usePermissionControllerFindOne,
  getPermissionControllerFindAllQueryKey,
  getPermissionControllerFindOneQueryKey,
} from "@/api/generated/permission/permission";
import {
  permissionFormSchema,
  type PermissionFormData,
  type Permission,
} from "@/features/permission/types";
import { isApiError } from "@/lib/api-error";

export function PermissionFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const { data: editingItem, isLoading: isLoadingDetail } =
    usePermissionControllerFindOne<Permission>(id ?? "", {
      query: { enabled: isEditing },
    });

  const createMutation = usePermissionControllerCreate();
  const updateMutation = usePermissionControllerUpdate();

  const form = useForm<PermissionFormData>({
    resolver: zodResolver(permissionFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      resource: "",
      action: "",
      module: "",
      isEnabled: true,
    },
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({
        code: editingItem.code,
        name: editingItem.name,
        description: editingItem.description || "",
        resource: editingItem.resource,
        action: editingItem.action,
        module: editingItem.module || "",
        isEnabled: editingItem.isEnabled,
      });
    }
  }, [editingItem, form]);

  const onSubmit = async (data: PermissionFormData) => {
    try {
      if (isEditing && id) {
        await updateMutation.mutateAsync({
          id,
          data: {
            name: data.name,
            description: data.description || undefined,
            module: data.module || undefined,
            isEnabled: data.isEnabled,
          },
        });
        toast.success("权限更新成功");
      } else {
        await createMutation.mutateAsync({
          data: {
            code: data.code,
            name: data.name,
            description: data.description || undefined,
            resource: data.resource,
            action: data.action,
            module: data.module || undefined,
          },
        });
        toast.success("权限创建成功");
      }
      // 使缓存失效，确保列表页和编辑页显示最新数据
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getPermissionControllerFindAllQueryKey(),
        }),
        isEditing &&
          queryClient.invalidateQueries({
            queryKey: getPermissionControllerFindOneQueryKey(id),
          }),
      ]);
      navigate("/system/permissions");
    } catch (error) {
      if (isApiError(error) && error.hasValidationErrors) {
        const fieldErrors = error.getFieldErrorMap();
        Object.entries(fieldErrors).forEach(([field, message]) => {
          if (field in form.getValues()) {
            form.setError(field as keyof PermissionFormData, { message });
          }
        });
      } else if (isApiError(error)) {
        toast.error(error.message);
      } else {
        toast.error(isEditing ? "权限更新失败" : "权限创建失败");
      }
    }
  };

  if (isEditing && isLoadingDetail) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
        <Card>
          <CardHeader className="space-y-3">
            <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/system/permissions")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "编辑权限" : "新增权限"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "修改权限信息" : "创建新的权限项"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>权限信息</CardTitle>
          <CardDescription>请填写权限的详细信息</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>权限编码 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如: system:user-list"
                        {...field}
                        disabled={isEditing}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      格式：module:resource-action，只能包含小写字母、数字、冒号和连字符
                      {isEditing && "（编辑时不可修改）"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>权限名称 *</FormLabel>
                    <FormControl>
                      <Input placeholder="例如: 查看用户列表" {...field} />
                    </FormControl>
                    <FormDescription>
                      权限的中文名称，用于界面显示
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="module"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>模块</FormLabel>
                      <FormControl>
                        <Input placeholder="例如: system" {...field} />
                      </FormControl>
                      <FormDescription>权限所属模块</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="resource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>资源 *</FormLabel>
                      <FormControl>
                        <Input placeholder="例如: user" {...field} />
                      </FormControl>
                      <FormDescription>操作的资源对象</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>操作 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如: list, create, update, delete, view"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      对资源执行的操作，如
                      list（列表）、create（创建）、update（更新）、delete（删除）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="权限的详细说明..."
                        className="min-h-[100px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>权限的详细说明（可选）</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用状态</FormLabel>
                      <FormDescription>是否启用此权限</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/system/permissions")}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "保存中..."
                    : isEditing
                      ? "保存"
                      : "创建"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
