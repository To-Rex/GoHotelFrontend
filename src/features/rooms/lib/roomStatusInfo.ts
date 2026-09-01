import type { HousekeepingTask } from "@/types/api"

/**
 * Xona holati haqidagi aniq ma'lumot: qachondan beri shu holatda, kim
 * biriktirilgan, ish boshlanganmi.
 *
 * Nega kerak: ro'yxatda faqat "Tozalanmoqda" yozuvi turardi. U rost, lekin
 * hech narsa aytmaydi — xona besh daqiqadan beri shundami yoki bir kundanmi,
 * farrosh biriktirilganmi, u ishni boshlaganmi. Aynan shu farqni ko'rmaganimiz
 * uchun bir kun turib qolgan xona e'tibordan chetda qoldi.
 *
 * Nega alohida modul: bu mantiq to'rt joyda kerak (xonalar sahifasining
 * karta va ro'yxat ko'rinishlari, soatlik lenta, kalendar) va vaqt hisobi —
 * chegaralar, ko'plik, kun/soat o'tishlari — testga arziydigan yagona joy.
 */

/** Bo'sh xona uchun hech qanday qo'shimcha ma'lumot ko'rsatilmaydi. */
export const DETAILED_STATUSES = [
  "CLEANING",
  "MAINTENANCE",
  "INSPECTION",
  "OUT_OF_SERVICE",
] as const

/** Vazifa turi -> holat matnidagi nomi. */
const TASK_ACTION: Record<string, string> = {
  CLEANING: "Tozalash",
  DEEP_CLEANING: "Chuqur tozalash",
  MAINTENANCE: "Ta'mirlash",
  INSPECTION: "Tekshiruv",
  TURN_DOWN: "Xona tayyorlash",
}

/** Vazifasiz holatlar uchun — tarixdan olingan vaqtga sarlavha. */
const STATUS_ACTION: Record<string, string> = {
  CLEANING: "Tozalash",
  MAINTENANCE: "Ta'mirlash",
  INSPECTION: "Tekshiruv",
  OUT_OF_SERVICE: "Xizmatdan chiqarilgan",
}

/**
 * Holat "uzoq cho'zilgan" deb hisoblanadigan chegara (daqiqa).
 *
 * Bu ogohlantirish, xato emas: tozalash odatda 20-30 daqiqada tugaydi,
 * shuning uchun bir soatdan oshgani e'tiborni tortishi kerak. Ta'mirlash
 * uzoqroq davom etishi tabiiy.
 */
const STALE_AFTER_MINUTES: Record<string, number> = {
  CLEANING: 60,
  INSPECTION: 60,
  MAINTENANCE: 24 * 60,
  OUT_OF_SERVICE: 7 * 24 * 60,
}

export interface RoomStatusDetail {
  /** "Tozalash boshlandi" / "Tozalash kutilmoqda" */
  headline: string
  /** Boshlangan payt, "14:20". Vaqt noma'lum bo'lsa null. */
  atLabel: string | null
  /** "35 daqiqa" — o'shandan beri o'tgan vaqt. */
  elapsedLabel: string | null
  /** Biriktirilgan xodim ismi. */
  assignee: string | null
  /** Ish boshlangan (IN_PROGRESS) yoki hali kutilmoqda (OPEN). */
  started: boolean
  /** Odatdagidan uzoq cho'zilgan — UI buni ajratib ko'rsatadi. */
  stale: boolean
}

export interface RoomStatusLike {
  id: string
  current_status: string
  /** Xona joriy holatga o'tgan payt (serverdan). */
  status_changed_at?: string | null
}

const parse = (value?: string | null): number | null => {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

const pad = (n: number) => String(n).padStart(2, "0")

/** "14:20" — mahalliy vaqt bo'yicha. */
export function clockLabel(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * O'tgan vaqt: "5 daqiqa", "1 soat 20 daqiqa", "2 kun 3 soat".
 *
 * Daqiqadan kichigi "hozir" — "0 daqiqa" mantiqsiz ko'rinadi. Kun va soatda
 * ikkinchi birlik nol bo'lsa tushirib qoldiriladi ("2 kun", "1 soat").
 */
export function formatElapsed(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 1) return "hozir"
  if (totalMinutes < 60) return `${totalMinutes} daqiqa`

  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) {
    const minutes = totalMinutes % 60
    return minutes ? `${totalHours} soat ${minutes} daqiqa` : `${totalHours} soat`
  }

  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours ? `${days} kun ${hours} soat` : `${days} kun`
}

/**
 * Xonaning faol xo'jalik vazifasi.
 *
 * Boshlangani ustun turadi: bir xonada ochiq va boshlangan vazifa birga
 * bo'lsa, xodimni qiziqtiradigani — hozir bajarilayotgani. Teng holatda
 * eng yangisi olinadi.
 */
export function activeTaskFor(
  tasks: readonly HousekeepingTask[],
  roomId: string
): HousekeepingTask | null {
  let best: HousekeepingTask | null = null
  for (const t of tasks) {
    if (t.room_id !== roomId) continue
    if (t.status !== "OPEN" && t.status !== "IN_PROGRESS") continue
    if (best === null) {
      best = t
      continue
    }
    const bestStarted = best.status === "IN_PROGRESS"
    const started = t.status === "IN_PROGRESS"
    if (started !== bestStarted) {
      if (started) best = t
      continue
    }
    if ((parse(t.created_at) ?? 0) > (parse(best.created_at) ?? 0)) best = t
  }
  return best
}

const fullName = (user?: { first_name?: string; last_name?: string } | null) => {
  if (!user) return null
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim()
  return name || null
}

/**
 * Xona holati bo'yicha ko'rsatiladigan tafsilot. Bo'sh xonada — null.
 *
 * Vaqt manbai: vazifa boshlangan bo'lsa `started_at`, aks holda vazifa
 * yaratilgan payt; vazifa umuman bo'lmasa xona holati o'zgargan payt.
 * Oxirgisi qo'lda qo'yilgan holatlar uchun (masalan ta'mirlash) yagona
 * ma'lumot manbai.
 */
export function roomStatusDetail(
  room: RoomStatusLike,
  task: HousekeepingTask | null,
  now: number
): RoomStatusDetail | null {
  const status = room.current_status
  if (!(DETAILED_STATUSES as readonly string[]).includes(status)) return null

  const started = task?.status === "IN_PROGRESS"
  const since =
    (started ? parse(task?.started_at) : null) ??
    parse(task?.created_at) ??
    parse(room.status_changed_at)

  const action =
    (task ? TASK_ACTION[task.task_type] : null) ||
    STATUS_ACTION[status] ||
    "Holat"

  let headline: string
  if (task) {
    headline = started ? `${action} boshlandi` : `${action} kutilmoqda`
  } else {
    // Vazifa yo'q — nima bo'layotganini aytolmaymiz, faqat qachondan beri
    headline = action
  }

  const elapsedMs = since === null ? null : Math.max(now - since, 0)
  const limit = STALE_AFTER_MINUTES[status]

  return {
    headline,
    atLabel: since === null ? null : clockLabel(since),
    elapsedLabel: elapsedMs === null ? null : formatElapsed(elapsedMs),
    assignee: fullName(task?.assigned_user),
    started,
    stale:
      elapsedMs !== null && limit !== undefined && elapsedMs > limit * 60_000,
  }
}
