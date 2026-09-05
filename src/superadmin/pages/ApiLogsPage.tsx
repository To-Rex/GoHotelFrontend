import { useMemo, useState } from "react"
import { Loader2, Pause, Play, RotateCcw, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  useApiLogs,
  useClearApiLogs,
  type ApiLogEntry,
} from "../api/panel"
import { PanelButton, PanelEmpty, PanelHeading, PanelInput, PanelSelect } from "../components/ui"

/**
 * So'rovlar jurnali — backendga kelayotgan so'rovlar jonli ko'rinishda.
 *
 * Jurnal serverda FAQAT XOTIRADA turadi (oxirgi 500 ta): diskka
 * yozilmaydi, server qayta ko'tarilsa bo'shaydi. Sahifa ochiq turganda
 * har 3 soniyada yangilanadi — pauza tugmasi bilan to'xtatib, qatorni
 * bemalol o'rganish mumkin. Sir maydonlar (parol, token) serverda
 * niqoblanadi va bu yerga *** bo'lib keladi.
 */
export function ApiLogsPage() {
  const [method, setMethod] = useState("")
  const [status, setStatus] = useState("")
  const [q, setQ] = useState("")
  const [paused, setPaused] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const { data, isLoading, refetch, isFetching } = useApiLogs(
    { method, status, q },
    !paused
  )
  const clearLogs = useClearApiLogs()

  const rows = useMemo(() => data?.items ?? [], [data])

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PanelHeading
          title="So'rovlar jurnali"
          subtitle={`Backendga kelgan oxirgi ${data?.max_entries ?? 500} ta so'rov — faqat xotirada, diskka yozilmaydi`}
        />
        <div className="flex items-center gap-2">
          <PanelButton
            variant="ghost"
            onClick={() => setPaused((v) => !v)}
            title={paused ? "Jonli yangilanishni davom ettirish" : "Yangilanishni to'xtatib turish"}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Davom ettirish" : "Pauza"}
          </PanelButton>
          <PanelButton variant="ghost" onClick={() => refetch()} title="Hozir yangilash">
            <RotateCcw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </PanelButton>
          <PanelButton
            variant="ghost"
            onClick={() => clearLogs.mutate()}
            disabled={clearLogs.isPending}
            title="Jurnalni tozalash (faqat xotiradagi yozuvlar)"
          >
            <Trash2 className="h-4 w-4" />
            Tozalash
          </PanelButton>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-[8rem_8rem_1fr]">
        <PanelSelect value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">Barcha metodlar</option>
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </PanelSelect>
        <PanelSelect value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Barcha holatlar</option>
          <option value="2xx">2xx — muvaffaqiyat</option>
          <option value="3xx">3xx — yo'naltirish</option>
          <option value="4xx">4xx — mijoz xatosi</option>
          <option value="5xx">5xx — server xatosi</option>
        </PanelSelect>
        <PanelInput
          placeholder="URL bo'yicha qidirish: /reservations, /guests..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : rows.length === 0 ? (
        <PanelEmpty>
          Hozircha yozuv yo'q — so'rovlar kelishi bilan shu yerda ko'rinadi
        </PanelEmpty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Vaqt</th>
                  <th className="px-3 py-2.5 font-medium">Metod</th>
                  <th className="px-3 py-2.5 font-medium">URL</th>
                  <th className="px-3 py-2.5 font-medium">Holat</th>
                  <th className="px-3 py-2.5 font-medium">Vaqt (ms)</th>
                  <th className="px-3 py-2.5 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <LogRow
                    key={row.id}
                    row={row}
                    open={openId === row.id}
                    onToggle={() => setOpenId(openId === row.id ? null : row.id)}
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

const METHOD_TONE: Record<string, string> = {
  GET: "bg-sky-500/10 text-sky-300",
  POST: "bg-emerald-500/10 text-emerald-300",
  PUT: "bg-amber-500/10 text-amber-300",
  PATCH: "bg-amber-500/10 text-amber-300",
  DELETE: "bg-rose-500/10 text-rose-300",
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

function LogRow({
  row,
  open,
  onToggle,
}: {
  row: ApiLogEntry
  open: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer hover:bg-white/[0.02]",
          open && "bg-white/[0.03]"
        )}
      >
        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
          {new Date(row.ts).toLocaleTimeString("uz-UZ")}
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
        <td className="max-w-[360px] truncate px-3 py-2 font-mono text-xs text-slate-300">
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
        <td
          className={cn(
            "px-3 py-2 text-xs",
            row.duration_ms > 1000 ? "text-amber-300" : "text-slate-400"
          )}
        >
          {row.duration_ms}
        </td>
        <td className="px-3 py-2 text-xs text-slate-500">{row.ip || "—"}</td>
      </tr>
      {open && (
        <tr className="bg-black/20">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  So'rov tanasi
                </p>
                <pre className="max-h-72 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                  {pretty(row.request_body)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Javob
                </p>
                <pre className="max-h-72 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                  {pretty(row.response_body)}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
