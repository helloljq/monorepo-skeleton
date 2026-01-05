import { Loader2 } from "lucide-react";
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
import { useConfigItemControllerRemove } from "@/api/generated/config-center-config-items/config-center-config-items";
import type { ConfigItem } from "../types";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error";

interface DeleteConfirmDialogProps {
  item: ConfigItem;
  namespace: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteConfirmDialog({
  item,
  namespace,
  onClose,
  onSuccess,
}: DeleteConfirmDialogProps) {
  const deleteMutation = useConfigItemControllerRemove();

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault(); // 阻止默认的对话框关闭行为
    try {
      await deleteMutation.mutateAsync({ namespace, key: item.key });
      toast.success("删除配置项成功");
      onSuccess(); // 成功后由父组件控制关闭
    } catch (error) {
      console.error("删除配置项失败:", error);
      toast.error(getApiErrorMessage(error, "删除配置项失败"));
    }
  };

  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <p>
              确定要删除配置项{" "}
              <span className="font-mono font-semibold">{item.key}</span> 吗？
              此操作不可恢复。
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
