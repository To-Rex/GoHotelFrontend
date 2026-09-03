import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
  Wallet,
  ReceiptText,
  CircleDollarSign,
  AlertCircle,
  LayoutDashboard,
  TrendingDown,
  TrendingUp,
  Store,
  BedDouble,
  Banknote,
  Undo2,
} from "lucide-react"
import { useFinanceSummary } from "../api/finance"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { buildDatePresets, resolveDateRange } from "@/lib/datePresets"
import { DebtorsPanel } from "../components/DebtorsPanel"
import { InvoicesSection } from "../components/InvoicesSection"
import { PaymentsSection } from "../components/PaymentsSection"
import { ShopSection } from "../components/ShopSection"
import { PAYMENT_METHOD_LABELS } from "@/lib/paymentMethods"

/**
 * Moliya sahifasi.
 *
 * Sahifa BO'LIMLARGA ajratilgan. Ilgari beshta to'liq jadval bir vaqtda,
 * bitta uzun sahifada chizilardi: yozuvlar ko'payganda brauzer minglab
 * qatorni ushlab turardi va kerakli narsani topish uchun sahifani
 * oxirigacha aylantirish kerak edi. Endi faqat ochilgan bo'lim yuklanadi
 * va chiziladi.
 *
 * Bo'lim menyusi `/settings` dagidek: keng ekranda chapda yopishib
 * turadigan ustun, tor ekranda tepada aylanadigan qator. Yon ustun
 * gorizontal qatordan afzal — ro'yxat doim ko'z oldida qoladi va har
 * bo'lim yoniga yozuvlar soni sig'adi.
 *
 * Sozlamalardan bitta farqi bor: u yerda bo'limlar bitta sahifada turadi
 * va menyu faqat kerakli joyga siljitadi. Bu yerda unday qilib bo'lmaydi
 * — sahifaning og'irligi aynan hammasini bir vaqtda chizishdan edi.
 *
 * Yig'ma raqamlar (kartalar, sof natija, to'lov usullari, xarajat
 * toifalari) `/finance/summary` dan keladi. Ular jadvallarga BOG'LIQ
 * EMAS: jadval bir sahifa ko'rsatsa ham summalar butun davr bo'yicha
 * to'liq qoladi. Ilgari ular brauzerda, yuklab olingan ro'yxatlar
 * ustidan hisoblanardi va ro'yxat chegaraga (500 qator) yetganda
 * jimgina kam chiqardi.
 */

const fmt = (n: number) => Number(n || 0).toLocaleString()

const SECTIONS = [
  {
    key: "overview",
    label: "Umumiy",
    desc: "Davr yakuni, qarzdorlar va pul harakati usullar bo'yicha",
    icon: LayoutDashboard,
    iconClass: "bg-primary-50 text-primary-600",
  },
  {
    key: "payments",
    label: "To'lovlar",
    desc: "Davrda qabul qilingan to'lovlar — qidirish va saralash mumkin",
    icon: Wallet,
    iconClass: "bg-emerald-50 text-emerald-600",
  },
  {
    key: "shop",
    label: "Do'kon",
    desc: "Bronga yozilgan qarzlar va davrda to'langan savdolar",
    icon: Store,
    iconClass: "bg-violet-50 text-violet-600",
  },
  {
    key: "invoices",
    label: "Hisob-fakturalar",
    desc: "Hujjatlar, to'langan summa va qolgan qarz",
    icon: ReceiptText,
    iconClass: "bg-blue-50 text-blue-600",
  },
] as const

type SectionKey = (typeof SECTIONS)[number]["key"]

/**
 * Bo'lim menyusi: keng ekranda chapda ustun, tor ekranda tepada qator.
 *
 * Yonidagi son — o'sha bo'limda nechta yozuv borligi. Xodim bo'limni
 * ochmasdan turib unda ish bor-yo'qligini ko'radi. Tor ekranda son
 * berkitiladi: u yerda qator siqilib qolardi.
 */
