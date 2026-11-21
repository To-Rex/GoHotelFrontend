import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, ChevronLeft, ChevronRight, Gauge, Loader2, Save, ShieldAlert } from "lucide-react"

import { tr } from "@/i18n"
import { apiErrorMessage } from "@/lib/apiError"
import { hotelClock, formatHotelMoment } from "@/lib/hotelTime"
import { cn } from "@/lib/utils"

import {
  useAiMe,
  useAiUsage,
  useIncidents,
  useReviewIncident,
  useSaveLimits,
  type AiMember,
  type ChartBlock,
} from "../api/assistant"
import { ChartBlockView } from "../components/ChartBlockView"
import { Markdown } from "../components/Markdown"
import { formatCompact, formatNumber } from "../lib/format"

/* AI yordamchi sarfi — administrator, tizim ma'muri va sozlovchi.

   Oy bo'yicha: jami token, xabarlar, faol xodimlar, taxminiy narx (sozlovchi
   narx kiritgan bo'lsa); kunlik grafik; xodimlar ro'yxati va shaxsiy limit
   (administrator o'zgartira oladi). "Xavfli so'rovlar" — faqat tizim
   ma'muri va sozlovchiga: savol, berilgan javob, toifa. */

const pad = (n: number) => String(n).padStart(2, "0")
const thisMonth = () => (hotelClock(new Date())?.ymd ?? "").slice(0, 7)
const shiftMonth = (m: string, delta: number) => {
  const [y, mo] = m.split("-").map(Number)
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}
// i18n:keys
const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
]
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number)
  return `${tr(MONTHS[mo - 1] ?? "")} ${y}`
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
      {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
    </div>
  )
}

