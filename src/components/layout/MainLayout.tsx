import { useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/lib/permissions";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Ekranni to'liq egallashi kerak bo'lgan sahifalar: bu yerda max-w-7xl cheklovi va
// p-6 padding qo'llanmaydi, sahifaning o'zi butun bo'sh joyni boshqaradi.
const FULL_BLEED_ROUTES = ["/booking"];

export const MainLayout = () => {
  const { isAuthenticated, setUser } = useAuthStore();
  const { pathname } = useLocation();
  const { canRoute, firstAllowedRoute } = usePermissions();

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

  const fullBleed = FULL_BLEED_ROUTES.includes(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar />
        <main className={cn("flex-1 min-h-0", fullBleed ? "overflow-hidden" : "overflow-y-auto p-6")}>
          {fullBleed ? (
            <Outlet />
          ) : (
            <div className="mx-auto max-w-7xl">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
