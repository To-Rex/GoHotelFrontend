import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
  ArrowRightLeft,
  CalendarCheck,
  ChevronDown,
  TrendingDown,
  Store,
  Wallet,
} from "lucide-react"
import { useShiftState } from "../api/shifts"
import { useReservations } from "@/features/reservations/api/reservations"
import { useExpenses } from "@/features/expenses/api/expenses"
import { useShopSales, type ShopSale } from "@/features/shop/api/shop"
import { useGuests } from "@/features/guests/api/guests"
import { useRooms } from "@/features/rooms/api/rooms"
import { useAuthStore } from "@/store/auth"
import type { Reservation, Expense } from "@/types/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString()

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

/* Yig'iluvchi ro'yxat: sarlavha bosilganda ochiladi/yopiladi.

   Qabul qilingan smena hisoboti sahifa boshida turadi va o'z ostidagi asosiy
   hisobotni pastga surib yuboradi. Ro'yxatlar odatda kerak emas — muhimi
   kartochkalardagi jamlar — shuning uchun ular YOPIQ holatda boshlanadi va
   faqat so'ralganda ochiladi. */
function CollapsibleList({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 bg-gray-50/70 px-3 py-2.5 text-left text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100",
          open && "border-b"
        )}
      >
        <span>
          {title} ({count} ta)
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && children}
    </div>
  )
}

/* Qabul qilingan smena hisoboti — /my-reports da ALOHIDA bo'lim.

   Avvalgi xodimning sessiya davridagi bronlari, xarajatlari, do'kon
   savdolari va kassa hisoboti ko'rsatiladi. Bu summalar FAQAT ko'rish
   uchun — avvalgi xodim hisobida qoladi, joriy xodimnikiga qo'shilmaydi. */