function FinanceNav({
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

export const FinancePage = () => {
  const todayStr = format(new Date(), "yyyy-MM-dd")

  // Standart holat — bugungi hisobot
  /* Tanlangan davr kalit sifatida saqlanadi, sanalarga qarab topilmaydi:
     "Shu oy" oyning 1-kunida "Bugun" bilan, 7-kunida "Oxirgi 7 kun" bilan
     bir xil oraliq beradi va o'shanda tanlov noto'g'ri tugmada qolardi.
     Izoh `lib/datePresets.ts` da. */
  const [presetKey, setPresetKey] = useState<string | null>("today")
  const [custom, setCustom] = useState({ from: todayStr, to: todayStr })
  const [statusFilter, setStatusFilter] = useState("")
  const [section, setSection] = useState<SectionKey>("overview")

  // Tez tanlovlar: bugungi/kechagi kun, 7 kun, shu oy, barcha davr.
  // Kun almashsa sanalar ham yangilanadi.
  const presets = useMemo(
    () => buildDatePresets(new Date(todayStr), { withYesterday: true }),
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

  const {
    data: summary,
    isLoading,
    isError,
  } = useFinanceSummary(dateFrom, dateTo, statusFilter || undefined)

  // Xarajatlar hisobotga qo'shiladi (sof natija uchun) — endpoint barcha
  // tizimga kirgan foydalanuvchilar uchun ochiq
  const canExpenses = true

  /* To'lov turlari bo'yicha to'liq tafsilot.

     Uch manba bir jadvalda: bron to'lovlari, do'kon savdosi va xarajatlar.
     Yig'indilar serverdan keladi; bu yerda faqat tartib va sof qiymat
     hisoblanadi.

     Tanish usullar avval, tartibda; notanishlari oxirida — ular ham
     ko'rinishi kerak, aks holda pul jimgina yo'qolganday tuyuladi. */
  const methodRows = useMemo(() => {
    const rows = summary?.methods ?? []
    const known = Object.keys(PAYMENT_METHOD_LABELS)
    const rank = (key: string) => {
      const index = known.indexOf(key)
      return index === -1 ? known.length : index
    }
    return [...rows]
      .sort((a, b) => rank(a.key) - rank(b.key))
      .map((row) => {
        const income = row.pay + row.shop
        return {
          ...row,
          label: PAYMENT_METHOD_LABELS[row.key] || row.key,
          income,
          net: income - row.expense,
        }
      })
  }, [summary])

  /* Jadvalning "Jami" qatori — qatorlarning o'zidan. Alohida hisoblansa
     yaxlitlash yoki bo'lib to'lash farqi jadval ichida qarama-qarshilik
     bo'lib ko'rinardi */
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

  // Kassadagi naqd qoldiq: naqd tushum − naqd xarajat
  const cashOnHand = useMemo(
    () => methodRows.find((r) => r.key === "CASH")?.net ?? 0,
    [methodRows]
  )

  const activeSection = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0]

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

  if (isError || !summary) {
    return <div>Xatolik yuz berdi. Iltimos qayta urining.</div>
  }

  const expensesTotal = summary.expense_total
  const expenseCategories = summary.expense_categories

  /* Davr yakuni. Ilgari bu ifoda uch joyda takrorlanardi — qiymat, rang va
     belgi uchun alohida; bittasini o'zgartirib qolganlarini unutish oson
     edi. */
  const netResult = summary.income + summary.shop_revenue - expensesTotal
  const netPositive = netResult >= 0

  const cards = [
    {
      label: "Tushum (to'lovlar)",
      value: `${fmt(summary.income)} So'm`,
      sub: `${summary.payment_count} ta to'lov`,
      icon: Wallet,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Hisob-fakturalar",
      value: `${fmt(summary.invoice_total)} So'm`,
      sub:
        summary.invoice_discount > 0
          ? `${summary.invoice_count} ta hujjat · chegirma −${fmt(summary.invoice_discount)} So'm`
          : `${summary.invoice_count} ta hujjat`,
      icon: ReceiptText,
      accent: "bg-blue-50 text-blue-600",
    },
    {
      label: "To'langan",
      value: `${fmt(summary.invoice_paid)} So'm`,
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
      value: `${fmt(summary.shop_revenue)} So'm`,
      sub: `${summary.shop_paid_count} ta to'langan sotuv`,
      icon: Store,
      accent: "bg-violet-50 text-violet-600",
    },
    {
      label: "Do'kon qarzi (bronda)",
      value: `${fmt(summary.shop_debt)} So'm`,
      sub: `${summary.shop_debt_count} ta to'lanmagan sotuv`,
      icon: BedDouble,
      accent: "bg-orange-50 text-orange-600",
    },
    {
      label: "Naqd qoldiq",
      value: `${fmt(cashOnHand)} So'm`,
      sub: "naqd tushum − naqd xarajat",
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
            sub: `${summary.expense_count} ta chiqim`,
            icon: TrendingDown,
            accent: "bg-red-50 text-red-600",
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

      {/* BO'LIM MENYUSI va tanlangan bo'lim. Faqat ochilgani chiziladi va
          so'rov yuboradi — sahifaning og'irligi shu yerda hal bo'ladi. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <FinanceNav
          active={section}
          onSelect={setSection}
          counts={{
            payments: summary.payment_count,
            invoices: summary.invoice_count,
            shop: summary.shop_paid_count + summary.shop_debt_count,
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
              {/* Hisobot kartalari.

                  Yon menyu 240px joy oladi, shuning uchun to'rt ustun
                  faqat xl dan boshlab: undan tor ekranda summa ustunga
                  sig'may qisqarib qolardi. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cards.map((c) => (
                  <div
                    key={c.label}
                    className="rounded-lg border bg-white p-4 flex items-start gap-3"
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
                      <p className="text-lg font-bold text-gray-900 truncate">{c.value}</p>
                      <p className="text-[11px] text-gray-400">{c.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* DAVR YAKUNI — qolgan kartalardan ataylab boshqacha: bu ularning
                  xulosasi, ular bilan bir qatorda turadigan yana bitta raqam emas.
                  Shuning uchun to'liq kenglik, kattaroq shrift va belgisiga qarab
                  rang. Tarkibiy qismlari yonida yozilgan: xodim raqam qayerdan
                  chiqqanini kartalarni qo'shib chiqmasdan ko'radi. */}
              {canExpenses && (
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
                        <p className="text-sm font-semibold text-gray-600">Sof natija</p>
                        <p
                          className={cn(
                            "text-2xl sm:text-3xl font-bold tabular-nums leading-tight",
                            netPositive ? "text-emerald-700" : "text-red-700"
                          )}
                        >
                          {fmt(netResult)} So'm
                        </p>
                      </div>
                    </div>

                    {/* Hisob-kitobi — qaysi raqamlardan yig'ilgani */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                      <span className="whitespace-nowrap">
                        Tushum{" "}
                        <b className="font-semibold text-gray-700 tabular-nums">
                          {fmt(summary.income)}
                        </b>
                      </span>
                      <span className="text-gray-300">+</span>
                      <span className="whitespace-nowrap">
                        Do'kon{" "}
                        <b className="font-semibold text-gray-700 tabular-nums">
                          {fmt(summary.shop_revenue)}
                        </b>
                      </span>
                      <span className="text-gray-300">−</span>
                      <span className="whitespace-nowrap">
                        Xarajat{" "}
                        <b className="font-semibold text-gray-700 tabular-nums">
                          {fmt(expensesTotal)}
                        </b>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* QARZDORLAR — sahifaning yuqori qismida, davr yakunidan keyin.

                  Bu olinmagan pul, ya'ni sarlavha raqamlari bilan bir qatorda
                  turadigan ma'lumot. Pastda, jadvallar orasida turganda u ko'zga
                  tashlanmasdi — xodim sahifani oxirigacha aylantirmaydi.

                  Tanlangan davrga BOG'LANMAGAN va bu ataylab: qarz davr hodisasi
                  emas, joriy holat. Ilgari u davr bilan cheklangan edi va "Bugun"
                  tanlanganda ro'yxat deyarli doim bo'sh chiqardi. */}
              <DebtorsPanel title="Qarzdorlar (bronlar bo'yicha)" initialLimit={6} />

              {/* To'lov usullari bo'yicha to'liq tafsilot */}
              <div className="overflow-hidden rounded-lg border bg-white">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 className="text-lg font-bold tracking-tight">
                    To'lov usullari bo'yicha
                  </h2>
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
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-sm text-gray-400"
                          >
                            Tanlangan davrda pul harakati bo'lmagan
                          </td>
                        </tr>
                      ) : (
                        methodRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-4 py-2 font-medium text-gray-800">
                              {row.label}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                              {row.pay ? fmt(row.pay) : "—"}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                              {row.shop ? fmt(row.shop) : "—"}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold tabular-nums text-emerald-600">
                              {fmt(row.income)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-red-600">
                              {row.expense ? fmt(row.expense) : "—"}
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
                {summary.shop_debt > 0 && (
                  <p className="border-t px-4 py-2.5 text-xs text-gray-500">
                    Bronga yozilgan {summary.shop_debt_count} ta to'lanmagan do'kon
                    savdosi ({fmt(summary.shop_debt)} so'm) tushumga kirmagan —{" "}
                    pul hali olinmagan.
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
                              {c.count} ta · {share.toFixed(0)}%
                            </span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {section === "payments" && (
            <PaymentsSection dateFrom={dateFrom} dateTo={dateTo} />
          )}

          {section === "shop" && (
            <ShopSection dateFrom={dateFrom} dateTo={dateTo} />
          )}

          {section === "invoices" && (
            <InvoicesSection
              dateFrom={dateFrom}
              dateTo={dateTo}
              status={statusFilter}
              onStatus={setStatusFilter}
            />
          )}
        </div>
      </div>
    </div>
  )
}
