import { useAuthStore } from "@/store/auth";

/**
 * Ruxsatlar backenddagi `permissions` jadvali kodlari bilan bir xil
 * (masalan: "reservation.create", "guest.update", "room.view").
 * `/auth/me` endpointi EMPLOYEE uchun shu kodlar ro'yxatini qaytaradi;
 * ADMIN va SUPER_ADMIN uchun ro'yxat bo'sh keladi — ular hamma narsaga ega.
 */

// Har bir marshrut uchun talab qilinadigan ruxsatlar. Ro'yxatdagi kamida
// bittasi bo'lsa sahifa ochiladi (OR mantiq). Bo'sh massiv — hammaga ochiq.
export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  // Dashboard moliyaviy KPI (jami tushum) ko'rsatadi — hisobot ruxsati talab qilinadi
  "/": ["report.view", "report.generate"],
  "/booking": ["reservation.create", "reservation.view"],
  "/reservations": ["reservation.view"],
  "/rooms": ["room.view"],
  "/guests": ["guest.view"],
  "/finance": ["finance.view"],
};

// Faqat ADMIN/SUPER_ADMIN uchun ochiq marshrutlar (avvalgi xatti-harakat saqlangan).
export const ADMIN_ONLY_ROUTES = ["/settings"];

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  const isAdmin = user?.user_type === "ADMIN" || user?.user_type === "SUPER_ADMIN";

  // `undefined` — profil hali yangilanmagan (eski sessiya). Bunday holatda
  // hech narsani yashirmaymiz, aks holda /auth/me javobi kelguncha menyu
  // "sakrab" ketadi yoki eski sessiyalar noto'g'ri cheklanadi.
  const codes = user?.permissions;
  const unknown = codes === undefined;

  const can = (...required: string[]): boolean => {
    if (isAdmin || unknown) return true;
    if (required.length === 0) return true;
    return required.some((c) => codes!.includes(c));
  };

  const canRoute = (path: string): boolean => {
    if (ADMIN_ONLY_ROUTES.includes(path)) return !!isAdmin;
    return can(...(ROUTE_PERMISSIONS[path] ?? []));
  };

  // Ruxsat berilmagan sahifaga kirishga urinilganda yo'naltiriladigan manzil.
  const firstAllowedRoute = (): string => {
    const order = ["/", "/booking", "/reservations", "/guests", "/rooms", "/finance"];
    return order.find((p) => canRoute(p)) ?? "/";
  };

  return { isAdmin, permissions: codes ?? [], can, canRoute, firstAllowedRoute };
}
