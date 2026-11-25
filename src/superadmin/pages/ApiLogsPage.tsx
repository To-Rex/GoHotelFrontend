import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  Copy,
  Database,
  Pause,
  Play,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  useApiLogs,
  useClearApiLogs,
  useHotels,
  type ApiLogEntry,
  type PanelHotel,
} from "../api/panel"
import { PanelButton, PanelNotice } from "../components/ui"
import { MethodPicker, StatusPanel } from "../components/ApiLogFilters"
import {
  Emblem,
  GirihPattern,
  HoshiyaRule,
  Rosette,
  StarMark,
  StarSpinner,
} from "../components/ornament"
import {
  SINCE_LABELS,
  SINCE_OPTIONS,
  buildStatusParam,
  focusCode,
  parseMethodsParam,
  parseSinceParam,
  parseStatusParam,
  statusLabel,
  type StatusSelection,
} from "../lib/apiLogFilters"
import {
  METHOD_COLOR,
  UZ,
  durationColor,
  statusColor,
} from "../lib/ornament"
import { tr, trc } from "@/i18n"

/**
 * So'rovlar jurnali — backendga kelayotgan so'rovlar jonli ko'rinishda.
 *
 * Jonli jurnal serverda XOTIRADA turadi (oxirgi 500 ta): server qayta
 * ko'tarilsa bo'shaydi. Xatolar (4xx/5xx) esa bazada 3 kun saqlanadi va
 * shu ro'yxatda jonli yozuvlar bilan birga keladi (`stored` belgisi) —
 * "bron qilishda server xatosi chiqdi" degan muammo ertasiga ham, deploy
 * dan keyin ham ochib ko'riladi; ishlov berilmagan xatoning traceback'i
 * ham bor. Sahifa ochiq turganda har 3 soniyada yangilanadi — pauza
 * tugmasi bilan to'xtatib, qatorni bemalol o'rganish mumkin. Sir
 * maydonlar (parol, token) serverda niqoblanadi va bu yerga *** bo'lib
 * keladi.
 *
 * Har bir yozuvda mehmonxona/filial/foydalanuvchi konteksti ham bor:
 * kompaniya bo'yicha filtr, ustunlar bo'yicha saralash va to'liq
 * tafsilotlar (request/response, user-agent, IP) shu yerga tayanadi.
 *
 * Filtrlar: holat kodlari (bir nechtasi birga, har birining soni bilan;
 * "faqat shular" yoki "shularsiz"), metodlar (bir nechtasi), davr, URL.
 * Kompaniya, holat, metod va davr URL'da turadi — sahifa yangilansa yoki
 * havola yuborilsa ham filtr saqlanadi.
 *
 * Ko'rinish: minimal, o'zbek naqshi bilan — sarlavha fonida girih to'ri,
 * bo'limlar orasida hoshiya, belgilar sakkiz qirrali yulduz; holat
 * sinflari koshin ranglarida (feruza, lojuvard, tilla, anor — lib/ornament).
 */
