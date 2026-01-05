import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useConfigItemControllerRollback } from "@/api/generated/config-center-config-items/config-center-config-items";
import type { RollbackConfigDto } from "@/api/model";
import { rollbackConfigSchema, type RollbackConfigData } from "../types";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error";

interface RollbackConfirmDialogProps {
  namespace: string;
  configKey: string;
  version: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RollbackConfirmDialog({
  namespace,
  configKey,
  version,
  onClose,
  onSuccess,
}: RollbackConfirmDialogProps) {
  const queryClient = useQueryClient();
  const rollbackMutation = useConfigItemControllerRollback();

  const form = useForm<RollbackConfigData>({
    resolver: zodResolver(rollbackConfigSchema),
    defaultValues: {
      changeNote: "",
    },
  });

  const onSubmit = async (values: RollbackConfigData) => {
    try {
      const data: RollbackConfigDto = {
        changeNote: values.changeNote,
      };
      await rollbackMutation.mutateAsync({
        namespace,
        key: configKey,
        version,
        data,
      });
      // 失效所有相关缓存（列表、详情、历史记录）
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          // 匹配所有配置项相关的查询
          return (
            queryKey[0] === "/api/v1/config/{namespace}" ||
            (queryKey[0] === "/api/v1/config/{namespace}/{key}" &&
              queryKey[2] === configKey) ||
            (queryKey[0] === "/api/v1/config/{namespace}/{key}/history" &&
              queryKey[2] === configKey)
          );
        },
      });
      toast.success("回滚成功");
      onSuccess();
    } catch (error) {
      console.error("回滚失败:", error);
      toast.error(getApiErrorMessage(error, "回滚失败"));
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认回滚</DialogTitle>
          <DialogDescription>
            确定要将配置项{" "}
            <span className="font-mono font-semibold">
              {namespace}/{configKey}
            </span>{" "}
            回滚到版本 <span className="font-semibold">v{version}</span> 吗？
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="changeNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>回滚原因 *</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="请说明回滚原因..."
                      rows={3}
                      disabled={rollbackMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={rollbackMutation.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={rollbackMutation.isPending}>
                {rollbackMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                确认回滚
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
