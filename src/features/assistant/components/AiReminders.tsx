import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { BellRing, Check, Clock, X } from "lucide-react"

import { tr } from "@/i18n"
import { HOTEL_UTC_OFFSET_MINUTES } from "@/lib/hotelTime"

import { useAiMe, useDuePlans, useUpdatePlan, type AiPlan } from "../api/assistant"
import { formatLocalDue } from "../lib/format"
import { PANEL_PARAM } from "../lib/panels"

/* Sayt ichidagi eslatma: yordamchi rejalaridan vaqti kelganlari (har
   daqiqa so'raladi). Mobil ilovaga server push ham yuboradi. Yopilgan
   eslatma shu brauzerda qayta chiqmaydi; "15 daqiqadan keyin" — vaqt
   suriladi (server qayta eslatadi). */

const KEY = "ai.reminders.dismissed"

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]).slice(-200) : []
  } catch {
    return []
  }
}

function writeDismissed(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-200)))
  } catch {
    // saqlab bo'lmasa — faqat shu sessiyada
  }
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Mehmonxona vaqtida "hozir + N daqiqa" ("YYYY-MM-DDTHH:MM"). */
function localPlus(minutes: number): string {
  const t = new Date(Date.now() + (HOTEL_UTC_OFFSET_MINUTES + minutes) * 60_000)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`
}

export function AiReminders() {
  const me = useAiMe()
  const { data: due = [] } = useDuePlans(!!me.data?.allowed)
  const update = useUpdatePlan()
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)

  useEffect(() => writeDismissed(dismissed), [dismissed])

  const visible = due.filter((p) => !dismissed.includes(`${p.id}:${p.due_at}`)).slice(0, 3)
  if (!visible.length) return null

  const hide = (p: AiPlan) => setDismissed((d) => [...d, `${p.id}:${p.due_at}`])

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,340px)] flex-col gap-2">
      {visible.map((p) => (
        <div
          key={p.id}
          role="status"
          className="pointer-events-auto rounded-2xl border border-amber-200 bg-card p-3 shadow-xl"
        >
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <BellRing className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">{tr("Eslatma")}</p>
              <p className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{p.title}</p>
              {p.note && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.note}</p>}
              <p className="mt-0.5 text-[11px] text-muted-foreground">{formatLocalDue(p.due_local)}</p>
            </div>
            <button
              type="button"
              onClick={() => hide(p)}
              title={tr("Yopish")}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: p.id, status: "done" })}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {tr("Bajarildi")}
            </button>
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => {
                update.mutate({ id: p.id, due_at: localPlus(15) })
                hide(p)
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              <Clock className="h-3.5 w-3.5" />
              {tr("15 daqiqadan keyin")}
            </button>
            <Link
              // Rejalar paneli endi yopiq turadi — havola uni ochib beradi
              to={`/assistant?${PANEL_PARAM}=plans`}
              onClick={() => hide(p)}
              className="ml-auto inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
            >
              {tr("Rejalar")}
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
