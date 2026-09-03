import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
  FileBarChart,
  CalendarCheck,
  Wallet,
  TrendingDown,
  TrendingUp,
  Banknote,
  Store,
  AlertCircle,
  LayoutDashboard,
} from "lucide-react"
import { useShopSales, type ShopSale } from "@/features/shop/api/shop"
import { DebtorsPanel } from "@/features/finance/components/DebtorsPanel"
import { useMyReport, METHOD_COLUMNS } from "../api/myReport"
import { SortableHead, TablePager, TableSearch } from "@/components/ui/table-tools"
import {
  initialTableState,
  setSearch,
  tableView,
  toggleSort,
  type TableState,
} from "@/lib/tableState"
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
import { buildDatePresets, resolveDateRange } from "@/lib/datePresets"

/* Shaxsiy hisobot: joriy xodimning tanlangan kunlardagi ishi.

   Barcha ko'rsatkichlar SERVERDA hisoblanadi (`/reports/my-summary`). Ilgari
   sahifa butun mehmonxonaning eng yangi 500 ta bronini yuklab, brauzerda
   filtrlar edi — bunda 500 tadan keyingi yozuvlar jimgina tushib qolar,
   "bugun" har bo'limda boshqa ma'noni bildirar, eng muhimi pul bronni KIM
   YARATGANIGA qarab yozilardi. Endi pul to'lovning o'zidan olinadi, ya'ni
   kassa hisobidagi ta'rif bilan bir xil.

   Sahifa `/finance` dagidek BO'LIMLARGA ajratilgan: keng ekranda chapda
   yopishib turadigan menyu, tor ekranda tepada aylanadigan qator. Ilgari
   hamma jadval bitta uzun sahifada chizilardi — yozuvlar ko'payganda
   kerakli narsani topish uchun sahifani oxirigacha aylantirish kerak edi.
   Endi faqat ochilgan bo'lim chiziladi. */

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

const SECTIONS = [
  {
    key: "overview",
    label: "Umumiy",
    desc: "Davr yakuni, qarzdorlarim va pul harakati usullar bo'yicha",
    icon: LayoutDashboard,
    iconClass: "bg-primary-50 text-primary-600",
  },
  {
    key: "reservations",
    label: "Bronlarim",
    desc: "Tanlangan davrda siz yaratgan bronlar",
    icon: CalendarCheck,
    iconClass: "bg-blue-50 text-blue-600",
  },
  {
    key: "shop",
    label: "Do'kon sotuvlarim",
    desc: "Siz qayd etgan do'kon savdolari — to'langan va brondagilar",
    icon: Store,
    iconClass: "bg-violet-50 text-violet-600",
  },
  {
    key: "expenses",
    label: "Xarajatlarim",
    desc: "Siz kiritgan chiqimlar",
    icon: TrendingDown,
    iconClass: "bg-red-50 text-red-600",
  },
] as const

type SectionKey = (typeof SECTIONS)[number]["key"]

/**
 * Bo'lim menyusi — `/finance` sahifasidagi bilan bir xil ko'rinish.
 *
 * Yonidagi son — o'sha bo'limda nechta yozuv borligi. Xodim bo'limni
 * ochmasdan turib unda ish bor-yo'qligini ko'radi. Tor ekranda son
 * berkitiladi: u yerda qator siqilib qolardi.
 */
