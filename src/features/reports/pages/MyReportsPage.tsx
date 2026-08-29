import { useMemo, useState } from "react"
import { format, subDays } from "date-fns"
import {
  FileBarChart,
  CalendarCheck,
  Wallet,
  TrendingDown,
  TrendingUp,
  Scale,
  Banknote,
  Store,
  AlertCircle,
} from "lucide-react"
import { useShopSales, type ShopSale } from "@/features/shop/api/shop"
import { useMyReport, METHOD_COLUMNS } from "../api/myReport"
import { useAuthStore } from "@/store/auth"
import { apiErrorMessage } from "@/lib/apiError"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/* Shaxsiy hisobot: joriy xodimning tanlangan kunlardagi ishi.

   Barcha ko'rsatkichlar SERVERDA hisoblanadi (`/reports/my-summary`). Ilgari
   sahifa butun mehmonxonaning eng yangi 500 ta bronini yuklab, brauzerda
   filtrlar edi — bunda 500 tadan keyingi yozuvlar jimgina tushib qolar,
   "bugun" har bo'limda boshqa ma'noni bildirar, eng muhimi pul bronni KIM
   YARATGANIGA qarab yozilardi. Endi pul to'lovning o'zidan olinadi, ya'ni
   kassa hisobidagi ta'rif bilan bir xil. */

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlangan",
  CHECKED_IN: "Kirilgan",
  CHECKED_OUT: "Chiqilgan",
  CANCELLED: "Bekor qilingan",
  NO_SHOW: "Kelmagan",
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-emerald-100 text-emerald-700",
  CHECKED_OUT: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-red-100 text-red-600",
  NO_SHOW: "bg-orange-100 text-orange-600",
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

