import { format } from "date-fns"

import { tr } from "@/i18n"
import { paymentMethodLabel } from "@/lib/paymentMethods"
import type { PaymentMethodChange, PaymentRecord } from "@/types/api"

/* To'lov TAHRIRLARI — Moliya → To'lovlar jadvalida "bu to'lov tahrirlangan:
   necha puldan necha pulga, qaysi turdan qaysi turga, qancha, kim, qachon".

   Server har tahrirni `method_changes` ga yozadi:
     full       — butun summa boshqa turga o'tdi (summa o'zgarmaydi);
     partial    — summaning bir qismi YANGI qatorga o'tdi (asl qatordagi yozuv);
     split_from — shu qator boshqa to'lovdan ajralgan (ajralgan qatordagi yozuv).

   Tahrir pul QACHON olinganini o'zgartirmaydi: ajralgan qator ham asl
   to'lov vaqtida turadi, tahrir payti esa shu tarixda.

   Eski yozuvlarda summalar (`total_before/after`) yo'q — ular hozirgi
   summadan orqaga qarab hisoblab olinadi: to'lov summasini faqat qisman
   tahrir o'zgartiradi. Toza funksiyalar, test qilinadi. */

export type PaymentEditKind = "full" | "partial" | "split_from"

export interface PaymentEdit {
  kind: PaymentEditKind
  /** Tahrir payti (eski ajralgan qatorda noma'lum bo'lishi mumkin) */
  at: string | null
  byName: string | null
  /** Qaysi vazifada tahrirlagan (ADMIN / SUPER_ADMIN / MANAGER / RECEPTION; eski yozuvda null) */
  byRole: string | null
  note: string | null
  oldMethod: string | null
  newMethod: string
  /** Boshqa turga o'tgan summa (butun tahrirda — to'lovning hammasi) */
  moved: number
  /** Shu qator summasi tahrirdan OLDIN. Ajralgan qatorda — asl to'lov
   *  summasi (eski yozuvda noma'lum — null) */
  before: number | null
  /** Shu qator summasi tahrirdan KEYIN */
  after: number
  /** partial — ajralgan yangi qator raqami; split_from — asl to'lov raqami */
  otherNumber: string | null
}

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/* Ajralgan qatorga server yozadigan avtomatik izoh:
   "Qisman o'tkazildi: PAY-1 dan 50000 So'm (CASH → ONLINE)" */
const SPLIT_NOTE = /^Qisman o'tkazildi: (\S+) dan (\d+(?:[.,]\d+)?) So'm \((\S+) → (\S+)\)$/

/** Avtomatik izohdan: qaysi to'lovdan, qancha, nimadan nimaga ajralgan. */
export function parseSplitNote(
  notes?: string | null
): { number: string; amount: number; old: string; new: string } | null {
  const m = (notes || "").trim().match(SPLIT_NOTE)
  if (!m) return null
  const amount = Number(m[2].replace(",", "."))
  if (!Number.isFinite(amount)) return null
  return { number: m[1], amount, old: m[3], new: m[4] }
}

/** To'lovning barcha tahrirlari — vaqt tartibida (eng eskisi birinchi). */
export function paymentEdits(
  p: Pick<PaymentRecord, "amount" | "method_changes" | "notes">
): PaymentEdit[] {
  const raw = (Array.isArray(p.method_changes) ? p.method_changes : []).filter(
    (e): e is PaymentMethodChange => !!e && typeof e === "object"
  )
  // Oxirgi tahrirdan orqaga: har qadamda "tahrirdan keyingi summa" ma'lum
  let running = Number(p.amount) || 0
  const edits: PaymentEdit[] = []
  for (let i = raw.length - 1; i >= 0; i--) {
    const e = raw[i]
    const base = {
      at: e.at || null,
      byName: (e.by_name || "").trim() || null,
      byRole: (e.by_role || "").trim() || null,
      note: (e.note || "").trim() || null,
      oldMethod: e.old ?? null,
      newMethod: e.new,
    }
    if (e.kind === "split_from") {
      const moved = num(e.amount) ?? running
      edits.push({
        ...base,
        kind: "split_from",
        moved,
        before: num(e.from_total),
        after: moved,
        otherNumber: e.from_payment_number || null,
      })
      running = 0
    } else if (e.kind === "partial") {
      const moved = num(e.amount) ?? 0
      const after = num(e.total_after) ?? running
      const before = num(e.total_before) ?? round2(after + moved)
      edits.push({
        ...base,
        kind: "partial",
        moved,
        before,
        after,
        otherNumber: e.new_payment_number || null,
      })
      running = before
    } else {
      const after = num(e.total_after) ?? running
      const before = num(e.total_before) ?? after
      edits.push({ ...base, kind: "full", moved: after, before, after, otherNumber: null })
      running = before
    }
  }
  edits.reverse()

  // Eski ajralgan qator: tarixida kelib chiqishi yozilmagan — izohdan olinadi
  if (!edits.some((e) => e.kind === "split_from")) {
    const legacy = parseSplitNote(p.notes)
    if (legacy) {
      edits.unshift({
        kind: "split_from",
        at: null,
        byName: null,
        byRole: null,
        note: null,
        oldMethod: legacy.old,
        newMethod: legacy.new,
        moved: legacy.amount,
        before: null,
        after: legacy.amount,
        otherNumber: legacy.number,
      })
    }
  }
  return edits
}

