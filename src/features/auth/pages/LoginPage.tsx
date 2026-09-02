import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { useSeo } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Moon,
  Sun,
  User,
} from "lucide-react";
import {
  hasCamera,
  verifyFaceLogin,
  loginWithoutCamera,
  faceErrorMessage,
} from "@/features/auth/api/face";
import { FaceCameraDialog } from "@/features/auth/components/FaceCameraDialog";

/**
 * Kirish sahifasi — landing bilan bir xil uslubda: ikki tabiat sahnasi
 * (kun — jazirama quyosh, bulutlar, qushlar; tun — yulduzlar, oy, uchar
 * yulduz), gradientsiz yaxlit fonlar va shisha karta. Barcha mantiq
 * (Enter oqimi, xato banneri, Caps Lock, yuz bilan kirish) saqlangan.
 */

const loginSchema = z.object({
  username: z.string().min(1, "Foydalanuvchi nomi kiritilishi shart"),
  password: z.string().min(4, "Parol kamida 4 ta belgidan iborat bo'lishi kerak"),
});

// Tungi osmon yulduzlari (foizli koordinatalar)
const STARS = [
  { top: "8%", left: "10%", s: 3, d: "0s" },
  { top: "14%", left: "38%", s: 2, d: "-1.6s" },
  { top: "10%", left: "70%", s: 2, d: "-2.8s" },
  { top: "22%", left: "88%", s: 3, d: "-0.7s" },
  { top: "30%", left: "16%", s: 2, d: "-3.4s" },
  { top: "38%", left: "60%", s: 2, d: "-1.2s" },
  { top: "48%", left: "6%", s: 2, d: "-2.1s" },
  { top: "56%", left: "82%", s: 2, d: "-0.4s" },
  { top: "66%", left: "28%", s: 3, d: "-3.9s" },
  { top: "74%", left: "64%", s: 2, d: "-1.9s" },
  { top: "84%", left: "12%", s: 2, d: "-2.6s" },
  { top: "90%", left: "78%", s: 2, d: "-0.9s" },
  { top: "44%", left: "42%", s: 2, d: "-3.1s" },
  { top: "78%", left: "44%", s: 2, d: "-1.4s" },
];

