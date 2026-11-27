/* E-mehmon (davlat ro'yxati) — sof yordamchi funksiyalar.

   E-mehmon'ga so'rovlar FAQAT serverdan ketadi (maxfiy kalit brauzerga
   chiqmaydi). Bu yerda — shakl bilan ishlash: vaqtni Toshkent vaqtida
   ko'rsatish, «Bazadan tekshirish» natijasini shaklga qo'yish, to'liqlikni
   oldindan tekshirish. Yakuniy tekshiruv baribir serverda. */

export type EmehmonState =
  | "none"
  | "sending"
  | "registered"
  | "checked_out"
  | "failed"
  | "skipped"

export type Sex = "M" | "W"

export interface EmehmonChild {
  full_name: string
  gen: Sex | null
  birth_day: string | null
}

export interface EmehmonForm {
  surname: string
  firstname: string
  lastname: string
  citizen_id: number | null
  passport_number: string
  passport_type_id: number
  passport_date: string | null
  passport_issued_by: string
  birth_date: string | null
  sex: Sex | null
  pinfl: string
  person_id: string
  visit_type_id: number | null
  guest_type_id: number | null
  /** Kirish vaqti — ISO, Toshkent vaqti bilan: `2026-05-22T14:30:00+05:00` */
  arrival: string | null
  days: number | null
  room: string
  amount: number | null
  paid: boolean
  birth_country_id: number | null
  from_country_id: number | null
  visa_type_id: number | null
  visa_number: string
  visa_from: string | null
  visa_to: string | null
  visa_issued_by: string
  kpp_number: string
  kpp_date: string | null
  children: EmehmonChild[]
}

export interface DictItem {
  id: number
  name: string
  code?: string | null
}

export const UZBEKISTAN = 173
/** "Mahalliy" fuqaroliklar: O'zbekiston va fuqaroligi yo'q shaxs — PINFL bilan */
export const LOCAL_CITIZENS = [UZBEKISTAN, 231]

export const isLocal = (citizenId: number | null | undefined) =>
  citizenId != null && LOCAL_CITIZENS.includes(citizenId)

/** E-mehmon `payment_type_id` (chiqarishda yuboriladi). i18n:keys */
export const PAYMENT_TYPES: Array<{ id: number; label: string }> = [
  { id: 2, label: "Naqd" },
  { id: 4, label: "Uzcard" },
  { id: 3, label: "Humo" },
  { id: 5, label: "Pul o'tkazmasi" },
  { id: 6, label: "Shartnoma" },
  { id: 1, label: "Boshqa" },
]

// i18n:keys
const STATE_LABELS: Record<EmehmonState, string> = {
  none: "Ro'yxatga olinmagan",
  sending: "Yuborilmoqda",
  registered: "Ro'yxatga olingan",
  checked_out: "Chiqarilgan",
  failed: "Xato",
  skipped: "Kerak emas",
}

const STATE_TONES: Record<EmehmonState, string> = {
  none: "bg-amber-50 text-amber-700",
  sending: "bg-sky-50 text-sky-700",
  registered: "bg-emerald-50 text-emerald-700",
  checked_out: "bg-gray-100 text-gray-600",
  failed: "bg-red-50 text-red-700",
  skipped: "bg-gray-100 text-gray-500",
}

export const stateLabel = (state: EmehmonState) => STATE_LABELS[state] ?? state
export const stateTone = (state: EmehmonState) => STATE_TONES[state] ?? STATE_TONES.none

const TASHKENT_OFFSET_MIN = 5 * 60
const pad = (n: number) => String(n).padStart(2, "0")

/** ISO vaqt → `datetime-local` qiymati, Toshkent vaqti bilan.
 *  Brauzer qaysi vaqt zonasida bo'lishidan qat'i nazar bir xil chiqadi. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ""
  const d = new Date(ms + TASHKENT_OFFSET_MIN * 60_000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** `datetime-local` qiymati (Toshkent vaqti) → ISO `+05:00` bilan. */
