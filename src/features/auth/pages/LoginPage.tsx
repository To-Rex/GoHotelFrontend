import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Foydalanuvchi nomi kiritilishi shart"),
  password: z.string().min(4, "Parol kamida 4 ta belgidan iborat bo'lishi kerak"),
});

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      setIsLoading(true);
      setError(null);
      const { data } = await api.post("/auth/login", values);
      
      // Assume the API returns { access_token, refresh_token }
      // We also need to fetch user profile since login usually just returns tokens
      localStorage.setItem("accessToken", data.access_token);
      localStorage.setItem("refreshToken", data.refresh_token);

      const profileRes = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });

      setAuth(profileRes.data, data.access_token, data.refresh_token);
      navigate("/");
    } catch (err: any) {
      console.error("Login error", err);
      setError(err.response?.data?.detail || "Tizimga kirishda xatolik yuz berdi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Building2 className="text-primary-foreground" size={24} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">GoHotel</h1>
          <p className="text-sm text-muted-foreground">
            Mehmonxona boshqaruv tizimiga xush kelibsiz
          </p>
        </div>
        
        <Card className="border-border/50 shadow-sm backdrop-blur-sm bg-background/95">
          <CardHeader>
            <CardTitle>Tizimga kirish</CardTitle>
            <CardDescription>
              Hisob ma'lumotlaringizni kiriting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Foydalanuvchi nomi</FormLabel>
                      <FormControl>
                        <Input placeholder="admin" {...field} />
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
                      <FormLabel>Parol</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && <div className="text-sm font-medium text-destructive">{error}</div>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Kirilmoqda..." : "Kirish"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
