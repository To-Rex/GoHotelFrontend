import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  LogOut,
  User,
  Menu,
  ScanFace,
  Sun,
  Moon,
  Clock,
  RotateCw,
  ChevronDown,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FaceEnrollDialog } from "@/features/auth/components/FaceEnrollDialog";
import { RecognizedGuestsMenu } from "@/features/vision/components/RecognizedGuestsMenu";
import {
  NewBookingDialog,
  type NewBookingRequest,
} from "@/features/reservations/components/NewBookingDialog";
import { addDaysStr, todayStr } from "@/features/reservations/lib/booking";
import { cn } from "@/lib/utils";

// Qolgan daqiqalarni odam o'qiydigan ko'rinishga keltiradi: "2 soat 15 daq"
const formatMinutes = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} daq`;
  if (m === 0) return `${h} soat`;
  return `${h} soat ${m} daq`;
};

interface NavbarProps {
  /** Mobil ko'rinishda sidebar drawer'ni ochish */
  onMenuClick?: () => void;
}

export const Navbar = ({ onMenuClick }: NavbarProps) => {
  const { user, logout } = useAuthStore();
  // Yuz bilan kirishni sozlash dialogi (har bir xodim o'z yuzini biriktiradi)
  const [faceDialogOpen, setFaceDialogOpen] = useState(false);

  /* Kamera tanigan mehmon ustiga bosilganda ochiladigan bandlov dialogi.
     U shu yerda turadi, sahifada emas: panel navbarda, ya'ni har qanday
     sahifadan bosilishi mumkin. Xona berilmaydi — dialog o'z ro'yxatini
     ko'rsatadi, sanalar esa bugundan ertaga. */
  const [bookingRequest, setBookingRequest] = useState<NewBookingRequest | null>(
    null
  );
  const openBookingFor = (guestId: string) => {
    const today = todayStr();
    setBookingRequest({
      checkInDate: today,
      checkOutDate: addDaysStr(today, 1),
      guestId,
    });
  };

  // Profil menyusi: account bosilganda ochiladi (ichida Chiqish tugmasi).
  // Tashqariga bosilganda yoki Escape'da yopiladi
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Yangilash: joriy sahifadagi barcha so'rovlar keshini eskirtirib qayta
  // yuklaydi (to'liq sahifa reload emas — holat va formalar saqlanadi)
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    setRefreshing(true);
    queryClient.invalidateQueries();
  };
  useEffect(() => {
    if (refreshing && isFetching === 0) {
      const t = window.setTimeout(() => setRefreshing(false), 300);
      return () => window.clearTimeout(t);
    }
  }, [refreshing, isFetching]);

  // Kun/tun mavzusi — tanlov brauzerda saqlanadi (standart: kun)
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  // Har 30 soniyada yangilanadigan "hozir" — ish vaqti hisoblagichi uchun
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Xodimning ish vaqti holati: smena ichida bo'lsa — tugashiga qancha qolgani,
  // tashqarida bo'lsa — boshlanish vaqti. Tungi smena (masalan 22:00-06:00)
  // ham to'g'ri hisoblanadi.
  const work = useMemo(() => {
    if (user?.user_type !== "EMPLOYEE" || !user.work_start || !user.work_end)
      return null;
    const parse = (t: string): number | null => {
      const [h, m] = t.split(":").map(Number);
      return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
    };
    const start = parse(user.work_start);
    const end = parse(user.work_end);
    if (start === null || end === null || start === end) return null;
    const d = new Date(now);
    const cur = d.getHours() * 60 + d.getMinutes();
    const inShift = start < end ? cur >= start && cur < end : cur >= start || cur < end;
    if (!inShift) return { state: "off" as const, startLabel: user.work_start };
    return { state: "on" as const, remaining: (end - cur + 1440) % 1440 };
  }, [user, now]);

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-3 sm:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        {/* Mobilda sidebar drawer tugmasi */}
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            title="Menyu"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Xodim uchun ish vaqti hisoblagichi: soat nechada tugashi (yaqqol)
            va tugashiga qancha qolgani */}
        {work &&
          (work.state === "on" ? (
            <span
              title={`Ish vaqti: ${user?.work_start}–${user?.work_end}`}
              className={cn(
                "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-semibold text-white shadow-sm",
                work.remaining <= 30 ? "bg-amber-500" : "bg-emerald-600"
              )}
            >
              {/* Tugash soati — oq kartochkada, eng ko'zga tashlanadigan qism */}
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-sm font-bold tabular-nums",
                  work.remaining <= 30 ? "text-amber-600" : "text-emerald-700"
                )}
              >
                <Clock size={13} />
                {user?.work_end}
              </span>
              <span>
                <span className="hidden sm:inline">gacha · qoldi: </span>
                {formatMinutes(work.remaining)}
              </span>
            </span>
          ) : (
            <span
              title={`Ish vaqti: ${user?.work_start}–${user?.work_end}`}
              className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500"
            >
              <Clock size={13} />
              <span className="hidden sm:inline">Ish</span>
              {work.startLabel}
              <span className="hidden sm:inline">da boshlanadi</span>
            </span>
          ))}
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Yangilash — yaqqol ko'rinadigan to'ldirilgan tugma */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Sahifani yangilash"
          className="flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-primary-500/30 transition-all hover:bg-primary-700 hover:shadow-primary-500/40 active:scale-95 disabled:opacity-70 sm:px-4 sm:text-sm"
        >
          <RotateCw size={16} className={cn(refreshing && "animate-spin")} />
          <span className="hidden sm:inline">
            {refreshing ? "Yangilanmoqda..." : "Yangilash"}
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={dark ? "Kun mavzusiga o'tish" : "Tun mavzusiga o'tish"}
        >
          {dark ? (
            <Sun size={18} className="text-muted-foreground hover:text-foreground" />
          ) : (
            <Moon size={18} className="text-muted-foreground hover:text-foreground" />
          )}
        </Button>
        {/* Kamera tanigan mehmonlar — xodimning o'z filiali bo'yicha */}
        <RecognizedGuestsMenu onPickGuest={openBookingFor} />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setFaceDialogOpen(true)}
          title="Yuz bilan kirishni sozlash"
        >
          <ScanFace size={18} className="text-muted-foreground hover:text-foreground" />
        </Button>
        {/* Account — eng o'ng burchakda; bosilganda profil menyusi ochiladi */}
        <div ref={menuRef} className="relative border-l border-border pl-2 sm:pl-3">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="Profil"
            className={cn(
              "flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-medium transition-colors hover:bg-muted",
              menuOpen && "bg-muted"
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User size={18} />
            </span>
            <span className="hidden md:block">
              {user?.first_name} {user?.last_name}
            </span>
            <ChevronDown
              size={14}
              className={cn(
                "text-muted-foreground transition-transform",
                menuOpen && "rotate-180"
              )}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
              {/* Profil ma'lumoti */}
              <div className="border-b border-border px-4 py-3">
                <p className="truncate text-sm font-semibold">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{user?.username}
                  {user?.hotel_name ? ` · ${user.hotel_name}` : ""}
                </p>
              </div>
              {/* Profil sahifasi */}
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <UserRound size={16} className="text-muted-foreground" />
                Profil
              </Link>
              {/* Chiqish */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2.5 border-t border-border px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut size={16} />
                Chiqish
              </button>
            </div>
          )}
        </div>
      </div>

      <FaceEnrollDialog open={faceDialogOpen} onOpenChange={setFaceDialogOpen} />
      <NewBookingDialog
        request={bookingRequest}
        onClose={() => setBookingRequest(null)}
      />
    </header>
  );
};