function UsageTab({ month }: { month: string }) {
  const { data, isLoading, isFetching } = useAiUsage(month)
  const saveLimits = useSaveLimits()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!data) return
    setDraft(Object.fromEntries(data.members.map((m) => [m.user_id, m.monthly_limit != null ? String(m.monthly_limit) : ""])))
  }, [data])

  const chart: ChartBlock | null = useMemo(() => {
    if (!data?.daily.length) return null
    return {
      type: "chart",
      id: "usage-daily",
      chart: "bar",
      title: tr("Kunlik sarf"),
      unit: tr("token"),
      x: { key: "x", label: tr("Kun") },
      series: [{ key: "tokens", label: tr("Token") }],
      data: data.daily.map((d) => ({ x: d.date, tokens: d.tokens })),
      truncated: false,
    }
  }, [data])

  const parse = (v: string) => {
    const n = Number(v.replace(/[\s ]/g, ""))
    return v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n) : null
  }
  const dirty = (data?.members ?? []).filter((m) => !m.system && parse(draft[m.user_id] ?? "") !== m.monthly_limit)

  const submit = async () => {
    setNote(null)
    try {
      await saveLimits.mutateAsync(dirty.map((m) => ({ user_id: m.user_id, monthly_limit: parse(draft[m.user_id] ?? "") })))
      setNote({ ok: true, text: tr("Limitlar saqlandi") })
    } catch (e) {
      setNote({ ok: false, text: apiErrorMessage(e) })
    }
  }

  if (isLoading) return <p className="py-10 text-center text-sm text-gray-400">{tr("Yuklanmoqda...")}</p>
  if (!data) return null
  const t = data.totals

  const limitOf = (m: AiMember) => (m.system ? null : m.effective_limit ?? null)

  return (
    <div className={cn("space-y-4 transition-opacity", isFetching && "opacity-70")}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label={tr("Jami token")}
          value={formatCompact(t.tokens)}
          hint={tr("kiruvchi {{i}} · chiquvchi {{o}}", { i: formatCompact(t.input), o: formatCompact(t.output) })}
        />
        <Tile label={tr("Javoblar")} value={formatNumber(t.messages)} />
        <Tile label={tr("Faol xodimlar")} value={formatNumber(t.active_users)} />
        <Tile
          label={tr("Taxminiy narx")}
          value={t.cost_usd != null ? `$${t.cost_usd.toFixed(2)}` : "—"}
          hint={
            data.hotel_monthly_limit != null
              ? tr("mehmonxona limiti: {{l}}", { l: formatCompact(data.hotel_monthly_limit) })
              : t.cost_usd == null
                ? tr("narx sozlanmagan")
                : undefined
          }
        />
      </div>
      {chart && <ChartBlockView block={chart} />}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
          <p className="font-semibold text-gray-900">{tr("Xodimlar")}</p>
          <span className="text-xs text-gray-500">
            {data.default_monthly_limit != null
              ? tr("Umumiy limit: {{l}} token / oy", { l: formatNumber(data.default_monthly_limit) })
              : tr("Umumiy limit yo'q")}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!dirty.length || saveLimits.isPending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saveLimits.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {dirty.length ? tr("Limitlarni saqlash ({{n}})", { n: dirty.length }) : tr("Limitlarni saqlash")}
          </button>
          {note && <span className={cn("w-full text-xs sm:w-auto", note.ok ? "text-emerald-700" : "text-red-600")}>{note.text}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-semibold">{tr("Xodim")}</th>
                <th className="px-4 py-2 font-semibold">{tr("Ruxsat")}</th>
                <th className="px-4 py-2 text-right font-semibold">{tr("Token")}</th>
                <th className="px-4 py-2 text-right font-semibold">{tr("Javoblar")}</th>
                <th className="px-4 py-2 font-semibold">{tr("Oxirgi")}</th>
                <th className="px-4 py-2 text-right font-semibold">{tr("Shaxsiy limit")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.members.map((m) => {
                const limit = limitOf(m)
                const pct = limit ? Math.min(100, Math.round((m.month_tokens / Math.max(limit, 1)) * 100)) : null
                return (
                  <tr key={m.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <p className="font-medium text-gray-900">{m.name}</p>
                      <p className="text-[11px] text-gray-500">@{m.username}</p>
                    </td>
                    <td className="px-4 py-2">
                      {m.system ? (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">{tr("Doim")}</span>
                      ) : m.allowed ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{tr("Bor")}</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{tr("Yo'q")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className="font-semibold text-gray-900">{formatCompact(m.month_tokens)}</span>
                      {pct !== null && (
                        <div className="ml-auto mt-1 h-1 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={cn("h-full rounded-full", pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-primary-500")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{formatNumber(m.month_messages)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{m.last_used_at ? formatHotelMoment(m.last_used_at) : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {m.system ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <input
                          inputMode="numeric"
                          value={draft[m.user_id] ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, [m.user_id]: e.target.value }))}
                          placeholder={data.default_monthly_limit != null ? formatNumber(data.default_monthly_limit) : tr("cheklanmagan")}
                          className="h-8 w-32 rounded-lg border border-gray-200 bg-white px-2 text-right text-xs tabular-nums text-gray-900 outline-none focus:border-primary-400"
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const SOURCE_LABEL: Record<string, () => string> = {
  heuristic: () => tr("Avtomatik aniqlandi"),
  model: () => tr("Yordamchi belgiladi"),
  server: () => tr("Server to'xtatdi"),
}

function IncidentsTab() {
  const [onlyNew, setOnlyNew] = useState(true)
  const [category, setCategory] = useState("")
  const { data, isLoading } = useIncidents({ reviewed: onlyNew ? false : undefined, category: category || undefined })
  const review = useReviewIncident()
  const categories = data?.categories ?? {}

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-white p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setOnlyNew(true)}
            className={cn("rounded-md px-3 py-1.5 font-medium", onlyNew ? "bg-primary-50 text-primary-700" : "text-gray-600")}
          >
            {tr("Ko'rilmagan")}
            {data && data.unreviewed > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{data.unreviewed}</span>}
          </button>
          <button
            type="button"
            onClick={() => setOnlyNew(false)}
            className={cn("rounded-md px-3 py-1.5 font-medium", !onlyNew ? "bg-primary-50 text-primary-700" : "text-gray-600")}
          >
            {tr("Hammasi")}
          </button>
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none"
        >
          <option value="">{tr("Barcha toifalar")}</option>
          {Object.entries(categories).map(([k, v]) => (
            <option key={k} value={k}>
              {tr(v)}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{data ? tr("{{n}} ta yozuv", { n: data.total }) : ""}</span>
      </div>
      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-400">{tr("Yuklanmoqda...")}</p>
      ) : !data?.items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
          {onlyNew ? tr("Ko'rilmagan xavfli so'rov yo'q") : tr("Xavfli so'rovlar qayd etilmagan")}
        </div>
      ) : (
        data.items.map((inc) => (
          <div key={inc.id} className={cn("rounded-2xl border bg-white p-4", !inc.reviewed && "border-red-200")}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                <ShieldAlert className="h-3 w-3" />
                {tr(inc.category_label)}
              </span>
              <span className="text-gray-500">{(SOURCE_LABEL[inc.source] ?? SOURCE_LABEL.model)()}</span>
              <span className="font-medium text-gray-900">{inc.user_name ?? "—"}</span>
              <span className="text-gray-400">{inc.created_at ? formatHotelMoment(inc.created_at) : ""}</span>
              <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-gray-600">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                  checked={inc.reviewed}
                  onChange={(e) => review.mutate({ id: inc.id, reviewed: e.target.checked })}
                />
                {tr("Ko'rib chiqildi")}
              </label>
            </div>
            {inc.reason && <p className="mt-1.5 text-xs text-gray-500">{inc.reason}</p>}
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{tr("Savol")}</p>
                <p className="whitespace-pre-wrap text-sm text-gray-900 [overflow-wrap:anywhere]">{inc.question}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{tr("Berilgan javob")}</p>
                {inc.answer ? <Markdown text={inc.answer} className="text-gray-700" /> : <p className="text-sm text-gray-500">—</p>}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default function AiUsagePage() {
  const me = useAiMe()
  const [month, setMonth] = useState(thisMonth)
  const [tab, setTab] = useState<"usage" | "incidents">("usage")
  const current = thisMonth()

  if (me.isLoading) return <p className="py-10 text-center text-sm text-gray-400">{tr("Yuklanmoqda...")}</p>
  if (!me.data?.can_manage_usage) {
    return <p className="py-10 text-center text-sm text-gray-500">{tr("Bu sahifa administrator uchun")}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <Gauge className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{tr("AI yordamchi sarfi")}</h1>
          <p className="text-xs text-gray-500">
            {me.data.enabled
              ? [me.data.provider_label, me.data.model].filter(Boolean).join(" · ")
              : tr("Yordamchi o'chirilgan yoki sozlanmagan")}
          </p>
        </div>
        {me.data.can_configure && (
          <Link to="/settings#ai-assistant" className="text-xs font-medium text-primary-600 hover:underline">
            {tr("Sozlamalar")}
          </Link>
        )}
        {tab === "usage" && (
          <div className="ml-auto flex items-center gap-1 rounded-lg border bg-white p-0.5">
            <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] text-center text-sm font-semibold text-gray-900">{monthLabel(month)}</span>
            <button
              type="button"
              disabled={month >= current}
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {me.data.can_view_incidents && (
        <div className="flex gap-1 border-b">
          {(["usage", "incidents"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
                tab === k ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              {k === "usage" ? <Gauge className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {k === "usage" ? tr("Sarf va limitlar") : tr("Xavfli so'rovlar")}
            </button>
          ))}
        </div>
      )}

      {tab === "usage" ? <UsageTab month={month} /> : <IncidentsTab />}
    </div>
  )
}
