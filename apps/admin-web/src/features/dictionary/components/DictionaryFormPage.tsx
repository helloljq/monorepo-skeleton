import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import Editor from "@monaco-editor/react";

import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDictionaryControllerCreate,
  useDictionaryControllerUpdate,
  useDictionaryControllerFindOne,
} from "@/api/generated/dictionary/dictionary";
import {
  dictionaryFormSchema,
  type DictionaryFormData,
  type Dictionary,
} from "@/features/dictionary/types";

export function DictionaryFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [jsonError, setJsonError] = useState<string | null>(null);

  const { data: editingItem, isLoading: isLoadingDetail } =
    useDictionaryControllerFindOne<Dictionary>(id ?? "", {
      query: { enabled: isEditing },
    });

  const form = useForm<DictionaryFormData>({
    resolver: zodResolver(dictionaryFormSchema),
    defaultValues: {
      type: "",
      key: "",
      value: "",
      label: "",
      description: "",
      sort: 0,
      isEnabled: true,
      version: "",
    },
  });

  const createMutation = useDictionaryControllerCreate();
  const updateMutation = useDictionaryControllerUpdate();

  useEffect(() => {
    if (editingItem) {
      const valueStr =
        typeof editingItem.value === "object"
          ? JSON.stringify(editingItem.value, null, 2)
          : String(editingItem.value);

      form.reset({
        type: editingItem.type,
        key: editingItem.key,
        value: valueStr,
        label: editingItem.label,
        description: editingItem.description || "",
        sort: editingItem.sort,
        isEnabled: editingItem.isEnabled,
        version: editingItem.version || "",
      });
    }
  }, [editingItem, form]);

  const validateJson = (value: string): boolean => {
    try {
      JSON.parse(value);
      setJsonError(null);
      return true;
    } catch {
      // 不是 JSON 格式，作为普通字符串处理也是可以的
      setJsonError(null);
      return true;
    }
  };

  const onSubmit = async (data: DictionaryFormData) => {
    // 尝试解析 JSON，如果失败则作为字符串
    let valueToSubmit: string | number | object = data.value;
    try {
      valueToSubmit = JSON.parse(data.value);
    } catch {
      // 保持为字符串
    }

    try {
      if (isEditing && id) {
        await updateMutation.mutateAsync({
          id,
          data: {
            value: valueToSubmit as { [key: string]: unknown },
            label: data.label,
            description: data.description || undefined,
            sort: data.sort,
            isEnabled: data.isEnabled,
            version: data.version || undefined,
          },
        });
        toast.success("更新成功");
      } else {
        await createMutation.mutateAsync({
          data: {
            type: data.type,
            key: data.key,
            value: valueToSubmit as { [key: string]: unknown },
            label: data.label,
            description: data.description || undefined,
            sort: data.sort,
            isEnabled: data.isEnabled,
            version: data.version || undefined,
          },
        });
        toast.success("创建成功");
      }
      navigate("/system/dictionaries");
    } catch {
      toast.error(isEditing ? "更新失败" : "创建失败");
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoadingDetail) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
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
          onClick={() => navigate("/system/dictionaries")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "编辑字典" : "新增字典"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? "修改字典项的值、标签等信息"
              : "创建新的字典项，type+key 必须唯一"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>字典的类型和键用于唯一标识</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>字典类型 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例如: gender"
                          {...field}
                          disabled={isEditing}
                        />
                      </FormControl>
                      <FormDescription>
                        小写字母开头，只能包含小写字母、数字和下划线
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>字典键 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例如: MALE"
                          {...field}
                          disabled={isEditing}
                        />
                      </FormControl>
                      <FormDescription>
                        大写字母开头，只能包含大写字母、数字和下划线
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>显示标签 *</FormLabel>
                      <FormControl>
                        <Input placeholder="例如: 男" {...field} />
                      </FormControl>
                      <FormDescription>用于前端显示的文本</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="sort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>排序</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="version"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>版本号</FormLabel>
                        <FormControl>
                          <Input placeholder="可选" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isEnabled"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>启用状态</FormLabel>
                        <FormControl>
                          <div className="flex h-10 items-center">
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <span className="ml-2 text-sm">
                              {field.value ? "启用" : "禁用"}
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="可选，字典项说明"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>字典值</CardTitle>
              <CardDescription>
                支持 JSON 格式或普通字符串/数字。JSON 格式会自动格式化。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="overflow-hidden rounded-md border">
                        <Editor
                          height="300px"
                          defaultLanguage="json"
                          value={field.value}
                          onChange={(value) => {
                            field.onChange(value || "");
                            if (value) validateJson(value);
                          }}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: "on",
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2,
                            wordWrap: "on",
                            formatOnPaste: true,
                            formatOnType: true,
                          }}
                          theme="vs-dark"
                        />
                      </div>
                    </FormControl>
                    {jsonError && (
                      <p className="text-sm text-destructive">{jsonError}</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/system/dictionaries")}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save className="mr-2 h-4 w-4" />
              {isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
