import { useState } from "react"
import { BarChart3, ChevronDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import { barTooltip, percentText, tickStep, type DayBar, type ShareRow } from "../lib/financeStats"

/* Moliya bo'limlari statistikasining umumiy bo'laklari: yig'iladigan blok,
   ko'rsatkich kartasi, ulush chiziqlari va kunlik ustunlar grafigi.

   Grafik qoidalari: bitta seriya — bitta rang (birlamchi ko'k), ustun
   ingichka (≤ 24px), uchi 4px yumaloq va asosda to'g'ri, ustunlar orasida
   2px bo'shliq; o'q va to'r ko'zga tashlanmaydi; har ustunga sichqoncha
   yoki fokus bilan izoh (sana, summa, soni). Matn ma'lumot rangida emas —
   kulrang siyohda. */

const fmt = (n: number) => Math.round(Number(n || 0)).toLocaleString()

const STORAGE_KEY = "finance.stats.collapsed"

function readCollapsed(id: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? Boolean(JSON.parse(raw)?.[id]) : false
  } catch {
    return false
  }
}

function writeCollapsed(id: string, value: boolean) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[id] = value
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* saqlab bo'lmadi — joriy holat ishlayveradi */
  }
}

/** Statistika bloki: sarlavha (bosilsa yig'iladi — tanlov eslab qolinadi),
 *  filtr bo'lsa "filtr bo'yicha" belgisi */
export function StatsBlock({
  id,
  title,
  filtered,
  busy,
  children,
}: {
  id: string
  title: string
  filtered?: boolean
  busy?: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(id))
  const toggle = () => {
    setCollapsed((c) => {
      writeCollapsed(id, !c)
      return !c
    })
  }
  return (
    <section className="rounded-xl border bg-white" aria-label={title}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <BarChart3 className="h-4 w-4 flex-shrink-0 text-primary-600" />
        <span className="text-sm font-bold text-gray-800">{title}</span>
        {filtered && (
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
            {tr("filtr bo'yicha")}
          </span>
        )}
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
          {collapsed ? tr("Ko'rsatish") : tr("Yig'ish")}
          <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")} />
        </span>
      </button>
      {!collapsed && <div className="space-y-4 border-t px-4 pt-4 pb-4">{children}</div>}
    </section>
  )
}

export function StatTile({
  label,
  value,
  valueClass,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  valueClass?: string
  sub?: React.ReactNode
  icon: typeof BarChart3
  accent: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border bg-white p-3.5">
      <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", accent)}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={cn("truncate text-base font-bold tabular-nums text-gray-900", valueClass)}>{value}</p>
        {sub && <div className="text-[11px] leading-4 text-gray-400">{sub}</div>}
      </div>
    </div>
  )
}

/** Ulush chiziqlari: nomi, summa, ulush foizi va ingichka chiziq. Bosilsa —
 *  shu qiymat bo'yicha filtr (tanlangani ajralib turadi). */
