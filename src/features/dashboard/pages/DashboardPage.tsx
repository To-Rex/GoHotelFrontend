import { useMemo } from "react"
import { format, subDays } from "date-fns"
import {
  BedDouble,
  Users,
  CalendarCheck,
  Wallet,
  LogIn,
  LogOut,
  TrendingUp,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { useRooms } from "@/features/rooms/api/rooms"
import { useReservations } from "@/features/reservations/api/reservations"
import { useGuests } from "@/features/guests/api/guests"
import { useInvoices, usePayments } from "@/features/finance/api/finance"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const fmt = (n: number) => Number(n || 0).toLocaleString()

// Xona holatlari — semantik ranglar, yorliq va son bilan birga ko'rsatiladi
const ROOM_STATUSES: Array<{ key: string; label: string; color: string; dot: string }> = [
  { key: "AVAILABLE", label: "Bo'sh", color: "#10b981", dot: "bg-emerald-500" },
  { key: "OCCUPIED", label: "Band", color: "#ef4444", dot: "bg-red-500" },
  { key: "RESERVED", label: "Band qilingan", color: "#3b82f6", dot: "bg-blue-500" },
  { key: "CLEANING", label: "Tozalanmoqda", color: "#f59e0b", dot: "bg-amber-500" },
  { key: "MAINTENANCE", label: "Ta'mirda", color: "#f97316", dot: "bg-orange-500" },
  { key: "INSPECTION", label: "Tekshiruvda", color: "#a855f7", dot: "bg-purple-500" },
  { key: "OUT_OF_SERVICE", label: "Xizmatdan tashqari", color: "#9ca3af", dot: "bg-gray-400" },
]

const RES_STATUS_LABELS: Record<string, string> = {
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlangan",
  CHECKED_IN: "Kirgan",
  CHECKED_OUT: "Chiqgan",
  NO_SHOW: "Kelmadi",
  CANCELLED: "Bekor qilingan",
}

const resStatusBadge: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-emerald-100 text-emerald-700",
  CHECKED_OUT: "bg-gray-200 text-gray-600",
  NO_SHOW: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-600",
}

// Grafik tooltip'i — minimal oq karta
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">
        {fmt(payload[0].value)} So'm
      </p>
    </div>
  )
}