export function ApiLogsPage() {
  const [params, setParams] = useSearchParams()
  const hotelId = params.get("hotel_id") || ""
  const status = params.get("status") || ""
  const statusSel = useMemo(() => parseStatusParam(status), [status])
  const methods = useMemo(() => parseMethodsParam(params.get("method")), [params])
  const since = parseSinceParam(params.get("since"))
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<SortKey>("ts")
  const [order, setOrder] = useState<SortOrder>("desc")
  const [paused, setPaused] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  /* Filtr URL'da. Har bir o'zgarish URL'ning ENG SO'NGGI holatidan
     hisoblanadi (window.location): router URL'ni darhol yozadi, sahifa esa
     biroz keyin yangilanadi — ketma-ket tez bosishda oldingi tanlov
     yo'qolmasligi uchun eski render qiymatiga tayanilmaydi. */
  const patchParams = (
    patch: (current: URLSearchParams) => Record<string, string | null>
  ) => {
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(patch(next))) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }
  const changeHotel = (value: string) => patchParams(() => ({ hotel_id: value || null }))
  const changeStatus = (update: (current: StatusSelection) => StatusSelection) =>
    patchParams((cur) => ({
      status: buildStatusParam(update(parseStatusParam(cur.get("status")))) || null,
    }))
  const changeMethods = (update: (current: string[]) => string[]) =>
    patchParams((cur) => ({
      method: update(parseMethodsParam(cur.get("method"))).join(",") || null,
    }))
  const changeSince = (value: string) => patchParams(() => ({ since: value || null }))

  const { data: hotels = [] } = useHotels()
  const method = methods.join(",")
  const { data, isLoading, isError, refetch, isFetching } = useApiLogs(
    { method, status, q, hotel_id: hotelId, since_minutes: since, sort, order },
    !paused
  )
  const clearLogs = useClearApiLogs()

  const rows = useMemo(() => data?.items ?? [], [data])
  const hotelNames = useMemo(
    () => new Map((hotels as PanelHotel[]).map((h) => [h.id, h.name])),
    [hotels]
  )
  const errors = useMemo(
    () => rows.filter((row) => row.status >= 400).length,
    [rows]
  )
  const retentionDays = data?.retention_days ?? 3
  const avgDuration = rows.length
    ? Math.round(
        rows.reduce((sum, row) => sum + row.duration_ms, 0) / rows.length
      )
    : 0
  const maxDuration = Math.max(1, ...rows.map((row) => row.duration_ms))
  const matched = data?.matched_total ?? rows.length
  const hasFilters = !!(
    method ||
    status ||
    since ||
    hotelId ||
    q.trim() ||
    sort !== "ts" ||
    order !== "desc"
  )

  const companyOf = (row: ApiLogEntry) =>
    row.hotel_id
      ? hotelNames.get(row.hotel_id) || row.hotel_id.slice(0, 8)
      : "—"

  const changeSort = (key: SortKey) => {
    if (sort === key) setOrder((value) => (value === "asc" ? "desc" : "asc"))
    else {
      setSort(key)
      setOrder(
        key === "ts" || key === "duration_ms" || key === "status"
          ? "desc"
          : "asc"
      )
    }
  }

  const resetFilters = () => {
    setQ("")
    setSort("ts")
    setOrder("desc")
    patchParams(() => ({ hotel_id: null, status: null, method: null, since: null }))
  }

  const subtitle = tr(
    "Jonli jurnal — xotiradagi oxirgi so'rovlar ({{v}} tagacha); xatolar (4xx/5xx) bazada {{d}} kun saqlanadi",
    { v: data?.max_entries ?? 500, d: retentionDays }
  )

  return (
    <div className="space-y-4">
      {/* Sarlavha — girih to'ri ustida, ostida hoshiya va ko'rsatkichlar */}
      <header className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0f1216]">
        <GirihPattern className="text-[#bf8a24] opacity-[0.3] [mask-image:linear-gradient(100deg,transparent_34%,black_82%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4 px-5 pb-5 pt-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3.5">
            <Emblem />
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[#f1e9d8]">
                {tr("So'rovlar jurnali")}
              </h1>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-400">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 text-xs text-slate-300">
              <StarMark
                className={cn("h-3 w-3", !paused && "animate-pulse motion-reduce:animate-none")}
                style={{ color: paused ? UZ.tilla : UZ.feruza }}
              />
              {paused ? tr("Pauza") : tr("jonli")}
            </span>
            <PanelButton
              variant="ghost"
              onClick={() => setPaused((value) => !value)}
              title={
                paused
                  ? tr("Jonli yangilanishni davom ettirish")
                  : tr("Yangilanishni to'xtatib turish")
              }
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? tr("Davom ettirish") : tr("Pauza")}
            </PanelButton>
            <PanelButton
              variant="ghost"
              onClick={() => refetch()}
              title={tr("Hozir yangilash")}
            >
              <RotateCcw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </PanelButton>
            <PanelButton
              variant="ghost"
              onClick={() => clearLogs.mutate()}
              disabled={clearLogs.isPending}
              title={tr("Jonli jurnalni tozalash (bazada saqlangan xatolar {{d}} kungacha qoladi)", { d: retentionDays })}
            >
              <Trash2 className="h-4 w-4" />
              {trc("clear", "Tozalash")}
            </PanelButton>
          </div>
        </div>
        <HoshiyaRule className="relative" />
        <dl className="relative grid grid-cols-2 gap-px bg-white/[0.05] sm:grid-cols-3 lg:grid-cols-5">
          <Stat label={tr("Jami")} value={data?.captured_total ?? 0} />
          <Stat
            label={tr("Ko'rsatilgan")}
            value={matched > rows.length ? `${rows.length} / ${matched}` : rows.length}
          />
          <Stat label={tr("Xatolar")} value={errors} color={errors ? UZ.anor : undefined} />
          <Stat
            label={tr("Saqlangan xatolar ({{d}} kun)", { d: retentionDays })}
            value={data?.stored_errors ?? 0}
            color={data?.stored_errors ? UZ.tilla : undefined}
          />
          <Stat
            label={tr("O'rtacha davomiylik")}
            value={`${avgDuration} ms`}
            color={rows.length ? durationColor(avgDuration) : undefined}
          />
        </dl>
      </header>

      {/* Filtrlar */}
      <section className="rounded-2xl border border-white/[0.07] bg-[#0f1216] p-4 sm:p-5">
        <div className="flex flex-wrap gap-2.5">
          <label className="flex h-10 min-w-[16rem] flex-1 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-black/25 px-3 transition-colors focus-within:border-[#1fa694]/60">
            <Search className="h-4 w-4 flex-shrink-0 text-slate-500" />
            <input
              placeholder={tr("URL bo'yicha qidirish: /reservations, /guests...")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-full w-full bg-transparent font-mono text-[13px] text-slate-100 placeholder:font-sans placeholder:text-slate-600 focus:outline-none"
            />
          </label>
          <select
            value={hotelId}
            onChange={(e) => changeHotel(e.target.value)}
            aria-label={tr("Kompaniya")}
            title={tr("Kompaniya")}
            className={FIELD + " w-full sm:w-56"}
          >
            <option value="">{tr("Barcha kompaniyalar")}</option>
            {[...(hotels as PanelHotel[])]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
          </select>
          <select
            value={since ? String(since) : ""}
            onChange={(e) => changeSince(e.target.value)}
            aria-label={tr("Davr")}
            title={tr("Davr")}
            className={FIELD + " w-full sm:w-44"}
          >
            <option value="">{tr("Butun davr")}</option>
            {[...SINCE_OPTIONS, ...(since && !SINCE_LABELS[since] ? [since] : [])].map((minutes) => (
              <option key={minutes} value={minutes}>
                {sinceLabel(minutes)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
            title={tr("Filtrlarni tozalash")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.07] px-3.5 text-[13px] text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">{tr("Filtrlarni tozalash")}</span>
          </button>
        </div>
        <div className="mt-4">
          <MethodPicker methods={methods} onChange={changeMethods} />
        </div>
        <HoshiyaRule className="my-4 opacity-60" />
        <StatusPanel
          selection={statusSel}
          counts={data?.status_counts}
          onChange={changeStatus}
        />
      </section>

      {isError && (
        <PanelNotice>
          {tr("Jurnalni yuklab bo'lmadi. Qayta urinib ko'ring.")}
        </PanelNotice>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16" style={{ color: UZ.tilla }}>
          <StarSpinner />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/[0.08] px-6 py-14 text-center">
          <Rosette className="opacity-60" style={{ color: UZ.tilla }} />
          <p className="mt-5 text-sm text-slate-300">
            {hasFilters
              ? tr("Filtrga mos yozuv topilmadi")
              : tr(
                  "Hozircha yozuv yo'q — so'rovlar kelishi bilan shu yerda ko'rinadi"
                )}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3.5 text-[13px] text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
            >
              <RotateCcw className="h-4 w-4" />
              {tr("Filtrlarni tozalash")}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0f1216]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] text-sm">
              <thead className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0c0e12]/95 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500 backdrop-blur">
                <tr>
                  <SortHead label={tr("Vaqt")} column="ts" sort={sort} order={order} onSort={changeSort} />
                  <th className="px-3 py-3 font-semibold">{tr("Kompaniya")}</th>
                  <SortHead label={tr("Metod")} column="method" sort={sort} order={order} onSort={changeSort} />
                  <SortHead label="URL" column="path" sort={sort} order={order} onSort={changeSort} />
                  <SortHead label={tr("Holat")} column="status" sort={sort} order={order} onSort={changeSort} />
                  <SortHead label={tr("Vaqt (ms)")} column="duration_ms" sort={sort} order={order} onSort={changeSort} />
                  <th className="px-3 py-3 font-semibold">{tr("Foydalanuvchi")}</th>
                  <th className="px-3 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rows.map((row) => (
                  <LogRow
                    key={row.id}
                    row={row}
                    company={companyOf(row)}
                    retentionDays={retentionDays}
                    maxDuration={maxDuration}
                    open={openId === row.id}
                    onToggle={() =>
                      setOpenId(openId === row.id ? null : row.id)
                    }
                    statusSelected={
                      statusSel.mode === "include" &&
                      statusSel.tokens.includes(String(row.status))
                    }
                    onStatusClick={() =>
                      changeStatus((current) => focusCode(current, row.status))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

type SortKey = "ts" | "duration_ms" | "status" | "method" | "path"
type SortOrder = "asc" | "desc"

const FIELD =
  "h-10 rounded-xl border border-white/[0.07] bg-black/25 px-3 text-[13px] text-slate-100 transition-colors focus:border-[#1fa694]/60 focus:outline-none [&>option]:bg-[#12151a]"

const USER_COLOR: Record<string, string> = {
  SUPER_ADMIN: UZ.anor,
  ADMIN: UZ.lojuvard,
  EMPLOYEE: UZ.feruza,
  CONFIGURATOR: UZ.tilla,
}

const tinted = (color: string, bg = 14, ring = 34) => ({
  background: `color-mix(in oklab, ${color} ${bg}%, transparent)`,
  boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} ${ring}%, transparent)`,
})

/** Davr nomi; ro'yxatda yo'q qiymat (URL qo'lda yozilgan) — daqiqada. */
function sinceLabel(minutes: number): string {
  const label = SINCE_LABELS[minutes]
  return label ? tr(label) : `${minutes} min`
}

/** JSON matnni o'qishga qulay ko'rinishga keltiradi; JSON bo'lmasa asliday. */
function pretty(text: string | null | undefined): string {
  if (!text) return "—"
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  /** Urg'u rangi (yulduz belgisi) — qiymat e'tibor talab qilganda */
  color?: string
}) {
  return (
    <div className="flex flex-col justify-between gap-1.5 bg-[#0f1216] px-5 py-4">
      <dt className="flex items-start gap-1.5 text-[10px] font-semibold uppercase leading-snug tracking-[0.14em] text-slate-500">
        <StarMark className="mt-px h-2.5 w-2.5" style={{ color: color ?? "#3a414d" }} />
        <span>{label}</span>
      </dt>
      <dd className="font-mono text-[22px] font-medium tabular-nums tracking-tight text-[#f1e9d8]">
        {value}
      </dd>
    </div>
  )
}

function SortHead({
  label,
  column,
  sort,
  order,
  onSort,
}: {
  label: string
  column: SortKey
  sort: SortKey
  order: SortOrder
  onSort: (column: SortKey) => void
}) {
  const active = sort === column
  return (
    <th className="px-3 py-3 font-semibold">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1.5 uppercase tracking-[0.12em] transition-colors hover:text-slate-200",
          active ? "text-[#f1e9d8]" : "text-slate-500"
        )}
      >
        {label}
        {active ? (
          order === "asc" ? (
            <ArrowUp className="h-3 w-3" style={{ color: UZ.tilla }} />
          ) : (
            <ArrowDown className="h-3 w-3" style={{ color: UZ.tilla }} />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  )
}

function Meta({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p
        className={cn("mt-0.5 truncate text-xs text-slate-200", mono && "font-mono")}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

function BodyBlock({
  title,
  text,
}: {
  title: string
  text?: string | null
}) {
  const [copied, setCopied] = useState(false)
  const value = pretty(text)

  const copy = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard ruxsati bo'lmasa hech narsa qilmaymiz
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/35">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.05] px-3 py-1.5">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <StarMark className="h-2 w-2" style={{ color: UZ.tilla }} />
          {title}
        </p>
        <button
          type="button"
          onClick={copy}
          disabled={!text}
          title={tr("Nusxalash")}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 disabled:opacity-40"
        >
          {copied ? (
            <Check className="h-3 w-3" style={{ color: UZ.feruza }} />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? tr("Nusxalandi") : tr("Nusxalash")}
        </button>
      </div>
      <pre className="max-h-72 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-slate-300">
        {value}
      </pre>
    </div>
  )
}

function LogRow({
  row,
  company,
  retentionDays,
  maxDuration,
  open,
  onToggle,
  statusSelected,
  onStatusClick,
}: {
  row: ApiLogEntry
  company: string
  retentionDays: number
  maxDuration: number
  open: boolean
  onToggle: () => void
  /** Shu kod holat filtrida tanlanganmi */
  statusSelected: boolean
  /** Holat belgisini bosish — shu kod bo'yicha filtrlash */
  onStatusClick: () => void
}) {
  const date = new Date(row.ts)
  const time = date.toLocaleTimeString("uz-UZ", { hour12: false })
  const day = date.toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
  })
  const sColor = statusColor(row.status)
  const dColor = durationColor(row.duration_ms)
  const uColor = USER_COLOR[row.user_type || ""]

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-colors hover:bg-white/[0.02]",
          open && "bg-white/[0.03]"
        )}
      >
        <td
          className="whitespace-nowrap px-3 py-2.5 text-xs"
          title={date.toLocaleString("uz-UZ")}
        >
          <p className="font-mono text-slate-200">{time}</p>
          <p className="font-mono text-[10px] text-slate-500">{day}</p>
        </td>
        <td className="max-w-[12rem] px-3 py-2.5">
          <span
            className="inline-flex max-w-full items-center truncate rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[11px] text-slate-300"
            title={company}
          >
            {company}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-200">
            <i
              aria-hidden
              className="h-3 w-[3px] rounded-full"
              style={{ background: METHOD_COLOR[row.method] ?? "#5b6372" }}
            />
            {row.method}
          </span>
        </td>
        <td
          className="max-w-[360px] truncate px-3 py-2.5 font-mono text-xs text-slate-300"
          title={row.path}
        >
          {row.path}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onStatusClick()
            }}
            title={[
              statusLabel(row.status),
              statusSelected
                ? tr("Filtrdan olib tashlash")
                : tr("Shu holat bo'yicha filtrlash"),
            ]
              .filter(Boolean)
              .join(" — ")}
            className="group inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-50 transition-shadow"
            style={tinted(sColor, statusSelected ? 24 : 13, statusSelected ? 70 : 32)}
          >
            <StarMark
              className={cn(
                "h-2.5 w-2.5 transition-transform duration-300 motion-reduce:transition-none group-hover:rotate-45",
                statusSelected && "rotate-[22.5deg]"
              )}
              style={{ color: sColor }}
            />
            {row.status}
          </button>
          {row.stored && (
            <span
              className="ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-300"
              style={tinted(UZ.tilla, 10, 28)}
              title={tr("Bazada saqlangan xato — {{d}} kungacha turadi", { d: retentionDays })}
            >
              <Database className="h-3 w-3" style={{ color: UZ.tilla }} />
              {tr("saqlangan")}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <p className="font-mono text-xs tabular-nums text-slate-300">
            {row.duration_ms} ms
          </p>
          <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-white/[0.05]">
            <span
              className="block h-full rounded-full"
              style={{
                background: dColor,
                width: `${Math.max(4, Math.min(100, (row.duration_ms / maxDuration) * 100))}%`,
              }}
            />
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span
            className="rounded-md px-1.5 py-0.5 text-[11px] text-slate-200"
            style={uColor ? tinted(uColor, 12, 30) : { background: "rgba(255,255,255,0.04)" }}
            title={row.user_id || row.user_type || ""}
          >
            {row.user_type || "—"}
          </span>
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{row.ip || "—"}</td>
      </tr>
      {open && (
        <tr>
          <td
            colSpan={8}
            className="bg-black/25 px-5 py-4"
            style={{ boxShadow: `inset 3px 0 0 ${sColor}` }}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Meta label={tr("Kompaniya")} value={company} />
              <Meta label={tr("Filial")} value={row.branch_id || "—"} mono />
              <Meta
                label={tr("Foydalanuvchi turi")}
                value={row.user_type || "—"}
              />
              <Meta label="ID" value={row.user_id || "—"} mono />
              <Meta label="IP" value={row.ip || "—"} mono />
              <Meta
                label="User-Agent"
                value={row.user_agent || "—"}
                className="sm:col-span-2"
              />
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <BodyBlock title={tr("So'rov tanasi")} text={row.request_body} />
              <BodyBlock title={tr("Javob")} text={row.response_body} />
              {row.error && (
                <div className="lg:col-span-2">
                  <BodyBlock title={tr("Xato (traceback)")} text={row.error} />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
