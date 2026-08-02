import { useState, useMemo } from "react"
import { format, subDays, startOfMonth } from "date-fns"
import {
  Wallet,
  ReceiptText,
  CircleDollarSign,
  AlertCircle,
  TrendingDown,
  Scale,
} from "lucide-react"
import { useInvoices, usePayments } from "../api/finance"
import { useExpenses } from "@/features/expenses/api/expenses"
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

const METHOD_LABELS: Record<string, string> = {
  CASH: "Naqd pul",
  CREDIT_CARD: "Kredit karta",
  DEBIT_CARD: "Debit karta",
  BANK_TRANSFER: "Bank o'tkazmasi",
  MOBILE_PAYMENT: "Mobil to'lov",
  ONLINE: "Onlayn",
}

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

  // --- Hisobot ko'rsatkichlari (tanlangan davr bo'yicha) ---
  const summary = useMemo(() => {
    const income = filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
    const invoiceTotal = filteredInvoices.reduce(
      (s, i) => s + Number(i.total_amount || 0),
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

    // To'lov usullari bo'yicha taqsimot (masalan: naqd / karta)
    const byMethod: Record<string, number> = {}
    for (const p of filteredPayments) {
      byMethod[p.payment_method] = (byMethod[p.payment_method] || 0) + Number(p.amount || 0)
    }
    return { income, invoiceTotal, invoicePaid, debt, byMethod }
  }, [filteredPayments, filteredInvoices])

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
      sub: `${filteredInvoices.length} ta hujjat`,
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
            value: `${fmt(summary.income - expensesTotal)} So'm`,
            sub: "tushum − xarajat",
            icon: Scale,
            accent:
              summary.income - expensesTotal >= 0
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-600",
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

      {/* To'lov usullari bo'yicha taqsimot */}
      {Object.keys(summary.byMethod).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.byMethod).map(([method, amount]) => (
            <span
              key={method}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
            >
              <span className="font-medium">{METHOD_LABELS[method] || method}:</span>
              <span className="font-semibold text-gray-900">{fmt(amount)} So'm</span>
            </span>
          ))}
        </div>
      )}

      {/* To'lovlar (tushum) jadvali */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight">To'lovlar</h2>
        <div className="rounded-md border">
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

      {/* Hisob-fakturalar jadvali */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Raqami</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead>Muddati</TableHead>
                <TableHead>Holati</TableHead>
                <TableHead className="text-right">Umumiy summa</TableHead>
                <TableHead className="text-right">To'landi</TableHead>
                <TableHead className="text-right">Qoldiq</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-gray-400">
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
