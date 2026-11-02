import { useState } from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { addMonths, format, isSameMonth, startOfMonth, subMonths } from "date-fns"
import { enUS, ru, uz } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { getLang, monthYear, tr } from "@/i18n"
import type { DatePreset } from "@/lib/datePresets"
import {
  fromIso,
  highlightRange,
  monthGrid,
  pickDayFor,
  rangeDays,
  rangeLabel,
  toIso,
  type RangeDraft,
  type RangeField,
} from "@/lib/dateRange"
import { cn } from "@/lib/utils"

/**
 * Sana oralig'i — BITTA kalendar.
 *
 * Hisobot sahifalarida "Sanadan / Sanagacha" ikkita alohida maydon edi:
 * davrni tanlash uchun ikki marta brauzer kalendarini ochish kerak bo'lardi.
 * Endi bitta tugma oraliqni ko'rsatadi, bosilsa kalendar ochiladi.
 *
 * Tanlash ko'rinib turadi: tepada ikkita katak — "Sanadan" va "Sanagacha".
 * Qaysi biri navbatda bo'lsa o'sha yoritilgan; kalendarda bosilgan kun shu
 * katakka tushadi va navbat ikkinchisiga o'tadi. Kataklarga sanani qo'lda
 * ham yozish mumkin, bosib navbatni almashtirish ham. Oraliq sichqoncha
 * yurganda ko'rinib turadi, teskari bosilsa o'rni almashadi, kunlar soni
 * yonida. Tanlov «Qo'llash» bilan tasdiqlanadi («Bekor qilish» yoki
 * tashqariga bosish — o'zgarmaydi); tez tugmalar esa darhol qo'llanadi.
 *
 * Kompyuterda ikki oy yonma-yon (o'tgan va joriy — hisobotlar orqaga
 * qaraydi), telefonda bitta oy. Hafta dushanbadan.
 */

const LOCALES = { uz, ru, en: enUS } as const

export interface DateRangePickerProps {
  value: RangeDraft
  onChange: (next: RangeDraft) => void
  /** Kalendar ichidagi tez tanlovlar (sahifadagi tugmalar bilan bir xil). */
  presets?: DatePreset[]
  presetKey?: string | null
  onPreset?: (preset: DatePreset) => void
  className?: string
}

