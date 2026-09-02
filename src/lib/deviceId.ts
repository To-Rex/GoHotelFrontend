/**
 * Qurilma identifikatori.
 *
 * Xodim faqat administrator tasdiqlagan qurilmadan kira oladi. Qurilmani
 * ajratish uchun brauzerda bir marta tasodifiy ID yaratiladi va saqlanadi;
 * u har so'rovda `X-Device-Id` sarlavhasida yuboriladi.
 *
 * Bu mukammal emas: ID nusxalanishi yoki brauzer ma'lumoti tozalanganda
 * yo'qolishi mumkin (o'shanda qurilma yangi sifatida qaytadi va yana
 * tasdiq kutadi). Lekin u PAROL BILAN BIRGA ishlaydi — o'g'irlangan
 * parolning o'zi endi yetarli emas. Qurilmani chindan bog'lash uchun
 * passkey (WebAuthn) bor, u alohida imkoniyat.
 */

const STORAGE_KEY = "deviceId"

/** Brauzerda saqlangan ID; bo'lmasa yaratiladi. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const created = createId()
    localStorage.setItem(STORAGE_KEY, created)
    return created
  } catch {
    /* Shaxsiy rejim yoki saqlash o'chirilgan bo'lsa localStorage xato
       beradi. Bunda har safar yangi ID chiqadi va qurilma tasdiqlanmaydi —
       server buni tushunarli xabar bilan aytadi. */
    return ""
  }
}

function createId(): string {
  // randomUUID hamma joyda yo'q (eski brauzer, HTTP orqali ochilgan sayt)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

/** Qurilma nomi taklifi — administrator ro'yxatda tanishi uchun. */
export function describeDevice(userAgent: string): string {
  const ua = userAgent || ""
  const os =
    /Windows/i.test(ua) ? "Windows" :
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iPod/i.test(ua) ? "iOS" :
    /Mac OS X|Macintosh/i.test(ua) ? "macOS" :
    /Linux/i.test(ua) ? "Linux" : null

  // Tartib muhim: Edge ham "Chrome" deb ataydi, Chrome esa "Safari" deb
  const browser =
    /Edg\//i.test(ua) ? "Edge" :
    /OPR\/|Opera/i.test(ua) ? "Opera" :
    /YaBrowser/i.test(ua) ? "Yandex" :
    /Firefox\//i.test(ua) ? "Firefox" :
    /Chrome\//i.test(ua) ? "Chrome" :
    /Safari\//i.test(ua) ? "Safari" : null

  const parts = [os, browser].filter(Boolean)
  return parts.length ? parts.join(" · ") : "Noma'lum qurilma"
}
