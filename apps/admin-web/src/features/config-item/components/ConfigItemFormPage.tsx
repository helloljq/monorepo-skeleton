import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useConfigItemControllerCreate,
  useConfigItemControllerUpdate,
  useConfigItemControllerFindOne,
  getConfigItemControllerFindAllQueryKey,
  getConfigItemControllerFindOneQueryKey,
} from "@/api/generated/config-center-config-items/config-center-config-items";
import type { CreateConfigItemDto, UpdateConfigItemDto } from "@/api/model";
import {
  configItemFormSchema,
  type ConfigItemFormData,
  type ConfigItem,
} from "../types";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  parseConfigValue,
  serializeConfigValue,
  ValueParseError,
} from "../utils/valueParser";

export function ConfigItemFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { namespace, key } = useParams<{ namespace: string; key: string }>();
  const { resolvedTheme } = useTheme();

  const isEditing = !!key;

  const form = useForm<ConfigItemFormData>({
    resolver: zodResolver(configItemFormSchema),
    defaultValues: {
      key: "",
      valueType: "STRING",
      value: "",
      description: "",
      isEncrypted: false,
      isEnabled: true,
    },
  });

  const selectedValueType = useWatch({
    control: form.control,
    name: "valueType",
    defaultValue: "STRING",
  });

  const { data: editingItem, isLoading: isLoadingDetail } =
    useConfigItemControllerFindOne<ConfigItem>(namespace || "", key || "", {
      query: { enabled: !!namespace && isEditing && !!key },
    });

  const createMutation = useConfigItemControllerCreate();
  const updateMutation = useConfigItemControllerUpdate();

  useEffect(() => {
    if (editingItem) {
      form.reset({
        key: editingItem.key,
        valueType: editingItem.valueType,
        value: serializeConfigValue(editingItem.value),
        description: editingItem.description || "",
        isEncrypted: editingItem.isEncrypted,
        isEnabled: editingItem.isEnabled,
      });
    }
  }, [editingItem, form]);

  const onSubmit = async (values: ConfigItemFormData) => {
    // 参数校验
    if (!namespace) {
      toast.error("缺少命名空间参数");
      return;
    }

    try {
      // 验证值格式是否正确
      try {
        parseConfigValue(values.value, values.valueType);
      } catch (error) {
        if (error instanceof ValueParseError) {
          toast.error(error.message);
        } else {
          toast.error("值转换失败");
        }
        return;
      }

      if (isEditing && key) {
        const updateData: UpdateConfigItemDto = {
          value: values.value,
          valueType: values.valueType,
          description: values.description,
          isEncrypted: values.isEncrypted,
          isEnabled: values.isEnabled,
        };
        await updateMutation.mutateAsync({ namespace, key, data: updateData });
        queryClient.invalidateQueries({
          queryKey: getConfigItemControllerFindAllQueryKey(namespace),
        });
        queryClient.invalidateQueries({
          queryKey: getConfigItemControllerFindOneQueryKey(namespace, key),
        });
        toast.success("更新配置项成功");
      } else {
        const createData: CreateConfigItemDto = {
          key: values.key,
          value: values.value,
          valueType: values.valueType,
          description: values.description,
          isEncrypted: values.isEncrypted,
          isEnabled: values.isEnabled,
        };
        await createMutation.mutateAsync({ namespace, data: createData });
        queryClient.invalidateQueries({
          queryKey: getConfigItemControllerFindAllQueryKey(namespace),
        });
        toast.success("创建配置项成功");
      }
      navigate(`/config/namespaces/${namespace}/items`);
    } catch (error) {
      console.error("保存配置项失败:", error);
      toast.error(getApiErrorMessage(error, "保存配置项失败"));
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // 参数校验：namespace 必须存在
  if (!namespace) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">缺少命名空间参数</p>
          <Button
            className="mt-4"
            onClick={() => navigate("/config/namespaces")}
          >
            返回命名空间列表
          </Button>
        </div>
      </div>
    );
  }

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
          onClick={() => navigate(`/config/namespaces/${namespace}/items`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "编辑配置项" : "新建配置项"}
          </h1>
          <p className="text-muted-foreground">
            命名空间:{" "}
            <span className="font-mono font-semibold">{namespace}</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>配置信息</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>配置键 *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="例如: database_host"
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
                name="valueType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>值类型 *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="STRING">字符串</SelectItem>
                        <SelectItem value="NUMBER">数字</SelectItem>
                        <SelectItem value="BOOLEAN">布尔值</SelectItem>
                        <SelectItem value="JSON">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>配置值 *</FormLabel>
                    <FormControl>
                      {selectedValueType === "JSON" ? (
                        <div className="overflow-hidden rounded-md border">
                          <Editor
                            height="300px"
                            defaultLanguage="json"
                            value={field.value}
                            onChange={(value) => field.onChange(value || "")}
                            theme={
                              resolvedTheme === "dark" ? "vs-dark" : "light"
                            }
                            options={{
                              minimap: { enabled: false },
                              fontSize: 14,
                              lineNumbers: "on",
                              scrollBeyondLastLine: false,
                              automaticLayout: true,
                              tabSize: 2,
                              formatOnPaste: true,
                              formatOnType: true,
                            }}
                          />
                        </div>
                      ) : selectedValueType === "BOOLEAN" ? (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">true</SelectItem>
                            <SelectItem value="false">false</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          {...field}
                          placeholder={
                            selectedValueType === "NUMBER"
                              ? "例如: 3000"
                              : "例如: localhost"
                          }
                          className="font-mono"
                        />
                      )}
                    </FormControl>
                    <FormDescription>
                      {selectedValueType === "JSON" && "请输入有效的 JSON 格式"}
                      {selectedValueType === "NUMBER" && "请输入数字"}
                      {selectedValueType === "BOOLEAN" && "选择 true 或 false"}
                      {selectedValueType === "STRING" && "任意字符串"}
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
                        {...field}
                        placeholder="描述此配置项的用途..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isEncrypted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">加密存储</FormLabel>
                      <FormDescription>
                        敏感信息（如密码、密钥）应加密存储
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

              <FormField
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用状态</FormLabel>
                      <FormDescription>
                        禁用后，该配置项将不可用
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
                  onClick={() =>
                    navigate(`/config/namespaces/${namespace}/items`)
                  }
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
