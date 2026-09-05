/**
 * Xona holati bron qilishga yo'l qo'yadimi.
 *
 * To'rttala texnik holat — tozalanmoqda, ta'mirda, tekshiruvda va
 * xizmatdan tashqari — xonani BUTUNLAY yopadi: hech qanday sanaga bron
 * qilinmaydi. Farq faqat xabarda: tozalash o'zi tugab xona ochiladi,
 * qolganlarida holat almashtirilishi kerak. Holatdan tashqari faol
 * xo'jalik VAZIFASI ham tekshiriladi (`blockingTaskMap`) — xona "bo'sh"
 * ko'rinsa ham ochiq ish bron qilishga yo'l qo'ymaydi.
 *
 * Bu qoida serverda ham bor (`reservation_service._assert_room_bookable`) —
 * u haqiqiy himoya, bu esa xodim so'rov yuborishdan oldin sababni ko'rishi
 * uchun. Ikkalasi bir xil bo'lishi kerak, shuning uchun chegaralar shu yerda
 * bitta joyda yozilgan va test bilan qulflangan.
 */

/** Holat almashtirilmaguncha hech qanday sanaga bron qilib bo'lmaydi. */
export const BLOCKED_ALWAYS = [
  "MAINTENANCE",
  "INSPECTION",
  "OUT_OF_SERVICE",
] as const

/** Ish tugashi bilan O'ZI ochiladigan holat — xabari boshqacha. */
export const BLOCKED_NOW = ["CLEANING"] as const

const STATUS_LABEL: Record<string, string> = {
  CLEANING: "tozalanmoqda",
  MAINTENANCE: "ta'mirda",
  INSPECTION: "tekshiruvda",
  OUT_OF_SERVICE: "xizmatdan tashqari",
}

export interface BookableRoom {
  room_number?: string
  current_status: string
}

/** Bron davri. Soatlikda aniq vaqt, kunlikda sanalar. */
export interface BookingWindow {
  bookingType: "DAILY" | "HOURLY"
  /** "yyyy-MM-dd" */
  checkInDate?: string | null
  checkOutDate?: string | null
  /** Soatlik uchun: "yyyy-MM-ddTHH:mm" yoki ISO */
  checkInAt?: string | null
  checkOutAt?: string | null
}

/** Holat almashtirilmaguncha butunlay yopiqmi. */
export function isBlockedAlways(status: string): boolean {
  return (BLOCKED_ALWAYS as readonly string[]).includes(status)
}

/** Hozirgi payt uchun yopiq bo'lishi mumkinmi (tozalash). */
export function isBlockedNow(status: string): boolean {
  return (BLOCKED_NOW as readonly string[]).includes(status)
}

/** Bron qilishga xalaqit beradigan holatdami (ikkala darajadan biri). */
export function isRestrictedStatus(status: string): boolean {
  return isBlockedAlways(status) || isBlockedNow(status)
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] || status
}

