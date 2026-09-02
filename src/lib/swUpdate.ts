/**
 * Service worker'ni yangi deploydan xabardor qilish.
 *
 * Ilova PWA sifatida yig'iladi va service worker fayllarni keshlaydi. Kesh
 * `autoUpdate` rejimida ishlaydi, lekin yangilanish faqat SAHIFA QAYTA
 * YUKLANGANDA tekshiriladi. Resepsiya kompyuterida esa sahifa kun bo'yi
 * ochiq turadi: yangi deploy chiqsa ham xodim eski ilovani ko'rib
 * ishlayveradi — bu amalda muammo bo'ldi, deploy qilingan tuzatish
 * ekranda ko'rinmadi.
 *
 * Shuning uchun ochiq sahifa vaqti-vaqti bilan o'zi tekshiradi. Yangi
 * versiya topilsa service worker uni yuklab, o'rnini egallaydi (`sw.js`
 * `skipWaiting` va `clientsClaim` bilan yig'ilgan) va keyingi navigatsiyada
 * yangi kod ishlaydi.
 *
 * Sahifa majburan qayta yuklanmaydi: xodim shu payt bron yoki to'lov
 * kiritayotgan bo'lishi mumkin, kiritilganini yo'qotish yangilanishdan
 * ko'ra qimmatga tushadi.
 */

/** Tekshiruv oralig'i. Tez-tez so'rash shart emas — deploy kuniga bir necha marta. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000

export function startServiceWorkerUpdates(): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return () => {}
  }

  let timer: ReturnType<typeof setInterval> | undefined

  const check = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      // Ro'yxatdan o'tmagan bo'lsa (dev rejim yoki HTTP) tekshiradigan narsa yo'q
      await registration?.update()
    } catch {
      /* Tarmoq yo'q yoki brauzer ruxsat bermadi — keyingi safar urinadi */
    }
  }

  // Sahifa fonga o'tib qaytganda darhol tekshiramiz: xodim ertalab
  // kompyuterni uyg'otganda eng ko'p shu holat bo'ladi
  const onVisible = () => {
    if (document.visibilityState === "visible") void check()
  }

  void check()
  timer = setInterval(check, CHECK_INTERVAL_MS)
  document.addEventListener("visibilitychange", onVisible)

  return () => {
    if (timer) clearInterval(timer)
    document.removeEventListener("visibilitychange", onVisible)
  }
}
