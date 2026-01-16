import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  useIdentityControllerBindPhone,
  getIdentityControllerListIdentitiesQueryKey,
} from "@/api/generated/identity/identity";
import {
  bindPhoneSchema,
  type BindPhoneFormData,
} from "@/features/profile/types";

interface BindPhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BindPhoneDialog({ open, onOpenChange }: BindPhoneDialogProps) {
  const queryClient = useQueryClient();
  const bindPhoneMutation = useIdentityControllerBindPhone();

  const form = useForm<BindPhoneFormData>({
    resolver: zodResolver(bindPhoneSchema),
    defaultValues: {
      phone: "",
      code: "",
    },
  });

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const onSubmit = async (data: BindPhoneFormData) => {
    try {
      await bindPhoneMutation.mutateAsync({
        data: {
          phone: data.phone,
          code: data.code,
        },
      });
      toast.success("手机号绑定成功");
      queryClient.invalidateQueries({
        queryKey: getIdentityControllerListIdentitiesQueryKey(),
      });
      handleClose();
    } catch {
      toast.error("手机号绑定失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>绑定手机号</DialogTitle>
          <DialogDescription>
            绑定手机号后可用于登录和接收短信通知
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>手机号</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="请输入手机号"
                      maxLength={11}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>验证码</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        placeholder="请输入验证码"
                        maxLength={6}
                        {...field}
                      />
                    </FormControl>
                    <Button type="button" variant="outline" disabled>
                      获取验证码
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button type="submit" disabled={bindPhoneMutation.isPending}>
                {bindPhoneMutation.isPending ? "绑定中..." : "确认绑定"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
