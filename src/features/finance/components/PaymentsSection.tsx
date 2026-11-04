import { useEffect, useState } from "react"
import { ExternalLink, Pencil } from "lucide-react"
import { Link } from "react-router-dom"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { SortableHead, TablePager, TableSearch } from "@/components/ui/table-tools"
import { PAYMENT_METHOD_LABELS } from "@/lib/paymentMethods"
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { usePaymentsPage } from "../api/finance"
import { canEditPaymentMethod } from "../lib/paymentEdit"
import {
  bookingLink,
  formatMoment,
  formatReportDate,
  humanNote,
  isShopPayment,
  paymentMoment,
  purposeBadges,
  purposeDetail,
  purposeTitle,
  reportDateDiffers,
  type PurposeTone,
} from "../lib/paymentPurpose"
import { PaymentMethodEditDialog } from "./PaymentMethodEditDialog"
import {
  PAGE_SIZE,
  clampPage,
  initialTableState,
  pageCount,
  rangeLabel,
  setSearch,
  toggleSort,
} from "@/lib/tableState"
import { tr } from "@/i18n"
import type { PaymentRecord } from "@/types/api"

/**
 * To'lovlar jadvali — sahifalab, qidirib va saralab.
 *
 * Har qator NIMA UCHUN olinganini ko'rsatadi: xona va mehmon (bron
 * raqami, muddati), haqlar belgisi — xona / jarima / xizmat, qarz to'lovi
 * (mehmon chiqib ketgandan keyin), qaytarim; do'kon to'lovida — chekdagi
 * mahsulotlar. Vaqt — pul qabul qilingan daqiqa, yonida qabul qilgan
 * xodim. Taqsimot serverda hisoblanadi (`payment_purpose`), bu yerda
 * faqat ko'rsatiladi.
 *
 * Ilgari davrning barcha to'lovlari bir vaqtda chizilardi. Kunlik
 * hisobotda bu sezilmasdi, lekin "Shu oy" yoki "Barcha davr" tanlanganda
 * jadval bir necha ming qatorga cho'zilib ketardi va sahifadan
 * foydalanib bo'lmasdi.
 */

const fmt = (n: number) => Number(n || 0).toLocaleString()

const TONE_CLASS: Record<PurposeTone, string> = {
  room: "bg-blue-50 text-blue-700 ring-blue-100",
  penalty: "bg-rose-50 text-rose-700 ring-rose-100",
  service: "bg-amber-50 text-amber-700 ring-amber-100",
  shop: "bg-violet-50 text-violet-700 ring-violet-100",
  debt: "bg-orange-50 text-orange-700 ring-orange-100",
  refund: "bg-gray-100 text-gray-700 ring-gray-200",
  extra: "bg-teal-50 text-teal-700 ring-teal-100",
  other: "bg-gray-100 text-gray-600 ring-gray-200",
}

/** Haq belgilari: Xona / Jarima / Qarz to'lovi / Do'kon ... */
function PurposeTags({ payment }: { payment: PaymentRecord }) {
  const badges = purposeBadges(payment)
  if (badges.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b.key}
          title={b.title}
          className={cn(
            "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight ring-1 ring-inset",
            TONE_CLASS[b.tone]
          )}
        >
          {b.label}
        </span>
      ))}
    </div>
  )
}

