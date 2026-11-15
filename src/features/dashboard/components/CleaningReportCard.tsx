import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  Clock,
  DoorOpen,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react"

import { buildDatePresets } from "@/lib/datePresets"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import {
  cleaningHealth,
  cleaningSegments,
  formatMinutes,
  useCleaningReport,
  type SegmentKey,
} from "@/features/housekeeping/api/cleaningReport"
import { CleaningReportDialog } from "@/features/housekeeping/components/CleaningReportDialog"

/* Boshqaruv sahifasi → "Tozalash hisoboti".

   Xo'jalik ishlaridagi "Tozalash hisoboti" oynasining qisqa ko'rinishi:
   davrda nechta mehmon chiqib ketdi va shundan nechtasini farrosh o'zi
   tozalab yakunladi, nechtasi vaqt o'tgani uchun avtomatik yopildi,
   nechtasi hali ochiq yoki umuman vazifasiz qoldi. Ulush chizig'i bir
   qarashda holatni ko'rsatadi; "Batafsil" o'sha davr bilan to'liq
   hisobotni (farroshlar va xonalar kesimi) ochadi.

   Ma'lumot o'sha endpointdan, o'sha kalit bilan — oyna ochilganda qayta
   so'ralmaydi. So'rov xato bersa (ruxsat yo'q, eski server) karta
   ko'rinmaydi: boshqaruv sahifasi buzilmasin. */

const PERIOD_KEYS = ["today", "week", "month"] as const
type PeriodKey = (typeof PERIOD_KEYS)[number]

const SEGMENT_STYLE: Record<SegmentKey, { bar: string; dot: string; label: () => string }> = {
  by_person: { bar: "bg-emerald-500", dot: "bg-emerald-500", label: () => tr("Farrosh tozalagan") },
  auto: { bar: "bg-amber-400", dot: "bg-amber-400", label: () => tr("Avtomatik yopilgan") },
  open: { bar: "bg-sky-400", dot: "bg-sky-400", label: () => tr("Hali ochiq") },
  cancelled: { bar: "bg-gray-300", dot: "bg-gray-300", label: () => tr("Bekor qilingan") },
  no_task: { bar: "bg-red-500", dot: "bg-red-500", label: () => tr("Vazifasiz qolgan") },
}

