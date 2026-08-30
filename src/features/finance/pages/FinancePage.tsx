import { useState, useMemo } from "react"
import { format, subDays, startOfMonth } from "date-fns"
import {
  Wallet,
  ReceiptText,
  CircleDollarSign,
  AlertCircle,
  TrendingDown,
  Scale,
  Store,
  BedDouble,
  Banknote,
  Undo2,
} from "lucide-react"
import { useInvoices, usePayments } from "../api/finance"
import { useExpenses } from "@/features/expenses/api/expenses"
import { useShopSales } from "@/features/shop/api/shop"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { PAYMENT_METHOD_LABELS } from "@/lib/paymentMethods"

const selectClass =
  "flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Qoralama",
  ISSUED: "Taqdim etilgan",
  PARTIALLY_PAID: "Qisman to'langan",
  PAID: "To'langan",
  VOID: "Bekor qilingan",
  REFUNDED: "Qaytarilgan",
}

const statusBadge: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ISSUED: "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  VOID: "bg-red-100 text-red-600",
  REFUNDED: "bg-purple-100 text-purple-700",
}

// Nomlar butun ilova uchun bitta joyda; eski kodlar ham shu yerda
const METHOD_LABELS = PAYMENT_METHOD_LABELS

const fmt = (n: number) => Number(n || 0).toLocaleString()