/** To'lov tahrirlanganmi (jadvalda belgi ko'rsatish uchun). */
export const isEditedPayment = (
  p: Pick<PaymentRecord, "amount" | "method_changes" | "notes">
): boolean => paymentEdits(p).length > 0

const money = (n: number) => Number(n || 0).toLocaleString()

/** Qisqa nom — jadvaldagi belgi tor ustunga sig'ishi uchun. */
export function shortMethod(method?: string | null): string {
  switch (String(method || "").trim().toUpperCase()) {
    case "CASH":
      return tr("Naqd")
    case "CARD":
    case "CREDIT_CARD":
    case "DEBIT_CARD":
      return tr("Karta")
    case "ONLINE":
    case "MOBILE_PAYMENT":
      return tr("Online")
    case "BANK_TRANSFER":
    case "TRANSFER":
      return tr("O'tkazma")
    default:
      return paymentMethodLabel(method)
  }
}

/** Belgidagi qisqa matn: qisman tahrirda "100,000 → 50,000" (necha puldan
 *  necha pulga), qolganida "Naqd → Online" (qaysi turdan qaysi turga). */
export function editBadgeText(edit: PaymentEdit): string {
  if (edit.kind === "partial" && edit.before !== null) {
    return `${money(edit.before)} → ${money(edit.after)}`
  }
  return `${shortMethod(edit.oldMethod)} → ${shortMethod(edit.newMethod)}`
}

/** To'liq tavsif: nimadan nimaga va qancha. */
export function editDetail(edit: PaymentEdit): string {
  const oldLabel = paymentMethodLabel(edit.oldMethod)
  const newLabel = paymentMethodLabel(edit.newMethod)
  if (edit.kind === "partial") {
    return tr("{{before}} So'm {{old}} → {{after}} So'm {{old}} + {{moved}} So'm {{new}}", {
      before: money(edit.before ?? edit.after + edit.moved),
      after: money(edit.after),
      moved: money(edit.moved),
      old: oldLabel,
      new: newLabel,
    })
  }
  if (edit.kind === "split_from") {
    const params = { moved: money(edit.moved), old: oldLabel, new: newLabel }
    return edit.otherNumber
      ? tr("{{number}} to'lovidan ajratildi: {{moved}} So'm, {{old}} → {{new}}", {
          ...params,
          number: edit.otherNumber,
        })
      : tr("Boshqa to'lovdan ajratildi: {{moved}} So'm, {{old}} → {{new}}", params)
  }
  return tr("{{amount}} So'm: {{old}} → {{new}}", {
    amount: money(edit.after),
    old: oldLabel,
    new: newLabel,
  })
}

/** Qo'shimcha satr: ajralgan qator raqami yoki asl to'lov summasi. */
export function editExtra(edit: PaymentEdit): string {
  if (edit.kind === "partial" && edit.otherNumber) {
    return tr("Ajralgan qism — {{number}} to'lovi", { number: edit.otherNumber })
  }
  if (edit.kind === "split_from" && edit.before !== null) {
    return tr("Asl to'lov {{amount}} So'm edi", { amount: money(edit.before) })
  }
  return ""
}

/** Tahrir payti — jadvaldagi vaqt bilan bir xil ko'rinishda. */
export function editMoment(edit: Pick<PaymentEdit, "at">): string {
  if (!edit.at) return ""
  const d = new Date(edit.at)
  return Number.isNaN(d.getTime()) ? "" : format(d, "dd.MM.yyyy HH:mm")
}

/** Kim · qachon · izoh. */
/** Vazifa nomi — tarixda "Dilnoza Karimova (Qabulxona)" */
export function roleLabel(role: string | null | undefined): string | null {
  switch ((role || "").toUpperCase()) {
    case "ADMIN":
      return tr("Administrator")
    case "SUPER_ADMIN":
      return tr("Tizim ma'muri")
    case "MANAGER":
      return tr("Menejer")
    case "RECEPTION":
      return tr("Qabulxona")
    default:
      return null
  }
}

export function editMeta(edit: PaymentEdit): string {
  const role = roleLabel(edit.byRole)
  const who = edit.byName ? (role ? `${edit.byName} (${role})` : edit.byName) : role
  return [who, editMoment(edit), edit.note].filter(Boolean).join(" · ")
}

/** Belgi ustiga borganda: barcha tahrirlar, har biri alohida satrda. */
export function editsTitle(edits: PaymentEdit[]): string {
  return edits
    .map((e) => [editDetail(e), editMeta(e)].filter(Boolean).join(" — "))
    .join("\n")
}