// Uchib o'tayotgan qush silueti (qanot qoqadi)
function Bird({ style, size = 38 }: { style?: React.CSSProperties; size?: number }) {
  return (
    <svg
      viewBox="0 0 60 26"
      width={size}
      height={(size * 26) / 60}
      fill="none"
      className="landing-bird absolute text-zinc-700/70"
      style={style}
    >
      <path
        className="landing-flap"
        d="M3 16 Q 16 3, 30 15 Q 44 3, 57 16"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Suzuvchi bulut — yaxlit oq shakllar
function Cloud({
  style,
  scale = 1,
  opacity = 0.9,
}: {
  style?: React.CSSProperties;
  scale?: number;
  opacity?: number;
}) {
  return (
    <div className="landing-cloud absolute" style={style}>
      <div className="relative h-12 w-32" style={{ transform: `scale(${scale})`, opacity }}>
        <span className="absolute bottom-0 left-0 h-9 w-32 rounded-full bg-white" />
        <span className="absolute bottom-3 left-5 h-10 w-14 rounded-full bg-white" />
        <span className="absolute bottom-2 left-16 h-8 w-12 rounded-full bg-white" />
      </div>
    </div>
  );
}

export const LoginPage = () => {
  useSeo({
    title: "Kirish — GoHotel | Mehmonxona boshqaruv tizimi",
    description:
      "GoHotel tizimiga kirish: mehmonxonangiz bandlovlari, kassa-smena, ombor va hisobotlarini bitta oynada boshqaring.",
    canonicalPath: "/login",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Caps Lock yoqiqligida ogohlantirish (parol maydonida)
  const [capsOn, setCapsOn] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  // Sahna soatga qarab tanlanadi (19:00–06:00 — tun), tugma bilan almashtiriladi
  const [night, setNight] = useState(() => {
    const h = new Date().getHours();
    return h >= 19 || h < 6;
  });

  // Login ekranida tab sarlavhasi standart nomga qaytadi
  useEffect(() => {
    document.title = "GoHotel";
  }, []);

  /* IKKI BOSQICHLI KIRISH.

     Birinchi bosqich — login va parol. Xodim yuz biriktirgan bo'lsa server
     tokenlarni bermaydi, o'rniga qisqa muddatli `face_token` qaytaradi va
     kirish shu yerda to'xtaydi. Ikkinchi bosqich — kamera oynasi.

     Yuzning o'zi bilan kirish YO'Q: ilgari login sahifasida "Yuz bilan
     kirish" tugmasi bor edi va u parolni butunlay chetlab o'tardi. */
  const [faceToken, setFaceToken] = useState<string | null>(null);
  const [faceOpen, setFaceOpen] = useState(false);

  /** Tokenlar kelgach sessiyani ochish — ikkala yo'l uchun umumiy. */
  const finishLogin = async (tokens: { access_token: string; refresh_token: string }) => {
    localStorage.setItem("accessToken", tokens.access_token);
    localStorage.setItem("refreshToken", tokens.refresh_token);
    const profileRes = await api.get("/auth/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    setAuth(profileRes.data, tokens.access_token, tokens.refresh_token);
    navigate("/start");
  };

  const handleFaceCapture = async (photo: Blob): Promise<string | null> => {
    if (!faceToken) return "Kirish seansi tugadi — qaytadan urinib ko'ring";
    try {
      await finishLogin(await verifyFaceLogin(faceToken, photo));
      return null;
    } catch (err) {
      return faceErrorMessage(err);
    }
  };

  /* Oyna yopilsa kirish TUGALLANMAYDI. Foydalanuvchi parolni to'g'ri
     kiritgan bo'lsa ham, yuz tekshiruvidan o'tmasa ichkariga kira
     olmaydi — challenge shu yerda bekor qilinadi. */
  const closeFaceStep = (open: boolean) => {
    setFaceOpen(open);
    if (!open) {
      setFaceToken(null);
      setError(
        "Yuz tekshiruvi tugallanmadi. Kirish uchun uni o'tashingiz kerak."
      );
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

      if (data?.face_required && data?.face_token) {
        /* Yuz biriktirgan xodim. Kamera bo'lsa — ikkinchi bosqich; bo'lmasa
           parol bilan kiritiladi, chunki tekshirishning imkoni yo'q. */
        if (await hasCamera()) {
          setFaceToken(data.face_token);
          setFaceOpen(true);
          return;
        }
        await finishLogin(
          await loginWithoutCamera(data.face_token, "qurilmada kamera topilmadi")
        );
        return;
      }

      await finishLogin(data);
    } catch (err: any) {
      console.error("Login error", err);
      // 401 — noto'g'ri login/parol; boshqa xatolarda umumiy matn
      if (err?.response?.status === 401) {
        setError("Login yoki parol noto'g'ri. Tekshirib, qayta urinib ko'ring.");
      } else if (err?.response?.status === 403) {
        /* Qurilma tasdiqlanmagan bo'lsa — alohida sahifaga. Login
           formasidagi qizil qator yetarli emasdi: xodim parolni to'g'ri
           kiritgan bo'lsa ham nima bo'layotganini tushunmay, qayta-qayta
           urinardi. Sahifada sabab, nima qilish kerakligi va
           administratorga aytiladigan qurilma raqami turadi.
           Server shakli: { detail, error_code } */
        const code = err?.response?.data?.error_code;
        if (
          code === "DEVICE_PENDING" ||
          code === "DEVICE_BLOCKED" ||
          code === "DEVICE_UNKNOWN"
        ) {
          navigate("/device-pending", { state: { code } });
          return;
        }
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
    <div
      className={cn(
        "relative flex min-h-dvh items-center justify-center overflow-x-clip p-4 transition-colors duration-700",
        night ? "bg-zinc-950" : "bg-[#fdf6e3]"
      )}
    >
      {/* ============ TABIAT SAHNASI (fon) ============ */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* TUN: yulduzlar, uchar yulduz, oy */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            night ? "opacity-100" : "opacity-0"
          )}
        >
          {STARS.map((s, i) => (
            <span
              key={i}
              className="landing-star bg-white"
              style={{ top: s.top, left: s.left, width: s.s, height: s.s, animationDelay: s.d }}
            />
          ))}
          <span className="landing-shoot absolute right-[10%] top-[14%] h-0.5 w-20 rounded-full bg-white/80" />
          <div className="absolute right-[10%] top-[10%] sm:right-[14%] sm:top-[14%]">
            <span className="landing-sunpulse absolute -inset-4 rounded-full border border-zinc-200/10" />
            <div className="relative h-14 w-14 rounded-full bg-zinc-200 shadow-[0_0_40px_rgba(228,228,231,0.25)] sm:h-16 sm:w-16">
              <span className="absolute left-3 top-4 h-3 w-3 rounded-full bg-zinc-400/50" />
              <span className="absolute left-8 top-7 h-2 w-2 rounded-full bg-zinc-400/40" />
              <span className="absolute left-4 top-9 h-2 w-2 rounded-full bg-zinc-400/45" />
              <span className="absolute right-2.5 bottom-3 h-2.5 w-2.5 rounded-full bg-zinc-400/35" />
            </div>
          </div>
        </div>

        {/* KUN: quyosh, bulutlar, qushlar */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            night ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="absolute right-[8%] top-[9%] sm:right-[12%] sm:top-[12%]">
            <span className="landing-sunpulse absolute -inset-5 rounded-full border-2 border-amber-400/50" />
            <span
              className="landing-sunpulse absolute -inset-10 rounded-full border border-amber-400/25"
              style={{ animationDelay: "-2.5s" }}
            />
            <div className="relative h-14 w-14 rounded-full bg-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.55)] sm:h-16 sm:w-16" />
          </div>
          <Cloud style={{ top: "16%", animationDuration: "90s" }} scale={1} />
          <Cloud
            style={{ top: "30%", animationDuration: "70s", animationDelay: "-35s" }}
            scale={0.65}
            opacity={0.75}
          />
          <Cloud
            style={{ top: "8%", animationDuration: "110s", animationDelay: "-60s" }}
            scale={0.5}
            opacity={0.6}
          />
          <Bird style={{ top: "20%", animationDuration: "32s" }} size={36} />
          <Bird
            style={{ top: "26%", animationDuration: "40s", animationDelay: "-14s" }}
            size={26}
          />
        </div>
      </div>

      {/* ============ YUQORI PANEL: bosh sahifa + sahna almashtirgich ============ */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-6">
        <Link
          to="/landing"
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
            night
              ? "text-zinc-400 hover:bg-white/10 hover:text-white"
              : "text-zinc-600 hover:bg-zinc-900/5 hover:text-zinc-900"
          )}
        >
          <ArrowLeft size={15} />
          Bosh sahifa
        </Link>
        <button
          type="button"
          onClick={() => setNight((v) => !v)}
          title={night ? "Kun sahnasiga o'tish" : "Tun sahnasiga o'tish"}
          className={cn(
            "relative flex h-9 w-[68px] items-center rounded-full border transition-colors duration-500",
            night ? "border-white/15 bg-white/10" : "border-orange-900/15 bg-white/80"
          )}
        >
          <span
            className={cn(
              "absolute flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-all duration-500",
              night
                ? "left-[calc(100%-30px)] bg-zinc-200 text-zinc-800"
                : "left-1 bg-amber-400 text-white"
            )}
          >
            {night ? <Moon size={15} /> : <Sun size={15} />}
          </span>
        </button>
      </div>

      {/* ============ KIRISH KARTASI ============ */}
      <div className="relative z-10 w-full max-w-sm animate-login-rise">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-colors duration-700",
              night ? "bg-amber-400 shadow-amber-400/25" : "bg-orange-500 shadow-orange-500/30"
            )}
          >
            <Building2 className={night ? "text-zinc-900" : "text-white"} size={28} />
          </div>
          <div>
            <h1
              className={cn(
                "text-3xl font-bold tracking-tight transition-colors duration-700",
                night ? "text-white" : "text-zinc-900"
              )}
            >
              GoHotel
            </h1>
            <p
              className={cn(
                "mt-1 text-sm transition-colors duration-700",
                night ? "text-zinc-400" : "text-zinc-600"
              )}
            >
              Mehmonxona boshqaruv tizimiga xush kelibsiz
            </p>
          </div>
        </div>

        {/* Oq shisha karta — forma har ikki sahnada ham o'qilishi kafolatlangan */}
        <div
          className={cn(
            "rounded-2xl border bg-white/95 p-6 text-zinc-900 shadow-2xl backdrop-blur-xl sm:p-7",
            night ? "border-white/10 shadow-black/40" : "border-orange-900/10 shadow-orange-900/15"
          )}
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-tight">Tizimga kirish</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
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
                    <FormLabel className="text-zinc-700">Foydalanuvchi nomi</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                        />
                        <Input
                          placeholder="admin"
                          autoFocus
                          autoComplete="username"
                          className="h-11 border-zinc-200 bg-white pl-9 text-zinc-900 placeholder:text-zinc-400 transition-shadow focus-visible:shadow-md"
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
                    <FormLabel className="text-zinc-700">Parol</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                        />
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="h-11 border-zinc-200 bg-white pl-9 pr-10 text-zinc-900 placeholder:text-zinc-400 transition-shadow focus-visible:shadow-md"
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
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 transition-colors hover:text-zinc-700"
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
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 animate-login-shake"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "h-11 w-full rounded-xl text-base font-semibold shadow-lg transition-all active:scale-[0.98]",
                  night
                    ? "bg-amber-400 text-zinc-900 shadow-amber-400/30 hover:bg-amber-300"
                    : "bg-orange-600 text-white shadow-orange-600/30 hover:bg-orange-500"
                )}
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

              {/* Yuz bilan to'g'ridan-to'g'ri kirish tugmasi OLIB
                  TASHLANDI: u parolni butunlay chetlab o'tardi. Yuz endi
                  ikkinchi bosqich va parol tekshirilgandan keyin
                  so'raladi. */}
            </form>
          </Form>
        </div>

        {/* Ikkinchi bosqich. Yopilsa kirish tugallanmaydi. */}
        <FaceCameraDialog
          open={faceOpen}
          onOpenChange={closeFaceStep}
          title="Yuzni tasdiqlang"
          actionLabel="Bekor qilish"
          hint="Ikkinchi bosqich: yuzingizni oval ramkaga joylang. Bu hisobga faqat uning egasi kira oladi."
          auto
          onCapture={handleFaceCapture}
        />

        <p
          className={cn(
            "mt-6 text-center text-xs transition-colors duration-700",
            night ? "text-zinc-500" : "text-zinc-500"
          )}
        >
          © {new Date().getFullYear()} GoHotel — mehmonxona boshqaruv tizimi
        </p>
      </div>
    </div>
  );
};
