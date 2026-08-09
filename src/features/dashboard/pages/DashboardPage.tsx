import { useMemo } from "react"
import { format, subDays } from "date-fns"
import {
  BedDouble,
  Users,
  CalendarCheck,
  LogIn,
  LogOut,
  TrendingUp,
  TrendingDown,
  Store,
  ClipboardList,
  CalendarPlus,
  Sparkles,
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
import { useExpenses } from "@/features/expenses/api/expenses"
import { useShopSales } from "@/features/shop/api/shop"
import { useHousekeepingTasks } from "@/features/housekeeping/api/housekeeping"
import { useAuthStore } from "@/store/auth"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const fmt = (n: number) => Number(n || 0).toLocaleString()

// Sana sarlavhasi uchun o'zbekcha oy/hafta kunlari
const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
]
const UZ_DAYS = [
  "yakshanba", "dushanba", "seshanba", "chorshanba",
  "payshanba", "juma", "shanba",
]

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

// Grafik tooltip'i — minimal karta
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-900">{fmt(payload[0].value)} So'm</p>
    </div>
  )
}

// Ro'yxat panellari uchun umumiy karta qobig'i
function Panel({
  icon: Icon,
  iconClass,
  title,
  count,
  children,
}: {
  icon: any
  iconClass: string
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            iconClass
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-bold text-gray-900">
          {title}
          {count !== undefined && (
            <span className="ml-1.5 font-semibold text-gray-400">({count})</span>
          )}
        </h2>
      </div>
      {children}
    </div>
  )
}

