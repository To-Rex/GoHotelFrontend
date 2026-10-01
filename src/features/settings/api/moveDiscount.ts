import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { tr } from "@/i18n"

/* Xona almashtirishda chegirma — mehmonxona bo'yicha bitta sozlama.

   Mehmon kirib, xona yoqmadi va qimmatroq xonaga o'tmoqchi: narx farqini
   to'liq olish o'rniga resepshn chegirma qilib bera oladi. Bera olishi va
   eng ko'p qancha berishi — shu sozlamada. Administrator sozlamaga
   bog'lanmaydi, lekin chegirma hech qachon narx farqidan oshmaydi.

   Haqiqiy tekshiruv SERVERDA (move_discount_policy) — bu yerdagi hisob
   faqat xodimga darhol tushunarli bo'lishi uchun. Hisob server bilan bir
   xil: eng katta chegirma pastga yaxlitlanadi (Math.floor).

   Standart — O'CHIQ: yoqilmaguncha xodim chegirma bera olmaydi. */

export interface MoveDiscountSettings {
  /** Xodimlar (resepshn) chegirma bera oladimi */
  enabled: boolean
  /** Narx farqidan eng ko'p foiz (0 — cheklovsiz) */
  max_percent: number
  /** Bir ko'chirishda eng ko'p summa, so'm (0 — cheklovsiz) */
  max_amount: number
}

export const MOVE_DISCOUNT_DEFAULTS: MoveDiscountSettings = {
  enabled: false,
  max_percent: 0,
  max_amount: 0,
}

export const MOVE_DISCOUNT_QUERY_KEY = ["moveDiscountSettings"] as const

const num = (value: unknown, max?: number): number => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return max !== undefined ? Math.min(n, max) : n
}

/** Server javobini xavfsiz o'qish: faqat aniq `true` — yoqilgan. */
export const resolveMoveDiscountSettings = (raw: unknown): MoveDiscountSettings => {
  if (!raw || typeof raw !== "object") return { ...MOVE_DISCOUNT_DEFAULTS }
  const r = raw as Record<string, unknown>
  return {
    enabled: r.enabled === true,
    max_percent: num(r.max_percent, 100),
    max_amount: num(r.max_amount),
  }
}

export const useMoveDiscountSettings = (enabled = true) =>
  useQuery({
    queryKey: MOVE_DISCOUNT_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<MoveDiscountSettings>(
        "/hotels/move-discount-settings"
      )
      return resolveMoveDiscountSettings(data)
    },
    enabled,
    // Kamdan-kam o'zgaradi
    staleTime: 5 * 60 * 1000,
  })

export const useSaveMoveDiscountSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (next: MoveDiscountSettings) => {
      const { data } = await api.put<MoveDiscountSettings>(
        "/hotels/move-discount-settings",
        {
          enabled: next.enabled === true,
          max_percent: num(next.max_percent, 100),
          max_amount: num(next.max_amount),
        }
      )
      return resolveMoveDiscountSettings(data)
    },
    onSuccess: (data) => qc.setQueryData(MOVE_DISCOUNT_QUERY_KEY, data),
  })
}

/**
 * Shu ko'chirishda berilishi mumkin bo'lgan eng katta chegirma (so'm).
 * `increase` — narx farqi; arzonroq yoki teng xonada 0. Xodimga ruxsat
 * bo'lmasa ham 0. Administrator faqat farq bilan cheklanadi.
 */
export const maxMoveDiscount = (
  settings: MoveDiscountSettings | undefined,
  increase: number,
  isAdmin: boolean
): number => {
  const diff = num(increase)
  if (diff <= 0) return 0
  let limit = diff
  if (!isAdmin) {
    const s = settings ?? MOVE_DISCOUNT_DEFAULTS
    if (!s.enabled) return 0
    if (s.max_percent > 0) limit = Math.min(limit, (diff * s.max_percent) / 100)
    if (s.max_amount > 0) limit = Math.min(limit, s.max_amount)
  }
  return Math.floor(limit + 1e-9)
}

/** Arzonroq xonaga qaytilsa avval oldingi ko'chirish chegirmasi kamayadi
 *  (server: carry_over_move_discount). */
export const carryOverMoveDiscount = (previous: number, increase: number): number => {
  let kept = num(previous)
  if (increase < 0) kept = Math.max(0, kept + increase)
  return Math.round(kept)
}

/** Mehmon AMALDA qancha ko'p to'laydi: bron chegirmasi foizda bo'lsa, farq
 *  ham shu foizga kamayadi (server: net_increase). */
export const netIncrease = (increase: number, discountPercent?: number | null): number => {
  const pct = num(discountPercent, 100)
  return pct > 0 ? (increase * (100 - pct)) / 100 : increase
}

/** Joriy ko'chirish chegirmasining boshlang'ich (arzon) xona narxi — oxirgi
 *  ko'chirish yozuvidan (server: discount_baseline). */
export const discountBaseline = (
  roomMoves: Array<{ discount_baseline_price?: number | null }> | null | undefined
): number | null => {
  if (!Array.isArray(roomMoves) || roomMoves.length === 0) return null
  const value = num(roomMoves[roomMoves.length - 1]?.discount_baseline_price)
  return value > 0 ? value : null
}

/** Chegirma joriy va boshlang'ich xona narxi farqidan oshmaydi
 *  (server: clamp_move_discount). */
export const clampMoveDiscount = (
  moveDiscount: number,
  roomCharge: number,
  baselineCharge: number | null,
  discountPercent?: number | null
): number => {
  const stored = num(moveDiscount)
  if (stored <= 0) return 0
  if (baselineCharge === null) return stored
  const cap = netIncrease(roomCharge - baselineCharge, discountPercent)
  return Math.min(stored, Math.max(0, Math.floor(cap + 1e-9)))
}

/** Chegirma qoidaga sig'adimi. Sig'masa — sabab, sig'sa — null. */
export const moveDiscountProblem = (
  settings: MoveDiscountSettings | undefined,
  increase: number,
  isAdmin: boolean,
  discount: number
): string | null => {
  const amount = Math.round(num(discount))
  if (amount <= 0) return null
  if (increase <= 0) return tr("Chegirma faqat qimmatroq xonaga o'tishda beriladi")
  if (!isAdmin && !(settings ?? MOVE_DISCOUNT_DEFAULTS).enabled) {
    return tr("Xona almashtirishda chegirma berish sozlamalarda o'chirilgan")
  }
  const max = maxMoveDiscount(settings, increase, isAdmin)
  if (amount > max) {
    return tr("Chegirma {{max}} so'mdan oshmasligi kerak", { max: max.toLocaleString() })
  }
  return null
}

/** Xodimga ko'rsatiladigan qisqa izoh (chegara qanday). */
export const moveDiscountHint = (
  settings: MoveDiscountSettings | undefined,
  isAdmin: boolean
): string => {
  if (isAdmin) return tr("Administrator: narx farqining hammasigacha")
  const s = settings ?? MOVE_DISCOUNT_DEFAULTS
  const parts: string[] = []
  if (s.max_percent > 0) parts.push(tr("farqning {{max_percent}}% igacha", { max_percent: s.max_percent }))
  if (s.max_amount > 0) parts.push(tr("{{max_amount}} so'mgacha", { max_amount: s.max_amount.toLocaleString() }))
  return parts.length ? parts.join(" · ") : tr("narx farqining hammasigacha")
}