export function DateRangePicker({
  value,
  onChange,
  presets = [],
  presetKey = null,
  onPreset,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<RangeDraft>(value)
  const [field, setField] = useState<RangeField>("from")
  const [hover, setHover] = useState<string | null>(null)
  // O'ng (telefonda — yagona) oy: tanlangan davrning oxiri, bo'lmasa bugun
  const [anchor, setAnchor] = useState<Date>(() => anchorFor(value))

  const locale = LOCALES[getLang()]
  const today = toIso(new Date())
  const label = rangeLabel(value.from, value.to, tr("Barcha davr"))
  const days = rangeDays(draft.from, draft.to)

  const handleOpen = (next: boolean) => {
    if (next) {
      // Tez tugmalar bilan o'zgargan bo'lishi mumkin — har ochilishda qiymatdan
      setDraft(value)
      setField(value.from && !value.to ? "to" : "from")
      setHover(null)
      setAnchor(anchorFor(value))
    }
    setOpen(next)
  }

  const select = (day: string) => {
    const next = pickDayFor(draft, field, day)
    setDraft(next.draft)
    setField(next.field)
    setHover(null)
  }

  const apply = () => {
    onChange(draft)
    setOpen(false)
  }

  const choosePreset = (preset: DatePreset) => {
    onPreset?.(preset)
    setOpen(false)
  }

  const range = highlightRange(draft, hover, field)
  const months = [subMonths(anchor, 1), anchor]
  const hint = !draft.from
    ? tr("Boshlanish kunini tanlang")
    : !draft.to
      ? tr("Tugash kunini tanlang")
      : `${rangeLabel(draft.from, draft.to, "")} · ${tr("{{count}} kun", { count: days })}`

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={tr("Sana oralig'i")}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none",
            "hover:bg-gray-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50",
            className
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="tabular-nums text-gray-900">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-[calc(100vw-1.5rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-lg outline-none sm:w-auto"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* Tez tanlovlar: kompyuterda chap ustun, telefonda yuqorida qator */}
            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1 sm:min-w-[8.5rem] sm:flex-col sm:border-r sm:border-gray-100 sm:pr-3">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => choosePreset(p)}
                    aria-pressed={presetKey === p.key}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                      presetKey === p.key
                        ? "bg-primary-50 text-primary-700"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            <div className="min-w-0">
              {/* Chegaralar: qaysi biri navbatda — yoritilgan. Kataklar sanani
                  qo'lda kiritish maydoni ham */}
              <div className="mb-3 flex items-center gap-2">
                <RangeEdge
                  label={tr("Sanadan")}
                  value={draft.from}
                  active={field === "from"}
                  max={draft.to || undefined}
                  onFocus={() => setField("from")}
                  onChange={(v) => setDraft({ from: v, to: draft.to })}
                />
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
                <RangeEdge
                  // `key`: boshlanish o'zgarganda maydon qayta yaratiladi —
                  // Safari bo'shatilgan sana maydonida eski qiymatni ko'rsatib
                  // turishi mumkin
                  key={`to-${draft.from}`}
                  label={tr("Sanagacha")}
                  value={draft.to}
                  active={field === "to"}
                  min={draft.from || undefined}
                  onFocus={() => setField("to")}
                  onChange={(v) => setDraft({ from: draft.from, to: v })}
                />
                {days != null && (
                  <span className="hidden shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary-700 sm:inline-block">
                    {tr("{{count}} kun", { count: days })}
                  </span>
                )}
              </div>

              {/* Oylar: o'tgan oy faqat keng ekranda. Oldinga/orqaga tugmalari
                  butun kalendar burchaklarida — oylar soni o'zgarsa ham joyida */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAnchor((m) => subMonths(m, 1))}
                  aria-label={tr("Oldingi oy")}
                  className="absolute left-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAnchor((m) => addMonths(m, 1))}
                  aria-label={tr("Keyingi oy")}
                  className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <div className="flex gap-6">
                  {months.map((month, index) => (
                    <div key={toIso(month)} className={cn(index === 0 && "hidden sm:block")}>
                      <div className="flex h-8 items-center justify-center px-8 text-sm font-semibold text-gray-900">
                        {monthYear(month)}
                      </div>
                      <MonthGrid
                        month={month}
                        locale={locale}
                        today={today}
                        range={range}
                        onPick={select}
                        onHover={setHover}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500 tabular-nums" aria-live="polite">
                  {hint}
                </p>
                <div className="ml-auto flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                    {tr("Bekor qilish")}
                  </Button>
                  <Button type="button" size="sm" onClick={apply}>
                    {tr("Qo'llash")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

function anchorFor(value: RangeDraft): Date {
  return startOfMonth(fromIso(value.to) ?? fromIso(value.from) ?? new Date())
}

/** "Sanadan" / "Sanagacha" katagi: yozuv, sana (qo'lda ham kiritiladi) va
 *  navbat belgisi. Bosilsa yoki maydonga kirilsa navbat shu chegaraga o'tadi. */
function RangeEdge({
  label,
  value,
  active,
  min,
  max,
  onFocus,
  onChange,
}: {
  label: string
  value: string
  active: boolean
  min?: string
  max?: string
  onFocus: () => void
  onChange: (value: string) => void
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 flex-1 cursor-text flex-col rounded-lg border px-3 py-1.5 transition-colors",
        active
          ? "border-primary-500 bg-primary-50/40 ring-2 ring-primary-100"
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <span className={cn("text-[11px] font-medium", active ? "text-primary-700" : "text-gray-500")}>
        {label}
      </span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-gray-900 outline-none"
      />
    </label>
  )
}

function MonthGrid({
  month,
  locale,
  today,
  range,
  onPick,
  onHover,
}: {
  month: Date
  locale: (typeof LOCALES)[keyof typeof LOCALES]
  today: string
  range: [string, string] | null
  onPick: (day: string) => void
  onHover: (day: string | null) => void
}) {
  const days = monthGrid(month)

  return (
    <div className="grid w-[16rem] grid-cols-7" role="grid" onMouseLeave={() => onHover(null)}>
      {days.slice(0, 7).map((d) => (
        <div
          key={`h-${toIso(d)}`}
          className="flex h-8 items-center justify-center text-[11px] font-medium uppercase text-gray-400"
        >
          {format(d, "EEEEEE", { locale })}
        </div>
      ))}
      {days.map((d) => {
        const iso = toIso(d)
        // Qo'shni oy kunlari bo'sh katak: ikki oy yonma-yon turganda bir kun
        // ikki joyda tanlangan bo'lib ko'rinmasin
        if (!isSameMonth(d, month)) {
          return <div key={iso} role="gridcell" aria-hidden="true" className="h-9" />
        }
        const inRange = Boolean(range && iso >= range[0] && iso <= range[1])
        const isStart = range?.[0] === iso
        const isEnd = range?.[1] === iso
        const edge = isStart || isEnd
        return (
          <button
            key={iso}
            type="button"
            role="gridcell"
            aria-selected={inRange}
            aria-label={format(d, "d MMMM yyyy", { locale })}
            onClick={() => onPick(iso)}
            onMouseEnter={() => onHover(iso)}
            onFocus={() => onHover(iso)}
            className={cn(
              "relative h-9 w-full text-sm tabular-nums transition-colors",
              // Oraliq — yaxlit chiziq: o'rtadagi kunlar burchaksiz, chetlari yumaloq
              inRange && !edge && "bg-primary-50 text-primary-700",
              edge && "bg-primary-600 font-semibold text-white hover:bg-primary-600",
              isStart && isEnd && "rounded-md",
              isStart && !isEnd && "rounded-l-md",
              isEnd && !isStart && "rounded-r-md",
              !inRange && "rounded-md text-gray-800 hover:bg-gray-100",
              iso === today && !edge && "font-semibold underline decoration-primary-500 decoration-2 underline-offset-4"
            )}
          >
            {d.getDate()}
          </button>
        )
      })}
    </div>
  )
}
