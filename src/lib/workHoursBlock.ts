/**
 * Ish vaqtidan tashqarida ishlash taqiqi — umumiy qism.
 *
 * Mehmonxona sozlamalarida "Ish vaqti nazorati" yoqilgan bo'lsa, server
 * ish vaqti tugagan (yoki hali boshlanmagan) xodimning so'rovlariga 403 va
 * `OUTSIDE_WORK_HOURS` kodini qaytaradi. Qaror faqat SERVERDA qabul
 * qilinadi: administrator, "ish vaqtidan tashqari ham ishlay oladi"
 * belgili xodim va kassasi ochiq resepshn xodimi (ish vaqti tugaganda
 * "Davom etish" bilan ishlaydi) to'silmaydi.
 *
 * Kod uch joyda kerak: `api.ts` (so'rov to'silganda yozadi va yo'naltiradi),
 * kirish va asosiy qobiq (`/auth/me` dagi `work_hours_blocked` belgisiga
 * qarab yo'naltiradi) hamda sabab sahifasi (ko'rsatadi). Mehmonxona
 * to'xtatilgani (`hotelBlock.ts`) bilan bir xil tuzilish.
 */

/** Serverning xato kodi. `HOTEL_` bilan boshlanmaydi — aks holda u
 *  "mehmonxona to'xtatilgan" deb qabul qilinardi. */
export const OUTSIDE_WORK_HOURS_CODE = "OUTSIDE_WORK_HOURS"

/** Ish vaqti tashqarisida ko'rsatiladigan ochiq sahifa. */
export const OFF_HOURS_ROUTE = "/off-hours"

/** Server matni to'liq qayta yuklashdan omon qolishi uchun. */
export const WORK_HOURS_BLOCK_MESSAGE_KEY = "workHoursBlockMessage"

/** Serverdan kelgan kod ish vaqti taqiqi haqidami. */
export const isOutsideWorkHoursCode = (code: unknown): boolean =>
  code === OUTSIDE_WORK_HOURS_CODE

/** Javob xodimni ish vaqti sahifasiga yuborishi kerakmi (status + kod). */
export const isOutsideWorkHoursResponse = (
  status: unknown,
  code: unknown
): boolean => status === 403 && isOutsideWorkHoursCode(code)

/**
 * `/auth/me` javobi xodim HOZIR to'silganini aytadimi.
 *
 * Faqat aniq `true` hisobga olinadi: eski server bu maydonni qaytarmaydi
 * va u holda hech kim to'silmasligi kerak (avvalgi xatti-harakat).
 */
export const isWorkHoursBlocked = (profile: unknown): boolean =>
  !!profile &&
  typeof profile === "object" &&
  (profile as { work_hours_blocked?: unknown }).work_hours_blocked === true

const HM = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/

/** "HH:MM" (yoki "H:MM", "HH:MM:SS") bo'lsa — "HH:MM", aks holda `null`. */
const normalizeHM = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const m = value.trim().match(HM)
  if (!m) return null
  return `${m[1].padStart(2, "0")}:${m[2]}`
}

/**
 * Sahifada ko'rsatiladigan ish vaqti oralig'i: "09:00–18:00".
 *
 * Jadval yo'q, buzuq yoki 24 soatlik (boshlanish = tugash) bo'lsa `null` —
 * bunday xodimni server hech qachon to'smaydi, ko'rsatadigan oraliq ham yo'q.
 */
export const workHoursRange = (
  schedule: { work_start?: unknown; work_end?: unknown } | null | undefined
): string | null => {
  const start = normalizeHM(schedule?.work_start)
  const end = normalizeHM(schedule?.work_end)
  if (!start || !end || start === end) return null
  return `${start}–${end}`
}

/* AYLANMA YO'NALTIRISHDAN HIMOYA.

   Sahifa `/auth/me` "to'silmagan" desa xodimni o'zi ichkariga qaytaradi.
   Agar ichkaridagi so'rovlar baribir 403 qaytarsa (masalan, serverlar
   soati bir-biridan farq qilsa), xodim darhol qaytib keladi va sahifa
   soniyasiga bir necha marta qayta yuklanib qolardi. Shuning uchun
   avtomatik qaytish qisqa vaqt ichida faqat bir marta bajariladi;
   "Qayta tekshirish" tugmasi bu cheklovga bo'ysunmaydi. */
export const AUTO_RETURN_KEY = "offHoursAutoReturnAt"
export const AUTO_RETURN_COOLDOWN_MS = 30_000

