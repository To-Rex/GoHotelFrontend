import type { CashBreakdown, CashCut, HandoverScope, PrevShiftsPlan } from "../api/shifts"

/* Kassani kunlik kesim bo'yicha topshirish — tanlov mantig'i.

   Sessiya bir necha kun ochiq tursa, kunlik kesim momentlari (masalan har
   kuni 00:05) uni kunlarga bo'ladi:

       boshlanish ─▶ 1-kesim ─▶ 2-kesim ─▶ hozir
          1-kun        2-kun     kesimdan keyin

   Topshirish KETMA-KET: xodim qaysi kungacha topshirishini tanlaydi va
   o'sha kungacha bo'lgan hamma kunlar topshiriladi (eng eskisidan boshlab).
   Oxirgi qator — "kesimdan keyin" — tanlansa, avvalgidek hozirgacha bo'lgan
   hamma pul topshiriladi.

   "Faqat yopilgan kunlar" rejimida (sozlama, `closed_days_only`) tanlov
   yo'q: har doim oxirgi kesimgacha — yopilgan kunlarning hammasi birga;
   bugungi tushum topshirilmaydi. Sessiyaga kesim tushmagan bo'lsa — hali
   topshiradigan narsa yo'q.

   "Faqat oldingi smenalar" rejimida (`handover_scope: "prev_shifts"`) kunlik
   kesim ishlatilmaydi: topshiriladigani — oldingi smenalardan qolgan pul
   (`prev_shifts`), xodimning o'z smenasidagi tushum esa kassada qoladi.
   Bunday pul bo'lmasa — topshiradigan narsa yo'q.

   Hisob serverda (`plan_cuts`); bu yerda faqat ko'rsatish va tanlov. */

/** "Hamma pul" tanlovi (kesimsiz — avvalgi xatti-harakat). */
export const ALL_CASH = "all"

/** Tanlov: kesim momenti (`CashCut.cut_at`) yoki `ALL_CASH`. */
export type CutChoice = string

const cutsOf = (data: CashBreakdown | undefined | null): CashCut[] => data?.cuts ?? []

/** Kesim bo'yicha topshirish mumkinmi (sessiyaga kamida bitta kesim tushgan). */
export const hasCuts = (data: CashBreakdown | undefined | null): boolean =>
  cutsOf(data).length > 0

/** Hisobdagi topshirish tartibi. Yangi maydon bo'lmasa (eski server) —
 *  `closed_days_only` dan; u ham bo'lmasa — erkin. */
export const handoverScopeOf = (data: CashBreakdown | undefined | null): HandoverScope => {
  const scope = data?.handover_scope
  if (scope === "free" || scope === "closed_days" || scope === "prev_shifts") return scope
  return data?.closed_days_only === true ? "closed_days" : "free"
}

/** "Faqat yopilgan kunlar" rejimi: xodim tanlamaydi — yopilgan kunlarning
 *  hammasi birga topshiriladi, bugungi tushum esa keyingi kesimdan keyin. */
export const closedDaysOnly = (data: CashBreakdown | undefined | null): boolean =>
  handoverScopeOf(data) === "closed_days"

/** "Faqat oldingi smenalar" rejimi: topshiriladigani — oldingi smenalardan
 *  qolgan pul; xodimning o'z smenasidagi tushum topshirilmaydi. */
export const prevShiftsOnly = (data: CashBreakdown | undefined | null): boolean =>
  handoverScopeOf(data) === "prev_shifts"

/** Oldingi smenalardan qolgan pulni topshirish hisobi (faqat shu rejimda). */
export const prevShiftsPlan = (
  data: CashBreakdown | undefined | null
): PrevShiftsPlan | null => (prevShiftsOnly(data) ? (data?.prev_shifts ?? null) : null)

/** Kunlar ro'yxati ko'rsatiladimi: sessiyaga kesim tushgan va rejim kunlik
 *  kesim bilan ishlaydi ("oldingi smenalar"da kesim ishlatilmaydi). */
export const showsDays = (data: CashBreakdown | undefined | null): boolean =>
  !prevShiftsOnly(data) && hasCuts(data)

/** Cheklangan rejimda topshiradigan narsa yo'q:
 *  - yopilgan kunlar: kassa oxirgi kesimdan keyin ochilgan — unda faqat
 *    bugungi pul bor;
 *  - oldingi smenalar: qabul qilingan pul yo'q (yoki smenadagi xarajatga
 *    ketgan) — kassada faqat xodimning o'z tushumi. */