const parseMs = (value?: string | null): number | null => {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Bron davri hozirgi paytni qamrab oladimi.
 *
 * Kunlik bronda kun aniqligida: kirish sanasi bugun yoki undan oldin, chiqish
 * sanasi esa bugundan keyin. Soatlikda aniq vaqt bo'yicha.
 *
 * Vaqti noma'lum bo'lsa (sanalar hali kiritilmagan) `false` — xodim hali
 * hech narsa tanlamagan bo'lsa uni ogohlantirish erta bo'lardi.
 */
export function windowCoversNow(w: BookingWindow, now: Date): boolean {
  if (w.bookingType === "HOURLY") {
    const start = parseMs(w.checkInAt)
    const end = parseMs(w.checkOutAt)
    if (start === null || end === null) return false
    const ms = now.getTime()
    return start <= ms && ms < end
  }

  if (!w.checkInDate || !w.checkOutDate) return false
  const pad = (n: number) => String(n).padStart(2, "0")
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return w.checkInDate <= today && today < w.checkOutDate
}

/** Faol bo'lsa xonani bron uchun butunlay yopadigan vazifa turlari.

    Xona holati hatto "bo'sh" bo'lishi mumkin, lekin unda tugallanmagan
    VAZIFA — ta'mir, tekshiruv yoki har qanday tozalash — turgan bo'lsa,
    bron ish yakunlangunga qadar yopiq. TURN_DOWN ro'yxatda yo'q: u
    mehmon ichkarida turganda bajariladi va xonani band qilmaydi. Server
    ham xuddi shu qoidani tekshiradi
    (`reservation_service._active_blocking_task`). */
export const BLOCKING_TASK_TYPES = [
  "MAINTENANCE",
  "INSPECTION",
  "CLEANING",
  "DEEP_CLEANING",
] as const

const TASK_WORK_LABEL: Record<string, string> = {
  MAINTENANCE: "ta'mirlash ishi",
  INSPECTION: "tekshiruv ishi",
  CLEANING: "tozalash ishi",
  DEEP_CLEANING: "chuqur tozalash ishi",
}

//: Bir xonada bir nechta faol vazifa bo'lsa — og'irrog'i ustun
const TASK_PRIORITY = BLOCKING_TASK_TYPES as readonly string[]

export function taskWorkLabel(taskType: string): string {
  return TASK_WORK_LABEL[taskType] || taskType
}

/** Vazifaning bron to'sig'ini hisoblash uchun kerak bo'lgan qismi. */
export interface RoomTaskLike {
  room_id: string
  task_type: string
  status: string
  scheduled_date?: string | null
}

/**
 * Xona -> uni yopadigan faol vazifa turi.
 *
 * Faqat OCHIQ yoki BOSHLANGAN ta'mir/tekshiruv hisobga olinadi; kelgusi
 * sanaga rejalashtirilgani xonani hozirdan yopmaydi (mavjud "kelgusi
 * vazifa xonani band qilmaydi" qoidasi bilan bir xil). Bitta xonada
 * ikkalasi bo'lsa ta'mir ustun.
 */
export function blockingTaskMap(
  tasks: readonly RoomTaskLike[],
  now: Date
): Record<string, string> {
  const pad = (n: number) => String(n).padStart(2, "0")
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const map: Record<string, string> = {}
  for (const t of tasks) {
    if (!(BLOCKING_TASK_TYPES as readonly string[]).includes(t.task_type)) continue
    if (t.status !== "OPEN" && t.status !== "IN_PROGRESS") continue
    if (t.scheduled_date && String(t.scheduled_date).slice(0, 10) > today) continue
    const current = map[t.room_id]
    if (
      !current ||
      TASK_PRIORITY.indexOf(t.task_type) < TASK_PRIORITY.indexOf(current)
    ) {
      map[t.room_id] = t.task_type
    }
  }
  return map
}

/**
 * Bron qilishga to'siq bo'lsa — sababi, bo'lmasa null.
 *
 * `window` berilmasa faqat "har qanday vaqt uchun taqiq" tekshiriladi: bu
 * ro'yxatlarda xonani belgilash uchun, sanalar hali ma'lum bo'lmaganda.
 */
export function roomBookingBlock(
  room: BookableRoom,
  /* Davr va vaqt endi qarorga ta'sir qilmaydi (to'rttala holat ham har
     qanday sanaga yopiq) — imzo chaqiruvchilar va testlar buzilmasligi
     uchun saqlangan */
  _window: BookingWindow | null,
  _now: Date,
  /** Xonadagi faol xo'jalik vazifasi turi (`blockingTaskMap`dan). */
  blockingTask?: string | null
): string | null {
  const status = room.current_status
  const where = room.room_number ? `${room.room_number}-xona` : "Xona"
  const label = statusLabel(status)

  if (isBlockedAlways(status)) {
    return `${where} ${label} — holat o'zgartirilmaguncha hech qanday sanaga bron qilib bo'lmaydi.`
  }

  // Holat yumshoq bo'lsa ham tugallanmagan ta'mir/tekshiruv vazifasi
  // xonani yopadi — ish yakunlangach o'zi ochiladi
  if (blockingTask) {
    return `${where}da ${taskWorkLabel(blockingTask)} tugallanmagan — ish yakunlangach bron qilish mumkin bo'ladi.`
  }

  if (isBlockedNow(status)) {
    return `${where} hozir ${label} — tozalash yakunlangach bron qilish mumkin bo'ladi.`
  }

  return null
}
