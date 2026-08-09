import { useMemo, useState } from "react"
import { format, subDays } from "date-fns"
import {
  FileBarChart,
  CalendarCheck,
  Wallet,
  TrendingDown,
  Banknote,
  Store,
} from "lucide-react"
import { useReservations } from "@/features/reservations/api/reservations"
import { useExpenses } from "@/features/expenses/api/expenses"
import { useShopSales, type ShopSale } from "@/features/shop/api/shop"
import { useGuests } from "@/features/guests/api/guests"
import { useRooms } from "@/features/rooms/api/rooms"
import { useAuthStore } from "@/store/auth"
import { ShiftPanel } from "@/features/shifts/components/ShiftPanel"
import { AcceptedShiftReport } from "@/features/shifts/components/AcceptedShiftReport"
import type { Reservation, Expense } from "@/types/api"
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

/* Shaxsiy hisobot: joriy xodim O'ZI yaratgan bronlar va O'ZI kiritgan
   xarajatlar. Ma'lumotlar mavjud API'lardan olinadi va created_by bo'yicha
   mijoz tomonda filtrlash qilinadi — boshqa sahifalarga ta'sir yo'q. */

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

  const { data: reservations = [], isLoading: resLoading } = useReservations()
  const { data: expenses = [], isLoading: expLoading } = useExpenses(dateFrom, dateTo)
  const { data: shopSales = [] } = useShopSales(dateFrom, dateTo)
  const { data: guests = [] } = useGuests()
  const { data: rooms = [] } = useRooms()

  const guestName = (id: string) => {
    const g = (guests as any[]).find((x) => x.id === id)
    return g ? `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim() : "—"
  }
  const roomNumber = (id: string) => {
    const r = (rooms as any[]).find((x) => x.id === id)
    return r ? r.room_number : "—"
  }

  // O'zim yaratgan bronlar — bron QAYD ETILGAN sana (created_at) oraliqda bo'lsa
  const myReservations = useMemo(() => {
    if (!user?.id) return [] as Reservation[]
    return (reservations as Reservation[])
      .filter((r) => r.created_by === user.id)
      .filter((r) => {
        const d = format(new Date(r.created_at), "yyyy-MM-dd")
        return d >= dateFrom && d <= dateTo
      })
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  }, [reservations, user?.id, dateFrom, dateTo])

  // O'zim kiritgan xarajatlar (sana bo'yicha server filtrlagan)
  const myExpenses = useMemo(() => {
    if (!user?.id) return [] as Expense[]
    return (expenses as Expense[]).filter((e) => e.created_by === user.id)
  }, [expenses, user?.id])

  // O'zim qilgan do'kon sotuvlari (sotuv vaqti bo'yicha, server filtrlagan)
  const myShopSales = useMemo(() => {
    if (!user?.id) return [] as ShopSale[]
    return (shopSales as ShopSale[]).filter((s) => s.created_by === user.id)
  }, [shopSales, user?.id])

  // Bekor qilinganlar pulga hisoblanmaydi
  const activeRes = myReservations.filter((r) => r.status !== "CANCELLED")
  const resTotal = activeRes.reduce((s, r) => s + Number(r.total_amount || 0), 0)
  const resPaid = activeRes.reduce((s, r) => s + Number(r.paid_amount || 0), 0)
  const cancelledCount = myReservations.length - activeRes.length
  const expTotal = myExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const shopTotal = myShopSales.reduce((s, x) => s + Number(x.total_amount || 0), 0)
  const shopPendingTotal = myShopSales
    .filter((x) => x.status === "PENDING")
    .reduce((s, x) => s + Number(x.total_amount || 0), 0)

  const isLoading = resLoading || expLoading

  return (
    <div className="space-y-5">
      {/* Smena va kassa paneli (faqat kassali rejimda ko'rinadi) */}
      <ShiftPanel />

      {/* Qabul qilingan smena hisoboti — ALOHIDA bo'lim (avvalgi xodim
          hisobida, joriy xodim summalariga qo'shilmaydi) */}
      <AcceptedShiftReport />

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

      {/* Ko'rsatkichlar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarCheck size={15} /> Yaratgan bronlarim
          </div>
          <p className="mt-1 text-2xl font-bold">{myReservations.length} ta</p>
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
          <p className="mt-1 text-2xl font-bold">{fmt(resTotal)} So'm</p>
          <p className="mt-0.5 text-xs text-muted-foreground">bekor qilinganlarsiz</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Banknote size={15} /> Qabul qilingan to'lovlar
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{fmt(resPaid)} So'm</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Store size={15} /> Do'kon sotuvlarim
          </div>
          <p className="mt-1 text-2xl font-bold text-violet-600">{fmt(shopTotal)} So'm</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {myShopSales.length} ta sotuv
            {shopPendingTotal > 0 && ` · bronda: ${fmt(shopPendingTotal)}`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingDown size={15} /> Xarajatlarim
          </div>
          <p className="mt-1 text-2xl font-bold text-red-600">{fmt(expTotal)} So'm</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{myExpenses.length} ta yozuv</p>
        </div>
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
              <span className="text-xs text-muted-foreground">{myReservations.length} ta</span>
            </div>
            {myReservations.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tanlangan davrda siz yaratgan bron yo'q
              </p>
            ) : (
              <div className="overflow-x-auto">
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
                          {guestName(r.guest_id)}
                        </TableCell>
                        <TableCell className="text-sm">{roomNumber(r.room_id)}</TableCell>
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
              <div className="overflow-x-auto">
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
            )}
          </div>

          {/* Mening xarajatlarim */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Mening xarajatlarim</h2>
              <span className="text-xs text-muted-foreground">{myExpenses.length} ta</span>
            </div>
            {myExpenses.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tanlangan davrda siz kiritgan xarajat yo'q
              </p>
            ) : (
              <div className="overflow-x-auto">
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
            )}
          </div>
        </>
      )}
    </div>
  )
}
