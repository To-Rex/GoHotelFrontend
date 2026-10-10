import type { ExpectedCompanion, ReservationCompanion } from "@/types/api"
import { tr, trc } from "@/i18n"

/* Turish davomida hamrohlar: ketdi / qaytdi / o'rniga yangisi keldi.

   Server bilan bir xil qoidalar (companion_ops.py): yozuv o'chirilmaydi,
   "ketdi" belgisi bor yozuv ichkarida hisoblanmaydi, ichkaridagilar
   (asosiy mehmon + ketmagan hamrohlar) mehmonlar sonidan oshmaydi. Bu
   yerda faqat ko'rsatish uchun oldindan hisoblanadi — yakuniy tekshiruv
   serverda. */

/* Eski yozuv (faqat guest_id + name) ham, to'liq yozuv ham qabul qilinadi */
type CompanionLike = Partial<ReservationCompanion> | null | undefined

/** Bron — panelga kerakli qismi. BookingPage'da bron `any` bo'lib keladi,
    shuning uchun qat'iy Reservation turi talab qilinmaydi. */
export interface CompanionReservationLike {
  status: string
  adults: number
  guest_id?: string
  companions?: ReservationCompanion[] | null
  /** Kechikib keladigan hamrohlar — joy egallaydi */
  expected_companions?: ExpectedCompanion[] | null
  checkout_requested_at?: string | null
}

/** Kechikib keladigan hamrohlar (bo'sh yozuvlarsiz) */
export const expectedCompanions = (
  res: Pick<CompanionReservationLike, "expected_companions">
): ExpectedCompanion[] => (res.expected_companions || []).filter((e) => e && e.id)

/** Hamroh hozir xonadami — "ketdi" belgisi yo'q (eski yozuvlar ham) */
export const isPresent = (c: CompanionLike): boolean => !c?.left_at

export const presentCompanions = (
  list: ReservationCompanion[] | null | undefined
): ReservationCompanion[] => (list || []).filter((c) => c && isPresent(c))

/** Bron qilingan mehmonlar soni — kamida 1 (asosiy mehmon) */
export const guestCapacity = (adults: number): number =>
  Math.max(Math.floor(Number(adults) || 1), 1)

/** Hozir xonada nechta kishi: asosiy mehmon + ichkaridagi hamrohlar */
export const insideCount = (res: Pick<CompanionReservationLike, "companions">): number =>
  1 + presentCompanions(res.companions).length

/** Bo'sh joylar: mehmonlar soni − ichkaridagilar − kechikib keladiganlar
    (manfiy bo'lmaydi). Kutilayotgan hamroh joyini boshqasi egallamasin. */
export const freeSeats = (
  res: Pick<CompanionReservationLike, "adults" | "companions" | "expected_companions">
): number =>
  Math.max(guestCapacity(res.adults) - insideCount(res) - expectedCompanions(res).length, 0)

/** Hamroh kechikib keladi deb belgilash mumkinmi — bo'sh joy bo'lsa */
export const canExpectCompanion = (res: CompanionReservationLike): boolean =>
  (res.status === "CONFIRMED" || res.status === "CHECKED_IN") &&
  !res.checkout_requested_at &&
  freeSeats(res) > 0

export type CompanionAddCheck = { ok: true } | { ok: false; reason: string }

/** Hamroh qo'shish mumkinmi — tugma chiqarishdan oldin. Sabab matni xodimga
    ko'rsatiladi, shuning uchun nima qilish kerakligini ham aytadi. */
export function companionAddCheck(res: CompanionReservationLike): CompanionAddCheck {
  if (res.status !== "CONFIRMED" && res.status !== "CHECKED_IN") {
    return { ok: false, reason: tr("Bu holatdagi bronga hamroh qo'shilmaydi") }
  }
  if (res.checkout_requested_at) {
    return {
      ok: false,
      reason: tr("Chiqish jarayoni boshlangan — yangi hamroh qo'shilmaydi"),
    }
  }
  /* Joy faqat kechikib keladiganlar hisobiga band — kelgan odam o'sha kutilgan
     hamroh deb olinadi (server ham shunday qiladi) */
  if (freeSeats(res) === 0 && expectedCompanions(res).length === 0) {
    return {
      ok: false,
      reason: tr("Xonada joy yo'q: mehmonlar soni {{adults}}, hammasi ichkarida. Avval ketgan hamrohni belgilang yoki bronni tahrirlab mehmonlar sonini oshiring", { adults: guestCapacity(res.adults) }),
    }
  }
  return { ok: true }
}

/** Ketganini belgilash — faqat kirgan bronda, hali ketmagan hamroh uchun */
export const canMarkLeft = (res: Pick<CompanionReservationLike, "status">, c: CompanionLike) =>
  res.status === "CHECKED_IN" && isPresent(c)

/** "Ketdi"ni bekor qilish — kirgan bronda, ketgan deb belgilangan hamroh */
export const canMarkReturned = (
  res: Pick<CompanionReservationLike, "status">,
  c: CompanionLike
) => res.status === "CHECKED_IN" && !isPresent(c)

/** Ro'yxatdan butunlay olib tashlash — faqat kirishdan oldin */
export const canRemove = (res: Pick<CompanionReservationLike, "status">) =>
  res.status === "CONFIRMED"

export type CompanionState = "inside" | "left" | "returned" | "added"

/** Yozuvning hozirgi holati — chip uchun */
export function companionState(c: ReservationCompanion): CompanionState {
  if (c.left_at) return "left"
  if (c.returned_at) return "returned"
  if (c.added_at) return "added"
  return "inside"
}

const pad = (n: number) => String(n).padStart(2, "0")

/** "25.09, 14:30" — ketgan/qo'shilgan vaqt. Bugungi bo'lsa faqat soat. */
export function shortMoment(value?: string | null, now: Date = new Date()): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return sameDay ? time : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}, ${time}`
}

/** Chip matni: "Ichkarida" / "Ketdi · 14:30" / "Qaytdi · 15:10" / "Qo'shildi · 12:00" */
export function companionStatusLabel(c: ReservationCompanion, now: Date = new Date()): string {
  const state = companionState(c)
  const at =
    state === "left"
      ? shortMoment(c.left_at, now)
      : state === "returned"
        ? shortMoment(c.returned_at, now)
        : state === "added"
          ? shortMoment(c.added_at, now)
          : null
  // "status": chipdagi holat. Paneldagi xuddi shu so'zli tugmalar esa amal
  // (tr("Ketdi") — "ketganini belgilash") — boshqa tillarda farq qiladi
  const word =
    state === "left"
      ? trc("status", "Ketdi")
      : state === "returned"
        ? trc("status", "Qaytdi")
        : state === "added"
          ? c.arrived_late
            ? tr("Kechikib keldi")
            : tr("Qo'shildi")
          : tr("Ichkarida")
  return at ? `${word} · ${at}` : word
}