export function CleaningReportCard({ delay = 0 }: { delay?: number }) {
  const presets = useMemo(() => buildDatePresets(new Date()), [])
  const periods = useMemo(
    () => PERIOD_KEYS.map((k) => presets.find((p) => p.key === k)).filter((p): p is NonNullable<typeof p> => !!p),
    [presets]
  )
  // Standart — oxirgi 7 kun: bugungi raqam kichik, oylik esa kech bilinadi
  const [periodKey, setPeriodKey] = useState<PeriodKey>("week")
  const period = periods.find((p) => p.key === periodKey) ?? periods[0]
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading, isError, isFetching } = useCleaningReport(period?.from ?? "", period?.to ?? "")

  if (isError || !period) return null

  const s = data?.summary
  const segments = s ? cleaningSegments(s) : []
  const health = s ? cleaningHealth(s) : "none"
  const attentionRooms = (data?.rooms ?? []).filter((r) => r.auto || r.no_task)
  const topCleaners = (data?.cleaners ?? []).filter((c) => c.user_id).slice(0, 3)

  const tiles = s
    ? [
        { label: tr("Chiqishlar"), value: s.checkouts, tone: "text-gray-900", icon: DoorOpen },
        { label: tr("Farrosh tozalagan"), value: s.cleaned_by_person, tone: "text-emerald-600", icon: Sparkles },
        {
          label: tr("Avtomatik yopilgan"),
          value: s.auto_closed,
          tone: s.auto_closed ? "text-amber-600" : "text-gray-900",
          icon: ShieldAlert,
        },
        {
          label: tr("Vazifasiz qolgan"),
          value: s.no_task,
          tone: s.no_task ? "text-red-600" : "text-gray-900",
          icon: AlertTriangle,
        },
      ]
    : []

  return (
    <section
      className="group animate-dash-rise rounded-2xl border bg-white p-4 transition-shadow duration-300 hover:shadow-md sm:p-5"
      style={{ animationDelay: `${340 + delay}ms` }}
      aria-labelledby="dash-cleaning-title"
    >
      {/* Sarlavha + davr */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="dash-cleaning-title" className="flex min-w-0 items-center gap-2.5 text-sm font-bold text-gray-900">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            <BedDouble className="h-4 w-4" />
          </span>
          <span className="truncate">{tr("Tozalash hisoboti")}</span>
          {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-300" />}
        </h2>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-gray-200 p-0.5" role="group" aria-label={tr("Davr")}>
            {periods.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodKey(p.key as PeriodKey)}
                aria-pressed={periodKey === p.key}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  periodKey === p.key ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-800"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary-600 transition-colors hover:bg-primary-50 hover:text-primary-700"
          >
            {tr("Batafsil")}
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {isLoading || !s ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : s.checkouts === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-400">
          <DoorOpen className="h-5 w-5 flex-shrink-0" />
          {tr("Bu davrda mehmon chiqmagan — solishtirish uchun ma'lumot yo'q")}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Asosiy raqamlar */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tiles.map((c) => (
              <div key={c.label} className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <c.icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{c.label}</span>
                </p>
                <p className={cn("text-xl font-bold tabular-nums", c.tone)}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Ulush chizig'i — har chiqish aynan bitta guruhda */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-xs text-gray-500">
                {tr("Farrosh tasdiqlagan tozalashlar")}
              </p>
              <p
                className={cn(
                  "text-sm font-bold tabular-nums",
                  health === "good" ? "text-emerald-600" : health === "bad" ? "text-red-600" : "text-amber-600"
                )}
              >
                {s.verified_percent ?? 0}%
              </p>
            </div>
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100"
              role="img"
              aria-label={segments.map((g) => `${SEGMENT_STYLE[g.key].label()}: ${g.count}`).join(", ")}
            >
              {segments.map((g) => (
                <span
                  key={g.key}
                  className={cn("h-full transition-[width] duration-700", SEGMENT_STYLE[g.key].bar)}
                  style={{ width: `${g.percent}%` }}
                  title={`${SEGMENT_STYLE[g.key].label()}: ${g.count}`}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {segments.map((g) => (
                <span key={g.key} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className={cn("h-2 w-2 rounded-full", SEGMENT_STYLE[g.key].dot)} />
                  {SEGMENT_STYLE[g.key].label()}
                  <b className="tabular-nums text-gray-800">{g.count}</b>
                </span>
              ))}
            </div>
          </div>

          {/* Xulosa */}
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
              health === "good"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : health === "bad"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
            )}
          >
            {health === "good" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            )}
            <span>
              {tr("{{checkouts}} ta chiqishdan {{cleaned}} tasini farrosh o'zi tozalab yakunlagan.", {
                checkouts: s.checkouts,
                cleaned: s.cleaned_by_person,
              })}
              {s.auto_closed > 0 &&
                " " + tr("{{count}} tasi vaqt o'tgani uchun avtomatik yopilgan — tozalanganini hech kim tasdiqlamagan.", { count: s.auto_closed })}
              {s.no_task > 0 &&
                " " + tr("{{count}} ta chiqishda tozalash vazifasi umuman ochilmagan.", { count: s.no_task })}
            </span>
          </div>

          {/* Vaqtlar, farroshlar, e'tibor talab qiladigan xonalar */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-gray-100 px-3 py-2.5">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                {tr("O'rtacha vaqt")}
              </p>
              <div className="space-y-1 text-sm">
                <p className="flex justify-between gap-2">
                  <span className="text-gray-500">{tr("Kutish")}</span>
                  <b className="tabular-nums text-gray-900">{formatMinutes(s.avg_wait_minutes)}</b>
                </p>
                <p className="flex justify-between gap-2">
                  <span className="text-gray-500">{tr("Tozalash")}</span>
                  <b className="tabular-nums text-gray-900">{formatMinutes(s.avg_work_minutes)}</b>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 px-3 py-2.5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {tr("Farroshlar")}
              </p>
              {topCleaners.length === 0 ? (
                <p className="text-xs text-gray-400">{tr("Vazifalar farroshga biriktirilmagan")}</p>
              ) : (
                <div className="space-y-1">
                  {topCleaners.map((c) => (
                    <p key={c.user_id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-gray-800">{c.name || tr("Noma'lum")}</span>
                      <span className="flex-shrink-0 text-xs tabular-nums">
                        <b className="text-emerald-600">{c.by_person}</b>
                        {c.auto > 0 && <span className="ml-1.5 text-amber-600">+{c.auto} {tr("avto")}</span>}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-100 px-3 py-2.5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {tr("E'tibor talab qiladigan xonalar")}
              </p>
              {attentionRooms.length === 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {tr("Hammasi joyida")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {attentionRooms.slice(0, 8).map((r) => (
                    <span
                      key={r.room_number}
                      title={[
                        r.no_task ? tr("vazifasiz: {{n}}", { n: r.no_task }) : "",
                        r.auto ? tr("avto: {{n}}", { n: r.auto }) : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-bold tabular-nums",
                        r.no_task ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                      )}
                    >
                      {r.room_number}
                    </span>
                  ))}
                  {attentionRooms.length > 8 && (
                    <span className="px-1 text-xs text-gray-400">+{attentionRooms.length - 8}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <CleaningReportDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        initialFrom={period.from}
        initialTo={period.to}
      />
    </section>
  )
}
