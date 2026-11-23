import { useState, type ReactNode } from "react"
import { Check, EyeOff, Plus, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import {
  CLASS_LABELS,
  HTTP_METHODS,
  groupCodes,
  normalizeStatusToken,
  sameSelection,
  statusLabel,
  tokenCovers,
  toggleToken,
  type StatusClass,
  type StatusMode,
  type StatusSelection,
} from "../lib/apiLogFilters"

/* So'rovlar jurnali — holat va metod tanlagichlari.

   Holat: har bir kod (200, 401, 422...) yonida nechta so'rov borligi bilan
   tugma; bir nechtasini birga tanlash mumkin. Tanlanganlar ikki xil
   ishlaydi: "faqat shularni ko'rsatish" yoki "shularni yashirish" (ko'p
   200 lar ichidan xatolarni ajratib olish uchun). Ro'yxatda yo'q kod yoki
   oraliq (418, 500-504) qo'lda qo'shiladi. */

const CLASS_TONE: Record<StatusClass, { dot: string; on: string; text: string }> = {
  "2xx": { dot: "bg-emerald-400", on: "border-emerald-400/60 bg-emerald-500/15 text-emerald-100", text: "text-emerald-300" },
  "3xx": { dot: "bg-sky-400", on: "border-sky-400/60 bg-sky-500/15 text-sky-100", text: "text-sky-300" },
  "4xx": { dot: "bg-amber-400", on: "border-amber-400/60 bg-amber-500/15 text-amber-100", text: "text-amber-300" },
  "5xx": { dot: "bg-rose-400", on: "border-rose-400/60 bg-rose-500/15 text-rose-100", text: "text-rose-300" },
}

const EXCLUDED = "border-rose-400/40 bg-rose-500/10 text-rose-200/80 line-through decoration-rose-300/70"
const IDLE = "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/[0.05]"

function Chip({
  active,
  mode,
  activeClass,
  dim,
  title,
  onClick,
  children,
}: {
  active: boolean
  mode: StatusMode
  activeClass: string
  /** Sinf tanlangani uchun bilvosita qamralgan kod */
  dim?: boolean
  title?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40",
        active ? (mode === "exclude" ? EXCLUDED : activeClass) : IDLE,
        !active && dim && (mode === "exclude" ? "opacity-50" : "border-dashed"),
      )}
    >
      {active &&
        (mode === "exclude" ? (
          <EyeOff className="h-3 w-3 flex-shrink-0" />
        ) : (
          <Check className="h-3 w-3 flex-shrink-0" />
        ))}
      {children}
    </button>
  )
}

const Count = ({ n }: { n: number }) => (
  <span className="rounded bg-black/30 px-1 font-mono text-[10px] tabular-nums text-slate-400">
    {n.toLocaleString("ru-RU")}
  </span>
)

