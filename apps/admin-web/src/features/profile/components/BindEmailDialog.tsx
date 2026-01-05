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
  useIdentityControllerBindEmail,
  getIdentityControllerListIdentitiesQueryKey,
} from "@/api/generated/identity/identity";
import { bindEmailSchema, type BindEmailFormData } from "../types";

interface BindEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BindEmailDialog({ open, onOpenChange }: BindEmailDialogProps) {
  const queryClient = useQueryClient();
  const bindEmailMutation = useIdentityControllerBindEmail();

  const form = useForm<BindEmailFormData>({
    resolver: zodResolver(bindEmailSchema),
    defaultValues: {
      email: "",
      password: "",
      code: "",
    },
  });

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const onSubmit = async (data: BindEmailFormData) => {
    try {
      await bindEmailMutation.mutateAsync({
        data: {
          email: data.email,
          password: data.password,
          code: data.code,
        },
      });
      toast.success("邮箱绑定成功");
      queryClient.invalidateQueries({
        queryKey: getIdentityControllerListIdentitiesQueryKey(),
      });
      handleClose();
    } catch {
      toast.error("邮箱绑定失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>绑定邮箱</DialogTitle>
          <DialogDescription>绑定邮箱后可用于登录和接收通知</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱地址</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="请输入邮箱地址"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>设置密码</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="请输入密码（至少8位，包含大小写字母和数字）"
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
              <Button type="submit" disabled={bindEmailMutation.isPending}>
                {bindEmailMutation.isPending ? "绑定中..." : "确认绑定"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
