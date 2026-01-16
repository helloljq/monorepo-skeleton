import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { customFetch } from "@/api/custom-fetch";
import { useAuthStore } from "@/stores/auth-store";
import { isApiError } from "@/lib/api-error";

const loginSchema = z.object({
  email: z.string().min(1, "请输入邮箱").email("请输入有效的邮箱地址"),
  password: z.string().min(1, "请输入密码").max(128, "密码最长128个字符"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { deviceId, login, isAuthenticated } = useAuthStore();

  // 如果已登录，跳转到主页
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true);
      const user = await customFetch<{
        id: string;
        email: string | null;
        name?: string | null;
      }>({
        url: "/v1/auth/web/login",
        method: "POST",
        data: {
          email: data.email,
          password: data.password,
          deviceId,
        },
      });

      login(user);

      toast.success("登录成功");
      navigate("/");
    } catch (error) {
      if (isApiError(error) && error.hasValidationErrors) {
        const fieldErrors = error.getFieldErrorMap();
        Object.entries(fieldErrors).forEach(([field, message]) => {
          if (field in form.getValues()) {
            form.setError(field as keyof LoginFormData, { message });
          }
        });
        const firstError = error.validationErrors[0]?.message;
        if (firstError) {
          toast.error(firstError);
        }
      } else if (isApiError(error)) {
        toast.error(error.message);
      } else {
        toast.error("登录失败，请检查邮箱和密码");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">登录</CardTitle>
          <CardDescription>输入您的邮箱和密码登录系统</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="请输入邮箱"
                        autoComplete="email"
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
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="请输入密码"
                          autoComplete="current-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                登录
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                还没有账号？{" "}
                <Link
                  to="/register"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  立即注册
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