export const handoverBlocked = (data: CashBreakdown | undefined | null): boolean => {
  const scope = handoverScopeOf(data)
  if (scope === "closed_days") return !hasCuts(data)
  if (scope === "prev_shifts") return Number(data?.prev_shifts?.due_cash || 0) < 1
  return false
}

/** Standart tanlov — eng oxirgi kesim: tugagan kunlarning hammasi
 *  topshiriladi, bugungi (kesimdan keyingi) tushum kassada qoladi.
 *  Kesim yo'q bo'lsa — hamma pul. */
export const defaultCutChoice = (data: CashBreakdown | undefined | null): CutChoice => {
  const cuts = cutsOf(data)
  return cuts.length > 0 ? cuts[cuts.length - 1].cut_at : ALL_CASH
}

/** Joriy tanlov. Xodim hali tanlamagan (`null`) yoki tanlagan kesimi
 *  ro'yxatdan chiqib ketgan bo'lsa (hisob yangilandi) — standart. */
export const effectiveCutChoice = (
  data: CashBreakdown | undefined | null,
  choice: CutChoice | null
): CutChoice => {
  // Oldingi smenalar rejimi: yagona variant — smena boshidagi pul
  if (prevShiftsOnly(data)) return data?.prev_shifts?.cut_at ?? ALL_CASH
  // Yopilgan kunlar rejimi: tanlov inobatga olinmaydi — har doim oxirgi kesim
  if (closedDaysOnly(data)) return defaultCutChoice(data)
  if (choice === ALL_CASH) return ALL_CASH
  if (choice && cutsOf(data).some((c) => c.cut_at === choice)) return choice
  return defaultCutChoice(data)
}

/** Tanlangan kesim; `null` — hamma pul topshiriladi. */
export const selectedCut = (
  data: CashBreakdown | undefined | null,
  choice: CutChoice | null
): CashCut | null => {
  // Oldingi smenalar rejimi: topshiriladigani — smena boshidagi pul
  if (prevShiftsOnly(data)) return data?.prev_shifts ?? null
  const effective = effectiveCutChoice(data, choice)
  if (effective === ALL_CASH) return null
  return cutsOf(data).find((c) => c.cut_at === effective) ?? null
}

/** Topshiriladigan summa: kesim tanlangan bo'lsa — o'sha kesimgacha,
 *  aks holda kassadagi hamma pul. */
export const amountDue = (
  data: CashBreakdown | undefined | null,
  cut: CashCut | null
): number => Number((cut ? cut.due_cash : data?.expected_cash) || 0)

/** Topshirgandan keyin kassada qoladigan pul (yangi sessiya hisobida). */
export const cashLeftAfter = (
  data: CashBreakdown | undefined | null,
  cut: CashCut | null
): number => (cut ? Number(data?.expected_cash || 0) - Number(cut.due_cash || 0) : 0)

/** Topshirilayotgan davr: kassa ochilgan paytdan tanlangan kesimgacha. */
export interface HandoverPeriod {
  from: string
  /** Davr oxiri (ISO); `null` — hozirgacha (hamma pul topshiriladi) */
  to: string | null
  /** Davrga kirgan tugagan (kesim yopgan) kunlar soni */
  days: number
}

/** Joriy tanlov qaysi davrni qamrashi. Kesim yo'q bo'lsa — `null`
 *  (davr ko'rsatilmaydi: kassa ochilgandan hozirgacha, bitta kun ichida). */
export const handoverPeriod = (
  data: CashBreakdown | undefined | null,
  choice: CutChoice | null
): HandoverPeriod | null => {
  const cuts = cutsOf(data)
  // Oldingi smenalar rejimida davr yo'q — pul smena boshida qabul qilingan
  if (cuts.length === 0 || prevShiftsOnly(data)) return null
  const effective = effectiveCutChoice(data, choice)
  const index = cuts.findIndex((c) => c.cut_at === effective)
  if (effective === ALL_CASH || index < 0) {
    return { from: cuts[0].from_at, to: null, days: cuts.length }
  }
  return { from: cuts[0].from_at, to: cuts[index].cut_at, days: index + 1 }
}