/** Oxirgi avtomatik qaytishdan beri yetarli vaqt o'tdimi. */
export const canAutoReturn = (
  lastAt: number | null,
  now: number,
  cooldownMs: number = AUTO_RETURN_COOLDOWN_MS
): boolean =>
  lastAt === null || !Number.isFinite(lastAt) || now - lastAt >= cooldownMs || now < lastAt

export const readAutoReturnAt = (): number | null => {
  try {
    const raw = sessionStorage.getItem(AUTO_RETURN_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export const markAutoReturn = (now: number): void => {
  try {
    sessionStorage.setItem(AUTO_RETURN_KEY, String(now))
  } catch {
    /* saqlab bo'lmasa — himoyasiz, lekin ishlaydi */
  }
}

/* OCHIQ OYNA YOPILGUNCHA KUTISH.

   To'siq odatda fondagi so'rovdan bilinadi va sahifa darhol almashadi.
   Ekranda oyna ochiq bo'lsa esa u bilan birga foydalanuvchi o'qiyotgan
   narsa ham yo'qolardi. Eng muhim holat — resepshn xodimi ish vaqtidan
   keyin smenani topshiradi: server topshirishni qabul qiladi (sessiya hali
   faol edi), lekin sessiya endi "qabul kutilmoqda" holatida — smena
   holatini qayta o'qish 403 qaytaradi va kassa hisoboti oynasi (kutilgan /
   sanalgan / farq) ko'rinmasdan sahifa almashib ketardi.

   Shuning uchun ochiq oyna (Radix Dialog/AlertDialog/Popover) yopilguncha,
   ko'pi bilan DIALOG_WAIT_MAX_MS kutiladi. Oyna bo'lmasa — darhol. */
export const OPEN_DIALOG_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
export const DIALOG_WAIT_POLL_MS = 500
export const DIALOG_WAIT_MAX_MS = 2 * 60_000

const hasOpenDialog = (): boolean => {
  try {
    return (
      typeof document !== "undefined" &&
      document.querySelector(OPEN_DIALOG_SELECTOR) !== null
    )
  } catch {
    return false
  }
}

const isOnOffHoursPage = (): boolean =>
  window.location.pathname.startsWith(OFF_HOURS_ROUTE)

// Kutish paytida xodim o'zi chiqib ketgan bo'lsa — sahifaga yubormaymiz
const hasSession = (): boolean => {
  try {
    return !!localStorage.getItem("accessToken")
  } catch {
    return true
  }
}

let pendingRedirect: ReturnType<typeof setInterval> | null = null

/**
 * Ish vaqti sahifasiga o'tish (`api.ts` dagi 403 ushlagichidan).
 *
 * Sessiya tozalanmaydi. Allaqachon o'sha sahifada bo'lsak — tegilmaydi;
 * ochiq oyna bo'lsa — u yopilguncha kutiladi (bir nechta 403 bitta
 * kutishga qo'shiladi).
 */
export const redirectToOffHours = (): void => {
  if (isOnOffHoursPage()) return
  if (!hasOpenDialog()) {
    window.location.replace(OFF_HOURS_ROUTE)
    return
  }
  if (pendingRedirect !== null) return
  const startedAt = Date.now()
  pendingRedirect = setInterval(() => {
    if (hasOpenDialog() && Date.now() - startedAt < DIALOG_WAIT_MAX_MS) return
    if (pendingRedirect !== null) clearInterval(pendingRedirect)
    pendingRedirect = null
    if (isOnOffHoursPage() || !hasSession()) return
    window.location.replace(OFF_HOURS_ROUTE)
  }, DIALOG_WAIT_POLL_MS)
}

/** Server matnini saqlash (to'liq qayta yuklashda router state yo'qoladi). */
export const rememberWorkHoursBlockMessage = (detail: unknown): void => {
  if (typeof detail !== "string" || !detail) return
  try {
    sessionStorage.setItem(WORK_HOURS_BLOCK_MESSAGE_KEY, detail)
  } catch {
    /* Shaxsiy rejimda saqlash taqiqlangan bo'lishi mumkin — sahifada
       xodimning ish vaqti baribir ko'rinadi */
  }
}

export const readWorkHoursBlockMessage = (): string => {
  try {
    return sessionStorage.getItem(WORK_HOURS_BLOCK_MESSAGE_KEY) || ""
  } catch {
    return ""
  }
}

export const clearWorkHoursBlockMessage = (): void => {
  try {
    sessionStorage.removeItem(WORK_HOURS_BLOCK_MESSAGE_KEY)
  } catch {
    /* saqlanmagan bo'lsa tozalash ham shart emas */
  }
}
