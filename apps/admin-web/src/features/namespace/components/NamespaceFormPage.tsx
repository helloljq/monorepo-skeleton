import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  useNamespaceControllerCreate,
  useNamespaceControllerUpdate,
  useNamespaceControllerFindOne,
  getNamespaceControllerFindAllQueryKey,
  getNamespaceControllerFindOneQueryKey,
} from "@/api/generated/config-center-namespaces/config-center-namespaces";
import type { CreateNamespaceDto, UpdateNamespaceDto } from "@/api/model";
import {
  namespaceFormSchema,
  type NamespaceFormData,
  type Namespace,
} from "@/features/namespace/types";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error";

export function NamespaceFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { name } = useParams<{ name: string }>();
  const isEditing = !!name;

  const form = useForm<NamespaceFormData>({
    resolver: zodResolver(namespaceFormSchema),
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      isEnabled: true,
    },
  });

  const { data: editingItem, isLoading: isLoadingDetail } =
    useNamespaceControllerFindOne<Namespace>(name!, {
      query: { enabled: isEditing },
    });

  const createMutation = useNamespaceControllerCreate();
  const updateMutation = useNamespaceControllerUpdate();

  useEffect(() => {
    if (editingItem) {
      form.reset({
        name: editingItem.name,
        displayName: editingItem.displayName,
        description: editingItem.description || "",
        isEnabled: editingItem.isEnabled,
      });
    }
  }, [editingItem, form]);

  const onSubmit = async (values: NamespaceFormData) => {
    try {
      if (isEditing) {
        const updateData: UpdateNamespaceDto = {
          displayName: values.displayName,
          description: values.description,
          isEnabled: values.isEnabled,
        };
        await updateMutation.mutateAsync({ name: name!, data: updateData });
        queryClient.invalidateQueries({
          queryKey: getNamespaceControllerFindAllQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getNamespaceControllerFindOneQueryKey(name),
        });
        toast.success("更新命名空间成功");
      } else {
        const createData: CreateNamespaceDto = values;
        await createMutation.mutateAsync({ data: createData });
        queryClient.invalidateQueries({
          queryKey: getNamespaceControllerFindAllQueryKey(),
        });
        toast.success("创建命名空间成功");
      }
      navigate("/config/namespaces");
    } catch (error) {
      console.error("保存命名空间失败:", error);
      toast.error(getApiErrorMessage(error, "保存命名空间失败"));
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoadingDetail) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/config/namespaces")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "编辑命名空间" : "新建命名空间"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "修改命名空间配置信息" : "创建新的配置命名空间"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>命名空间名称 *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="例如: app_config"
                        disabled={isEditing}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      小写字母开头，只能包含小写字母、数字和下划线
                      {isEditing && "（创建后不可修改）"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>显示名称 *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例如: 应用配置" />
                    </FormControl>
                    <FormDescription>用于界面显示的友好名称</FormDescription>
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
                        {...field}
                        placeholder="描述此命名空间的用途..."
                        rows={3}
                      />
                    </FormControl>
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
                      <FormDescription>
                        禁用后，该命名空间下的配置将不可用
                      </FormDescription>
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

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditing ? "保存" : "创建"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/config/namespaces")}
                >
                  取消
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