export const AcceptedShiftReport = () => {
  const user = useAuthStore((s) => s.user)
  const { data: state } = useShiftState(!!user)
  const acc = state?.accepted_session

  // Sessiya oynasi (sana oralig'i server filtrlari uchun)
  const winFrom = acc?.started_at ? format(new Date(acc.started_at), "yyyy-MM-dd") : ""
  const winTo = acc?.ended_at ? format(new Date(acc.ended_at), "yyyy-MM-dd") : winFrom
  // Qabul qilingan smena bo'lmasa so'rov umuman yuborilmaydi: ilgari bo'sh
  // sana bilan ketib, butun ro'yxatni tortib olardi
  const hasAccepted = Boolean(acc?.started_at)

  const { data: reservations = [] } = useReservations()
  const { data: expenses = [] } = useExpenses(winFrom, winTo, hasAccepted)
  const { data: shopSales = [] } = useShopSales(winFrom, winTo, { enabled: hasAccepted })
  const { data: guests = [] } = useGuests()
  const { data: rooms = [] } = useRooms()

  // Sessiya vaqt oynasiga tushish tekshiruvi (aniq vaqti bilan)
  const inWindow = (iso?: string | null): boolean => {
    if (!acc?.started_at || !iso) return false
    const t = new Date(iso).getTime()
    const from = new Date(acc.started_at).getTime()
    const to = acc.ended_at ? new Date(acc.ended_at).getTime() : Date.now()
    return t >= from && t <= to
  }

  const prevReservations = useMemo(
    () =>
      acc
        ? (reservations as Reservation[])
            .filter((r) => r.created_by === acc.user_id && inWindow(r.created_at))
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reservations, acc?.user_id, acc?.started_at, acc?.ended_at]
  )
  const prevExpenses = useMemo(
    () =>
      acc
        ? (expenses as Expense[]).filter(
            (e) => e.created_by === acc.user_id && (!e.created_at || inWindow(e.created_at))
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, acc?.user_id, acc?.started_at, acc?.ended_at]
  )
  const prevShopSales = useMemo(
    () =>
      acc
        ? (shopSales as ShopSale[]).filter(
            (s) => s.created_by === acc.user_id && (!s.created_at || inWindow(s.created_at))
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shopSales, acc?.user_id, acc?.started_at, acc?.ended_at]
  )

  // Panel faqat joriy sessiya faol bo'lganda va qabul qilingan smena bo'lganda
  if (!user || !state || state.mode !== "cash" || !acc) return null
  if (!state.my_session || state.my_session.status !== "ACTIVE") return null

  const guestName = (id: string) => {
    const g = (guests as any[]).find((x) => x.id === id)
    return g ? `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim() : "—"
  }
  const roomNumber = (id: string) => {
    const r = (rooms as any[]).find((x) => x.id === id)
    return r ? r.room_number : "—"
  }

  const activeRes = prevReservations.filter((r) => r.status !== "CANCELLED")
  const resTotal = activeRes.reduce((s, r) => s + Number(r.total_amount || 0), 0)
  const expTotal = prevExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  // Do'kon PULI faqat TO'LANGAN savdolardan: bronga yozilgan (hali to'lanmagan)
  // savdo kassaga tushmagan, uni tushum deb ko'rsatish smenani topshirishda
  // yo'q pulni talab qilishga olib keladi
  const paidShop = prevShopSales.filter((x) => x.status === "PAID")
  const shopTotal = paidShop.reduce((s, x) => s + Number(x.total_amount || 0), 0)
  const shopPending = prevShopSales.length - paidShop.length

  const stats = [
    {
      icon: CalendarCheck,
      accent: "bg-blue-50 text-blue-600",
      label: "Bronlar",
      // Ro'yxatda bekor qilinganlar ham ko'rinadi, shuning uchun kartochka
      // ham umumiy sonni ko'rsatadi — aks holda bitta so'z ikki xil raqamni
      // bildirardi
      value: `${prevReservations.length} ta`,
      sub:
        prevReservations.length === activeRes.length
          ? `${fmt(resTotal)} so'm`
          : `${fmt(resTotal)} so'm · ${prevReservations.length - activeRes.length} ta bekor`,
    },
    {
      icon: TrendingDown,
      accent: "bg-red-50 text-red-500",
      label: "Xarajatlar",
      value: `${prevExpenses.length} ta`,
      sub: `${fmt(expTotal)} so'm`,
    },
    {
      icon: Store,
      accent: "bg-violet-50 text-violet-600",
      label: "Do'kon savdolari",
      value: `${paidShop.length} ta`,
      sub:
        shopPending > 0
          ? `${fmt(shopTotal)} so'm · bronda ${shopPending} ta`
          : `${fmt(shopTotal)} so'm`,
    },
    {
      icon: Wallet,
      accent:
        acc.cash_diff && acc.cash_diff !== 0
          ? "bg-red-50 text-red-500"
          : "bg-emerald-50 text-emerald-600",
      label: "Kassa (topshirilgan)",
      value: `${fmt(acc.counted_cash)} so'm`,
      sub:
        acc.cash_diff && acc.cash_diff !== 0
          ? `farq: ${fmt(acc.cash_diff)} so'm`
          : "farqsiz topshirilgan",
    },
  ]

  return (
    <section className="rounded-2xl border-2 border-emerald-200 bg-white overflow-hidden">
      {/* Bo'lim sarlavhasi — alohida hisobot ekani yaqqol ko'rinadi */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <ArrowRightLeft className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="font-bold text-emerald-900 leading-tight">
              Qabul qilingan smena hisoboti — {acc.user_name}
            </h2>
            <p className="text-xs text-emerald-700/80">
              {acc.started_at && format(new Date(acc.started_at), "dd.MM HH:mm")}
              {" – "}
              {acc.ended_at && format(new Date(acc.ended_at), "dd.MM HH:mm")}
              {acc.accepted_at &&
                ` · qabul qilingan: ${format(new Date(acc.accepted_at), "HH:mm")}`}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
          Avvalgi xodim hisobida — sizga qo'shilmaydi
        </span>
      </div>

      <div className="space-y-4 p-4">
        {/* Statistika kartalari */}
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border bg-white p-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    s.accent
                  )}
                >
                  <s.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-gray-400">{s.label}</p>
                  <p className="truncate text-sm font-bold text-gray-900">
                    {s.value}
                  </p>
                  <p className="truncate text-[11px] text-gray-500">{s.sub}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Kassa tafsiloti */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-gray-50 px-2.5 py-1 font-medium text-gray-600 ring-1 ring-gray-200">
            Boshlang'ich: <b className="tabular-nums">{fmt(acc.opening_cash)}</b> so'm
          </span>
          <span className="rounded-full bg-gray-50 px-2.5 py-1 font-medium text-gray-600 ring-1 ring-gray-200">
            Kutilgan: <b className="tabular-nums">{fmt(acc.expected_cash)}</b> so'm
          </span>
          <span className="rounded-full bg-gray-50 px-2.5 py-1 font-medium text-gray-600 ring-1 ring-gray-200">
            Sanalgan: <b className="tabular-nums">{fmt(acc.counted_cash)}</b> so'm
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 font-semibold",
              acc.cash_diff
                ? "bg-red-100 text-red-600"
                : "bg-emerald-100 text-emerald-700"
            )}
          >
            Farq: <span className="tabular-nums">{fmt(acc.cash_diff)}</span> so'm
          </span>
        </div>

        {/* Avvalgi xodim bronlari */}
        {prevReservations.length > 0 && (
          <CollapsibleList
            title="Smena davomidagi bronlar"
            count={prevReservations.length}
          >
            {/* MOBIL: bronlar ixcham karta ko'rinishida (jadval planshet/desktopda) */}
            <div className="space-y-2.5 p-2.5 md:hidden">
              {prevReservations.map((r) => (
                <div key={r.id} className="rounded-2xl border bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-xs">
                      <span className="whitespace-nowrap text-gray-500">
                        {format(new Date(r.created_at), "HH:mm")}
                      </span>
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-700">
                        {roomNumber(r.room_id)}
                      </span>
                      <span className="truncate text-gray-700">
                        {guestName(r.guest_id)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"
                      )}
                    >
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium tabular-nums">
                    {fmt(Number(r.total_amount))} so'm
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
                    <TableHead>Xona</TableHead>
                    <TableHead>Mehmon</TableHead>
                    <TableHead>Summa</TableHead>
                    <TableHead>Holat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prevReservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-gray-500">
                        {format(new Date(r.created_at), "HH:mm")}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-700">
                          {roomNumber(r.room_id)}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {guestName(r.guest_id)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium tabular-nums">
                        {fmt(Number(r.total_amount))} so'm
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"
                          )}
                        >
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleList>
        )}

        {/* Avvalgi xodim xarajatlari */}
        {prevExpenses.length > 0 && (
          <CollapsibleList
            title="Smena davomidagi xarajatlar"
            count={prevExpenses.length}
          >
            {/* MOBIL: xarajatlar ixcham karta ko'rinishida (jadval planshet/desktopda) */}
            <div className="space-y-2.5 p-2.5 md:hidden">
              {prevExpenses.map((e) => (
                <div key={e.id} className="rounded-2xl border bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="whitespace-nowrap text-gray-500">
                        {e.created_at ? format(new Date(e.created_at), "HH:mm") : "—"}
                      </span>
                      <span className="truncate text-gray-700">{e.title}</span>
                    </span>
                    <span className="flex-shrink-0 font-medium tabular-nums">
                      {fmt(Number(e.amount))} so'm
                    </span>
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
                    <TableHead>Nomi</TableHead>
                    <TableHead>Summa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prevExpenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-gray-500">
                        {e.created_at ? format(new Date(e.created_at), "HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-gray-700">{e.title}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium tabular-nums">
                        {fmt(Number(e.amount))} so'm
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleList>
        )}

        {prevReservations.length === 0 &&
          prevExpenses.length === 0 &&
          prevShopSales.length === 0 && (
            <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-gray-400">
              Avvalgi smena davomida bron, xarajat yoki savdo qayd etilmagan.
            </p>
          )}
      </div>
    </section>
  )
}
