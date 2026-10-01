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
  "/rooms": ["room.view"],
  // Qavatlar — ADMIN/SUPER_ADMIN (isAdmin bypass) yoki floor ruxsatli xodim ko'radi
  "/floors": ["floor.create", "floor.update", "floor.delete"],
  // Mehmonlar bazasi — admin (bypass) va menejer (shift.force_close) uchun.
  // Qabulxona xodimiga sahifa ko'rinmaydi: unga mehmon KERAK bo'lgan joyda —
  // "Yangi bandlov" oynasida — qidirish, skanerlash va yangi mehmon qo'shish
  // avvalgidek ishlayveradi, chunki u sahifa ruxsatiga bog'liq emas.
  "/guests": ["shift.force_close"],
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
  // Kassa hisobotlari — smena ochish/topshirish.
  //
  // Ro'yxat isCashStaff() ni TO'LIQ qamrab olishi SHART: smena ochilmagan
  // xodim shu sahifaga yo'naltiriladi, u yerga esa kira olmasa — yo'naltirish
  // aylanib qoladi. Shuning uchun faqat finance.payment.create ega kassir ham
  // shu yerda bo'lishi kerak.
  "/cash-reports": [
    "reservation.create",
    "reservation.view",
    "finance.payment.create",
  ],
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
  // Xabarlar — barcha xodimlar (farrosh ham) yuboradi/ko'radi
  "/messages": [],
  // Talab, taklif va shikoyatlar — mehmon bilan ishlaydiganlar: qabulxona
  // (reservation.*), menejer (shift.force_close), admin (bypass) va alohida
  // feedback.* berilganlar. Ro'yxat backend feedback_service.VIEW_CODES
  // bilan bir xil. Farrosh/texnik ko'rmaydi — murojaatda mehmon ismi va
  // telefoni bor.
  "/feedback": [
    "feedback.view",
    "feedback.create",
    "feedback.manage",
    "reservation.create",
    "reservation.update",
    "reservation.view",
    "shift.force_close",
  ],
};

// Faqat ADMIN/SUPER_ADMIN (va mehmonxona tanlagan sozlovchi) uchun ochiq marshrutlar.
// Qurilmalar ro'yxati kirish huquqini beradi — uni tahrirlash tizimga
// kirish huquqini tarqatish bilan barobar, shuning uchun faqat admin
// "/apps" — o'rnatish fayllari: tarqatish administratorning ishi
export const ADMIN_ONLY_ROUTES = ["/devices", "/apps"];

// Sozlamalar — FAQAT sozlovchi (CONFIGURATOR) va tizim ma'muri (SUPER_ADMIN).
// Mehmonxona administratori ham, xodimlar ham bu sahifalarni umuman
// ko'rmaydi; server ham sozlamani o'zgartirishni faqat shularga beradi.
export const SETTINGS_ROUTES = ["/settings", "/settings/receipt"];

/** Yo'lni marshrutlash qanday tushunsa shunday: kichik harf, oxirgi "/" siz. */
export const normalizeRoute = (path: string): string =>
  (path || "/").toLowerCase().replace(/\/+$/, "") || "/";

/** Tanlangan mehmonxonada administrator kabi ishlaydigan turlar. */
export const isAdminType = (type?: string | null): boolean =>
  type === "ADMIN" || type === "SUPER_ADMIN" || type === "CONFIGURATOR";

/** Sozlamalarni ko'ra va o'zgartira oladiganlar. */
export const canManageSettingsType = (type?: string | null): boolean =>
  type === "CONFIGURATOR" || type === "SUPER_ADMIN";

/** Mehmonxona va filialni o'zi tanlay oladiganlar (Navbar'dagi tanlagich). */
export const canSwitchContextType = (type?: string | null): boolean =>
  type === "CONFIGURATOR" || type === "SUPER_ADMIN";

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  const isAdmin = isAdminType(user?.user_type);
  const canManageSettings = canManageSettingsType(user?.user_type);
  const isConfigurator = user?.user_type === "CONFIGURATOR";

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
    // Marshrutlash katta-kichik harf va oxirgi "/" ga qaramaydi
    // ("/Settings/receipt/" ham o'sha sahifa) — tekshiruv ham shunday
    const route = normalizeRoute(path);
    if (SETTINGS_ROUTES.includes(route)) return canManageSettings;
    if (ADMIN_ONLY_ROUTES.includes(route)) return !!isAdmin;
    return can(...(ROUTE_PERMISSIONS[route] ?? []));
  };

  // Ruxsat berilmagan sahifaga kirishga urinilganda yo'naltiriladigan manzil.
  const firstAllowedRoute = (): string => {
    const order = [
      "/",
      "/booking",
      "/guests",
      "/rooms",
      "/finance",
      "/housekeeping",
      "/employees",
      "/services",
    ];
    return order.find((p) => canRoute(p)) ?? "/";
  };

  return {
    isAdmin,
    canManageSettings,
    isConfigurator,
    permissions: codes ?? [],
    can,
    canRoute,
    firstAllowedRoute,
  };
}
