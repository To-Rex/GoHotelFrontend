import { useEffect, useState } from "react"
import { format } from "date-fns"
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
import { usePaymentStaff, usePaymentsPage } from "../api/finance"
import { paymentEditBlock, remainingEdits, type EditBlock } from "../lib/paymentEdit"
import { usePaymentEditSettings } from "@/features/settings/api/paymentEditSettings"
import {
  bookingLink,
  compactTitle,
  formatReportDate,
  isShopPayment,
  paymentMoment,
  purposeBadges,
  purposeSubline,
  reportDateDiffers,
  type PurposeTone,
} from "../lib/paymentPurpose"
import { EditedMark, PaymentEditHistoryDialog } from "./PaymentEditHistory"
import { PaymentMethodEditDialog } from "./PaymentMethodEditDialog"
import {
  AllChip,
  AmountRange,
  FilterChip,
  FoundLine,
  OptionSelect,
  ResetFilters,
  SortSelect,
  ToggleFilter,
} from "./FilterControls"
import {
  EMPTY_PAYMENT_FILTERS,
  METHOD_OPTIONS,
  PAYMENT_KIND_OPTIONS,
  PAYMENT_SORT_OPTIONS,
  isFilterKind,
  paymentFilterCount,
  paymentFilterParams,
  toggleValue,
  type PaymentFilters,
} from "../lib/financeFilters"
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
 * Har qator ikki satr: belgi (xona / jarima / qarz to'lovi / qaytarim /
 * do'kon) va sarlavha — xona · mehmon yoki chekdagi mahsulotlar; ostida
 * xira bitta satrda bron raqami · muddati · izoh. Vaqt — pul qabul
 * qilingan daqiqa, yonida qabul qilgan xodim. Taqsimot serverda
 * hisoblanadi (`payment_purpose`), bu yerda faqat ko'rsatiladi.
 *
 * Tahrirlangan to'lov (turi butunlay yoki qisman o'zgartirilgan) to'lov
 * turi ostida sariq belgi bilan turadi: "100,000 → 50,000" yoki
 * "Naqd → Online"; bosilsa to'liq tarix ochiladi (kim, qachon, qancha).
 * Tahrir vaqtni o'zgartirmaydi — qator pul olingan daqiqada qoladi.
 *
 * Ixchamlik ataylab: kunlik hisobotda 30–50 qator bir ekranga sig'ishi
 * kerak, shuning uchun har ma'lumot o'z o'rnida, qator balandligi ikki
 * satrdan oshmaydi, uzun matn qisqartirilib to'lig'i ustiga borganda
 * ko'rinadi. Mobilda alohida kartalar o'rniga zich ro'yxat.
 *
 * Ilgari davrning barcha to'lovlari bir vaqtda chizilardi. Kunlik
 * hisobotda bu sezilmasdi, lekin "Shu oy" yoki "Barcha davr" tanlanganda
 * jadval bir necha ming qatorga cho'zilib ketardi va sahifadan
 * foydalanib bo'lmasdi.
 *
 * Filtrlar (serverda — sahifalash bilan birga): "Turi" chiplari (bron /
 * do'kon / xona / jarima / xizmat / qarz to'lovi / ortiqcha / qaytarim —
 * bir nechtasi birga, "yoki"), to'lov turi (yoki "Naqdsiz"), qabul qilgan
 * xodim, summa oralig'i, faqat tahrirlanganlar. Qatordagi belgi yoki
 * xodim nomi bosilsa ham filtr qo'yiladi. "Topildi" satrida butun natija
 * soni va summasi. Saralash: vaqt, xona, to'lov turi, xodim, raqam, summa.
 */

const fmt = (n: number) => Number(n || 0).toLocaleString()

/** Birinchi bosishda o'sish tartibida saralanadigan ustunlar */
const TEXT_SORTS = new Set(["room_number", "created_by_name"])

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

/** Belgi bosilganda "Turi" filtri (tanlangan bo'lsa — olib tashlanadi) */
interface KindPick {
  active: readonly string[]
  onPick: (kind: string) => void
}

/** Haq belgilari: Xona / Jarima / Qarz to'lovi / Do'kon ... Bosilsa —
 *  faqat shu turdagi to'lovlar (filtr). */
