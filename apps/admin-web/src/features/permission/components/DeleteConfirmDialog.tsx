import { toast } from "sonner";

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
import { usePermissionControllerRemove } from "@/api/generated/permission/permission";
import type { Permission } from "@/features/permission/types";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Permission | null;
  onSuccess: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: DeleteConfirmDialogProps) {
  const deleteMutation = usePermissionControllerRemove();

  const handleDelete = async () => {
    if (!item) return;

    try {
      await deleteMutation.mutateAsync({ id: item.id });
      toast.success("删除成功");
      onSuccess();
    } catch {
      toast.error("删除失败");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除权限{" "}
            <strong className="text-foreground">{item?.code}</strong> 吗？
            <br />
            此操作为软删除，数据可以恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? "删除中..." : "删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
