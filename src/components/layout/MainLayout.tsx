import { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/lib/permissions";
import {
  useShiftState,
  shiftRestriction,
  isCashStaff,
  allowedRoutesFor,
  SHIFT_REDIRECT_ROUTE,
} from "@/features/shifts/api/shifts";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSeo } from "@/lib/seo";

// Ekranni to'liq egallashi kerak bo'lgan sahifalar: bu yerda max-w-7xl cheklovi va
// p-6 padding qo'llanmaydi, sahifaning o'zi butun bo'sh joyni boshqaradi.
const FULL_BLEED_ROUTES = ["/booking"];

// Barcha sahifalar to'liq KENGLIKDA ochiladi: scroll va padding odatdagidek,
// markazlash (max-w) cheklovi yo'q — kontent butun bo'sh joyni egallaydi.

// Smena cheklovi paytida ochiq qoladigan sahifalar


export const MainLayout = () => {
  const { isAuthenticated, setUser, user } = useAuthStore();
  const { pathname } = useLocation();
  // Ichki boshqaruv sahifalari qidiruvga chiqmasligi kerak (noindex)
  useSeo({ title: "Boshqaruv paneli — GoHotel", noindex: true });
  const { canRoute, firstAllowedRoute } = usePermissions();

  // Smena holati — faqat kassa bilan ishlaydigan xodimlar uchun so'raladi.
  // Ish vaqti tugagan / kassa kesimi kelgan / blok bo'lgan xodim faqat
  // "Mening hisobotim" va "Xarajatlar" sahifalarini ko'radi.
  const { data: shiftState } = useShiftState(isAuthenticated && isCashStaff(user));

  // Mobil (tor ekran) uchun sidebar drawer holati — sahifa almashganda yopiladi
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Brauzer tab sarlavhasi — foydalanuvchi mehmonxonasining nomi.
  // SUPER_ADMIN da (yoki nom hali yuklanmagan bo'lsa) "GoHotel" qoladi.
  useEffect(() => {
    document.title = user?.hotel_name || "GoHotel";
  }, [user?.hotel_name]);

  // Sahifa yangilanganda profilni (ruxsatlarni ham) qayta o'qiymiz — localStorage'dagi
  // eski sessiyada `permissions` bo'lmasligi yoki admin ruxsatlarni o'zgartirgan
  // bo'lishi mumkin. Xatolik bo'lsa e'tiborsiz qoldiramiz: 401 ni api interceptor hal qiladi.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setUser]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Ruxsati yo'q sahifaga to'g'ridan-to'g'ri URL orqali kirilsa — ruxsat berilgan
  // birinchi sahifaga qaytaramiz.
  if (!canRoute(pathname)) {
    return <Navigate to={firstAllowedRoute()} replace />;
  }

  // Smena cheklovi: smena ochilmagan, ish vaqti tugagan (davom etilmagan),
  // kunlik kassa kesimi kelgan yoki oldingi smena topshirilmagan — faqat
  // kassa, hisobot va xarajatlar sahifalari ochiq qoladi.
  const restriction = shiftRestriction(user, shiftState);
  if (restriction && !allowedRoutesFor(restriction).includes(pathname)) {
    // Kassa sahifasiga — smenani ochish/topshirish tugmalari o'sha yerda
    return <Navigate to={SHIFT_REDIRECT_ROUTE} replace />;
  }

  const fullBleed = FULL_BLEED_ROUTES.includes(pathname);

  return (
    /* h-dvh: haqiqiy ko'rinadigan balandlik — 100vh brauzer paneli/zoom
       hisobga olinmay pastki qismni kesib qo'yishi mumkin edi */
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop: doimiy sidebar; mobil: yashirin (drawer orqali ochiladi) */}
      <div className="hidden h-full md:block">
        <Sidebar />
      </div>

      {/* Mobil drawer — qoraytirilgan fon ustida chiqadigan sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full shadow-2xl">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setMobileNavOpen(true)} />
        <main
          className={cn(
            "flex-1 min-h-0",
            fullBleed ? "overflow-hidden" : "overflow-y-auto p-3 sm:p-4 md:p-6"
          )}
        >
          {fullBleed ? (
            <Outlet />
          ) : (
            /* min-h-full: sahifa kontenti kam bo'lsa ham butun bo'sh joyni egallaydi */
            <div className="min-h-full">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