export function StatusPicker({
  selection,
  counts,
  onChange,
}: {
  selection: StatusSelection
  counts?: Record<string, number>
  /** O'zgartirish funksiyasi — joriy (eng so'nggi) tanlovdan yangisini hisoblaydi */
  onChange: (update: (current: StatusSelection) => StatusSelection) => void
}) {
  const [custom, setCustom] = useState("")
  const [customError, setCustomError] = useState(false)
  const { tokens, mode } = selection
  const groups = groupCodes(counts, tokens)

  const presets: { id: string; label: string; title: string; sel: StatusSelection }[] = [
    { id: "all", label: tr("Hammasi"), title: tr("Holat bo'yicha filtr yo'q"), sel: { tokens: [], mode: "include" } },
    { id: "ok", label: tr("Muvaffaqiyatli"), title: "2xx", sel: { tokens: ["2xx"], mode: "include" } },
    { id: "errors", label: tr("Barcha xatolar"), title: "4xx + 5xx", sel: { tokens: ["4xx", "5xx"], mode: "include" } },
    { id: "server", label: tr("Server xatolari"), title: "5xx", sel: { tokens: ["5xx"], mode: "include" } },
    {
      id: "quiet",
      label: tr("Odatiylarsiz"),
      title: tr("200 va 304 javoblarini yashirish — qolgan hamma so'rovlar"),
      sel: { tokens: ["200", "304"], mode: "exclude" },
    },
  ]

  const addCustom = () => {
    const parts = custom.split(/[,\s]+/).filter(Boolean)
    const parsed = parts.map(normalizeStatusToken)
    if (!parts.length || parsed.some((t) => !t)) {
      setCustomError(true)
      return
    }
    onChange((cur) => {
      const next = [...cur.tokens]
      for (const t of parsed as string[]) if (!next.includes(t)) next.push(t)
      return { ...cur, tokens: next }
    })
    setCustom("")
    setCustomError(false)
  }

  // Qo'lda qo'shilgan, tugmasi yo'q bo'laklar (oraliq yoki ro'yxatda bo'lmagan sinf)
  const shownAsChip = (t: string) => /^\d{3}$/.test(t) || groups.some((g) => g.cls === t)

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 w-14 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {tr("Holat")}
        </span>
        {presets.map((p) => {
          const on = sameSelection(selection, p.sel)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(() => p.sel)}
              aria-pressed={on}
              title={p.title}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium transition-colors",
                on
                  ? "bg-emerald-400 text-[#07110d]"
                  : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-slate-100",
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-start gap-x-5 gap-y-2 sm:pl-[3.75rem]">
        {groups.length === 0 && (
          <p className="py-1.5 text-xs text-slate-500">{tr("Hozircha holat kodlari yo'q — so'rovlar kelishi bilan shu yerda chiqadi")}</p>
        )}
        {groups.map((g) => {
          const tone = CLASS_TONE[g.cls]
          const clsOn = tokens.includes(g.cls)
          return (
            <div key={g.cls} className="flex flex-wrap items-center gap-1.5">
              <Chip
                active={clsOn}
                mode={mode}
                activeClass={tone.on}
                onClick={() => onChange((cur) => toggleToken(cur, g.cls))}
                title={tr("{{cls}} — barcha {{label}} kodlari", { cls: g.cls, label: tr(CLASS_LABELS[g.cls]).toLowerCase() })}
              >
                <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
                <span className={cn("font-mono font-semibold", !clsOn && tone.text)}>{g.cls}</span>
                <span className="hidden text-slate-400 sm:inline">{tr(CLASS_LABELS[g.cls])}</span>
                <Count n={g.total} />
              </Chip>
              {g.codes.map(({ code, count }) => {
                const token = String(code)
                const on = tokens.includes(token)
                const covered = !on && tokens.some((t) => t !== token && tokenCovers(t, code))
                const label = statusLabel(code)
                return (
                  <Chip
                    key={code}
                    active={on}
                    mode={mode}
                    activeClass={tone.on}
                    dim={covered}
                    onClick={() => onChange((cur) => toggleToken(cur, token))}
                    title={[token, label].filter(Boolean).join(" — ")}
                  >
                    <span className="font-mono font-semibold">{code}</span>
                    {label && <span className="hidden max-w-[9rem] truncate text-slate-400 lg:inline">{label}</span>}
                    <Count n={count} />
                  </Chip>
                )
              })}
            </div>
          )
        })}

        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            addCustom()
          }}
        >
          <input
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value)
              setCustomError(false)
            }}
            placeholder={tr("Kod yoki oraliq: 418, 500-504")}
            aria-label={tr("Holat kodi yoki oraliq qo'shish")}
            aria-invalid={customError}
            className={cn(
              "h-8 w-48 rounded-lg border bg-[#0b0d10] px-2.5 font-mono text-xs text-slate-100 placeholder:font-sans placeholder:text-slate-600",
              "focus:outline-none focus:ring-2",
              customError
                ? "border-rose-400/60 focus:ring-rose-400/20"
                : "border-white/[0.08] focus:border-emerald-400/50 focus:ring-emerald-400/15",
            )}
          />
          <button
            type="submit"
            disabled={!custom.trim()}
            title={tr("Qo'shish")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-slate-300 transition-colors hover:bg-white/[0.05] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
      {customError && (
        <p className="text-[11px] text-rose-300 sm:pl-[3.75rem]">
          {tr("Tushunarsiz qiymat. Masalan: 404 yoki 4xx yoki 500-504 (bir nechtasini vergul bilan)")}
        </p>
      )}

      {tokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 sm:ml-[3.75rem]">
          <span className="text-xs text-slate-400">{tr("Tanlangan:")}</span>
          {tokens.map((t) => (
            <span
              key={t}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-md pl-2 pr-1 font-mono text-[11px]",
                mode === "exclude" ? "bg-rose-500/10 text-rose-200 line-through" : "bg-emerald-500/10 text-emerald-200",
                !shownAsChip(t) && "ring-1 ring-white/10",
              )}
            >
              {t}
              <button
                type="button"
                onClick={() => onChange((cur) => toggleToken(cur, t))}
                title={tr("Olib tashlash")}
                aria-label={tr("{{v}} ni olib tashlash", { v: t })}
                className="rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-slate-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-white/[0.08] p-0.5" role="group" aria-label={tr("Tanlanganlar bilan nima qilinsin")}>
              {(["include", "exclude"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange((cur) => ({ ...cur, mode: m }))}
                  aria-pressed={mode === m}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors",
                    mode === m
                      ? m === "include"
                        ? "bg-emerald-400/90 text-[#07110d]"
                        : "bg-rose-400/90 text-[#1a0709]"
                      : "text-slate-400 hover:text-slate-100",
                  )}
                >
                  {m === "include" ? <Check className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {m === "include" ? tr("Faqat shularni ko'rsatish") : tr("Shularni yashirish")}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onChange(() => ({ tokens: [], mode: "include" }))}
              className="text-xs text-slate-400 underline-offset-2 hover:text-slate-100 hover:underline"
            >
              {tr("Tozalash")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const METHOD_ON: Record<string, string> = {
  GET: "border-sky-400/60 bg-sky-500/15 text-sky-100",
  POST: "border-emerald-400/60 bg-emerald-500/15 text-emerald-100",
  PUT: "border-amber-400/60 bg-amber-500/15 text-amber-100",
  PATCH: "border-amber-400/60 bg-amber-500/15 text-amber-100",
  DELETE: "border-rose-400/60 bg-rose-500/15 text-rose-100",
}

export function MethodPicker({
  methods,
  onChange,
}: {
  methods: string[]
  /** O'zgartirish funksiyasi — joriy (eng so'nggi) ro'yxatdan yangisini hisoblaydi */
  onChange: (update: (current: string[]) => string[]) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-14 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {tr("Metod")}
      </span>
      <button
        type="button"
        onClick={() => onChange(() => [])}
        aria-pressed={methods.length === 0}
        className={cn(
          "h-7 rounded-full px-3 text-xs font-medium transition-colors",
          methods.length === 0
            ? "bg-emerald-400 text-[#07110d]"
            : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-slate-100",
        )}
      >
        {tr("Hammasi")}
      </button>
      {HTTP_METHODS.map((m) => {
        const on = methods.includes(m)
        return (
          <Chip
            key={m}
            active={on}
            mode="include"
            activeClass={METHOD_ON[m]}
            onClick={() => onChange((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))}
          >
            <span className="font-mono font-semibold">{m}</span>
          </Chip>
        )
      })}
    </div>
  )
}