export function ShareBars({
  title,
  rows,
  activeKeys,
  onPick,
  pickable,
  countLabel,
  empty,
}: {
  title: string
  rows: ShareRow[]
  activeKeys?: ReadonlySet<string>
  onPick?: (key: string) => void
  pickable?: (key: string) => boolean
  countLabel?: (count: number) => string
  empty?: string
}) {
  const anyActive = !!activeKeys && activeKeys.size > 0
  return (
    <div className="min-w-0">
      <h4 className="mb-2 text-xs font-semibold text-gray-600">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">{empty || tr("Ma'lumot yo'q")}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => {
            const active = activeKeys?.has(r.key) ?? false
            const canPick = !!onPick && (pickable ? pickable(r.key) : true)
            const body = (
              <>
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className={cn("min-w-0 truncate", active ? "font-semibold text-gray-900" : "text-gray-700")}>
                    {r.label}
                    {r.count !== undefined && countLabel && (
                      <span className="ml-1 text-[11px] text-gray-400">{countLabel(r.count)}</span>
                    )}
                  </span>
                  <span className="flex-shrink-0 tabular-nums text-gray-800">
                    {r.negative ? "−" : ""}
                    {fmt(Math.abs(r.amount))}
                    {r.share !== null && (
                      <span className="ml-1.5 inline-block w-11 text-right text-[11px] text-gray-400">
                        {percentText(r.share)}
                      </span>
                    )}
                    {r.share === null && <span className="ml-1.5 inline-block w-11" />}
                  </span>
                </span>
                <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      r.negative ? "bg-gray-400" : "bg-primary-500",
                      anyActive && !active && "opacity-40"
                    )}
                    style={{ width: `${r.width}%` }}
                  />
                </span>
              </>
            )
            return (
              <li key={r.key}>
                {canPick ? (
                  <button
                    type="button"
                    onClick={() => onPick!(r.key)}
                    aria-pressed={active}
                    title={active ? tr("Filtrni olib tashlash") : tr("Faqat shularni ko'rsatish")}
                    className={cn(
                      "-mx-1.5 block w-[calc(100%+12px)] rounded-md px-1.5 py-1 text-left transition-colors hover:bg-gray-50",
                      active && "bg-primary-50/60 ring-1 ring-primary-200"
                    )}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="py-1">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Kunlik (yoki oylik) ustunlar: balandlik — summa; izoh — sana, summa, soni */
export function DayColumns({ bars, title }: { bars: DayBar[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (bars.length < 2) return null
  const max = Math.max(...bars.map((b) => b.amount), 0)
  const step = tickStep(bars.length)
  // Ustunlar soni o'zgargan bo'lsa (davr almashdi) eski indeks bo'sh qoladi
  const shown = hover !== null ? (bars[hover] ?? null) : null
  const peak = bars.reduce((best, b) => (b.amount > best.amount ? b : best), bars[0])
  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold text-gray-600">{title}</h4>
        {/* Izoh satri: sichqoncha ustida — o'sha ustun; aks holda eng yuqorisi */}
        <p className="text-[11px] tabular-nums text-gray-500" aria-live="polite">
          {shown
            ? barTooltip(shown)
            : peak.amount > 0
              ? tr("Eng ko'p: {{title}} — {{amount}} So'm", { title: peak.title, amount: fmt(peak.amount) })
              : ""}
        </p>
      </div>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        {/* Yengil to'r: yuqori va o'rta chiziq */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-gray-100" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-gray-100" />
        {/* `relative` — ustunlar to'r chiziqlari USTIDA chizilsin */}
        <div className="relative flex h-28 items-end gap-[2px]" role="list" aria-label={title}>
          {bars.map((b, i) => {
            const h = max > 0 ? (b.amount / max) * 100 : 0
            return (
              <button
                key={b.key}
                type="button"
                role="listitem"
                // Urilish maydoni — butun ustun balandligi (ingichka ustunga tegish oson)
                className="group flex h-full min-w-0 flex-1 cursor-default items-end justify-center focus:outline-none"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={barTooltip(b)}
                title={barTooltip(b)}
              >
                <span
                  className={cn(
                    "block w-full max-w-[24px] rounded-t-[4px] transition-colors",
                    b.amount > 0 ? "bg-primary-500" : "bg-transparent",
                    hover === i ? "bg-primary-700" : "group-focus-visible:bg-primary-700",
                    hover !== null && hover !== i && b.amount > 0 && "bg-primary-300"
                  )}
                  style={{ height: b.amount > 0 ? `max(${h}%, 2px)` : 0 }}
                />
              </button>
            )
          })}
        </div>
        <div className="border-t border-gray-200" />
        <div className="mt-1 flex gap-[2px]">
          {bars.map((b, i) => (
            <span
              key={b.key}
              className={cn(
                "min-w-0 flex-1 text-center text-[10px] tabular-nums",
                hover === i ? "font-semibold text-gray-700" : "text-gray-400"
              )}
            >
              {i % step === 0 || hover === i ? b.tick : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