export const DashboardPage = () => {
  const todayStr = format(new Date(), "yyyy-MM-dd")
  const weekAgoStr = format(subDays(new Date(), 6), "yyyy-MM-dd")

  const { data: rooms = [], isLoading: roomsLoading } = useRooms()
  const { data: reservations = [], isLoading: resLoading } = useReservations()
  const { data: guests = [], isLoading: guestsLoading } = useGuests()
  const { data: invoices = [] } = useInvoices()
  const { data: payments = [], isLoading: paymentsLoading } = usePayments(
    weekAgoStr,
    todayStr
  )

  const isLoading = roomsLoading || resLoading || guestsLoading || paymentsLoading

  // Backend eski versiyada sana parametrlarini bilmasligi mumkin —
  // mijoz tomonida ham oraliqqa filtrlaymiz (FinancePage bilan bir xil usul)
  const weekPayments = useMemo(
    () =>
      payments.filter((p) => {
        const d = String(p.payment_date || "").slice(0, 10)
        return d >= weekAgoStr && d <= todayStr
      }),
    [payments, weekAgoStr, todayStr]
  )

  // --- KPI ko'rsatkichlar ---
  const totalRooms = rooms.length
  const occupiedRooms = rooms.filter((r) =>
    ["OCCUPIED", "RESERVED"].includes(r.current_status)
  ).length
  const availableRooms = rooms.filter((r) => r.current_status === "AVAILABLE").length
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

  const activeReservations = reservations.filter((r) =>
    ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(r.status)
  ).length

  const todayIncome = weekPayments
    .filter((p) => String(p.payment_date || "").slice(0, 10) === todayStr)
    .reduce((s, p) => s + Number(p.amount || 0), 0)
  const totalRevenue = invoices.reduce((s, inv) => s + Number(inv.paid_amount || 0), 0)

  // --- 7 kunlik tushum grafigi ---
  const chartData = useMemo(() => {
    const byDate: Record<string, number> = {}
    for (const p of weekPayments) {
      const d = String(p.payment_date || "").slice(0, 10)
      byDate[d] = (byDate[d] || 0) + Number(p.amount || 0)
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i)
      const key = format(d, "yyyy-MM-dd")
      return { label: format(d, "dd.MM"), amount: byDate[key] || 0 }
    })
  }, [weekPayments])

  const weekTotal = chartData.reduce((s, d) => s + d.amount, 0)

  // --- Xonalar holati taqsimoti ---
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rooms) m[r.current_status] = (m[r.current_status] || 0) + 1
    return m
  }, [rooms])
  const presentStatuses = ROOM_STATUSES.filter((s) => statusCounts[s.key])

  // --- Bugungi kirish/chiqishlar va so'nggi bandlovlar ---
  const guestMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const g of guests) m[g.id] = `${g.first_name} ${g.last_name || ""}`.trim()
    return m
  }, [guests])

  const roomMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const r of rooms) m[r.id] = r.room_number
    return m
  }, [rooms])

  const arrivals = reservations.filter(
    (r) =>
      r.check_in_date === todayStr &&
      ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(r.status)
  )
  const departures = reservations.filter(
    (r) =>
      r.check_out_date === todayStr && ["CHECKED_IN", "CHECKED_OUT"].includes(r.status)
  )
  const recentReservations = useMemo(
    () =>
      [...reservations]
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
        .slice(0, 6),
    [reservations]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Boshqaruv paneli</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  const tiles = [
    {
      label: "Bugungi tushum",
      value: `${fmt(todayIncome)} So'm`,
      sub: `Jami tushum: ${fmt(totalRevenue)} So'm`,
      icon: Wallet,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Xonalar bandligi",
      value: `${occupancyRate}%`,
      sub: `Band: ${occupiedRooms} · Bo'sh: ${availableRooms} / ${totalRooms}`,
      icon: BedDouble,
      accent: "bg-blue-50 text-blue-600",
    },
    {
      label: "Faol bandlovlar",
      value: String(activeReservations),
      sub: `Bugun kirish: ${arrivals.length} · chiqish: ${departures.length}`,
      icon: CalendarCheck,
      accent: "bg-violet-50 text-violet-600",
    },
    {
      label: "Mehmonlar",
      value: String(guests.length),
      sub: "Bazada ro'yxatdan o'tgan",
      icon: Users,
      accent: "bg-amber-50 text-amber-600",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Boshqaruv paneli</h1>
        <p className="text-sm text-gray-500 mt-1">
          {format(new Date(), "yyyy-MM-dd")} holatiga ko'ra umumiy ko'rsatkichlar
        </p>
      </div>

      {/* KPI kartalar */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border bg-white p-4 flex items-start gap-3">
            <span
              className={cn(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                t.accent
              )}
            >
              <t.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{t.label}</p>
              <p className="text-xl font-bold text-gray-900 truncate">{t.value}</p>
              <p className="text-[11px] text-gray-400 truncate">{t.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tushum grafigi + xonalar holati */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-semibold text-gray-900">
                Oxirgi 7 kun tushumi
              </h2>
            </div>
            <span className="text-xs text-gray-500">
              Jami: <span className="font-semibold text-gray-900">{fmt(weekTotal)} So'm</span>
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v: number) =>
                    v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)
                  }
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Xonalar holati taqsimoti */}
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Xonalar holati</h2>
          {totalRooms === 0 ? (
            <p className="text-sm text-gray-400">Xonalar yo'q</p>
          ) : (
            <>
              {/* Segmentli gorizontal chiziq — ulushlar */}
              <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
                {presentStatuses.map((s) => (
                  <div
                    key={s.key}
                    title={`${s.label}: ${statusCounts[s.key]} ta`}
                    style={{
                      width: `${(statusCounts[s.key] / totalRooms) * 100}%`,
                      backgroundColor: s.color,
                    }}
                  />
                ))}
              </div>
              <div className="mt-4 space-y-2.5">
                {presentStatuses.map((s) => (
                  <div key={s.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-600">
                      <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
                      {s.label}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {statusCounts[s.key]}
                      <span className="ml-1 text-[11px] font-normal text-gray-400">
                        ({Math.round((statusCounts[s.key] / totalRooms) * 100)}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bugungi kirish/chiqishlar va so'nggi bandlovlar */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <LogIn className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-900">
              Bugungi kirishlar ({arrivals.length})
            </h2>
          </div>
          {arrivals.length === 0 ? (
            <p className="text-sm text-gray-400">Bugun kirishlar yo'q</p>
          ) : (
            <div className="space-y-2.5">
              {arrivals.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-900 truncate leading-tight">
                      {guestMap[r.guest_id] || r.reservation_number}
                    </p>
                    <p className="text-[11px] text-gray-400 leading-tight">
                      Xona: {roomMap[r.room_id] || "—"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full",
                      resStatusBadge[r.status] || resStatusBadge.PENDING
                    )}
                  >
                    {RES_STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <LogOut className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-gray-900">
              Bugungi chiqishlar ({departures.length})
            </h2>
          </div>
          {departures.length === 0 ? (
            <p className="text-sm text-gray-400">Bugun chiqishlar yo'q</p>
          ) : (
            <div className="space-y-2.5">
              {departures.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-900 truncate leading-tight">
                      {guestMap[r.guest_id] || r.reservation_number}
                    </p>
                    <p className="text-[11px] text-gray-400 leading-tight">
                      Xona: {roomMap[r.room_id] || "—"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full",
                      resStatusBadge[r.status] || resStatusBadge.PENDING
                    )}
                  >
                    {RES_STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck className="h-4 w-4 text-primary-600" />
            <h2 className="text-sm font-semibold text-gray-900">So'nggi bandlovlar</h2>
          </div>
          {recentReservations.length === 0 ? (
            <p className="text-sm text-gray-400">Bandlovlar yo'q</p>
          ) : (
            <div className="space-y-2.5">
              {recentReservations.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-900 truncate leading-tight">
                      {guestMap[r.guest_id] || r.reservation_number}
                    </p>
                    <p className="text-[11px] text-gray-400 leading-tight">
                      Xona: {roomMap[r.room_id] || "—"} · {r.check_in_date}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-semibold text-gray-900">
                    {fmt(r.total_amount)}{" "}
                    <span className="font-normal text-gray-400">So'm</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
