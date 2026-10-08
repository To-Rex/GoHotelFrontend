import { tr } from "@/i18n"
import type { DebtReason, ReservationDebt } from "../api/debtors"

/* Qarz sabablarini o'qiladigan matnga aylantirish. Sof funksiyalar —
   ro'yxat, navbar eslatmasi, bosh sahifa va bron oynasi bir xil yozadi. */

const fmt = (n?: number | null) => Number(n || 0).toLocaleString()

const PENALTY_KINDS: Record<string, string> = {
  LATE_CHECKOUT: tr("kech chiqish"),
  DAMAGE: tr("shikast"),
  OTHER: tr("boshqa"),
}

/** "Jarima (kech chiqish, 1 soat)" — summasiz sarlavha */
export function reasonTitle(reason: DebtReason): string {
  switch (reason.kind) {
    case "room":
      return reason.room_number
        ? tr("Turar joy ({{room}}-xona)", { room: reason.room_number })
        : tr("Turar joy")
    case "extension":
      return tr("Chiqishda qayta hisob (uzaytirilgan muddat)")
    case "service":
      return reason.name
        ? tr("Xizmat: {{name}}", { name: reason.name })
        : tr("Xizmat")
    case "penalty": {
      const kind = reason.penalty_kind ? PENALTY_KINDS[reason.penalty_kind] : ""
      const note = (reason.note || "").trim()
      const extra = [kind, note].filter(Boolean).join(", ")
      return extra ? tr("Jarima ({{extra}})", { extra }) : tr("Jarima")
    }
    case "shop":
      return reason.products
        ? tr("Do'kon: {{products}}", { products: reason.products })
        : tr("Do'kon")
    default:
      return String(reason.kind || "")
  }
}

/** Qo'shimcha izoh: necha kecha, qisman to'langani va h.k. */
export function reasonDetail(reason: DebtReason): string | null {
  const parts: string[] = []
  if (reason.kind === "room" && reason.nights) {
    parts.push(
      tr("{{nights}} × {{price}} so'm", { nights: reason.nights, price: fmt(reason.unit_price) })
    )
    if (reason.discount) parts.push(tr("chegirma {{v}}", { v: fmt(reason.discount) }))
  }
  if (reason.kind === "extension") {
    parts.push(tr("mehmon chiqqanda bron jamisiga qo'shiladi"))
  }
  if (reason.kind === "shop" && reason.created_by_name) {
    parts.push(tr("sotgan: {{name}}", { name: reason.created_by_name }))
  }
  if (reason.charged && reason.amount < reason.charged - 0.5) {
    parts.push(
      tr("{{charged}} dan {{left}} qoldi", { charged: fmt(reason.charged), left: fmt(reason.amount) })
    )
  }
  return parts.length ? parts.join(" · ") : null
}

/** "Jarima (kech chiqish) 50 000 · Do'kon: Cola ×2 20 000 · +1" */
export function reasonsSummary(reasons: DebtReason[] | undefined, limit = 2): string {
  const list = reasons || []
  const parts = list.slice(0, limit).map((r) => `${reasonTitle(r)} ${fmt(r.amount)}`)
  if (list.length > limit) parts.push(`+${list.length - limit}`)
  return parts.join(" · ")
}

/** Qarzning asosiy sababi turi — rang/ikonka tanlash uchun */
export function primaryKind(reasons: DebtReason[] | undefined): string | null {
  if (!reasons?.length) return null
  return [...reasons].sort((a, b) => b.amount - a.amount)[0].kind
}

/** Bronda haqiqiy qarz bormi (yarim so'mlik yaxlitlash qarz emas) */
export const hasDebt = (debt?: Pick<ReservationDebt, "total_debt"> | null) =>
  !!debt && debt.total_debt > 0.5
