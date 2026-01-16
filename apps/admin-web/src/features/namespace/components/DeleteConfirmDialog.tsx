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
import { useNamespaceControllerRemove } from "@/api/generated/config-center-namespaces/config-center-namespaces";
import type { Namespace } from "@/features/namespace/types";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error";

interface DeleteConfirmDialogProps {
  item: Namespace;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteConfirmDialog({
  item,
  onClose,
  onSuccess,
}: DeleteConfirmDialogProps) {
  const deleteMutation = useNamespaceControllerRemove();

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault(); // 阻止默认的对话框关闭行为
    try {
      await deleteMutation.mutateAsync({ name: item.name });
      toast.success("删除命名空间成功");
      onSuccess(); // 成功后由父组件控制关闭
    } catch (error) {
      console.error("删除命名空间失败:", error);
      toast.error(getApiErrorMessage(error, "删除命名空间失败"));
    }
  };

  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                确定要删除命名空间{" "}
                <span className="font-mono font-semibold">{item.name}</span> 吗?
              </p>
              <p className="text-destructive">
                此操作将同时删除该命名空间下的所有配置项！
              </p>
            </div>
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