export const MyReportsPage = () => {
  const user = useAuthStore((s) => s.user)

  // Sana har renderda qayta hisoblanadi: sahifa yarim tundan o'tib ochiq
  // qolsa ham "Bugun" haqiqiy bugunni bildiradi
  const todayStr = format(new Date(), "yyyy-MM-dd")
  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo, setDateTo] = useState(todayStr)

  const presets = [
    { key: "today", label: "Bugun", from: todayStr, to: todayStr },
    {
      key: "week",
      label: "7 kun",
      from: format(subDays(new Date(), 6), "yyyy-MM-dd"),
      to: todayStr,
    },
    {
      key: "month",
      label: "30 kun",
      from: format(subDays(new Date(), 29), "yyyy-MM-dd"),
      to: todayStr,
    },
  ]

  // Barcha ko'rsatkichlar shu bitta so'rovdan — serverda hisoblangan
  const {
    data: report,
    isLoading,
    error: reportError,
  } = useMyReport(dateFrom, dateTo)

  // Do'kon jadvali: sotuv QAYD ETILGAN vaqt bo'yicha, chunki bronga yozilgan
  // (hali to'lanmagan) sotuvlar ham ro'yxatda ko'rinishi kerak. Kartochkadagi
  // PUL esa serverdan keladi va u to'langan vaqt bo'yicha hisoblanadi.
  const { data: shopSales = [], error: shopError } = useShopSales(dateFrom, dateTo)
  const myShopSales = useMemo(() => {
    if (!user?.id) return [] as ShopSale[]
    return (shopSales as ShopSale[]).filter((s) => s.created_by === user.id)
  }, [shopSales, user?.id])

  const myReservations = report?.reservations.items ?? []
  const myExpenses = report?.expenses.items ?? []

  const resCount = report?.reservations.count ?? 0
  const cancelledCount = report?.reservations.cancelled_count ?? 0
  const resTotal = report?.reservations.total_amount ?? 0
  // Xodim HAQIQATDA qabul qilgan pul (qaytarimlar allaqachon ayirilgan)
  const collected = report?.payments.total ?? 0
  const collectedCash = report?.payments.by_method.cash ?? 0
  const refunds = report?.payments.refunds ?? 0
  const shopTotal = report?.shop.total ?? 0
  const shopCount = report?.shop.count ?? 0
  const shopPendingTotal = report?.shop.unpaid_total ?? 0
  const shopPendingCount = report?.shop.unpaid_count ?? 0
  const expTotal = report?.expenses.total ?? 0
  const expCount = report?.expenses.count ?? 0
  // Jami tushum va sof natija serverda hisoblanadi va shu yerda qayta
  // hisoblanmaydi: ta'rif bitta joyda turishi kerak
  const incomeTotal = report?.income.total ?? 0
  const netTotal = report?.net.total ?? 0
  const netCash = report?.net_cash ?? 0

  const loadError = reportError || shopError

  // Yuklanayotganda ko'rsatkichlar NOL emas, "—" bo'ladi: nol ham haqiqiy
  // qiymat, uni yuklanish holatidan ajratib bo'lmasa xodim "hech narsa
  // qilmabman" degan xulosaga keladi
  const stat = (value: number) => (isLoading ? "—" : fmt(value))
  const count = (value: number) => (isLoading ? "—" : String(value))


  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25">
            <FileBarChart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Mening hisobotim</h1>
            <p className="text-sm text-muted-foreground">
              {user?.first_name} {user?.last_name} — shaxsiy bronlar va xarajatlar
            </p>
          </div>
        </div>

        {/* Sana oralig'i */}
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => {
            const active = dateFrom === p.from && dateTo === p.to
            return (
              <button
                key={p.key}
                onClick={() => {
                  setDateFrom(p.from)
                  setDateTo(p.to)
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            )
          })}
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-[140px] text-sm"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-[140px] text-sm"
          />
        </div>
      </div>

      {/* Ma'lumot kelmasa — nol emas, sabab ko'rsatiladi */}
      {loadError && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          Hisobotni yuklab bo'lmadi: {apiErrorMessage(loadError)}
        </p>
      )}

      {/* Ko'rsatkichlar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarCheck size={15} /> Yaratgan bronlarim
          </div>
          <p className="mt-1 text-2xl font-bold">{count(resCount)} ta</p>
          {cancelledCount > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              shundan {cancelledCount} tasi bekor qilingan
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet size={15} /> Bronlar summasi
          </div>
          <p className="mt-1 text-2xl font-bold">{stat(resTotal)} So'm</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            bekor qilinganlarsiz · bu shartnoma qiymati, pul emas
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Banknote size={15} /> Qabul qilgan to'lovlarim
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{stat(collected)} So'm</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            naqd {fmt(collectedCash)}
            {refunds > 0 && ` · qaytarilgan ${fmt(refunds)}`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Store size={15} /> Do'kon sotuvlarim
          </div>
          <p className="mt-1 text-2xl font-bold text-violet-600">{stat(shopTotal)} So'm</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {shopCount} ta to'langan
            {shopPendingCount > 0 &&
              ` · bronda ${shopPendingCount} ta: ${fmt(shopPendingTotal)}`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingDown size={15} /> Xarajatlarim
          </div>
          <p className="mt-1 text-2xl font-bold text-red-600">{stat(expTotal)} So'm</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{expCount} ta yozuv</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp size={15} /> Jami tushum
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {stat(incomeTotal)} So'm
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            to'lovlar + do'kon · naqd qoldiq {fmt(netCash)}
          </p>
        </div>
        {/* Sof natija: musbat bo'lsa foyda, manfiy bo'lsa zarar */}
        <div
          className={cn(
            "rounded-xl border p-4",
            netTotal < 0
              ? "border-red-200 bg-red-50/60"
              : "border-emerald-200 bg-emerald-50/50"
          )}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Scale size={15} /> {netTotal < 0 ? "Zarar" : "Sof foyda"}
          </div>
          <p
            className={cn(
              "mt-1 text-2xl font-bold",
              netTotal < 0 ? "text-red-600" : "text-emerald-700"
            )}
          >
            {stat(Math.abs(netTotal))} So'm
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">tushum − xarajat</p>
        </div>
      </div>

      {/* To'lov turlari bo'yicha to'liq tafsilot */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">To'lov turlari bo'yicha</h2>
          <span className="text-xs text-muted-foreground">
            qaytarimlar tushumdan ayirilgan
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  To'lov turi
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bron to'lovlari
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Do'kon
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Jami tushum
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Xarajat
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sof
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {METHOD_COLUMNS.map((col) => {
                const pay = report?.payments.by_method[col.key] ?? 0
                const shop = report?.shop.by_method[col.key] ?? 0
                const income = report?.income.by_method[col.key] ?? 0
                const expense = report?.expenses.by_method[col.key] ?? 0
                const net = report?.net.by_method[col.key] ?? 0
                // Harakat bo'lmagan tur ro'yxatni uzaytirmaydi
                const empty = !pay && !shop && !income && !expense && !net
                if (empty && !isLoading) return null
                return (
                  <tr key={col.key}>
                    <td className="px-4 py-2 font-medium">{col.label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{stat(pay)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{stat(shop)}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-emerald-600">
                      {stat(income)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-red-600">
                      {expense ? stat(expense) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right font-semibold tabular-nums",
                        net < 0 ? "text-red-600" : "text-foreground"
                      )}
                    >
                      {stat(net)}
                    </td>
                  </tr>
                )
              })}
              {!isLoading && incomeTotal === 0 && expTotal === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Tanlangan davrda pul harakati bo'lmagan
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td className="px-4 py-2">Jami</td>
                <td className="px-4 py-2 text-right tabular-nums">{stat(collected)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{stat(shopTotal)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-600">
                  {stat(incomeTotal)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-red-600">
                  {stat(expTotal)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2 text-right tabular-nums",
                    netTotal < 0 ? "text-red-600" : "text-emerald-700"
                  )}
                >
                  {stat(netTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {refunds > 0 && (
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            Davr ichida {fmt(refunds)} so'm qaytarilgan — u yuqoridagi tushumdan
            allaqachon ayirilgan.
          </p>
        )}
        {shopPendingCount > 0 && (
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            To'lanmagan {shopPendingCount} ta do'kon savdosi ({fmt(shopPendingTotal)} so'm)
            tushumga kirmagan — pul hali olinmagan.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Mening bronlarim */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Mening bronlarim</h2>
              <span className="text-xs text-muted-foreground">{resCount} ta</span>
            </div>
            {myReservations.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tanlangan davrda siz yaratgan bron yo'q
              </p>
            ) : (
              <>
                {/* MOBIL: bronlar karta ko'rinishida (jadval planshet/desktopda) */}
                <div className="space-y-2.5 p-3 md:hidden">
                  {myReservations.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-border bg-card p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {r.guest_name || "—"}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {r.reservation_number} ·{" "}
                            {format(new Date(r.created_at), "dd.MM HH:mm")}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            STATUS_STYLES[r.status] || "bg-muted text-muted-foreground"
                          )}
                        >
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-end justify-between gap-2 border-t border-border pt-2">
                        <span className="text-sm">
                          <span className="text-muted-foreground">Xona: </span>
                          <span className="font-medium">{r.room_number || "—"}</span>
                        </span>
                        <div className="text-right">
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              r.status === "CANCELLED" &&
                                "text-muted-foreground line-through"
                            )}
                          >
                            Jami: {fmt(r.total_amount)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            To'langan: {fmt(r.paid_amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
                <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vaqt</TableHead>
                      <TableHead>Raqam</TableHead>
                      <TableHead>Mehmon</TableHead>
                      <TableHead>Xona</TableHead>
                      <TableHead>Holat</TableHead>
                      <TableHead className="text-right">Jami</TableHead>
                      <TableHead className="text-right">To'langan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myReservations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(r.created_at), "dd.MM HH:mm")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                          {r.reservation_number}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm font-medium">
                          {r.guest_name || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{r.room_number || "—"}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              STATUS_STYLES[r.status] || "bg-muted text-muted-foreground"
                            )}
                          >
                            {STATUS_LABELS[r.status] || r.status}
                          </span>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "whitespace-nowrap text-right text-sm font-semibold",
                            r.status === "CANCELLED" && "text-muted-foreground line-through"
                          )}
                        >
                          {fmt(r.total_amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm">
                          {fmt(r.paid_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </div>

          {/* Mening do'kon sotuvlarim */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Mening do'kon sotuvlarim</h2>
              <span className="text-xs text-muted-foreground">{myShopSales.length} ta</span>
            </div>
            {myShopSales.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tanlangan davrda siz qilgan do'kon sotuvi yo'q
              </p>
            ) : (
              <>
                {/* MOBIL: sotuvlar karta ko'rinishida (jadval planshet/desktopda) */}
                <div className="space-y-2.5 p-3 md:hidden">
                  {myShopSales.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-border bg-card p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-nowrap text-sm">
                          {s.created_at
                            ? format(new Date(s.created_at), "dd.MM HH:mm")
                            : "—"}
                        </p>
                        {s.status === "PAID" ? (
                          <Badge variant="secondary" className="flex-shrink-0 text-[11px]">
                            {s.payment_method === "CASH"
                              ? "Naqd"
                              : s.payment_method === "CARD"
                                ? "Karta"
                                : s.payment_method === "TRANSFER"
                                  ? "O'tkazma"
                                  : s.payment_method || "To'langan"}
                          </Badge>
                        ) : (
                          <Badge className="flex-shrink-0 bg-amber-100 text-[11px] text-amber-700 hover:bg-amber-100">
                            Bron: {s.reservation_number || "—"}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm">
                        {s.items
                          .map((i) => `${i.product_name} ×${i.quantity}`)
                          .join(", ")}
                      </p>
                      <p className="mt-2 border-t border-border pt-2 text-right text-sm font-semibold">
                        {fmt(s.total_amount)} So'm
                      </p>
                    </div>
                  ))}
                </div>
                {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
                <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vaqt</TableHead>
                      <TableHead>Mahsulotlar</TableHead>
                      <TableHead>To'lov</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myShopSales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {s.created_at ? format(new Date(s.created_at), "dd.MM HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate text-sm">
                          {s.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}
                        </TableCell>
                        <TableCell>
                          {s.status === "PAID" ? (
                            <Badge variant="secondary" className="text-[11px]">
                              {s.payment_method === "CASH"
                                ? "Naqd"
                                : s.payment_method === "CARD"
                                  ? "Karta"
                                  : s.payment_method === "TRANSFER"
                                    ? "O'tkazma"
                                    : s.payment_method || "To'langan"}
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-[11px] text-amber-700 hover:bg-amber-100">
                              Bron: {s.reservation_number || "—"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm font-semibold">
                          {fmt(s.total_amount)} So'm
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </div>

          {/* Mening xarajatlarim */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Mening xarajatlarim</h2>
              <span className="text-xs text-muted-foreground">{expCount} ta</span>
            </div>
            {myExpenses.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tanlangan davrda siz kiritgan xarajat yo'q
              </p>
            ) : (
              <>
                {/* MOBIL: xarajatlar karta ko'rinishida (jadval planshet/desktopda) */}
                <div className="space-y-2.5 p-3 md:hidden">
                  {myExpenses.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-2xl border border-border bg-card p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{e.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {e.expense_date
                              ? format(new Date(e.expense_date), "dd.MM.yyyy")
                              : "—"}
                          </p>
                        </div>
                        <p className="flex-shrink-0 text-sm font-semibold text-red-600">
                          {fmt(e.amount)}
                        </p>
                      </div>
                      {e.category && (
                        <Badge variant="secondary" className="mt-2 text-[11px]">
                          {e.category}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
                <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Nomi</TableHead>
                      <TableHead>Kategoriya</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myExpenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {e.expense_date ? format(new Date(e.expense_date), "dd.MM.yyyy") : "—"}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-sm font-medium">
                          {e.title}
                        </TableCell>
                        <TableCell>
                          {e.category ? (
                            <Badge variant="secondary" className="text-[11px]">
                              {e.category}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm font-semibold text-red-600">
                          {fmt(e.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