export function fromLocalInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || "")
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+05:00`
}

/** Ko'rsatish uchun: `22.05.2026 14:30` (Toshkent vaqti). */
export function formatMoment(iso: string | null | undefined): string {
  const local = toLocalInput(iso)
  if (!local) return ""
  const [date, time] = local.split("T")
  const [y, mo, d] = date.split("-")
  return `${d}.${mo}.${y} ${time}`
}

/** Mehmon kartasidagi fuqarolik (ISO kodi) → `countries` ma'lumotnomasidagi id. */
export function citizenFromCode(code: string | null | undefined, countries: DictItem[]): number | null {
  const wanted = (code || "").trim().toUpperCase()
  if (!wanted) return null
  if (wanted === "UZB") return UZBEKISTAN
  const hit = countries.find((c) => (c.code || "").toUpperCase() === wanted)
  return hit ? hit.id : null
}

/** O'zbekiston ro'yxat boshida — eng ko'p tanlanadi. */
export function sortCountries(countries: DictItem[]): DictItem[] {
  return [...countries].sort((a, b) => {
    if (a.id === UZBEKISTAN) return -1
    if (b.id === UZBEKISTAN) return 1
    return a.name.localeCompare(b.name)
  })
}

/** «Bazadan tekshirish» natijasi → shakl. Rasmiy ma'lumot xodim kiritganidan
 *  USTUN (pasportdagi aniq yozilish), lekin bo'sh qiymat hech narsani o'chirmaydi. */
export function applyLookup(form: EmehmonForm, person: Partial<EmehmonForm>): EmehmonForm {
  const next: EmehmonForm = { ...form }
  for (const [key, value] of Object.entries(person)) {
    if (value === null || value === undefined || value === "") continue
    if (!(key in next)) continue
    ;(next as unknown as Record<string, unknown>)[key] = value
  }
  return next
}

/** Fuqarolik almashganda boshqa fuqarolikka tegishli maydonlar tozalanadi. */
export function withCitizen(form: EmehmonForm, citizenId: number | null): EmehmonForm {
  if (citizenId === form.citizen_id) return form
  const next = { ...form, citizen_id: citizenId }
  if (isLocal(citizenId)) next.person_id = ""
  else next.pinfl = ""
  return next
}

/** «Bazadan tekshirish» uchun yetarlimi: pasport, tug'ilgan sana, fuqarolik. */
export const canLookup = (form: EmehmonForm) =>
  !!form.passport_number.trim() && !!form.birth_date && !!form.citizen_id

/** Kirish vaqti E-mehmon qabul qiladigan oraliqdami (oxirgi 12 soat, kelajak emas).
 *  Qaytadigan matnlar — tarjima kalitlari. i18n:keys */
export function arrivalProblem(arrival: string | null, nowMs: number): string | null {
  if (!arrival) return "Kirish vaqti ko'rsatilmagan"
  const ms = Date.parse(arrival)
  if (Number.isNaN(ms)) return "Kirish vaqti ko'rsatilmagan"
  if (ms > nowMs + 60_000) return "Kirish vaqti kelajakda bo'lishi mumkin emas"
  if (ms < nowMs - 12 * 3_600_000)
    return "Kirish vaqti 12 soatdan eski — E-mehmon faqat oxirgi 12 soatni qabul qiladi"
  return null
}

/** Yuborishdan oldingi tekshiruv — yetishmayotgan narsalar ro'yxati
 *  (matnlar — tarjima kalitlari). Server ham aynan shuni tekshiradi. i18n:keys */
export function formProblems(form: EmehmonForm, nowMs: number): string[] {
  const problems: string[] = []
  if (!form.surname.trim()) problems.push("Familiya (lotin harflarida) kiritilmagan")
  if (!form.firstname.trim()) problems.push("Ism (lotin harflarida) kiritilmagan")
  if (!form.citizen_id) problems.push("Fuqarolik tanlanmagan")
  if (!form.passport_number.trim()) problems.push("Pasport seriya va raqami kiritilmagan")
  if (!form.birth_date) problems.push("Tug'ilgan sana kiritilmagan")
  if (!form.passport_date) problems.push("Pasport berilgan sana kiritilmagan")
  else if (form.birth_date && form.passport_date <= form.birth_date)
    problems.push("Pasport berilgan sana tug'ilgan sanadan keyin bo'lishi kerak")
  if (!form.sex) problems.push("Jinsi tanlanmagan")
  if (!form.visit_type_id) problems.push("Tashrif maqsadi tanlanmagan")
  if (!form.guest_type_id) problems.push("Mehmon turi tanlanmagan")
  if (!form.days || form.days < 1) problems.push("Turish muddati (sutka) kiritilmagan")
  const arrival = arrivalProblem(form.arrival, nowMs)
  if (arrival) problems.push(arrival)
  if (form.citizen_id && !isLocal(form.citizen_id) && !form.person_id.trim())
    problems.push("Chet el fuqarosi uchun «Bazadan tekshirish» kerak (Chegara xizmati identifikatori)")
  const pinfl = form.pinfl.replace(/\D/g, "")
  if (pinfl && pinfl.length !== 14) problems.push("PINFL 14 ta raqamdan iborat bo'lishi kerak")
  return problems
}

/** Kirgandan beri o'tgan vaqt — navbat ro'yxati uchun (`3 soat 20 daq`). */
export function elapsedParts(sinceIso: string | null | undefined, nowMs: number): { hours: number; minutes: number } | null {
  if (!sinceIso) return null
  const ms = Date.parse(sinceIso)
  if (Number.isNaN(ms)) return null
  const total = Math.max(0, Math.floor((nowMs - ms) / 60_000))
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

/** So'm: `450 000`. */
export const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("uz-UZ").format(Math.round(value || 0)).replace(/,/g, " ")