function ReportNav({
  active,
  onSelect,
  counts,
}: {
  active: SectionKey
  onSelect: (key: SectionKey) => void
  counts: Partial<Record<SectionKey, number>>
}) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:w-60 lg:flex-shrink-0 lg:flex-col lg:overflow-visible lg:pb-0">
      {SECTIONS.map((s) => {
        const isActive = active === s.key
        const count = counts[s.key]
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors lg:w-full",
              isActive
                ? "border-primary-300 bg-primary-50/60 text-primary-800"
                : "border-transparent text-gray-600 hover:bg-gray-100"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                s.iconClass
              )}
            >
              <s.icon className="h-4 w-4" />
            </span>
            <span className="whitespace-nowrap text-sm font-medium lg:whitespace-normal">
              {s.label}
            </span>
            {count !== undefined && (
              <span
                className={cn(
                  "ml-auto hidden flex-shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums lg:inline",
                  isActive
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-100 text-gray-500"
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

/* Saralanadigan ustun sarlavhasi.

   Komponent BITTA va barqaror: jadval holati unga props bo'lib beriladi.
   Har jadval uchun alohida komponent yasalsa (masalan `useMemo` ichida)
   uning identifikatori har holat o'zgarishida yangilanardi va React
   `<th>` ni qayta o'rnatib, saralash tugmasidan fokusni olib tashlardi. */
function SortHead({
  state,
  setState,
  column,
  align,
  children,
}: {
  state: TableState
  setState: React.Dispatch<React.SetStateAction<TableState>>
  column: string
  align?: "left" | "right"
  children: React.ReactNode
}) {
  return (
    <SortableHead
      column={column}
      active={state.sortBy}
      dir={state.sortDir}
      align={align}
      onSort={(c) => setState((t) => toggleSort(t, c))}
    >
      {children}
    </SortableHead>
  )
}

export const MyReportsPage = () => {
  const user = useAuthStore((s) => s.user)

  // Sana har renderda qayta hisoblanadi: sahifa yarim tundan o'tib ochiq
  // qolsa ham "Bugun" haqiqiy bugunni bildiradi
  const todayStr = format(new Date(), "yyyy-MM-dd")

  /* Tanlangan davr kalit sifatida saqlanadi, sanalarga qarab topilmaydi —
     ikki tugma bir xil oraliq berganda tanlov noto'g'ri tugmada qolardi.
     Izoh `lib/datePresets.ts` da. "Barcha davr" bu sahifada yo'q:
     `/reports/my-summary` sanasiz ishlamaydi. */
  const [presetKey, setPresetKey] = useState<string | null>("today")
  const [custom, setCustom] = useState({ from: todayStr, to: todayStr })
  const [section, setSection] = useState<SectionKey>("overview")

  /* Har jadvalning o'z qidiruvi, saralashi va sahifasi.

     Bu ro'yxatlar serverdan TO'LIQ keladi (shaxsiy hisobot bitta xodimning
     bitta davri), shuning uchun ish brauzerda bajariladi. Ko'rinish va
     boshqaruv moliya sahifasidagi jadvallar bilan bir xil — xodim
     bittasini o'rgansa qolganini ham biladi. */
  const [resTable, setResTable] = useState<TableState>(() =>
    initialTableState("created_at")
  )
  const [shopTable, setShopTable] = useState<TableState>(() =>
    initialTableState("created_at")
  )
  const [expTable, setExpTable] = useState<TableState>(() =>
    initialTableState("expense_date")
  )

  const presets = useMemo(
    () =>
      buildDatePresets(new Date(todayStr), { withYesterday: true }).filter(
        (p) => p.key !== "all"
      ),
    [todayStr]
  )
  const { from: dateFrom, to: dateTo } = resolveDateRange(
    presets,
    presetKey,
    custom
  )

  const selectPreset = (p: { key: string; from: string; to: string }) => {
    setPresetKey(p.key)
    setCustom({ from: p.from, to: p.to })
  }

  const editRange = (next: { from: string; to: string }) => {
    setCustom(next)
    setPresetKey(null)
  }

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
  const netPositive = netTotal >= 0

  const loadError = reportError || shopError

  // Yuklanayotganda ko'rsatkichlar NOL emas, "—" bo'ladi: nol ham haqiqiy
  // qiymat, uni yuklanish holatidan ajratib bo'lmasa xodim "hech narsa
  // qilmabman" degan xulosaga keladi
  const stat = (value: number) => (isLoading ? "—" : fmt(value))
  const count = (value: number) => (isLoading ? "—" : String(value))

  const activeSection = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0]

  // Har jadvalning holati sarlavhaga shu juftlik orqali uzatiladi
  const resHead = { state: resTable, setState: setResTable }
  const shopHead = { state: shopTable, setState: setShopTable }
  const expHead = { state: expTable, setState: setExpTable }

  /* Ko'rinadigan qatorlar — qidiruv, saralash va sahifalashdan keyin.
     Kartochkalardagi raqamlar bu yerdan OLINMAYDI: ular serverdan
     keladi, ya'ni qidiruv yig'indini o'zgartirmaydi. */
  const resView = useMemo(
    () =>
      tableView(myReservations, resTable, {
        search: [
          (r) => r.guest_name,
          (r) => r.reservation_number,
          (r) => r.room_number,
        ],
        sort: {
          created_at: (r) => r.created_at,
          reservation_number: (r) => r.reservation_number,
          guest_name: (r) => r.guest_name,
          room_number: (r) => r.room_number,
          status: (r) => r.status,
          total_amount: (r) => r.total_amount,
          paid_amount: (r) => r.paid_amount,
        },
      }),
    [myReservations, resTable]
  )

  const shopView = useMemo(
    () =>
      tableView(myShopSales, shopTable, {
        search: [
          (x) => x.reservation_number,
          (x) => x.guest_name,
          (x) => x.items.map((i) => i.product_name).join(" "),
        ],
        sort: {
          created_at: (x) => x.created_at,
          reservation_number: (x) => x.reservation_number,
          status: (x) => x.status,
          total_amount: (x) => x.total_amount,
        },
      }),
    [myShopSales, shopTable]
  )

  const expView = useMemo(
    () =>
      tableView(myExpenses, expTable, {
        search: [(e) => e.title, (e) => e.category, (e) => e.notes],
        sort: {
          expense_date: (e) => e.expense_date,
          title: (e) => e.title,
          category: (e) => e.category,
          payment_method: (e) => e.payment_method,
          amount: (e) => e.amount,
        },
      }),
    [myExpenses, expTable]
  )

  /* Hisobot kartalari `/finance` uslubida: chapda rangli belgi, o'ngda
     nom-qiymat-izoh. Sof natija kartalar orasida emas — u ularning xulosasi,
     shuning uchun pastda to'liq kenglikdagi alohida panelda. */
  const cards = [
    {
      label: "Yaratgan bronlarim",
      value: `${count(resCount)} ta`,
      sub:
        cancelledCount > 0
          ? `shundan ${cancelledCount} tasi bekor qilingan`
          : "tanlangan davrda",
      icon: CalendarCheck,
      accent: "bg-blue-50 text-blue-600",
    },
    {
      label: "Bronlar summasi",
      value: `${stat(resTotal)} So'm`,
      sub: "bekor qilinganlarsiz · bu shartnoma qiymati, pul emas",
      icon: Wallet,
      accent: "bg-sky-50 text-sky-600",
    },
    {
      label: "Qabul qilgan to'lovlarim",
      value: `${stat(collected)} So'm`,
      sub:
        `naqd ${fmt(collectedCash)}` +
        (refunds > 0 ? ` · qaytarilgan ${fmt(refunds)}` : ""),
      icon: Banknote,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Do'kon sotuvlarim",
      value: `${stat(shopTotal)} So'm`,
      sub:
        `${shopCount} ta to'langan` +
        (shopPendingCount > 0
          ? ` · bronda ${shopPendingCount} ta: ${fmt(shopPendingTotal)}`
          : ""),
      icon: Store,
      accent: "bg-violet-50 text-violet-600",
    },
    {
      label: "Xarajatlarim",
      value: `${stat(expTotal)} So'm`,
      sub: `${expCount} ta yozuv`,
      icon: TrendingDown,
      accent: "bg-red-50 text-red-600",
    },
    {
      label: "Jami tushum",
      value: `${stat(incomeTotal)} So'm`,
      sub: `to'lovlar + do'kon · naqd qoldiq ${fmt(netCash)}`,
      icon: TrendingUp,
      accent: "bg-emerald-50 text-emerald-600",
    },
  ]

  return (
    <div className="space-y-6">
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
      </div>

      {/* Davr tanlash: tez tugmalar + "dan / gacha" sanalar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => selectPreset(p)}
              aria-pressed={presetKey === p.key}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                presetKey === p.key
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
              onChange={(e) => editRange({ from: e.target.value, to: dateTo })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Sanagacha</label>
            <Input
              type="date"
              className="w-40"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => editRange({ from: dateFrom, to: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Ma'lumot kelmasa — nol emas, sabab ko'rsatiladi */}
      {loadError && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          Hisobotni yuklab bo'lmadi: {apiErrorMessage(loadError)}
        </p>
      )}

      {/* BO'LIM MENYUSI va tanlangan bo'lim — faqat ochilgani chiziladi */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <ReportNav
          active={section}
          onSelect={setSection}
          counts={{
            reservations: resCount,
            shop: myShopSales.length,
            expenses: expCount,
          }}
        />

        <div className="min-w-0 flex-1 space-y-4">
          {/* Bo'lim sarlavhasi — nima ko'rsatilayotgani bir qatorda */}
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900">
              {activeSection.label}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">{activeSection.desc}</p>
          </div>

          {section === "overview" && (
            <div className="space-y-6">
              {/* Ko'rsatkich kartalari. Yon menyu 240px joy oladi, shuning
                  uchun uch ustun faqat xl dan boshlab. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((c) => (
                  <div
                    key={c.label}
                    className="flex items-start gap-3 rounded-lg border bg-white p-4"
                  >
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
                      <p className="truncate text-lg font-bold text-gray-900">
                        {c.value}
                      </p>
                      <p className="text-[11px] text-gray-400">{c.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* DAVR YAKUNI — kartalardan ataylab boshqacha: bu ularning
                  xulosasi. To'liq kenglik, kattaroq shrift va belgisiga qarab
                  rang. Tarkibiy qismlari yonida: xodim raqam qayerdan
                  chiqqanini kartalarni qo'shib chiqmasdan ko'radi. */}
              <div
                className={cn(
                  "rounded-xl border-2 p-5",
                  netPositive
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-red-200 bg-red-50/60"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl",
                        netPositive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {netPositive ? (
                        <TrendingUp className="h-6 w-6" />
                      ) : (
                        <TrendingDown className="h-6 w-6" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">
                        {netPositive ? "Sof foyda" : "Zarar"}
                      </p>
                      <p
                        className={cn(
                          "text-2xl font-bold leading-tight tabular-nums sm:text-3xl",
                          netPositive ? "text-emerald-700" : "text-red-700"
                        )}
                      >
                        {stat(Math.abs(netTotal))} So'm
                      </p>
                    </div>
                  </div>

                  {/* Hisob-kitobi — qaysi raqamlardan yig'ilgani */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                    <span className="whitespace-nowrap">
                      Tushum{" "}
                      <b className="font-semibold tabular-nums text-gray-700">
                        {fmt(incomeTotal)}
                      </b>
                    </span>
                    <span className="text-gray-300">−</span>
                    <span className="whitespace-nowrap">
                      Xarajat{" "}
                      <b className="font-semibold tabular-nums text-gray-700">
                        {fmt(expTotal)}
                      </b>
                    </span>
                  </div>
                </div>
              </div>

              {/* Mening qarzdorlarim — faqat shu xodim ochgan bronlar.
                  Shaxsiy hisobotda savol "men kimdan pul olishim kerak",
                  shuning uchun boshqa xodimlarning bronlari bu yerga
                  kirmaydi. */}
              <DebtorsPanel mine title="Qarzdorlarim" initialLimit={5} />

              {/* To'lov turlari bo'yicha to'liq tafsilot */}
              <div className="overflow-hidden rounded-lg border bg-white">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="text-lg font-bold tracking-tight">
                    To'lov turlari bo'yicha
                  </h3>
                  <span className="text-xs text-gray-400">
                    qaytarimlar tushumdan ayirilgan
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/80 text-left">
                        <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          To'lov turi
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
                            <td className="px-4 py-2 font-medium text-gray-800">
                              {col.label}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                              {stat(pay)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                              {stat(shop)}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold tabular-nums text-emerald-600">
                              {stat(income)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-red-600">
                              {expense ? stat(expense) : "—"}
                            </td>
                            <td
                              className={cn(
                                "px-4 py-2 text-right font-semibold tabular-nums",
                                net < 0 ? "text-red-600" : "text-gray-900"
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
                            className="px-4 py-8 text-center text-sm text-gray-400"
                          >
                            Tanlangan davrda pul harakati bo'lmagan
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-gray-50/60 font-semibold">
                        <td className="px-4 py-2">Jami</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {stat(collected)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {stat(shopTotal)}
                        </td>
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
                  <p className="border-t px-4 py-2.5 text-xs text-gray-500">
                    Davr ichida {fmt(refunds)} so'm qaytarilgan — u yuqoridagi
                    tushumdan allaqachon ayirilgan.
                  </p>
                )}
                {shopPendingCount > 0 && (
                  <p className="border-t px-4 py-2.5 text-xs text-gray-500">
                    To'lanmagan {shopPendingCount} ta do'kon savdosi (
                    {fmt(shopPendingTotal)} so'm) tushumga kirmagan — pul hali
                    olinmagan.
                  </p>
                )}
              </div>
            </div>
          )}

          {section !== "overview" && isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : (
            <>
              {section === "reservations" && (
                <div className="rounded-lg border bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <h3 className="text-sm font-semibold">Mening bronlarim</h3>
                    <div className="flex flex-1 items-center justify-end gap-3">
                      <span className="text-xs text-gray-400">{resCount} ta</span>
                      {myReservations.length > 0 && (
                        <TableSearch
                          className="w-full sm:w-64"
                          value={resTable.search}
                          onChange={(v) => setResTable((t) => setSearch(t, v))}
                          placeholder="Mehmon, raqam yoki xona..."
                        />
                      )}
                    </div>
                  </div>
                  {resView.total === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-400">
                      {resTable.search
                        ? "Qidiruv bo'yicha bron topilmadi"
                        : "Tanlangan davrda siz yaratgan bron yo'q"}
                    </p>
                  ) : (
                    <>
                      {/* MOBIL: bronlar karta ko'rinishida (jadval planshet/desktopda) */}
                      <div className="space-y-2.5 p-3 md:hidden">
                        {resView.rows.map((r) => (
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
                                  STATUS_STYLES[r.status] ||
                                    "bg-muted text-muted-foreground"
                                )}
                              >
                                {STATUS_LABELS[r.status] || r.status}
                              </span>
                            </div>
                            <div className="mt-2.5 flex items-end justify-between gap-2 border-t border-border pt-2">
                              <span className="text-sm">
                                <span className="text-muted-foreground">Xona: </span>
                                <span className="font-medium">
                                  {r.room_number || "—"}
                                </span>
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
                              <SortHead {...resHead} column="created_at">Vaqt</SortHead>
                              <SortHead {...resHead} column="reservation_number">Raqam</SortHead>
                              <SortHead {...resHead} column="guest_name">Mehmon</SortHead>
                              <SortHead {...resHead} column="room_number">Xona</SortHead>
                              <SortHead {...resHead} column="status">Holat</SortHead>
                              <SortHead {...resHead} column="total_amount" align="right">
                                Jami
                              </SortHead>
                              <SortHead {...resHead} column="paid_amount" align="right">
                                To'langan
                              </SortHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {resView.rows.map((r) => (
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
                                <TableCell className="text-sm">
                                  {r.room_number || "—"}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={cn(
                                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                      STATUS_STYLES[r.status] ||
                                        "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    {STATUS_LABELS[r.status] || r.status}
                                  </span>
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "whitespace-nowrap text-right text-sm font-semibold",
                                    r.status === "CANCELLED" &&
                                      "text-muted-foreground line-through"
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
                      <TablePager
                        page={resView.page}
                        pageCount={resView.pageCount}
                        label={resView.label}
                        onPage={(page) => setResTable((t) => ({ ...t, page }))}
                      />
                    </>
                  )}
                </div>
              )}

              {section === "shop" && (
                <div className="rounded-lg border bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <h3 className="text-sm font-semibold">
                      Mening do'kon sotuvlarim
                    </h3>
                    <div className="flex flex-1 items-center justify-end gap-3">
                      <span className="text-xs text-gray-400">
                        {myShopSales.length} ta
                      </span>
                      {myShopSales.length > 0 && (
                        <TableSearch
                          className="w-full sm:w-64"
                          value={shopTable.search}
                          onChange={(v) => setShopTable((t) => setSearch(t, v))}
                          placeholder="Bron, mijoz yoki mahsulot..."
                        />
                      )}
                    </div>
                  </div>
                  {shopView.total === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-400">
                      {shopTable.search
                        ? "Qidiruv bo'yicha sotuv topilmadi"
                        : "Tanlangan davrda siz qilgan do'kon sotuvi yo'q"}
                    </p>
                  ) : (
                    <>
                      {/* MOBIL: sotuvlar karta ko'rinishida (jadval planshet/desktopda) */}
                      <div className="space-y-2.5 p-3 md:hidden">
                        {shopView.rows.map((s) => (
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
                                <Badge
                                  variant="secondary"
                                  className="flex-shrink-0 text-[11px]"
                                >
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
                              <SortHead {...shopHead} column="created_at">Vaqt</SortHead>
                              <TableHead>Mahsulotlar</TableHead>
                              <SortHead {...shopHead} column="status">To'lov</SortHead>
                              <SortHead {...shopHead} column="total_amount" align="right">
                                Summa
                              </SortHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {shopView.rows.map((s) => (
                              <TableRow key={s.id}>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {s.created_at
                                    ? format(new Date(s.created_at), "dd.MM HH:mm")
                                    : "—"}
                                </TableCell>
                                <TableCell className="max-w-[320px] truncate text-sm">
                                  {s.items
                                    .map((i) => `${i.product_name} ×${i.quantity}`)
                                    .join(", ")}
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
                      <TablePager
                        page={shopView.page}
                        pageCount={shopView.pageCount}
                        label={shopView.label}
                        onPage={(page) => setShopTable((t) => ({ ...t, page }))}
                      />
                    </>
                  )}
                </div>
              )}

              {section === "expenses" && (
                <div className="rounded-lg border bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <h3 className="text-sm font-semibold">Mening xarajatlarim</h3>
                    <div className="flex flex-1 items-center justify-end gap-3">
                      <span className="text-xs text-gray-400">{expCount} ta</span>
                      {myExpenses.length > 0 && (
                        <TableSearch
                          className="w-full sm:w-64"
                          value={expTable.search}
                          onChange={(v) => setExpTable((t) => setSearch(t, v))}
                          placeholder="Nomi, toifasi yoki izohi..."
                        />
                      )}
                    </div>
                  </div>
                  {expView.total === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-400">
                      {expTable.search
                        ? "Qidiruv bo'yicha xarajat topilmadi"
                        : "Tanlangan davrda siz kiritgan xarajat yo'q"}
                    </p>
                  ) : (
                    <>
                      {/* MOBIL: xarajatlar karta ko'rinishida (jadval planshet/desktopda) */}
                      <div className="space-y-2.5 p-3 md:hidden">
                        {expView.rows.map((e) => (
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
                              <SortHead {...expHead} column="expense_date">Sana</SortHead>
                              <SortHead {...expHead} column="title">Nomi</SortHead>
                              <SortHead {...expHead} column="category">Kategoriya</SortHead>
                              <SortHead {...expHead} column="amount" align="right">
                                Summa
                              </SortHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {expView.rows.map((e) => (
                              <TableRow key={e.id}>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {e.expense_date
                                    ? format(new Date(e.expense_date), "dd.MM.yyyy")
                                    : "—"}
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
                                    <span className="text-sm text-muted-foreground">
                                      —
                                    </span>
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
                      <TablePager
                        page={expView.page}
                        pageCount={expView.pageCount}
                        label={expView.label}
                        onPage={(page) => setExpTable((t) => ({ ...t, page }))}
                      />
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
