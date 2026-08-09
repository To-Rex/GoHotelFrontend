import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertCircle, Building2, Eye, EyeOff, Loader2, Lock, User, ScanFace } from "lucide-react";
import {
  getFaceAvailability,
  hasCamera,
  faceLogin,
  faceErrorMessage,
} from "@/features/auth/api/face";
import { FaceCameraDialog } from "@/features/auth/components/FaceCameraDialog";

const loginSchema = z.object({
  username: z.string().min(1, "Foydalanuvchi nomi kiritilishi shart"),
  password: z.string().min(4, "Parol kamida 4 ta belgidan iborat bo'lishi kerak"),
});

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Caps Lock yoqiqligida ogohlantirish (parol maydonida)
  const [capsOn, setCapsOn] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  // Login ekranida tab sarlavhasi standart nomga qaytadi
  useEffect(() => {
    document.title = "GoHotel";
  }, []);

  // "Yuz bilan kirish" tugmasi FAQAT: (a) serverda yuz-kirish yoqilgan va
  // kamida bitta xodim yuz biriktirgan, (b) qurilmada kamera bor bo'lsa
  // ko'rinadi — aks holda umuman so'ralmaydi
  const [faceEnabled, setFaceEnabled] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getFaceAvailability(), hasCamera()]).then(([avail, cam]) => {
      if (!cancelled) setFaceEnabled(avail && cam);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFaceCapture = async (photo: Blob): Promise<string | null> => {
    try {
      const data = await faceLogin(photo);
      localStorage.setItem("accessToken", data.access_token);
      localStorage.setItem("refreshToken", data.refresh_token);
      const profileRes = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      setAuth(profileRes.data, data.access_token, data.refresh_token);
      navigate("/");
      return null;
    } catch (err) {
      return faceErrorMessage(err);
    }
  };

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
      // 401 — noto'g'ri login/parol; boshqa xatolarda umumiy matn
      if (err?.response?.status === 401) {
        setError("Login yoki parol noto'g'ri. Tekshirib, qayta urinib ko'ring.");
      } else if (err?.response?.status === 403) {
        setError(apiErrorMessage(err));
      } else if (!err?.response) {
        setError("Server bilan aloqa yo'q. Internet aloqasini tekshiring.");
      } else {
        setError(apiErrorMessage(err));
      }
      // Xato ko'ringach parol maydoni tozalanib, fokus qaytadi — qayta
      // urinish qulay bo'lishi uchun
      form.setValue("password", "");
      window.setTimeout(
        () => document.getElementById("login-password")?.focus(),
        50
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-4">
      {/* Suzuvchi yorug' dog'lar */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary-500/30 blur-3xl animate-login-blob" />
      <div
        className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-500/25 blur-3xl animate-login-blob"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="pointer-events-none absolute top-1/3 left-2/3 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl animate-login-blob"
        style={{ animationDelay: "-11s" }}
      />
      {/* Nozik nuqtali to'r */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[size:28px_28px]" />

      <div className="relative z-10 w-full max-w-sm animate-login-rise">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 shadow-lg shadow-primary-600/40">
            <Building2 className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">GoHotel</h1>
            <p className="mt-1 text-sm text-slate-300/80">
              Mehmonxona boshqaruv tizimiga xush kelibsiz
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-tight">Tizimga kirish</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Hisob ma'lumotlaringizni kiriting
            </p>
          </div>

          <Form {...form}>
            {/* Enter bosilganda ham forma yuboriladi — Kirish tugmasi type="submit" */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Foydalanuvchi nomi</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                          placeholder="admin"
                          autoFocus
                          autoComplete="username"
                          className="h-11 pl-9 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary-500/10"
                          {...field}
                          onKeyDown={(e) => {
                            // Enter — formani yubormasdan parol maydoniga o'tadi
                            if (e.key === "Enter") {
                              e.preventDefault();
                              document.getElementById("login-password")?.focus();
                            }
                          }}
                        />
                      </div>
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
                      <div className="relative">
                        <Lock
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="h-11 pl-9 pr-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary-500/10"
                          {...field}
                          onKeyDown={(e) => {
                            setCapsOn(e.getModifierState?.("CapsLock") ?? false);
                            // Enter — to'g'ridan-to'g'ri Kirish (brauzerning
                            // "implicit submit" xatti-harakatiga tayanmaymiz)
                            if (e.key === "Enter" && !isLoading) {
                              e.preventDefault();
                              form.handleSubmit(onSubmit)();
                            }
                          }}
                          onKeyUp={(e) =>
                            setCapsOn(e.getModifierState?.("CapsLock") ?? false)
                          }
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </FormControl>
                    {capsOn && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                        <AlertCircle size={13} />
                        Caps Lock yoqiq — parol katta harflarda yozilmoqda
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <div
                  key={error}
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive animate-login-shake"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-base font-semibold shadow-lg shadow-primary-600/30 transition-all hover:from-primary-500 hover:to-indigo-500 hover:shadow-primary-500/40 active:scale-[0.98]"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Kirilmoqda...
                  </span>
                ) : (
                  "Kirish"
                )}
              </Button>

              {/* Yuz bilan kirish — faqat qo'llab-quvvatlanadigan holatda */}
              {faceEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFaceOpen(true)}
                  className="h-11 w-full gap-2 font-semibold"
                >
                  <ScanFace size={18} />
                  Yuz bilan kirish
                </Button>
              )}
            </form>
          </Form>
        </div>

        <FaceCameraDialog
          open={faceOpen}
          onOpenChange={setFaceOpen}
          title="Yuz bilan kirish"
          actionLabel="Qo'lda kirish"
          hint="Yuzingizni oval ramkaga joylang — tanilishi bilan avtomatik kirasiz"
          auto
          onCapture={handleFaceCapture}
        />

        <p className="mt-6 text-center text-xs text-slate-400/70">
          © {new Date().getFullYear()} GoHotel — mehmonxona boshqaruv tizimi
        </p>
      </div>
    </div>
  );
};