/** Nima uchun: belgilar, xona · mehmon, bron raqami va muddati, izoh. */
function PurposeCell({ payment }: { payment: PaymentRecord }) {
  const detail = purposeDetail(payment)
  const note = humanNote(payment.notes) || payment.reference || ""
  const link = bookingLink(payment)
  return (
    <div className="min-w-0 space-y-0.5">
      <PurposeTags payment={payment} />
      <p className="flex items-center gap-1 font-medium leading-tight text-gray-900">
        <span className="truncate">{purposeTitle(payment)}</span>
        {link && (
          <Link
            to={link}
            title={tr("Bronni ochish")}
            className="flex-shrink-0 text-gray-300 transition-colors hover:text-primary-600"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </p>
      {detail && <p className="text-[11px] leading-tight text-gray-500">{detail}</p>}
      {note && <p className="truncate text-[11px] leading-tight text-gray-400">{note}</p>}
    </div>
  )
}

/** Qabul qilingan vaqt; hisobot sanasi boshqa kun bo'lsa — u ham. */
function MomentCell({ payment }: { payment: PaymentRecord }) {
  const moment = paymentMoment(payment)
  return (
    <div className="whitespace-nowrap tabular-nums">
      <p className="text-gray-900">{formatMoment(moment)}</p>
      {reportDateDiffers(payment) && (
        <p className="text-[11px] text-gray-400">
          {tr("hisobot: {{date}}", { date: formatReportDate(payment.payment_date) })}
        </p>
      )}
    </div>
  )
}

const MethodPill = ({ method }: { method: string }) => (
  <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
    {PAYMENT_METHOD_LABELS[method] || method}
  </span>
)

const Amount = ({ amount }: { amount: number }) => (
  <span
    className={cn(
      "whitespace-nowrap font-semibold tabular-nums",
      Number(amount) < 0 ? "text-rose-600" : "text-green-600"
    )}
  >
    {tr("{{amount}} So'm", { amount: fmt(amount) })}
  </span>
)

export function PaymentsSection({
  dateFrom,
  dateTo,
}: {
  dateFrom?: string
  dateTo?: string
}) {
  // Standart tartib — qabul qilingan vaqt bo'yicha (eng yangisi tepada)
  const [state, setState] = useState(() => initialTableState("created_at"))

  // To'lov turini tahrirlash: admin cheklovsiz, menejer faqat oxirgi
  // 2 kunlik to'lovlarda (server ham xuddi shunday tekshiradi). Do'kon
  // to'lovi bu yerda tahrirlanmaydi — u Do'kon sahifasida qabul qilinadi
  const { isAdmin, can } = usePermissions()
  const canEdit = isAdmin || can("shift.force_close")
  const [editTarget, setEditTarget] = useState<PaymentRecord | null>(null)
  const methodEditable = (p: PaymentRecord) =>
    canEditPaymentMethod({ payment: p, isAdmin, canForceClose: canEdit })
  const editTitle = (p: PaymentRecord) =>
    canEdit
      ? methodEditable(p)
        ? tr("To'lov turini tahrirlash")
        : tr("Menejer faqat oxirgi 2 kunlik to'lovlarni tahrirlay oladi")
      : ""
  const showEdit = (p: PaymentRecord) => canEdit && !isShopPayment(p)

  // Davr o'zgarsa birinchi sahifaga qaytiladi: 7-sahifada turib boshqa
  // oyga o'tgan odam bo'sh ekran ko'rmasligi kerak
  useEffect(() => {
    setState((s) => (s.page === 0 ? s : { ...s, page: 0 }))
  }, [dateFrom, dateTo])

  const { data, isLoading, isFetching } = usePaymentsPage({
    dateFrom,
    dateTo,
    state,
    includeShop: true,
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  // Yozuvlar kamayib ketsa (davr o'zgardi, qidiruv toraydi) joriy sahifa
  // chegaradan chiqib qolishi mumkin — o'shanda oxirgi mavjud sahifaga
  // tushiriladi, aks holda xodim bo'sh jadval oldida qolardi
  useEffect(() => {
    setState((s) => {
      const next = clampPage(s.page, total)
      return next === s.page ? s : { ...s, page: next }
    })
  }, [total])

  const pages = pageCount(total)
  const sort = (column: string) => setState((s) => toggleSort(s, column))

  // Bir xil sahifalagich ikki joyda: jadval ostida (desktop) va kartalar
  // ostida (mobil) — ikkalasi bir xil holatni boshqaradi
  const pager = (
    <TablePager
      page={state.page}
      pageCount={pages}
      busy={isFetching}
      label={rangeLabel(state.page, rows.length, total)}
      onPage={(page) =>
        setState((s) => ({ ...s, page: clampPage(page, total, PAGE_SIZE) }))
      }
    />
  )

  const emptyText = state.search
    ? tr("Qidiruv bo'yicha to'lov topilmadi")
    : tr("Tanlangan davrda to'lovlar yo'q")

  return (
    <div className="space-y-2">
      {/* Sarlavha bo'lim menyusining yonida yoziladi — bu yerda qisqa
          izoh va qidiruv turadi */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500">
          {tr("Bron to'lovlari (xona, jarima, qarz) va do'kon to'lovlari — qabul qilingan vaqti bilan")}
        </p>
        <TableSearch
          className="w-full sm:w-80"
          value={state.search}
          onChange={(value) => setState((s) => setSearch(s, value))}
          placeholder={tr("Raqam, xona, mehmon, mahsulot yoki izoh...")}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {/* MOBIL: to'lovlar karta ko'rinishida (jadval planshet/desktopda) */}
          <div className="space-y-2.5 md:hidden">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
                {emptyText}
              </div>
            ) : (
              rows.map((p) => (
                <div key={`${p.source || "RESERVATION"}-${p.id}`} className="rounded-2xl border bg-white p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <PurposeCell payment={p} />
                    <div className="flex-shrink-0 text-right">
                      <Amount amount={p.amount} />
                      <p className="mt-0.5 text-[11px] tabular-nums text-gray-400">
                        {formatMoment(paymentMoment(p))}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                      <MethodPill method={p.payment_method} />
                      {p.created_by_name && (
                        <span className="truncate">
                          {tr("qabul qildi: {{name}}", { name: p.created_by_name })}
                        </span>
                      )}
                      {p.payment_number && (
                        <span className="text-gray-400">{p.payment_number}</span>
                      )}
                    </div>
                    {showEdit(p) && (
                      <button
                        type="button"
                        onClick={() => setEditTarget(p)}
                        disabled={!methodEditable(p)}
                        title={editTitle(p)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {tr("Tahrirlash")}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    column="created_at"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    {tr("Vaqt")}
                  </SortableHead>
                  <TableHead>{tr("Nima uchun")}</TableHead>
                  <SortableHead
                    column="payment_method"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    {tr("To'lov turi")}
                  </SortableHead>
                  <TableHead>{tr("Qabul qildi")}</TableHead>
                  <SortableHead
                    column="payment_number"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    {tr("Raqami")}
                  </SortableHead>
                  <SortableHead
                    column="amount"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    align="right"
                  >
                    {tr("Summa")}
                  </SortableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-gray-400">
                      {emptyText}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p) => (
                    <TableRow key={`${p.source || "RESERVATION"}-${p.id}`}>
                      <TableCell className="align-top">
                        <MomentCell payment={p} />
                      </TableCell>
                      <TableCell className="max-w-[360px] align-top">
                        <PurposeCell payment={p} />
                      </TableCell>
                      <TableCell className="align-top">
                        <MethodPill method={p.payment_method} />
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate align-top text-gray-600">
                        {p.created_by_name || "-"}
                      </TableCell>
                      <TableCell className="align-top text-xs text-gray-500">
                        {p.payment_number || "—"}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Amount amount={p.amount} />
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {showEdit(p) && (
                          <button
                            type="button"
                            onClick={() => setEditTarget(p)}
                            disabled={!methodEditable(p)}
                            title={editTitle(p)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {pager}
          </div>

          {/* MOBIL: sahifalagich jadval kartalari ostida */}
          <div className="overflow-hidden rounded-2xl border md:hidden">{pager}</div>
        </>
      )}

      <PaymentMethodEditDialog
        payment={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </div>
  )
}