export const FinancePage = () => {
  const todayStr = format(new Date(), "yyyy-MM-dd")

  // Standart holat — bugungi hisobot
  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo, setDateTo] = useState(todayStr)
  const [statusFilter, setStatusFilter] = useState("")

  const {
    data: invoices = [],
    isLoading: invoicesLoading,
    isError,
  } = useInvoices(statusFilter || undefined, dateFrom, dateTo)
  const { data: payments = [], isLoading: paymentsLoading } = usePayments(
    dateFrom,
    dateTo
  )

  // Xarajatlar hisobotga qo'shiladi (sof natija uchun) — endpoint barcha
  // tizimga kirgan foydalanuvchilar uchun ochiq
  const canExpenses = true
  const { data: expenses = [] } = useExpenses(dateFrom, dateTo)

  // Do'kon sotuvlari: to'langanlari TUSHUM sifatida (to'lov sanasi bo'yicha —
  // bronga yozilib keyin to'langan sotuv aynan to'langan kun tushumiga tushadi);
  // bronga yozilgan to'lanmaganlari esa QARZ sifatida (joriy qoldiq, davrga
  // bog'liq emas) ko'rsatiladi
  const { data: shopPaidRaw = [] } = useShopSales(
    dateFrom || undefined,
    dateTo || undefined,
    { dateBy: "paid", status: "PAID" }
  )
  const { data: shopDebts = [] } = useShopSales(undefined, undefined, {
    status: "PENDING",
  })

  // Tez tanlovlar: bugungi/kechagi kun, 7 kun, shu oy, barcha davr
  const presets = [
    { key: "today", label: "Bugun", from: todayStr, to: todayStr },
    {
      key: "yesterday",
      label: "Kecha",
      from: format(subDays(new Date(), 1), "yyyy-MM-dd"),
      to: format(subDays(new Date(), 1), "yyyy-MM-dd"),
    },
    {
      key: "week",
      label: "Oxirgi 7 kun",
      from: format(subDays(new Date(), 6), "yyyy-MM-dd"),
      to: todayStr,
    },
    {
      key: "month",
      label: "Shu oy",
      from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      to: todayStr,
    },
    { key: "all", label: "Barcha davr", from: "", to: "" },
  ]
  const activePreset = presets.find((p) => p.from === dateFrom && p.to === dateTo)?.key

  // Sana oralig'i bo'yicha mijoz tomonida ham filtrlaymiz — backend eski
  // versiyada bo'lsa (date_from/date_to parametrlarini bilmasa) ham hisobot
  // to'g'ri chiqishi uchun. Yangi backendda bu shunchaki qayta tekshiruv.
  const inRange = (d?: string | null) => {
    if (!d) return !dateFrom && !dateTo
    const day = String(d).slice(0, 10)
    if (dateFrom && day < dateFrom) return false
    if (dateTo && day > dateTo) return false
    return true
  }
  const filteredInvoices = useMemo(
    () => invoices.filter((i) => inRange(i.invoice_date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, dateFrom, dateTo]
  )
  const filteredPayments = useMemo(
    () => payments.filter((p) => inRange(p.payment_date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, dateFrom, dateTo]
  )
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => inRange(e.expense_date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, dateFrom, dateTo]
  )
  const expensesTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)

  // Do'kon tushumi — to'lov sanasi bo'yicha (mijoz tomonda qayta tekshiruv)
  const shopPaid = useMemo(
    () => shopPaidRaw.filter((s) => inRange(s.paid_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shopPaidRaw, dateFrom, dateTo]
  )
  const shopRevenue = shopPaid.reduce((s, x) => s + Number(x.total_amount || 0), 0)
  const shopDebtTotal = shopDebts.reduce((s, x) => s + Number(x.total_amount || 0), 0)

  // --- Hisobot ko'rsatkichlari (tanlangan davr bo'yicha) ---
  const summary = useMemo(() => {
    const income = filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
    const invoiceTotal = filteredInvoices.reduce(
      (s, i) => s + Number(i.total_amount || 0),
      0
    )
    // Davr bo'yicha berilgan chegirmalar yig'indisi
    const invoiceDiscount = filteredInvoices.reduce(
      (s, i) => s + Number(i.discount_amount || 0),
      0
    )
    const invoicePaid = filteredInvoices.reduce(
      (s, i) => s + Number(i.paid_amount || 0),
      0
    )
    const debt = filteredInvoices
      .filter((i) => i.status !== "VOID" && i.status !== "REFUNDED")
      .reduce(
        (s, i) => s + Math.max(Number(i.total_amount || 0) - Number(i.paid_amount || 0), 0),
        0
      )

    // Qaytarimlar manfiy to'lov bo'lib yoziladi: ular `income` ni o'zi
    // kamaytiradi, lekin alohida ham ko'rsatiladi — aks holda "tushum nega
    // kamaydi" degan savol javobsiz qoladi
    const refunds = filteredPayments.reduce(
      (s, p) => s + (Number(p.amount || 0) < 0 ? -Number(p.amount || 0) : 0),
      0
    )
    return {
      income,
      invoiceTotal,
      invoiceDiscount,
      invoicePaid,
      debt,
      refunds,
    }
  }, [filteredPayments, filteredInvoices])

  /* To'lov turlari bo'yicha to'liq tafsilot.

     Uch manba bir jadvalda: bron to'lovlari, do'kon savdosi va xarajatlar.
     Ilgari sahifada faqat bron to'lovlari turi bo'yicha chiplar bor edi —
     do'kon qaysi usul bilan olingani va pul qaysi usulda chiqib ketgani
     ko'rinmasdi.

     Do'konda bo'lib to'langan savdo har bo'lagi o'z usuliga yoziladi
     (jami "MIXED" bo'lib qolmasligi uchun). */
  const methodRows = useMemo(() => {
    const rows: Record<string, { pay: number; shop: number; expense: number }> = {}
    const at = (method?: string | null) => {
      const key = (method || "").toUpperCase() || "UNKNOWN"
      if (!rows[key]) rows[key] = { pay: 0, shop: 0, expense: 0 }
      return rows[key]
    }

    for (const p of filteredPayments) at(p.payment_method).pay += Number(p.amount || 0)

    for (const sale of shopPaid) {
      if (sale.payments?.length) {
        for (const part of sale.payments) {
          at(part.payment_method).shop += Number(part.amount || 0)
        }
      } else {
        at(sale.payment_method).shop += Number(sale.total_amount || 0)
      }
    }

    for (const e of filteredExpenses) at(e.payment_method).expense += Number(e.amount || 0)

    // Tanish usullar avval, tartibda; notanishlari oxirida — ular ham
    // ko'rinishi kerak, aks holda pul jimgina yo'qolganday tuyuladi
    const known = Object.keys(METHOD_LABELS)
    const order = [...known, ...Object.keys(rows).filter((k) => !known.includes(k))]
    return order
      .filter((key) => rows[key])
      .map((key) => {
        const row = rows[key]
        const income = row.pay + row.shop
        return {
          key,
          label: METHOD_LABELS[key] || key,
          ...row,
          income,
          net: income - row.expense,
        }
      })
  }, [filteredPayments, shopPaid, filteredExpenses])

  // Xarajatlar toifalari bo'yicha — pul qayerga ketgani
  // Jadvalning "Jami" qatori — qatorlarning o'zidan. Alohida hisoblansa
  // yaxlitlash yoki bo'lib to'lash farqi jadval ichida qarama-qarshilik
  // bo'lib ko'rinardi
  const methodTotals = useMemo(
    () =>
      methodRows.reduce(
        (acc, r) => ({
          pay: acc.pay + r.pay,
          shop: acc.shop + r.shop,
          income: acc.income + r.income,
          expense: acc.expense + r.expense,
          net: acc.net + r.net,
        }),
        { pay: 0, shop: 0, income: 0, expense: 0, net: 0 }
      ),
    [methodRows]
  )

  const expenseCategories = useMemo(() => {
    const byCategory: Record<string, { total: number; count: number }> = {}
    for (const e of filteredExpenses) {
      const key = e.category?.trim() || "Boshqa"
      if (!byCategory[key]) byCategory[key] = { total: 0, count: 0 }
      byCategory[key].total += Number(e.amount || 0)
      byCategory[key].count += 1
    }
    return Object.entries(byCategory)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
  }, [filteredExpenses])

  // Kassadagi naqd qoldiq: naqd tushum − naqd xarajat
  const cashOnHand = useMemo(() => {
    const row = methodRows.find((r) => r.key === "CASH")
    return row ? row.net : 0
  }, [methodRows])

  const isLoading = invoicesLoading || paymentsLoading

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Moliya</h1>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  if (isError) {
    return <div>Xatolik yuz berdi. Iltimos qayta urining.</div>
  }

  const cards = [
    {
      label: "Tushum (to'lovlar)",
      value: `${fmt(summary.income)} So'm`,
      sub: `${filteredPayments.length} ta to'lov`,
      icon: Wallet,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Hisob-fakturalar",
      value: `${fmt(summary.invoiceTotal)} So'm`,
      sub:
        summary.invoiceDiscount > 0
          ? `${filteredInvoices.length} ta hujjat · chegirma −${fmt(summary.invoiceDiscount)} So'm`
          : `${filteredInvoices.length} ta hujjat`,
      icon: ReceiptText,
      accent: "bg-blue-50 text-blue-600",
    },
    {
      label: "To'langan",
      value: `${fmt(summary.invoicePaid)} So'm`,
      sub: "hisob-fakturalar bo'yicha",
      icon: CircleDollarSign,
      accent: "bg-sky-50 text-sky-600",
    },
    {
      label: "Qarzdorlik",
      value: `${fmt(summary.debt)} So'm`,
      sub: "to'lanmagan qoldiq",
      icon: AlertCircle,
      accent: "bg-amber-50 text-amber-600",
    },
    {
      label: "Do'kon tushumi",
      value: `${fmt(shopRevenue)} So'm`,
      sub: `${shopPaid.length} ta to'langan sotuv`,
      icon: Store,
      accent: "bg-violet-50 text-violet-600",
    },
    {
      label: "Do'kon qarzi (bronda)",
      value: `${fmt(shopDebtTotal)} So'm`,
      sub: `${shopDebts.length} ta to'lanmagan sotuv`,
      icon: BedDouble,
      accent: "bg-orange-50 text-orange-600",
    },
    {
      label: "Naqd qoldiq",
      value: `${fmt(cashOnHand)} So'm`,
      sub: "naqd tushum \u2212 naqd xarajat",
      icon: Banknote,
      accent: "bg-emerald-50 text-emerald-600",
    },
    ...(summary.refunds > 0
      ? [
          {
            label: "Qaytarilgan",
            value: `${fmt(summary.refunds)} So'm`,
            sub: "tushumdan allaqachon ayirilgan",
            icon: Undo2,
            accent: "bg-rose-50 text-rose-600",
          },
        ]
      : []),
    // Xarajatlar va sof natija — expense ruxsati bo'lganlarga ko'rsatiladi
    ...(canExpenses
      ? [
          {
            label: "Xarajatlar",
            value: `${fmt(expensesTotal)} So'm`,
            sub: `${filteredExpenses.length} ta chiqim`,
            icon: TrendingDown,
            accent: "bg-red-50 text-red-600",
          },
          {
            label: "Sof natija",
            value: `${fmt(summary.income + shopRevenue - expensesTotal)} So'm`,
            sub: "tushum + do'kon − xarajat",
            icon: Scale,
            accent:
              summary.income + shopRevenue - expensesTotal >= 0
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-600",
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Moliya</h1>
          <p className="text-sm text-gray-500 mt-1">
            {dateFrom || dateTo
              ? `Hisobot davri: ${dateFrom || "..."} — ${dateTo || "..."}`
              : "Hisobot davri: barcha davr"}
          </p>
        </div>
      </div>

      {/* Davr tanlash: tez tugmalar + "dan / gacha" sanalar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setDateFrom(p.from)
                setDateTo(p.to)
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                activePreset === p.key
                  ? "border-primary-600 bg-primary-50 text-primary-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Sanadan</label>
            <Input
              type="date"
              className="w-40"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Sanagacha</label>
            <Input
              type="date"
              className="w-40"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Hisobot kartalari */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-white p-4 flex items-start gap-3">
            <span
              className={cn(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                c.accent
              )}
            >
              <c.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-lg font-bold text-gray-900 truncate">{c.value}</p>
              <p className="text-[11px] text-gray-400">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* To'lov usullari bo'yicha to'liq tafsilot */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-bold tracking-tight">To'lov usullari bo'yicha</h2>
          <span className="text-xs text-gray-400">
            qaytarimlar tushumdan ayirilgan
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b bg-gray-50/80 text-left">
                <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Usul
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Bron to'lovlari
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Do'kon
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Jami tushum
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Xarajat
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Sof
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {methodRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    Tanlangan davrda pul harakati bo'lmagan
                  </td>
                </tr>
              ) : (
                methodRows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-2 font-medium text-gray-800">{row.label}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                      {row.pay ? fmt(row.pay) : "\u2014"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                      {row.shop ? fmt(row.shop) : "\u2014"}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-emerald-600">
                      {fmt(row.income)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-red-600">
                      {row.expense ? fmt(row.expense) : "\u2014"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right font-semibold tabular-nums",
                        row.net < 0 ? "text-red-600" : "text-gray-900"
                      )}
                    >
                      {fmt(row.net)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {methodRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-gray-50/60 font-semibold">
                  <td className="px-4 py-2">Jami</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fmt(methodTotals.pay)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fmt(methodTotals.shop)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-600">
                    {fmt(methodTotals.income)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600">
                    {fmt(methodTotals.expense)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 text-right tabular-nums",
                      methodTotals.net < 0 ? "text-red-600" : "text-emerald-700"
                    )}
                  >
                    {fmt(methodTotals.net)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {shopDebtTotal > 0 && (
          <p className="border-t px-4 py-2.5 text-xs text-gray-500">
            Bronga yozilgan {shopDebts.length} ta to'lanmagan do'kon savdosi (
            {fmt(shopDebtTotal)} so'm) tushumga kirmagan \u2014 pul hali olinmagan.
          </p>
        )}
      </div>

      {/* Xarajatlar toifalari — pul qayerga ketgani */}
      {expenseCategories.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-lg font-bold tracking-tight">Xarajatlar toifasi</h2>
            <span className="text-xs text-gray-400">
              jami {fmt(expensesTotal)} So'm
            </span>
          </div>
          <ul className="divide-y divide-gray-100">
            {expenseCategories.map((c) => {
              const share = expensesTotal > 0 ? (c.total / expensesTotal) * 100 : 0
              return (
                <li key={c.name} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-800">
                      {c.name}
                    </span>
                    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <span
                        className="block h-full rounded-full bg-red-400"
                        style={{ width: `${share}%` }}
                      />
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-right">
                    <span className="block text-sm font-bold tabular-nums text-gray-900">
                      {fmt(c.total)} So'm
                    </span>
                    <span className="block text-[11px] text-gray-400">
                      {c.count} ta \u00b7 {share.toFixed(0)}%
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* To'lovlar (tushum) jadvali */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight">To'lovlar</h2>

        {/* MOBIL: to'lovlar karta ko'rinishida (jadval planshet/desktopda) */}
        <div className="space-y-2.5 md:hidden">
          {filteredPayments.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
              Tanlangan davrda to'lovlar yo'q
            </div>
          ) : (
            filteredPayments.map((p) => (
              <div key={p.id} className="rounded-2xl border bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight text-gray-900">
                      {p.payment_number}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-gray-400">
                      {p.payment_date || "-"}
                    </p>
                  </div>
                  <span className="flex-shrink-0 font-semibold text-green-600">
                    {fmt(p.amount)} So'm
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {METHOD_LABELS[p.payment_method] || p.payment_method}
                  </span>
                </div>
                {(p.notes || p.reference) && (
                  <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
                    {p.notes || p.reference}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
        <div className="hidden rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Raqami</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead>To'lov turi</TableHead>
                <TableHead>Izoh</TableHead>
                <TableHead className="text-right">Summa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-gray-400">
                    Tanlangan davrda to'lovlar yo'q
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.payment_number}</TableCell>
                    <TableCell>{p.payment_date || "-"}</TableCell>
                    <TableCell>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {METHOD_LABELS[p.payment_method] || p.payment_method}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500 max-w-[240px] truncate">
                      {p.notes || p.reference || "-"}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-semibold">
                      {fmt(p.amount)} So'm
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Do'kon qarzlari — bronga yozilgan, hali to'lanmagan sotuvlar */}
      {shopDebts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-bold tracking-tight">
            Do'kon qarzlari (bronga yozilgan)
          </h2>

          {/* MOBIL: qarzlar karta ko'rinishida (jadval planshet/desktopda) */}
          <div className="space-y-2.5 md:hidden">
            {shopDebts.map((s) => (
              <div key={s.id} className="rounded-2xl border bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight text-gray-900">
                      {s.reservation_number || "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-gray-400">
                      {s.created_at
                        ? format(new Date(s.created_at), "dd.MM.yyyy HH:mm")
                        : "—"}
                    </p>
                  </div>
                  <span className="flex-shrink-0 font-semibold text-amber-600">
                    {fmt(s.total_amount)} So'm
                  </span>
                </div>
                <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
                  {s.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}
                </p>
              </div>
            ))}
          </div>

          {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
          <div className="hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bron</TableHead>
                  <TableHead>Vaqt</TableHead>
                  <TableHead>Mahsulotlar</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shopDebts.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.reservation_number || "—"}
                    </TableCell>
                    <TableCell>
                      {s.created_at
                        ? format(new Date(s.created_at), "dd.MM.yyyy HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-gray-500 max-w-[320px] truncate">
                      {s.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-amber-600">
                      {fmt(s.total_amount)} So'm
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-gray-400">
            To'lov Do'kon sahifasidagi "To'lash" tugmasi orqali qabul qilinadi —
            shundan so'ng summa tanlangan kun tushumiga qo'shiladi.
          </p>
        </div>
      )}

      {/* Do'kon sotuvlari (to'langan) — davr bo'yicha */}
      {shopPaid.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-bold tracking-tight">Do'kon sotuvlari</h2>

          {/* MOBIL: sotuvlar karta ko'rinishida (jadval planshet/desktopda) */}
          <div className="space-y-2.5 md:hidden">
            {shopPaid.map((s) => (
              <div key={s.id} className="rounded-2xl border bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight text-gray-900">
                      {s.paid_at
                        ? format(new Date(s.paid_at), "dd.MM.yyyy HH:mm")
                        : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-gray-400">
                      Bron: {s.reservation_number || "—"}
                    </p>
                  </div>
                  <span className="flex-shrink-0 font-semibold text-green-600">
                    {fmt(s.total_amount)} So'm
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {METHOD_LABELS[s.payment_method || ""] || s.payment_method || "—"}
                  </span>
                </div>
                <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
                  {s.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}
                </p>
              </div>
            ))}
          </div>

          {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
          <div className="hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To'langan vaqt</TableHead>
                  <TableHead>Mahsulotlar</TableHead>
                  <TableHead>To'lov turi</TableHead>
                  <TableHead>Bron</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shopPaid.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {s.paid_at ? format(new Date(s.paid_at), "dd.MM.yyyy HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-gray-500 max-w-[320px] truncate">
                      {s.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {METHOD_LABELS[s.payment_method || ""] || s.payment_method || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {s.reservation_number || "—"}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-semibold">
                      {fmt(s.total_amount)} So'm
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Hisob-fakturalar jadvali */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">Hisob-fakturalar</h2>
          <select
            className={cn(selectClass, "w-auto min-w-[170px]")}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Barcha holatlar</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {/* MOBIL: hisob-fakturalar karta ko'rinishida (jadval planshet/desktopda) */}
        <div className="space-y-2.5 md:hidden">
          {filteredInvoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
              Tanlangan davrda hisob-fakturalar yo'q
            </div>
          ) : (
            filteredInvoices.map((inv) => {
              const remaining = Math.max(
                Number(inv.total_amount || 0) - Number(inv.paid_amount || 0),
                0
              )
              return (
                <div key={inv.id} className="rounded-2xl border bg-white p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-tight text-gray-900">
                        {inv.invoice_number}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-tight text-gray-400">
                        {inv.invoice_date || "-"} · muddati: {inv.due_date || "-"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
                        statusBadge[inv.status] || statusBadge.DRAFT
                      )}
                    >
                      {STATUS_LABELS[inv.status] || inv.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-2.5 text-sm">
                    <div>
                      <p className="text-[11px] text-gray-400">Umumiy summa</p>
                      <p className="font-medium text-gray-900">
                        {fmt(inv.total_amount)} So'm
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400">To'landi</p>
                      <p className="font-semibold text-green-600">
                        {fmt(inv.paid_amount)} So'm
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400">Chegirma</p>
                      {Number(inv.discount_amount || 0) > 0 ? (
                        <p className="font-medium text-red-500">
                          −{fmt(inv.discount_amount)} So'm
                        </p>
                      ) : (
                        <p className="text-gray-300">—</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400">Qoldiq</p>
                      <p
                        className={cn(
                          "font-semibold",
                          remaining > 0 ? "text-amber-600" : "text-gray-400"
                        )}
                      >
                        {fmt(remaining)} So'm
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
        <div className="hidden rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Raqami</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead>Muddati</TableHead>
                <TableHead>Holati</TableHead>
                <TableHead className="text-right">Chegirma</TableHead>
                <TableHead className="text-right">Umumiy summa</TableHead>
                <TableHead className="text-right">To'landi</TableHead>
                <TableHead className="text-right">Qoldiq</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-gray-400">
                    Tanlangan davrda hisob-fakturalar yo'q
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((inv) => {
                  const remaining = Math.max(
                    Number(inv.total_amount || 0) - Number(inv.paid_amount || 0),
                    0
                  )
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.invoice_date || "-"}</TableCell>
                      <TableCell>{inv.due_date || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            statusBadge[inv.status] || statusBadge.DRAFT
                          )}
                        >
                          {STATUS_LABELS[inv.status] || inv.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(inv.discount_amount || 0) > 0 ? (
                          <span className="font-medium text-red-500">
                            −{fmt(inv.discount_amount)} So'm
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmt(inv.total_amount)} So'm
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-semibold">
                        {fmt(inv.paid_amount)} So'm
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold",
                          remaining > 0 ? "text-amber-600" : "text-gray-400"
                        )}
                      >
                        {fmt(remaining)} So'm
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