export const DashboardPage = () => {
  const user = useAuthStore((s) => s.user)
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
  // Qo'shimcha statistika manbalari (ruxsat bo'lmasa jimgina 0 ko'rinadi)
  const { data: expenses = [] } = useExpenses(todayStr, todayStr)
  const { data: shopPaidToday = [] } = useShopSales(todayStr, todayStr, {
    dateBy: "paid",
    status: "PAID",
  })
  const { data: shopDebts = [] } = useShopSales(undefined, undefined, {
    status: "PENDING",
  })
  const { data: hkTasks = [] } = useHousekeepingTasks()

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

  // --- Qo'shimcha KPI'lar ---
  const todayExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const shopTodayRevenue = shopPaidToday.reduce(
    (s, x) => s + Number(x.total_amount || 0),
    0
  )
  const shopDebtTotal = shopDebts.reduce((s, x) => s + Number(x.total_amount || 0), 0)
  // Bugungi sof natija: bron to'lovlari + do'kon − xarajatlar
  const todayNet = todayIncome + shopTodayRevenue - todayExpenses

  // Bugun yaratilgan yangi bronlar (soatlik/kunlik kesimida)
  const createdToday = reservations.filter(
    (r) => String(r.created_at || "").slice(0, 10) === todayStr
  )
  const createdTodayHourly = createdToday.filter(
    (r) => r.booking_type === "HOURLY"
  ).length

  // Oxirgi 7 kunda qo'shilgan mehmonlar
  const newGuestsWeek = guests.filter(
    (g: any) => String(g.created_at || "").slice(0, 10) >= weekAgoStr
  ).length

  // Xo'jalik vazifalari: ochiq/jarayonda va bugun yakunlanganlar
  const openTasks = (hkTasks as any[]).filter((t) =>
    ["OPEN", "IN_PROGRESS"].includes(t.status)
  )
  const doneToday = (hkTasks as any[]).filter(
    (t) =>
      t.status === "COMPLETED" &&
      String(t.completed_at || "").slice(0, 10) === todayStr
  ).length

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const now = new Date()
  const dateLine = `${now.getDate()}-${UZ_MONTHS[now.getMonth()]}, ${UZ_DAYS[now.getDay()]}`

  const tiles = [
    {
      label: "Bugungi xarajat",
      value: `${fmt(todayExpenses)} So'm`,
      sub: `${expenses.length} ta chiqim`,
      icon: TrendingDown,
      accent: "bg-red-50 text-red-600",
    },
    {
      label: "Do'kon (bugun)",
      value: `${fmt(shopTodayRevenue)} So'm`,
      sub:
        shopDebtTotal > 0
          ? `Bronlarda qarz: ${fmt(shopDebtTotal)} So'm`
          : `${shopPaidToday.length} ta sotuv`,
      icon: Store,
      accent: "bg-violet-50 text-violet-600",
    },
    {
      label: "Faol bandlovlar",
      value: String(activeReservations),
      sub: `Bugun kirish: ${arrivals.length} · chiqish: ${departures.length}`,
      icon: CalendarCheck,
      accent: "bg-sky-50 text-sky-600",
    },
    {
      label: "Bugungi yangi bronlar",
      value: String(createdToday.length),
      sub: `Soatlik: ${createdTodayHourly} · Kunlik: ${createdToday.length - createdTodayHourly}`,
      icon: CalendarPlus,
      accent: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Mehmonlar",
      value: String(guests.length),
      sub: `Oxirgi 7 kunda: +${newGuestsWeek}`,
      icon: Users,
      accent: "bg-amber-50 text-amber-600",
    },
    {
      label: "Xo'jalik vazifalari",
      value: String(openTasks.length),
      sub: `Bugun bajarildi: ${doneToday}`,
      icon: ClipboardList,
      accent: "bg-orange-50 text-orange-600",
    },
  ]

  return (
    <div className="space-y-5">
      {/* HERO — salomlashuv + kunning asosiy 3 ko'rsatkichi */}
      <div className="relative overflow-hidden rounded-2xl bg-primary-700 p-5 text-white shadow-lg shadow-primary-600/20 sm:p-6">
        {/* Bezak doiralari */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/5" />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-white/70">
              <Sparkles className="h-3.5 w-3.5" />
              {dateLine}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Xush kelibsiz{user?.first_name ? `, ${user.first_name}` : ""}!
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {user?.hotel_name || "Mehmonxona"} bo'yicha bugungi umumiy holat
            </p>
          </div>

          {/* Kunning asosiy raqamlari — shisha chiplar */}
          <div className="flex flex-wrap gap-2.5">
            <div className="rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">
                Bugungi tushum
              </p>
              <p className="text-lg font-bold leading-tight">{fmt(todayIncome)} So'm</p>
              <p className="text-[10px] text-white/50">jami: {fmt(totalRevenue)}</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">
                Sof natija
              </p>
              <p
                className={cn(
                  "text-lg font-bold leading-tight",
                  todayNet < 0 && "text-red-200"
                )}
              >
                {fmt(todayNet)} So'm
              </p>
              <p className="text-[10px] text-white/50">tushum + do'kon − xarajat</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">
                Bandlik
              </p>
              <p className="text-lg font-bold leading-tight">{occupancyRate}%</p>
              <p className="text-[10px] text-white/50">
                band {occupiedRooms} · bo'sh {availableRooms} / {totalRooms}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI kartalar — wrap uslubida */}
      <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fit,minmax(235px,1fr))]">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="group rounded-2xl border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl",
                  t.accent
                )}
              >
                <t.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">{t.label}</p>
                <p className="truncate text-xl font-bold text-gray-900">{t.value}</p>
                <p className="truncate text-[11px] text-gray-400">{t.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tushum grafigi + xonalar holati */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 transition-shadow hover:shadow-md lg:col-span-2 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-gray-900">Oxirgi 7 kun tushumi</h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Jami: {fmt(weekTotal)} So'm
            </span>
          </div>
          <div className="h-56 sm:h-64">
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
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(59,130,246,0.06)" }} />
                <Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Xonalar holati taqsimoti */}
        <div className="rounded-2xl border bg-white p-4 transition-shadow hover:shadow-md sm:p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <BedDouble className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-gray-900">Xonalar holati</h2>
          </div>
          {totalRooms === 0 ? (
            <p className="text-sm text-gray-400">Xonalar yo'q</p>
          ) : (
            <>
              {/* Segmentli gorizontal chiziq — ulushlar */}
              <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full">
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
                    <span className="font-bold text-gray-900">
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

      {/* Bugungi kirish/chiqishlar, so'nggi bandlovlar va xo'jalik — wrap uslubida */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        <Panel
          icon={LogIn}
          iconClass="bg-emerald-50 text-emerald-600"
          title="Bugungi kirishlar"
          count={arrivals.length}
        >
          {arrivals.length === 0 ? (
            <p className="text-sm text-gray-400">Bugun kirishlar yo'q</p>
          ) : (
            <div className="space-y-2.5">
              {arrivals.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600">
                      {roomMap[r.room_id] || "—"}
                    </span>
                    <p className="truncate leading-tight text-gray-900">
                      {guestMap[r.guest_id] || r.reservation_number}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      resStatusBadge[r.status] || resStatusBadge.PENDING
                    )}
                  >
                    {RES_STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          icon={LogOut}
          iconClass="bg-amber-50 text-amber-600"
          title="Bugungi chiqishlar"
          count={departures.length}
        >
          {departures.length === 0 ? (
            <p className="text-sm text-gray-400">Bugun chiqishlar yo'q</p>
          ) : (
            <div className="space-y-2.5">
              {departures.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600">
                      {roomMap[r.room_id] || "—"}
                    </span>
                    <p className="truncate leading-tight text-gray-900">
                      {guestMap[r.guest_id] || r.reservation_number}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      resStatusBadge[r.status] || resStatusBadge.PENDING
                    )}
                  >
                    {RES_STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          icon={CalendarCheck}
          iconClass="bg-primary-50 text-primary-600"
          title="So'nggi bandlovlar"
        >
          {recentReservations.length === 0 ? (
            <p className="text-sm text-gray-400">Bandlovlar yo'q</p>
          ) : (
            <div className="space-y-2.5">
              {recentReservations.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600">
                      {roomMap[r.room_id] || "—"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate leading-tight text-gray-900">
                        {guestMap[r.guest_id] || r.reservation_number}
                      </p>
                      <p className="text-[11px] leading-tight text-gray-400">
                        {r.check_in_date}
                      </p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-xs font-bold text-gray-900">
                    {fmt(r.total_amount)}{" "}
                    <span className="font-normal text-gray-400">So'm</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          icon={ClipboardList}
          iconClass="bg-orange-50 text-orange-600"
          title="Xo'jalik vazifalari"
          count={openTasks.length}
        >
          {openTasks.length === 0 ? (
            <p className="text-sm text-gray-400">Ochiq vazifalar yo'q</p>
          ) : (
            <div className="space-y-2.5">
              {openTasks.slice(0, 6).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600">
                      {roomMap[t.room_id] || t.room?.room_number || "—"}
                    </span>
                    <p className="truncate leading-tight text-gray-900">
                      {t.task_type === "CLEANING"
                        ? "Tozalash"
                        : t.task_type === "DEEP_CLEANING"
                          ? "Chuqur tozalash"
                          : t.task_type === "MAINTENANCE"
                            ? "Ta'mir"
                            : t.task_type === "INSPECTION"
                              ? "Tekshiruv"
                              : t.task_type || "Vazifa"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      t.status === "IN_PROGRESS"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {t.status === "IN_PROGRESS" ? "Jarayonda" : "Ochiq"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