/** Smena KUNLIK KESIMDA yopilishi ("faqat yopilgan kunlar" rejimida
 *  "Smenani tugallash"): yopilgan kunlar kesim momentida alohida yopiladi,
 *  kesimdan keyingi tushum esa kassa bilan birga keyingi xodimga o'tadi. */
export interface ShiftSplit {
  /** Yopiladigan davr boshi (kassa ochilgan payt) */
  from: string
  /** Oxirgi kunlik kesim — sessiya shu momentda yopiladi */
  cutAt: string
  /** Yopiladigan kunlar soni */
  days: number
  /** Kesim momentida kassada bo'lishi kerak bo'lgan pul */
  closedCash: number
  /** Kesimdan keyingi sof naqd harakat (bugungi tushum − xarajat) */
  todayCash: number
}

/** Smena tugallanganda kesim bo'yicha bo'linish. Rejim o'chiq yoki
 *  sessiyaga kesim tushmagan bo'lsa — `null` (smena avvalgidek yopiladi). */
export const shiftSplit = (data: CashBreakdown | undefined | null): ShiftSplit | null => {
  const cuts = cutsOf(data)
  if (!closedDaysOnly(data) || cuts.length === 0) return null
  const last = cuts[cuts.length - 1]
  return {
    from: cuts[0].from_at,
    cutAt: last.cut_at,
    days: cuts.length,
    closedCash: Number(last.expected_cash || 0),
    todayCash: Number(last.after_cash || 0),
  }
}

/** Moment bugundan necha kalendar kun keyin (mahalliy vaqt): 0 — bugun,
 *  1 — ertaga. "Keyingi kesim: ertaga 00:05" yozuvi uchun. */
export const dayOffset = (iso: string, now: Date = new Date()): number => {
  const at = new Date(iso)
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const to = new Date(at.getFullYear(), at.getMonth(), at.getDate())
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

export interface CutRow {
  /** Bosilganda o'rnatiladigan tanlov */
  choice: CutChoice
  /** "day" — tugagan kesim kuni; "rest" — oxirgi kesimdan keyin, hozirgacha */
  kind: "day" | "rest"
  /** Kesim yopgan ish kuni ("YYYY-MM-DD"); "rest" qatorida yo'q */
  day: string | null
  from: string
  /** Davr oxiri (ISO); "rest" qatorida `null` — hozir */
  to: string | null
  /** Shu davrning naqd puli. Birinchi kunga boshlang'ich kassa ham kiradi —
   *  qatorlar yig'indisi kassadagi jami pulga teng bo'lishi uchun. */
  amount: number
  /** Joriy tanlovda shu davr topshiriladimi */
  included: boolean
  /** Tanlov aynan shu qatorda to'xtaganmi (radio belgisi) */
  selected: boolean
}

/** Dialogdagi davrlar ro'yxati: har kesim kuni + "kesimdan keyin" qatori. */
export const cutRows = (
  data: CashBreakdown | undefined | null,
  choice: CutChoice | null
): CutRow[] => {
  const cuts = cutsOf(data)
  if (!data || cuts.length === 0 || prevShiftsOnly(data)) return []
  const effective = effectiveCutChoice(data, choice)
  const stopIndex =
    effective === ALL_CASH ? cuts.length : cuts.findIndex((c) => c.cut_at === effective)

  const rows: CutRow[] = cuts.map((cut, index) => ({
    choice: cut.cut_at,
    kind: "day",
    day: cut.day,
    from: cut.from_at,
    to: cut.cut_at,
    amount: Number(cut.day_cash || 0) + (index === 0 ? Number(cut.opening_cash || 0) : 0),
    included: index <= stopIndex,
    selected: index === stopIndex,
  }))
  const last = cuts[cuts.length - 1]
  rows.push({
    choice: ALL_CASH,
    kind: "rest",
    day: null,
    from: last.cut_at,
    to: null,
    amount: Number(last.after_cash || 0),
    included: effective === ALL_CASH,
    selected: effective === ALL_CASH,
  })
  return rows
}

/** "YYYY-MM-DD" → mahalliy sana (vaqt zonasi siljimasin — `new Date(iso)`
 *  uni UTC yarim tuni deb o'qib, g'arbiy zonalarda bir kun orqaga surardi). */
export const parseDay = (day: string): Date => {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
