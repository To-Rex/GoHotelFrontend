import { useState } from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from "lucide-react"
import { addMonths, format, isSameMonth, startOfMonth, subMonths } from "date-fns"
import { enUS, ru, uz } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { getLang, monthYear, tr } from "@/i18n"
import type { DatePreset } from "@/lib/datePresets"
import {
  displayDate,
  fromIso,
  hasTime,
  highlightRange,
  isOvernight,
  monthGrid,
  nextDay,
  pickDayFor,
  rangeDays,
  rangeLabel,
  rangeLabelWithTime,
  toIso,
  type RangeDraft,
  type RangeField,
  type TimeRange,
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
 *
 * IXTIYORIY SOAT (`hours` berilsa): "Sanadan" va "Sanagacha" kataklari
 * ichida soat maydoni ham chiqadi, ostida tez tanlovlar (smena oynalari)
 * va "Butun kun". Bitta kunda "gacha" "dan"dan kichik bo'lsa — tungi
 * oraliq, tugash ertasi kunga o'tadi (yozuvda ko'rinadi). Soat ham
 * «Qo'llash» bilan tasdiqlanadi. `datesLocked` — sanani faqat tez
 * tugmalar bilan tanlash mumkin (kalendar yo'q), soat esa ochiq: davri
 * cheklangan xodim uchun. Soat berilmasa komponent avvalgidek.
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
  /** Ixtiyoriy soat ("HH:MM", bo'sh — kun boshi/oxiri). Berilsa menyuda
   *  soat maydonlari chiqadi */
  hours?: TimeRange
  onHoursChange?: (next: TimeRange) => void
  /** Soat uchun tez tanlovlar (smena oynalari) */
  hourPresets?: ReadonlyArray<TimeRange>
  /** Sanani kalendardan tanlab bo'lmaydi — faqat tez tugmalar; soat ochiq */
  datesLocked?: boolean
}

const EMPTY_TIME: TimeRange = { from: "", to: "" }