function PurposeTags({ payment, pick }: { payment: PaymentRecord; pick?: KindPick }) {
  const badges = purposeBadges(payment)
  if (badges.length === 0) return null
  return (
    <>
      {badges.map((b) => {
        const className = cn(
          "inline-flex flex-shrink-0 items-center rounded px-1.5 py-px text-[11px] font-semibold leading-4 ring-1 ring-inset",
          TONE_CLASS[b.tone]
        )
        if (!pick || !isFilterKind(b.key)) {
          return (
            <span key={b.key} title={b.title} className={className}>
              {b.label}
            </span>
          )
        }
        const active = pick.active.includes(b.key)
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => pick.onPick(b.key)}
            aria-pressed={active}
            title={[b.title, active ? tr("Filtrni olib tashlash") : tr("Faqat shu turdagi to'lovlar")]
              .filter(Boolean)
              .join(" — ")}
            className={cn(className, "transition-shadow hover:ring-2", active && "ring-2 ring-gray-900/30")}
          >
            {b.label}
          </button>
        )
      })}
    </>
  )
}

/** Birinchi satr: belgilar + sarlavha (+ bronga havola). */
function PurposeHead({
  payment,
  wrap = false,
  pick,
}: {
  payment: PaymentRecord
  wrap?: boolean
  pick?: KindPick
}) {
  const link = bookingLink(payment)
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", wrap ? "flex-wrap gap-y-1" : "overflow-hidden")}>
      <PurposeTags payment={payment} pick={pick} />
      {/* Sarlavha va havola bitta guruh — mobilda qatorga sig'masa
          birga ko'chadi */}
      <span className="inline-flex min-w-0 items-center gap-1">
        <span className={cn("text-[13px] font-medium leading-5 text-gray-900", !wrap && "truncate")}>
          {compactTitle(payment)}
        </span>
        {link && (
          <Link
            to={link}
            title={tr("Bronni ochish")}
            className="flex-shrink-0 text-gray-300 transition-colors hover:text-primary-600"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </span>
    </div>
  )
}

/** Nima uchun (jadval): sarlavha, ostida xira satr — to'lig'i ustiga borganda. */
function PurposeCell({ payment, pick }: { payment: PaymentRecord; pick?: KindPick }) {
  const sub = purposeSubline(payment)
  return (
    <div className="min-w-0">
      <PurposeHead payment={payment} pick={pick} />
      {sub && (
        <p className="truncate text-[11px] leading-4 text-gray-500" title={sub}>
          {sub}
        </p>
      )}
    </div>
  )
}

/** Qabul qilingan vaqt: sana xira, soat aniq. */
function Moment({ payment, className }: { payment: PaymentRecord; className?: string }) {
  const d = paymentMoment(payment)
  if (!d) return <span className={className}>-</span>
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      <span className="text-gray-500">{format(d, "dd.MM.yyyy")}</span>{" "}
      <span className="font-medium text-gray-900">{format(d, "HH:mm")}</span>
    </span>
  )
}

/** Jadval ustuni: vaqt; hisobot sanasi boshqa kun bo'lsa — u ham. */
function MomentCell({ payment }: { payment: PaymentRecord }) {
  return (
    <div className="leading-5">
      <Moment payment={payment} className="text-[13px]" />
      {reportDateDiffers(payment) && (
        <p className="text-[11px] leading-4 text-gray-400">
          {tr("hisobot: {{date}}", { date: formatReportDate(payment.payment_date) })}
        </p>
      )}
    </div>
  )
}

const MethodPill = ({ method }: { method: string }) => (
  <span className="inline-flex whitespace-nowrap rounded-full bg-gray-100 px-2 py-px text-[11px] font-medium leading-4 text-gray-600">
    {PAYMENT_METHOD_LABELS[method] || method}
  </span>
)

const Amount = ({ amount, className }: { amount: number; className?: string }) => (
  <span
    className={cn(
      "whitespace-nowrap font-semibold tabular-nums",
      Number(amount) < 0 ? "text-rose-600" : "text-green-600",
      className
    )}
  >
    {tr("{{amount}} So'm", { amount: fmt(amount) })}
  </span>
)

