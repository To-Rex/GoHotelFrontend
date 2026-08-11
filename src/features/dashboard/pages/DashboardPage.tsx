import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
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
  History,
  Wallet,
  Trophy,
  ArrowRight,
  ArrowRightLeft,
  Clock,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  LabelList,
} from "recharts"
import { useRooms } from "@/features/rooms/api/rooms"
import { useReservations } from "@/features/reservations/api/reservations"
import { useGuests } from "@/features/guests/api/guests"
import { useInvoices, usePayments } from "@/features/finance/api/finance"
import { useExpenses } from "@/features/expenses/api/expenses"
import { useShopSales } from "@/features/shop/api/shop"
import { useHousekeepingTasks } from "@/features/housekeeping/api/housekeeping"
import { useShiftSettings, useShiftHistory } from "@/features/shifts/api/shifts"
import { useEmployees } from "@/features/employees/api/employees"
import { useAuthStore } from "@/store/auth"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const fmt = (n: number) => Number(n || 0).toLocaleString()

// Raqamlarning "sanab chiqish" animatsiyasi (ease-out, ~0.9s).
// Qiymat yangilanganda 0 dan emas, ko'rinib turgan qiymatdan davom etadi.
const useCountUp = (target: number, duration = 900): number => {
  const [val, setVal] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    // Harakat kamaytirilgan rejimda darhol yakuniy qiymat ko'rsatiladi
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = target
      setVal(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const from = fromRef.current
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = Math.round(from + (target - from) * eased)
      setVal(v)
      fromRef.current = v
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

// Kun vaqtiga qarab salomlashuv
const greetingByHour = (h: number): string =>
  h >= 5 && h < 11
    ? "Xayrli tong"
    : h >= 11 && h < 17
      ? "Xayrli kun"
      : h >= 17 && h < 22
        ? "Xayrli oqshom"
        : "Xayrli tun"

// "Necha vaqtdan beri" yorlig'i — smenalar paneli uchun
const sinceLabel = (iso: string | null | undefined): string => {
  if (!iso) return "—"
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h} s ${m} d` : `${m} d`
}

// Bugungi to'lov usullari guruhlash (naqd/karta/o'tkazma/boshqa)
const METHOD_GROUPS = [
  { key: "CASH", label: "Naqd", color: "#10b981", dot: "bg-emerald-500" },
  { key: "CARD", label: "Karta", color: "#3b82f6", dot: "bg-blue-500" },
  { key: "TRANSFER", label: "O'tkazma", color: "#8b5cf6", dot: "bg-violet-500" },
  { key: "OTHER", label: "Boshqa", color: "#94a3b8", dot: "bg-slate-400" },
]
const methodGroupKey = (m: string): string =>
  m === "CASH"
    ? "CASH"
    : m === "CREDIT_CARD" || m === "DEBIT_CARD"
      ? "CARD"
      : m === "BANK_TRANSFER"
        ? "TRANSFER"
        : "OTHER"

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
  { key: "CLEANING", label: "Tozalanmoqda", color: "#06b6d4", dot: "bg-cyan-500" },
  { key: "MAINTENANCE", label: "Ta'mirda", color: "#64748b", dot: "bg-slate-500" },
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
  PENDING: "bg-violet-100 text-violet-700",
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

// Ro'yxat panellari uchun umumiy karta qobig'i: bosqichli kirish animatsiyasi,
// hover'da yengil ko'tarilish va ikonkaning jonlanishi (landing uslubida)
function Panel({
  icon: Icon,
  iconClass,
  title,
  count,
  delay = 0,
  children,
}: {
  icon: any
  iconClass: string
  title: string
  count?: number
  delay?: number
  children: React.ReactNode
}) {
  return (
    <div
      className="group animate-dash-rise rounded-2xl border bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${340 + delay}ms` }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2.5 text-sm font-bold text-gray-900">
          <span
            className={cn(
              "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110",
              iconClass
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="truncate">{title}</span>
        </h2>
        {count !== undefined && (
          <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
            {count}
          </span>
        )}
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

  // Smenalar (faqat kassali rejimda, har daqiqada yangilanadi) va xodimlar
  const { data: shiftSettings } = useShiftSettings()
  const cashMode = shiftSettings?.mode === "cash"
  const { data: shiftSessions = [], isError: shiftsError } = useShiftHistory(
    100,
    cashMode,
    60_000
  )
  const { data: employeesList = [] } = useEmployees()

  // "jonli" davomiylik yorliqlari har daqiqada qayta hisoblanishi uchun tick
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!cashMode) return
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [cashMode])

  // Sarlavhadagi jonli soat (HH:mm) — bir xil qiymatda React qayta render
  // qilmaydi, shuning uchun soniyalik tekshiruv arzon
  const [clock, setClock] = useState(() => format(new Date(), "HH:mm"))
  useEffect(() => {
    const id = setInterval(() => setClock(format(new Date(), "HH:mm")), 1_000)
    return () => clearInterval(id)
  }, [])

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
  // Eng yuqori kun — grafikda faqat shu ustun ustiga qiymat yoziladi
  // (dataviz qoidasi: har nuqtaga emas, tanlab to'g'ridan-to'g'ri yorliq)
  const weekMax = Math.max(...chartData.map((d) => d.amount), 0)

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

  // --- Smenalar (kassali rejim): hozir ishlayotganlar, topshirilmoqda, bugungi yopilganlar ---
  const activeShifts = shiftSessions.filter((s) => s.status === "ACTIVE")
  const pendingShifts = shiftSessions.filter((s) => s.status === "PENDING_HANDOVER")
  // MAHALLIY sana bo'yicha (UTC slice emas — tungi smenalar tushib qolmasligi uchun)
  const closedTodayShifts = shiftSessions.filter(
    (s) =>
      s.status === "CLOSED" &&
      s.ended_at &&
      format(new Date(s.ended_at), "yyyy-MM-dd") === todayStr
  )
  const closedTodayCounted = closedTodayShifts.reduce(
    (sum, s) => sum + Number(s.counted_cash || 0),
    0
  )
  const diffTodayShifts = closedTodayShifts.filter(
    (s) => Number(s.cash_diff || 0) !== 0
  )

  // --- Bugungi to'lov usullari taqsimoti ---
  const methodSplit = useMemo(() => {
    const sums: Record<string, { count: number; total: number }> = {}
    for (const p of weekPayments) {
      if (String(p.payment_date || "").slice(0, 10) !== todayStr) continue
      const key = methodGroupKey(String(p.payment_method || ""))
      sums[key] = sums[key] || { count: 0, total: 0 }
      sums[key].count += 1
      sums[key].total += Number(p.amount || 0)
    }
    return METHOD_GROUPS.map((g) => ({
      ...g,
      ...(sums[g.key] || { count: 0, total: 0 }),
    })).filter((g) => g.count > 0)
  }, [weekPayments, todayStr])
  const methodTotal = methodSplit.reduce((s, g) => s + g.total, 0)

  // --- Eng faol xodimlar (bugun yaratilgan bronlar bo'yicha) ---
  const topStaff = useMemo(() => {
    if (createdToday.length === 0) return []
    const names: Record<string, string> = {}
    for (const e of employeesList) names[e.id] = `${e.first_name} ${e.last_name}`
    const agg: Record<string, { count: number; total: number }> = {}
    for (const r of createdToday) {
      if (r.status === "CANCELLED" || !r.created_by) continue
      agg[r.created_by] = agg[r.created_by] || { count: 0, total: 0 }
      agg[r.created_by].count += 1
      agg[r.created_by].total += Number(r.total_amount || 0)
    }
    return Object.entries(agg)
      .map(([id, v]) => ({ id, name: names[id] || "Xodim", ...v }))
      .sort((a, b) => b.count - a.count || b.total - a.total)
      .slice(0, 4)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, employeesList, todayStr])

  // Asosiy raqamlar "sanab chiqish" animatsiyasi bilan ko'rsatiladi
  const incomeAnim = useCountUp(todayIncome)
  const netAnim = useCountUp(todayNet)
  const occupancyAnim = useCountUp(occupancyRate, 700)

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
  const greeting = greetingByHour(now.getHours())

  const tiles = [
    {
      label: "Bugungi xarajat",
      value: `${fmt(todayExpenses)} So'm`,
      sub: `${expenses.length} ta chiqim`,
      icon: TrendingDown,
      iconClass: "text-red-500",
      bar: "bg-red-500",
    },
    {
      label: "Do'kon (bugun)",
      value: `${fmt(shopTodayRevenue)} So'm`,
      sub:
        shopDebtTotal > 0
          ? `Bronlarda qarz: ${fmt(shopDebtTotal)} So'm`
          : `${shopPaidToday.length} ta sotuv`,
      icon: Store,
      iconClass: "text-violet-600",
      bar: "bg-violet-500",
    },
    {
      label: "Faol bandlovlar",
      value: String(activeReservations),
      sub: `Bugun kirish: ${arrivals.length} · chiqish: ${departures.length}`,
      icon: CalendarCheck,
      iconClass: "text-sky-600",
      bar: "bg-sky-500",
    },
    {
      label: "Bugungi yangi bronlar",
      value: String(createdToday.length),
      sub: `Soatlik: ${createdTodayHourly} · Kunlik: ${createdToday.length - createdTodayHourly}`,
      icon: CalendarPlus,
      iconClass: "text-indigo-600",
      bar: "bg-indigo-500",
    },
    {
      label: "Mehmonlar",
      value: String(guests.length),
      sub: `Oxirgi 7 kunda: +${newGuestsWeek}`,
      icon: Users,
      iconClass: "text-emerald-600",
      bar: "bg-emerald-500",
    },
    {
      label: "Xo'jalik vazifalari",
      value: String(openTasks.length),
      sub: `Bugun bajarildi: ${doneToday}`,
      icon: ClipboardList,
      iconClass: "text-slate-600",
      bar: "bg-slate-500",
    },
  ]

  return (
    <div className="space-y-5">
      {/* SARLAVHA — tipografik: salomlashuv, sana va jonli soat */}
      <div className="animate-dash-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            {dateLine}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl 2xl:text-4xl">
            {greeting}
            {user?.first_name ? `, ${user.first_name}` : ""}!
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {user?.hotel_name || "Mehmonxona"} — bugungi holat bir qarashda
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-4xl 2xl:text-5xl">
            {clock}
          </p>
          <p className="text-[11px] text-gray-400">mahalliy vaqt</p>
        </div>
      </div>

      {/* ASOSIY RAQAMLAR REYKASI — sanab chiquvchi animatsiya bilan */}
      <div
        className="animate-dash-rise grid divide-y divide-gray-100 overflow-hidden rounded-2xl border bg-white lg:grid-cols-3 lg:divide-x lg:divide-y-0"
        style={{ animationDelay: "60ms" }}
      >
        <div className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-gray-50/70 sm:p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Bugungi tushum
            </p>
            <p className="mt-1 truncate text-2xl font-bold tabular-nums tracking-tight 2xl:text-3xl text-gray-900">
              {fmt(incomeAnim)}
              <span className="ml-1 text-sm font-medium text-gray-400">So'm</span>
            </p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              jami tushum: {fmt(totalRevenue)} So'm
            </p>
          </div>
          {/* 7 kunlik mini-trend — faqat keng ekranlarda (raqam qirqilmasligi uchun) */}
          <div className="hidden h-10 w-24 flex-shrink-0 xl:block">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 transition-colors hover:bg-gray-50/70 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Sof natija
          </p>
          <p
            className={cn(
              "mt-1 truncate text-2xl font-bold tabular-nums tracking-tight 2xl:text-3xl",
              todayNet < 0 ? "text-red-600" : "text-emerald-600"
            )}
          >
            {fmt(netAnim)}
            <span className="ml-1 text-sm font-medium text-gray-400">So'm</span>
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            tushum + do'kon − xarajat
          </p>
        </div>

        <div className="p-4 transition-colors hover:bg-gray-50/70 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Bandlik
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight 2xl:text-3xl text-gray-900">
            {occupancyAnim}
            <span className="text-sm font-medium text-gray-400">%</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-700"
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            band {occupiedRooms} · bo'sh {availableRooms} / {totalRooms} xona
          </p>
        </div>
      </div>

      {/* KPI kartalar — chiziqli aksent uslubi, bosqichma-bosqich chiqadi */}
      <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fit,minmax(235px,1fr))]">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className="group animate-dash-rise rounded-2xl border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: `${120 + i * 55}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-gray-500">{t.label}</p>
              <t.icon
                className={cn(
                  "h-4 w-4 flex-shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-125",
                  t.iconClass
                )}
              />
            </div>
            <p className="mt-1.5 truncate text-2xl font-bold tracking-tight text-gray-900 2xl:text-3xl">
              {t.value}
            </p>
            {/* Rang aksenti — hover'da cho'ziladigan chiziq */}
            <div
              className={cn(
                "mt-2 h-1 w-8 rounded-full transition-all duration-300 group-hover:w-16",
                t.bar
              )}
            />
            <p className="mt-1.5 truncate text-[11px] text-gray-400">{t.sub}</p>
          </div>
        ))}
      </div>

      {/* Tushum grafigi + xonalar holati */}
      <div
        className="animate-dash-rise grid gap-4 lg:grid-cols-3"
        style={{ animationDelay: "220ms" }}
      >
        <div className="rounded-2xl border bg-white p-4 transition-shadow hover:shadow-md lg:col-span-2 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2.5 text-sm font-bold text-gray-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </span>
              Oxirgi 7 kun tushumi
            </h2>
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
                <Bar
                  dataKey="amount"
                  fill="#2563eb"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                  activeBar={{ fill: "#1d4ed8" }}
                >
                  {/* Faqat eng yuqori kunga qiymat yorlig'i */}
                  <LabelList
                    dataKey="amount"
                    content={(props: any) => {
                      const { x, y, width, value } = props
                      if (!value || value !== weekMax) return null
                      return (
                        <text
                          x={Number(x) + Number(width) / 2}
                          y={Number(y) - 7}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={700}
                          fill="#9ca3af"
                        >
                          {value >= 1000000
                            ? `${(value / 1000000).toFixed(1)}M`
                            : value >= 1000
                              ? `${Math.round(value / 1000)}K`
                              : String(value)}
                        </text>
                      )
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Xonalar holati taqsimoti */}
        <div className="rounded-2xl border bg-white p-4 transition-shadow hover:shadow-md sm:p-5">
          <div className="mb-3">
            <h2 className="flex items-center gap-2.5 text-sm font-bold text-gray-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <BedDouble className="h-4 w-4" />
              </span>
              Xonalar holati
            </h2>
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
                    className="transition-all duration-700"
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

      {/* SMENALAR — jonli holat (faqat kassali rejimda; so'rov xatosida yashirinadi) */}
      {cashMode && !shiftsError && (
        <div
          className="animate-dash-rise overflow-hidden rounded-2xl border bg-white"
          style={{ animationDelay: "280ms" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <h2 className="flex items-center gap-2.5 text-sm font-bold text-gray-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <History className="h-4 w-4" />
                </span>
                Smenalar
              </h2>
              {activeShifts.length > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  jonli
                </span>
              )}
            </div>
            <Link
              to="/shifts"
              className="flex items-center gap-1 text-xs font-medium text-primary-600 transition-colors hover:text-primary-700"
            >
              Barchasi
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid divide-y divide-gray-100 md:grid-cols-3 md:divide-x md:divide-y-0">
            {/* Hozir ishlamoqda */}
            <div className="p-4">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Hozir ishlamoqda · {activeShifts.length}
              </p>
              {activeShifts.length === 0 ? (
                <p className="text-sm text-gray-400">Ochiq smena yo'q</p>
              ) : (
                <div className="space-y-2.5">
                  {activeShifts.slice(0, 4).map((s) => (
                    <div key={s.id} className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                        {(s.user_name || "?")
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight text-gray-900">
                          {s.user_name}
                          {s.continue_after_end && (
                            <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                              qo'shimcha vaqt
                            </span>
                          )}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] leading-tight text-gray-400">
                          <Clock className="h-3 w-3" />
                          {s.started_at
                            ? format(new Date(s.started_at), "HH:mm")
                            : "—"}{" "}
                          dan beri · {sinceLabel(s.started_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Topshirilmoqda */}
            <div className="p-4">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Topshirilmoqda · {pendingShifts.length}
              </p>
              {pendingShifts.length === 0 ? (
                <p className="text-sm text-gray-400">Topshirilayotgan smena yo'q</p>
              ) : (
                <div className="space-y-2.5">
                  {pendingShifts.slice(0, 4).map((s) => (
                    <div key={s.id} className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight text-gray-900">
                          {s.user_name}
                        </p>
                        <p className="text-[11px] leading-tight text-violet-600">
                          Keyingi xodim qabul qilishi kutilmoqda
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bugun yopilgan */}
            <div className="p-4">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Bugun yopilgan · {closedTodayShifts.length}
              </p>
              {closedTodayShifts.length === 0 ? (
                <p className="text-sm text-gray-400">Bugun yopilgan smena yo'q</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Jami sanalgan:{" "}
                    <span className="font-bold text-gray-900">
                      {fmt(closedTodayCounted)} So'm
                    </span>
                  </p>
                  {diffTodayShifts.length === 0 ? (
                    <p className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      Barcha kassalar farqsiz topshirildi
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {diffTodayShifts.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs"
                        >
                          <span className="truncate font-medium text-red-700">
                            {s.user_name}
                          </span>
                          <span className="flex-shrink-0 font-bold tabular-nums text-red-600">
                            {fmt(Number(s.cash_diff || 0))} So'm
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          iconClass="bg-sky-50 text-sky-600"
          title="Bugungi chiqishlar"
          count={departures.length}
          delay={60}
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
          delay={120}
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

        {/* Bugungi to'lov usullari taqsimoti */}
        <Panel
          icon={Wallet}
          iconClass="bg-blue-50 text-blue-600"
          title="To'lov usullari (bugun)"
          delay={180}
        >
          {methodSplit.length === 0 ? (
            <p className="text-sm text-gray-400">Bugun to'lovlar yo'q</p>
          ) : (
            <>
              {/* Segmentli ulush chizig'i */}
              <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full">
                {methodSplit.map((g) => (
                  <div
                    key={g.key}
                    title={`${g.label}: ${fmt(g.total)} So'm`}
                    style={{
                      width: `${(g.total / (methodTotal || 1)) * 100}%`,
                      backgroundColor: g.color,
                    }}
                  />
                ))}
              </div>
              <div className="mt-4 space-y-2.5">
                {methodSplit.map((g) => (
                  <div
                    key={g.key}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2 text-gray-600">
                      <span className={cn("h-2.5 w-2.5 rounded-full", g.dot)} />
                      {g.label}
                      <span className="text-[11px] text-gray-400">
                        {g.count} ta
                      </span>
                    </span>
                    <span className="font-bold tabular-nums text-gray-900">
                      {fmt(g.total)}
                      <span className="ml-1 text-[11px] font-normal text-gray-400">
                        ({Math.round((g.total / (methodTotal || 1)) * 100)}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        {/* Eng faol xodimlar — xodimlar ro'yxati ochiq bo'lgandagina (aks
            holda ismlar noma'lum bo'lib qolardi) */}
        {employeesList.length > 0 && (
        <Panel
          icon={Trophy}
          iconClass="bg-violet-50 text-violet-600"
          title="Eng faol xodimlar (bugun)"
          delay={240}
        >
          {topStaff.length === 0 ? (
            <p className="text-sm text-gray-400">Bugun bronlar yaratilmagan</p>
          ) : (
            <div className="space-y-2.5">
              {topStaff.map((st, i) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                        i === 0
                          ? "bg-primary-100 text-primary-700"
                          : i === 1
                            ? "bg-gray-200 text-gray-600"
                            : i === 2
                              ? "bg-sky-100 text-sky-700"
                              : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate leading-tight text-gray-900">{st.name}</p>
                      <p className="text-[11px] leading-tight text-gray-400">
                        {st.count} ta bron
                      </p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-xs font-bold tabular-nums text-gray-900">
                    {fmt(st.total)}{" "}
                    <span className="font-normal text-gray-400">So'm</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        )}

        <Panel
          icon={ClipboardList}
          iconClass="bg-slate-100 text-slate-600"
          title="Xo'jalik vazifalari"
          count={openTasks.length}
          delay={300}
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
                        : "bg-violet-100 text-violet-700"
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