export function DateRangePicker({
  value,
  onChange,
  presets = [],
  presetKey = null,
  onPreset,
  className,
  hours,
  onHoursChange,
  hourPresets = [],
  datesLocked = false,
}: DateRangePickerProps) {
  const withTime = hours !== undefined && !!onHoursChange
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<RangeDraft>(value)
  const [draftHours, setDraftHours] = useState<TimeRange>(hours ?? EMPTY_TIME)
  const [field, setField] = useState<RangeField>("from")
  const [hover, setHover] = useState<string | null>(null)
  // O'ng (telefonda — yagona) oy: tanlangan davrning oxiri, bo'lmasa bugun
  const [anchor, setAnchor] = useState<Date>(() => anchorFor(value))

  const locale = LOCALES[getLang()]
  const today = toIso(new Date())
  const label = withTime
    ? rangeLabelWithTime(value.from, value.to, hours, tr("Barcha davr"))
    : rangeLabel(value.from, value.to, tr("Barcha davr"))
  const days = rangeDays(draft.from, draft.to)
  const overnight = withTime && isOvernight(draft.from, draft.to, draftHours)

  const handleOpen = (next: boolean) => {
    if (next) {
      // Tez tugmalar bilan o'zgargan bo'lishi mumkin — har ochilishda qiymatdan
      setDraft(value)
      setDraftHours(hours ?? EMPTY_TIME)
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

  /* Faqat O'ZGARGANI yuboriladi: soat almashtirilganda sana qayta
     yuborilsa sahifa tez tugma tanlovini "qo'lda oraliq"ga o'tkazib
     yuborardi (cheklangan xodimda bu "Bugun"ga qaytarardi). */
  const applyHours = () => {
    if (!withTime) return
    const cur = hours ?? EMPTY_TIME
    if (draftHours.from !== cur.from || draftHours.to !== cur.to) onHoursChange!(draftHours)
  }

  const apply = () => {
    if (!datesLocked && (draft.from !== value.from || draft.to !== value.to)) onChange(draft)
    applyHours()
    setOpen(false)
  }

  const choosePreset = (preset: DatePreset) => {
    onPreset?.(preset)
    // Menyuda soat ham o'zgartirilgan bo'lsa — birga qo'llanadi
    applyHours()
    setOpen(false)
  }

  const range = highlightRange(draft, hover, field)
  const months = [subMonths(anchor, 1), anchor]
  const hint = !draft.from
    ? tr("Boshlanish kunini tanlang")
    : !draft.to
      ? tr("Tugash kunini tanlang")
      : withTime && hasTime(draftHours)
        ? rangeLabelWithTime(draft.from, draft.to, draftHours, "")
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
          {withTime && hasTime(hours) ? (
            <Clock className="h-4 w-4 shrink-0 text-primary-600" />
          ) : (
            <CalendarDays className="h-4 w-4 shrink-0 text-gray-500" />
          )}
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
              <div className={cn("mb-3 flex gap-2", withTime ? "items-stretch" : "items-center")}>
                <RangeEdge
                  label={tr("Sanadan")}
                  value={draft.from}
                  active={!datesLocked && field === "from"}
                  max={draft.to || undefined}
                  locked={datesLocked}
                  onFocus={() => setField("from")}
                  onChange={(v) => setDraft({ from: v, to: draft.to })}
                  time={withTime ? draftHours.from : undefined}
                  timeLabel={tr("Soatdan")}
                  onTimeChange={(v) => setDraftHours((h) => ({ ...h, from: v }))}
                />
                <ArrowRight className="h-4 w-4 shrink-0 self-center text-gray-400" />
                <RangeEdge
                  // `key`: boshlanish o'zgarganda maydon qayta yaratiladi —
                  // Safari bo'shatilgan sana maydonida eski qiymatni ko'rsatib
                  // turishi mumkin
                  key={`to-${draft.from}`}
                  label={tr("Sanagacha")}
                  value={draft.to}
                  active={!datesLocked && field === "to"}
                  min={draft.from || undefined}
                  locked={datesLocked}
                  onFocus={() => setField("to")}
                  onChange={(v) => setDraft({ from: draft.from, to: v })}
                  time={withTime ? draftHours.to : undefined}
                  timeLabel={tr("Soatgacha")}
                  onTimeChange={(v) => setDraftHours((h) => ({ ...h, to: v }))}
                  nextDayNote={overnight ? displayDate(nextDay(draft.to)) : undefined}
                />
                {days != null && (
                  <span className="hidden shrink-0 self-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary-700 sm:inline-block">
                    {tr("{{count}} kun", { count: days })}
                  </span>
                )}
              </div>

              {/* Soat: tez tanlovlar va "Butun kun" (soatni olib tashlash) */}
              {withTime && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    {tr("Soat")}
                  </span>
                  {hourPresets.map((p) => {
                    const active = draftHours.from === p.from && draftHours.to === p.to
                    return (
                      <button
                        key={`${p.from}-${p.to}`}
                        type="button"
                        onClick={() => setDraftHours(p)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] font-medium tabular-nums transition-colors",
                          active
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {p.from}–{p.to}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setDraftHours(EMPTY_TIME)}
                    aria-pressed={!hasTime(draftHours)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                      !hasTime(draftHours)
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {hasTime(draftHours) && <X className="h-3 w-3" />}
                    {tr("Butun kun")}
                  </button>
                  {overnight && (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                      {tr("tungi smena — ertasi kungacha")}
                    </span>
                  )}
                </div>
              )}

              {/* Oylar: o'tgan oy faqat keng ekranda. Oldinga/orqaga tugmalari
                  butun kalendar burchaklarida — oylar soni o'zgarsa ham joyida.
                  Sana qulflangan bo'lsa kalendar yo'q — faqat tez tugmalar */}
              {!datesLocked && (
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
              )}

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
  locked = false,
  onFocus,
  onChange,
  time,
  timeLabel,
  onTimeChange,
  nextDayNote,
}: {
  label: string
  value: string
  active: boolean
  min?: string
  max?: string
  /** Sana o'zgartirilmaydi (faqat ko'rsatiladi) */
  locked?: boolean
  onFocus: () => void
  onChange: (value: string) => void
  /** Soat maydoni (undefined — soatsiz rejim) */
  time?: string
  timeLabel?: string
  onTimeChange?: (value: string) => void
  /** Tungi oraliqda tugash aslida ertasi kun — shu sana yoziladi */
  nextDayNote?: string
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-1.5 transition-colors",
        active
          ? "border-primary-500 bg-primary-50/40 ring-2 ring-primary-100"
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <label className="flex min-w-0 cursor-text flex-col">
        <span className={cn("text-[11px] font-medium", active ? "text-primary-700" : "text-gray-500")}>
          {label}
        </span>
        {locked ? (
          <span className="text-sm font-semibold tabular-nums text-gray-900">
            {value ? displayDate(value) : "—"}
          </span>
        ) : (
          <input
            type="date"
            value={value}
            min={min}
            max={max}
            onFocus={onFocus}
            onChange={(e) => onChange(e.target.value)}
            className="w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-gray-900 outline-none"
          />
        )}
      </label>
      {time !== undefined && onTimeChange && (
        <div className="mt-1 flex min-w-0 items-center gap-1.5 border-t border-gray-100 pt-1">
          <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <input
            type="time"
            value={time}
            aria-label={timeLabel}
            onChange={(e) => onTimeChange(e.target.value)}
            className="w-full min-w-0 bg-transparent text-sm tabular-nums text-gray-900 outline-none placeholder:text-gray-400"
          />
          {time && (
            <button
              type="button"
              onClick={() => onTimeChange("")}
              aria-label={tr("Soatni tozalash")}
              className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      {nextDayNote && (
        <span className="mt-0.5 text-[10px] font-medium text-indigo-600 tabular-nums">
          {tr("ertasi kun: {{date}}", { date: nextDayNote })}
        </span>
      )}
    </div>
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