const EditButton = ({
  onClick,
  disabled,
  title,
}: {
  onClick: () => void
  disabled: boolean
  title: string
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
  >
    <Pencil className="h-3.5 w-3.5" />
  </button>
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

  /* Filtrlar davr almashganda turadi; o'zgarsa — birinchi sahifa */
  const [filters, setFiltersState] = useState<PaymentFilters>(EMPTY_PAYMENT_FILTERS)
  const setFilters = (update: (f: PaymentFilters) => PaymentFilters) => {
    setFiltersState(update)
    setState((s) => (s.page === 0 ? s : { ...s, page: 0 }))
  }
  const resetFilters = () => {
    setFiltersState(EMPTY_PAYMENT_FILTERS)
    setState((s) => setSearch(s, ""))
  }
  const filterCount = paymentFilterCount(filters) + (state.search.trim() ? 1 : 0)
  const filtering = filterCount > 0
  const pickKind = (kind: string) => setFilters((f) => ({ ...f, kinds: toggleValue(f.kinds, kind) }))
  const kindPick: KindPick = { active: filters.kinds, onPick: pickKind }
  const toggleUser = (id?: string | null) => {
    if (!id) return
    setFilters((f) => ({ ...f, user: f.user === id ? null : id }))
  }

  // Davrda pul qabul qilgan xodimlar — filtr tanlagichi uchun
  const { data: staff = [] } = usePaymentStaff(dateFrom, dateTo, true)
  const staffOptions = staff.map((u) => ({
    value: u.id,
    label: `${u.name || tr("Noma'lum")} (${u.count})`,
  }))
  // Tanlangan xodim bu davrda to'lov olmagan bo'lsa ham ro'yxatda tursin
  if (filters.user && !staffOptions.some((o) => o.value === filters.user)) {
    staffOptions.push({ value: filters.user, label: tr("Tanlangan xodim (0)") })
  }

  // To'lov turini tahrirlash: admin cheklovsiz, menejer faqat oxirgi
  // 2 kunlik to'lovlarda; qabulxona — mehmonxona sozlamasi yoqilgan
  // bo'lsa, o'sha oyna va bitta to'lovga chegara (server ham xuddi shunday
  // tekshiradi: payment_edit_settings). Do'kon to'lovi bu yerda
  // tahrirlanmaydi — u Do'kon sahifasida qabul qilinadi
  const { isAdmin, can } = usePermissions()
  const canForceClose = can("shift.force_close")
  const isReception = !isAdmin && !canForceClose && can("finance.payment.create")
  // Sozlama faqat qabulxonaga kerak — boshqalarga so'ralmaydi
  const { data: editSettings } = usePaymentEditSettings(isReception)
  const reception = editSettings
    ? { enabled: editSettings.reception_enabled, maxEdits: editSettings.reception_max_edits }
    : null
  const canEdit = isAdmin || canForceClose || (isReception && !!reception?.enabled)
  const [editTarget, setEditTarget] = useState<PaymentRecord | null>(null)
  // Tahrir tarixi — hammaga ochiq (faqat ko'rish), jadvaldagi belgidan
  const [historyTarget, setHistoryTarget] = useState<PaymentRecord | null>(null)
  const blockOf = (p: PaymentRecord): EditBlock | null =>
    paymentEditBlock({
      payment: p,
      isAdmin,
      canForceClose,
      canTakePayments: can("finance.payment.create"),
      reception,
    })
  const methodEditable = (p: PaymentRecord) => blockOf(p) === null
  const editTitle = (p: PaymentRecord) => {
    if (!canEdit) return ""
    switch (blockOf(p)) {
      case null:
        return tr("To'lov turini tahrirlash")
      case "limit":
        return tr("Bu to'lov allaqachon {{count}} marta tahrirlangan — qabulxona uchun chegara {{max}} marta", {
          count: p.method_changes?.filter((e) => e && e.kind !== "split_from").length ?? 0,
          max: reception?.maxEdits ?? 2,
        })
      case "window":
        return isReception
          ? tr("Qabulxona faqat oxirgi 2 kunlik to'lovlarni tahrirlay oladi")
          : tr("Menejer faqat oxirgi 2 kunlik to'lovlarni tahrirlay oladi")
      default:
        return tr("Tahrirlash mumkin emas")
    }
  }
  const showEdit = (p: PaymentRecord) => canEdit && !isShopPayment(p)
  const editButton = (p: PaymentRecord) =>
    showEdit(p) ? (
      <EditButton
        onClick={() => setEditTarget(p)}
        disabled={!methodEditable(p)}
        title={editTitle(p)}
      />
    ) : null

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
    filters: paymentFilterParams(filters),
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
  // Matnli ustunlar (xona, xodim) birinchi bosishda A dan Z gacha
  const sort = (column: string) =>
    setState((s) => toggleSort(s, column, TEXT_SORTS.has(column) ? "asc" : "desc"))

  // Bir xil sahifalagich ikki joyda: jadval ostida (desktop) va ro'yxat
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

  const emptyText = filtering
    ? tr("Filtr bo'yicha to'lov topilmadi")
    : tr("Tanlangan davrda to'lovlar yo'q")

  /* Qabul qilgan xodim — bosilsa faqat shu xodim olgan to'lovlar */
  const staffButton = (p: PaymentRecord, className?: string) => {
    if (!p.created_by_name) return <span className={className}>-</span>
    if (!p.created_by) return <span className={className}>{p.created_by_name}</span>
    const active = filters.user === p.created_by
    return (
      <button
        type="button"
        onClick={() => toggleUser(p.created_by)}
        aria-pressed={active}
        title={active ? tr("Filtrni olib tashlash") : tr("Faqat shu xodim qabul qilganlari")}
        className={cn(
          "block max-w-full truncate rounded px-1 -mx-1 text-left transition-colors hover:bg-gray-100 hover:text-gray-900",
          active && "bg-primary-50 text-primary-800 ring-1 ring-primary-200",
          className
        )}
      >
        {p.created_by_name}
      </button>
    )
  }

  const rowKey = (p: PaymentRecord) => `${p.source || "RESERVATION"}-${p.id}`

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

      {/* FILTRLAR. "Turi" — bir nechtasi birga ("yoki"): masalan Do'kon +
          Jarima. Qolganlari "va": tur + xodim + summa birga toraytiradi */}
      <div className="space-y-2 rounded-xl border bg-gray-50/60 p-2.5">
        {/* Chiplar har doim ko'rinsin (mobilda ham qatorga o'raladi) — tanlangan
            tur ekrandan tashqarida qolib ketmasin */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {tr("Turi")}
          </span>
          <AllChip
            active={filters.kinds.length === 0}
            onClick={() => setFilters((f) => ({ ...f, kinds: [] }))}
          />
          {PAYMENT_KIND_OPTIONS.map((k, i) => (
            <span key={k.value} className="contents">
              {/* Manba (bron / do'kon) va haq turlari orasida ajratgich */}
              {i === 2 && <span className="mx-0.5 hidden h-4 w-px flex-shrink-0 bg-gray-200 sm:block" aria-hidden />}
              <FilterChip
                tone={k.tone}
                active={filters.kinds.includes(k.value)}
                onClick={() => pickKind(k.value)}
              >
                {k.label}
              </FilterChip>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OptionSelect
            label={tr("To'lov turi")}
            allLabel={tr("Barcha to'lov turlari")}
            options={METHOD_OPTIONS}
            value={filters.method ?? ""}
            onChange={(v) => setFilters((f) => ({ ...f, method: v || null }))}
          />
          {staffOptions.length > 0 && (
            <OptionSelect
              label={tr("Qabul qildi")}
              allLabel={tr("Barcha xodimlar")}
              options={staffOptions}
              value={filters.user ?? ""}
              onChange={(v) => setFilters((f) => ({ ...f, user: v || null }))}
            />
          )}
          <AmountRange
            min={filters.minAmount}
            max={filters.maxAmount}
            onChange={({ min, max }) => setFilters((f) => ({ ...f, minAmount: min, maxAmount: max }))}
          />
          <ToggleFilter
            checked={filters.edited}
            onChange={(edited) => setFilters((f) => ({ ...f, edited }))}
          >
            {tr("Tahrirlanganlar")}
          </ToggleFilter>
          <SortSelect
            sortBy={state.sortBy}
            sortDir={state.sortDir}
            options={PAYMENT_SORT_OPTIONS}
            onChange={({ sortBy, sortDir }) => setState((s) => ({ ...s, sortBy, sortDir, page: 0 }))}
          />
          <ResetFilters count={filterCount} onReset={resetFilters} />
        </div>
        {filtering && !isLoading && (
          <FoundLine count={total} amount={data?.amount} busy={isFetching} />
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {/* MOBIL: zich ro'yxat (jadval planshet/desktopda) */}
          <div className="overflow-hidden rounded-xl border bg-white md:hidden">
            {rows.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">{emptyText}</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {rows.map((p) => {
                  const sub = purposeSubline(p)
                  return (
                    <li key={rowKey(p)} className="px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <PurposeHead payment={p} wrap pick={kindPick} />
                          {sub && (
                            <p className="mt-0.5 text-[11px] leading-4 text-gray-500">{sub}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right leading-4">
                          <Amount amount={p.amount} className="text-[13px] leading-5" />
                          <p className="text-[11px]">
                            <Moment payment={p} />
                          </p>
                          {reportDateDiffers(p) && (
                            <p className="text-[10px] text-gray-400">
                              {tr("hisobot: {{date}}", { date: formatReportDate(p.payment_date) })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-4 text-gray-500">
                          <MethodPill method={p.payment_method} />
                          <EditedMark payment={p} onOpen={() => setHistoryTarget(p)} />
                          {p.created_by_name && staffButton(p)}
                          {p.payment_number && (
                            <span className="tabular-nums text-gray-400">{p.payment_number}</span>
                          )}
                        </div>
                        {editButton(p)}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {pager}
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
                  {/* "Nima uchun" — xona raqami bo'yicha saralanadi */}
                  <SortableHead
                    column="room_number"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    className="w-full"
                  >
                    {tr("Nima uchun")}
                  </SortableHead>
                  <SortableHead
                    column="payment_method"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    {tr("To'lov turi")}
                  </SortableHead>
                  <SortableHead
                    column="created_by_name"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    {tr("Qabul qildi")}
                  </SortableHead>
                  {/* Tor planshetda raqam alohida ustun emas — xodim nomi
                      ostida; aks holda Summa ustuni ekrandan chiqib ketardi */}
                  <SortableHead
                    column="payment_number"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    className="hidden lg:table-cell"
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
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-gray-400">
                      {emptyText}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p) => (
                    <TableRow key={rowKey(p)}>
                      <TableCell className="py-1.5">
                        <MomentCell payment={p} />
                      </TableCell>
                      {/* w-full + max-w-0: ustun qolgan joyni oladi, uzun
                          matn ustunni cho'zmay qisqaradi; min-w — tor
                          planshetda ustun yo'qolib ketmasin (jadval
                          gorizontal aylanadi) */}
                      <TableCell className="w-full min-w-[200px] max-w-0 py-1.5 lg:min-w-[260px]">
                        <PurposeCell payment={p} pick={kindPick} />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex flex-col items-start gap-0.5">
                          <MethodPill method={p.payment_method} />
                          <EditedMark payment={p} onOpen={() => setHistoryTarget(p)} />
                        </div>
                      </TableCell>
                      <TableCell
                        className="max-w-[110px] truncate py-1.5 text-[13px] leading-5 text-gray-600 lg:max-w-[150px]"
                        title={p.created_by_name || undefined}
                      >
                        {staffButton(p)}
                        {p.payment_number && (
                          <p className="truncate text-[10px] leading-4 tabular-nums text-gray-400 lg:hidden">
                            {p.payment_number}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden py-1.5 text-[11px] tabular-nums text-gray-500 lg:table-cell">
                        {p.payment_number || "—"}
                      </TableCell>
                      <TableCell className="py-1.5 text-right">
                        <Amount amount={p.amount} className="text-[13px]" />
                      </TableCell>
                      <TableCell className="py-1.5 pl-0 text-right">{editButton(p)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {pager}
          </div>
        </>
      )}

      <PaymentMethodEditDialog
        payment={editTarget}
        onClose={() => setEditTarget(null)}
        remainingEdits={editTarget ? remainingEdits(editTarget, reception, isReception) : null}
      />
      <PaymentEditHistoryDialog
        payment={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  )
}
