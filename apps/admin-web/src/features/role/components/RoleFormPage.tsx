import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
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
  useRoleControllerCreate,
  useRoleControllerUpdate,
  useRoleControllerFindOne,
} from "@/api/generated/role/role";
import { roleFormSchema, type RoleFormData, type Role } from "../types";
import { isApiError } from "@/lib/api-error";

export function RoleFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const { data: editingItem, isLoading: isLoadingDetail } =
    useRoleControllerFindOne<Role>(Number(id), {
      query: { enabled: isEditing },
    });

  const createMutation = useRoleControllerCreate();
  const updateMutation = useRoleControllerUpdate();

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      isEnabled: true,
    },
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({
        code: editingItem.code,
        name: editingItem.name,
        description: editingItem.description || "",
        isEnabled: editingItem.isEnabled,
      });
    }
  }, [editingItem, form]);

  const onSubmit = async (data: RoleFormData) => {
    try {
      if (isEditing && id) {
        await updateMutation.mutateAsync({
          id: Number(id),
          data: {
            name: data.name,
            description: data.description || undefined,
            isEnabled: data.isEnabled,
          },
        });
        toast.success("角色更新成功");
      } else {
        await createMutation.mutateAsync({
          data: {
            code: data.code,
            name: data.name,
            description: data.description || undefined,
          },
        });
        toast.success("角色创建成功");
      }
      navigate("/system/roles");
    } catch (error) {
      if (isApiError(error) && error.hasValidationErrors) {
        const fieldErrors = error.getFieldErrorMap();
        Object.entries(fieldErrors).forEach(([field, message]) => {
          if (field in form.getValues()) {
            form.setError(field as keyof RoleFormData, { message });
          }
        });
      } else if (isApiError(error)) {
        toast.error(error.message);
      } else {
        toast.error(isEditing ? "角色更新失败" : "角色创建失败");
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
            {[...Array(4)].map((_, i) => (
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
          onClick={() => navigate("/system/roles")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "编辑角色" : "新增角色"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "修改角色信息" : "创建新的角色"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>角色信息</CardTitle>
          <CardDescription>请填写角色的详细信息</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>角色编码 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如: ADMIN"
                        {...field}
                        disabled={isEditing}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      大写字母开头，只能包含大写字母、数字和下划线
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
                    <FormLabel>角色名称 *</FormLabel>
                    <FormControl>
                      <Input placeholder="例如: 系统管理员" {...field} />
                    </FormControl>
                    <FormDescription>
                      角色的中文名称，用于界面显示
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
                        placeholder="角色的详细说明..."
                        className="min-h-[100px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>角色的详细说明（可选）</FormDescription>
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
                      <FormDescription>是否启用此角色</FormDescription>
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
                  onClick={() => navigate("/system/roles")}
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
