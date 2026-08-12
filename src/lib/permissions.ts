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
  // Qavatlar — ADMIN/SUPER_ADMIN (isAdmin bypass) yoki floor ruxsatli xodim ko'radi
  "/floors": ["floor.create", "floor.update", "floor.delete"],
  "/guests": ["guest.view"],
  "/finance": ["finance.view"],
  // Xarajatlar — BARCHA rollar uchun ochiq (bo'sh massiv = hammaga ruxsat);
  // kiritish ham hammaga ochiq, o'chirish esa expense.delete bilan cheklanadi
  "/expenses": [],
  // Do'kon (sotuvlar) — qabulxona, menejer va admin uchun. Hozircha alohida
  // shop.* ruxsat kodlari yo'q, shuning uchun /booking bilan bir xil doira:
  // bron ruxsatiga ega xodimlar (farroshda bu yo'q) va admin (bypass) ko'radi
  "/shop": ["reservation.create", "reservation.view"],
  // Shaxsiy hisobot — xodim o'zi yaratgan bronlar va xarajatlarini ko'radi.
  // Bron yarata oladigan har bir xodimga (qabulxona, menejer) ochiq
  "/my-reports": ["reservation.create", "reservation.view"],
  // --- Boshqaruv bo'limlari (admin/menejer) ---
  // ADMIN/SUPER_ADMIN isAdmin bypass orqali doim ko'radi; xodim (menejer)
  // esa quyidagi ruxsatlardan kamida bittasiga ega bo'lsa ko'radi.
  "/room-types": ["room_type.create", "room_type.update", "room_type.delete"],
  "/amenities": ["service.manage"],
  // Diqqat: service.view ataylab kiritilmagan — u faqat xizmatlarni ko'rish
  // (masalan, bronga xizmat qo'shish) uchun; boshqaruv sahifasi esa faqat
  // boshqaruv ruxsatlariga ega bo'lganlarga (va ADMIN/SUPER_ADMIN'ga) ochiq.
  "/services": [
    "service.manage",
    "service.create",
    "service.update",
    "hotel_service.manage",
  ],
  "/housekeeping": [
    "housekeeping.task.create",
    "housekeeping.task.assign",
    "housekeeping.task.update",
  ],
  "/employees": [
    "employee.view",
    "employee.create",
    "employee.update",
    "employee.delete",
    "employee.manage",
  ],
  "/permissions": ["permission.view", "permission.assign", "employee.manage"],
  // Smenalar tarixi — admin (bypass) va menejer (shift.force_close) uchun
  "/shifts": ["shift.force_close"],
  // Ombor — backend bilan bir xil boshqaruv doirasi (tannarxlar bor,
  // kassirga ko'rinmaydi); admin bypass, menejer service.* orqali kiradi
  "/warehouse": [
    "service.manage",
    "service.create",
    "service.update",
    "hotel_service.manage",
  ],
  // Profil — har bir kirgan foydalanuvchi o'zinikini ko'radi
  "/profile": [],
};

// Faqat ADMIN/SUPER_ADMIN uchun ochiq marshrutlar (avvalgi xatti-harakat saqlangan).
export const ADMIN_ONLY_ROUTES = ["/settings", "/settings/receipt"];

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
    const order = [
      "/",
      "/booking",
      "/reservations",
      "/guests",
      "/rooms",
      "/finance",
      "/housekeeping",
      "/employees",
      "/services",
    ];
    return order.find((p) => canRoute(p)) ?? "/";
  };

  return { isAdmin, permissions: codes ?? [], can, canRoute, firstAllowedRoute };
}
