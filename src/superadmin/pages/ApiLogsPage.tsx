import { useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  Copy,
  Loader2,
  Pause,
  Play,
  RotateCcw,
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
import {
  PanelButton,
  PanelCard,
  PanelEmpty,
  PanelHeading,
  PanelInput,
  PanelNotice,
  PanelSelect,
} from "../components/ui"
import { tr, trc } from "@/i18n"

/**
 * So'rovlar jurnali — backendga kelayotgan so'rovlar jonli ko'rinishda.
 *
 * Jurnal serverda FAQAT XOTIRADA turadi (oxirgi 500 ta): diskka
 * yozilmaydi, server qayta ko'tarilsa bo'shaydi. Sahifa ochiq turganda
 * har 3 soniyada yangilanadi — pauza tugmasi bilan to'xtatib, qatorni
 * bemalol o'rganish mumkin. Sir maydonlar (parol, token) serverda
 * niqoblanadi va bu yerga *** bo'lib keladi.
 *
 * Har bir yozuvda mehmonxona/filial/foydalanuvchi konteksti ham bor:
 * kompaniya bo'yicha filtr, ustunlar bo'yicha saralash va to'liq
 * tafsilotlar (request/response, user-agent, IP) shu yerga tayanadi.
 */
export function ApiLogsPage() {
  const [method, setMethod] = useState("")
  const [status, setStatus] = useState("")
  const [hotelId, setHotelId] = useState("")
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<SortKey>("ts")
  const [order, setOrder] = useState<SortOrder>("desc")
  const [paused, setPaused] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const { data: hotels = [] } = useHotels()
  const { data, isLoading, isError, refetch, isFetching } = useApiLogs(
    { method, status, q, hotel_id: hotelId, sort, order },
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
  const avgDuration = rows.length
    ? Math.round(
        rows.reduce((sum, row) => sum + row.duration_ms, 0) / rows.length
      )
    : 0
  const maxDuration = Math.max(1, ...rows.map((row) => row.duration_ms))
  const hasFilters = !!(
    method ||
    status ||
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
    setMethod("")
    setStatus("")
    setHotelId("")
    setQ("")
    setSort("ts")
    setOrder("desc")
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PanelHeading
          title={tr("So'rovlar jurnali")}
          subtitle={tr(
            "Backendga kelgan oxirgi {{v}} ta so'rov — faqat xotirada, diskka yozilmaydi",
            { v: data?.max_entries ?? 500 }
          )}
        />
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                paused ? "bg-amber-400" : "animate-pulse bg-emerald-400"
              )}
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
            title={tr("Jurnalni tozalash (faqat xotiradagi yozuvlar)")}
          >
            <Trash2 className="h-4 w-4" />
            {trc("clear", "Tozalash")}
          </PanelButton>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={tr("Jami")} value={data?.captured_total ?? 0} />
        <Stat label={tr("Ko'rsatilgan")} value={rows.length} />
        <Stat
          label={tr("Xatolar")}
          value={errors}
          tone={errors ? "text-rose-300" : "text-slate-100"}
        />
        <Stat
          label={tr("O'rtacha davomiylik")}
          value={`${avgDuration} ms`}
        />
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_8rem_8rem_minmax(0,1fr)_auto]">
        <PanelSelect
          value={hotelId}
          onChange={(e) => setHotelId(e.target.value)}
          aria-label={tr("Kompaniya")}
          title={tr("Kompaniya")}
        >
          <option value="">{tr("Barcha kompaniyalar")}</option>
          {[...(hotels as PanelHotel[])]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
        </PanelSelect>
        <PanelSelect
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          aria-label={tr("Metod")}
        >
          <option value="">{tr("Barcha metodlar")}</option>
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </PanelSelect>
        <PanelSelect
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={tr("Holat")}
        >
          <option value="">{tr("Barcha holatlar")}</option>
          <option value="2xx">{tr("2xx — muvaffaqiyat")}</option>
          <option value="3xx">{tr("3xx — yo'naltirish")}</option>
          <option value="4xx">{tr("4xx — mijoz xatosi")}</option>
          <option value="5xx">{tr("5xx — server xatosi")}</option>
        </PanelSelect>
        <PanelInput
          placeholder={tr("URL bo'yicha qidirish: /reservations, /guests...")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <PanelButton
          variant="ghost"
          onClick={resetFilters}
          disabled={!hasFilters}
          title={tr("Filtrlarni tozalash")}
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">{tr("Filtrlarni tozalash")}</span>
        </PanelButton>
      </div>

      {isError && (
        <div className="mb-4">
          <PanelNotice>
            {tr("Jurnalni yuklab bo'lmadi. Qayta urinib ko'ring.")}
          </PanelNotice>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : rows.length === 0 ? (
        <PanelEmpty>
          {hasFilters
            ? tr("Filtrga mos yozuv topilmadi")
            : tr(
                "Hozircha yozuv yo'q — so'rovlar kelishi bilan shu yerda ko'rinadi"
              )}
        </PanelEmpty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950/95 text-left text-xs text-slate-400 backdrop-blur">
                <tr>
                  <SortHead
                    label={tr("Vaqt")}
                    column="ts"
                    sort={sort}
                    order={order}
                    onSort={changeSort}
                  />
                  <th className="px-3 py-2.5 font-medium">{tr("Kompaniya")}</th>
                  <SortHead
                    label={tr("Metod")}
                    column="method"
                    sort={sort}
                    order={order}
                    onSort={changeSort}
                  />
                  <SortHead
                    label="URL"
                    column="path"
                    sort={sort}
                    order={order}
                    onSort={changeSort}
                  />
                  <SortHead
                    label={tr("Holat")}
                    column="status"
                    sort={sort}
                    order={order}
                    onSort={changeSort}
                  />
                  <SortHead
                    label={tr("Vaqt (ms)")}
                    column="duration_ms"
                    sort={sort}
                    order={order}
                    onSort={changeSort}
                  />
                  <th className="px-3 py-2.5 font-medium">
                    {tr("Foydalanuvchi")}
                  </th>
                  <th className="px-3 py-2.5 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <LogRow
                    key={row.id}
                    row={row}
                    company={companyOf(row)}
                    maxDuration={maxDuration}
                    open={openId === row.id}
                    onToggle={() =>
                      setOpenId(openId === row.id ? null : row.id)
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

const METHOD_TONE: Record<string, string> = {
  GET: "bg-sky-500/10 text-sky-300",
  POST: "bg-emerald-500/10 text-emerald-300",
  PUT: "bg-amber-500/10 text-amber-300",
  PATCH: "bg-amber-500/10 text-amber-300",
  DELETE: "bg-rose-500/10 text-rose-300",
}

const USER_TONE: Record<string, string> = {
  SUPER_ADMIN: "bg-fuchsia-500/10 text-fuchsia-300",
  ADMIN: "bg-violet-500/10 text-violet-300",
  EMPLOYEE: "bg-sky-500/10 text-sky-300",
  CONFIGURATOR: "bg-teal-500/10 text-teal-300",
}

function statusTone(status: number): string {
  if (status >= 500) return "bg-rose-500/15 text-rose-300"
  if (status >= 400) return "bg-amber-500/15 text-amber-300"
  return "bg-emerald-500/10 text-emerald-300"
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
  tone,
}: {
  label: string
  value: number | string
  tone?: string
}) {
  return (
    <PanelCard className="p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight",
          tone || "text-slate-100"
        )}
      >
        {value}
      </p>
    </PanelCard>
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
    <th className="px-3 py-2.5 font-medium">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors hover:text-slate-200",
          active ? "text-slate-200" : "text-slate-400"
        )}
      >
        {label}
        {active ? (
          order === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
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
      <p className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={cn("truncate text-xs text-slate-300", mono && "font-mono")}
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
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? tr("Nusxalandi") : tr("Nusxalash")}
        </button>
      </div>
      <pre className="max-h-72 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
        {value}
      </pre>
    </div>
  )
}

function LogRow({
  row,
  company,
  maxDuration,
  open,
  onToggle,
}: {
  row: ApiLogEntry
  company: string
  maxDuration: number
  open: boolean
  onToggle: () => void
}) {
  const date = new Date(row.ts)
  const time = date.toLocaleTimeString("uz-UZ", { hour12: false })
  const day = date.toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
  })
  const userTone = USER_TONE[row.user_type || ""] || "bg-white/5 text-slate-400"
  const durationTone =
    row.duration_ms > 1000 ? "text-amber-300" : "text-slate-400"

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
          className="whitespace-nowrap px-3 py-2 text-xs text-slate-400"
          title={date.toLocaleString("uz-UZ")}
        >
          <p className="text-slate-300">{time}</p>
          <p className="text-[10px] text-slate-500">{day}</p>
        </td>
        <td className="max-w-[12rem] px-3 py-2">
          <span
            className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-300"
            title={company}
          >
            {company}
          </span>
        </td>
        <td className="px-3 py-2">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold",
              METHOD_TONE[row.method] || "bg-white/5 text-slate-300"
            )}
          >
            {row.method}
          </span>
        </td>
        <td
          className="max-w-[360px] truncate px-3 py-2 font-mono text-xs text-slate-300"
          title={row.path}
        >
          {row.path}
        </td>
        <td className="px-3 py-2">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold",
              statusTone(row.status)
            )}
          >
            {row.status}
          </span>
        </td>
        <td className="px-3 py-2">
          <p className={cn("text-xs tabular-nums", durationTone)}>
            {row.duration_ms} ms
          </p>
          <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-white/5">
            <span
              className={cn(
                "block h-full rounded-full",
                row.duration_ms > 1000 ? "bg-amber-400" : "bg-emerald-400/70"
              )}
              style={{
                width: `${Math.min(
                  100,
                  (row.duration_ms / maxDuration) * 100
                )}%`,
              }}
            />
          </span>
        </td>
        <td className="px-3 py-2">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[11px]",
              userTone
            )}
            title={row.user_id || row.user_type || ""}
          >
            {row.user_type || "—"}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-slate-500">{row.ip || "—"}</td>
      </tr>
      {open && (
        <tr className="bg-black/20">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <BodyBlock title={tr("So'rov tanasi")} text={row.request_body} />
              <BodyBlock title={tr("Javob")} text={row.response_body} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
