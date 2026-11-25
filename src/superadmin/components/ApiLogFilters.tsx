import { useState, type CSSProperties, type ReactNode } from "react"
import { Check, EyeOff, Plus, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import {
  CLASS_LABELS,
  HTTP_METHODS,
  groupCodes,
  normalizeStatusToken,
  sameSelection,
  statusClassOf,
  statusLabel,
  tokenCovers,
  toggleToken,
  type StatusMode,
  type StatusSelection,
} from "../lib/apiLogFilters"
import { CLASS_COLOR, METHOD_COLOR, UZ } from "../lib/ornament"
import { StarMark } from "./ornament"

/* So'rovlar jurnali — filtr boshqaruvlari (o'zbek naqshi uslubida).

   Minimal: tekis sirt, ingichka chiziq, rang faqat ma'no tashiganda
   (holat sinfi — feruza/lojuvard/tilla/anor). Har bir rang yonida doim kod
   yozuvi va sakkiz qirrali yulduz — rangni ajrata olmagan ko'z ham
   adashmaydi.

   Holat: tepada tayyor tanlovlar; ostida "holatlar taqsimoti" chizig'i
   (bosilsa — shu kod tanlanadi); undan keyin sinflar bo'yicha ustunlar —
   har bir kod nomi, soni va ulushi bilan. Tanlanganlar "faqat shular" yoki
   "shularsiz" rejimida ishlaydi. */

const ACCENT = UZ.feruza
const tint = (pct: number) => `color-mix(in oklab, var(--c) ${pct}%, transparent)`

/** Segmentli tugmalar guruhi (bir qatorda, bitta ramkada). */
function Segmented({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-white/[0.07] bg-black/25 p-1"
    >
      {children}
    </div>
  )
}

function SegItem({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa694]/50",
        active ? "text-[#c9f1ea]" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
      )}
      style={
        active
          ? {
              background: `color-mix(in oklab, ${ACCENT} 17%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${ACCENT} 42%, transparent)`,
            }
          : undefined
      }
    >
      {children}
    </button>
  )
}

/** Kichik sarlavha: yulduz + matn (bo'lim nomi). */
export function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      <StarMark className="h-2.5 w-2.5" style={{ color: UZ.tilla }} />
      {children}
    </span>
  )
}

/* ------------------------------------------------------------- metodlar -- */

export function MethodPicker({
  methods,
  onChange,
}: {
  methods: string[]
  /** O'zgartirish funksiyasi — joriy (eng so'nggi) ro'yxatdan yangisini hisoblaydi */
  onChange: (update: (current: string[]) => string[]) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterLabel>{tr("Metod")}</FilterLabel>
      <Segmented label={tr("Metod")}>
        <SegItem active={methods.length === 0} onClick={() => onChange(() => [])}>
          {tr("Hammasi")}
        </SegItem>
        {HTTP_METHODS.map((m) => {
          const on = methods.includes(m)
          return (
            <SegItem
              key={m}
              active={on}
              onClick={() =>
                onChange((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))
              }
            >
              <span
                aria-hidden
                className="h-2.5 w-[3px] rounded-full"
                style={{ background: METHOD_COLOR[m] }}
              />
              <span className="font-mono">{m}</span>
            </SegItem>
          )
        })}
      </Segmented>
    </div>
  )
}

/* --------------------------------------------------------------- holat -- */

type RowState = "on" | "covered" | "idle"

function rowState(tokens: string[], code: number): RowState {
  const token = String(code)
  if (tokens.includes(token)) return "on"
  if (tokens.some((t) => t !== token && tokenCovers(t, code))) return "covered"
  return "idle"
}

/** Holatlar taqsimoti — bitta chiziqda hamma kodlar ulushi bilan. Segment
 *  bosilsa shu kod tanlanadi; ustiga olib borilsa — nomi, soni va foizi. */
function Spectrum({
  groups,
  tokens,
  mode,
  onToggle,
}: {
  groups: ReturnType<typeof groupCodes>
  tokens: string[]
  mode: StatusMode
  onToggle: (code: number) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const items = groups.flatMap((g) => g.codes.map((c) => ({ ...c, cls: g.cls })))
  const total = items.reduce((s, c) => s + c.count, 0)
  if (!total) return null

  // Har bir segment o'rtasi (0..1) — ustiga olib borilganda maslahat shu yerda chiqadi
  const placed = items
    .filter((c) => c.count > 0)
    .reduce<(typeof items[number] & { mid: number; end: number })[]>((list, c) => {
      const start = list.length ? list[list.length - 1].end : 0
      const end = start + c.count / total
      list.push({ ...c, mid: (start + end) / 2, end })
      return list
    }, [])
  const hovered = placed.find((c) => c.code === hover)

  return (
    <div className="relative pt-1">
      {hovered && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#171b21] px-2.5 py-1.5 text-[11px] text-slate-200 shadow-xl"
          style={{ left: `${Math.min(92, Math.max(8, hovered.mid * 100))}%` }}
        >
          <span className="inline-flex items-center gap-1.5">
            <StarMark className="h-2.5 w-2.5" style={{ color: CLASS_COLOR[hovered.cls] }} />
            <span className="font-mono font-semibold text-slate-50">{hovered.code}</span>
            {statusLabel(hovered.code) && <span className="text-slate-400">{statusLabel(hovered.code)}</span>}
            <span className="font-mono tabular-nums text-slate-300">
              · {hovered.count.toLocaleString("ru-RU")} ({Math.max(1, Math.round((hovered.count / total) * 100))}%)
            </span>
          </span>
        </div>
      )}
      <div className="flex w-full gap-[2px]" onMouseLeave={() => setHover(null)}>
        {placed.map((c, i) => {
          const state = rowState(tokens, c.code)
          const chosen = state !== "idle"
          const dim = tokens.length > 0 && (mode === "include" ? !chosen : chosen)
          const hatched = mode === "exclude" && chosen
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => onToggle(c.code)}
              onMouseEnter={() => setHover(c.code)}
              onFocus={() => setHover(c.code)}
              onBlur={() => setHover(null)}
              aria-label={`${c.code} — ${c.count}`}
              className="group flex h-5 min-w-[6px] items-center focus-visible:outline-none"
              style={{ flex: `${c.count} 1 0%` }}
            >
              <span
                className={cn(
                  "block h-2.5 w-full transition-[opacity,height] duration-200 group-hover:h-3.5 group-focus-visible:h-3.5",
                  i === 0 && "rounded-l-full",
                  i === placed.length - 1 && "rounded-r-full",
                  dim && "opacity-25"
                )}
                style={{
                  background: hatched
                    ? `repeating-linear-gradient(135deg, ${CLASS_COLOR[c.cls]} 0 3px, transparent 3px 6px)`
                    : CLASS_COLOR[c.cls],
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function StatusPanel({
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
  const maxCount = Math.max(1, ...groups.flatMap((g) => g.codes.map((c) => c.count)))
  const total = groups.reduce((s, g) => s + g.total, 0)

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

  const tokenColor = (t: string) => {
    const cls = /^[1-5]xx$/.test(t) ? t : statusClassOf(Number(t.slice(0, 3)))
    return (cls && CLASS_COLOR[cls as keyof typeof CLASS_COLOR]) || "#8a93a3"
  }

  return (
    <div className="space-y-4">
      {/* Sarlavha qatori: tayyor tanlovlar va qo'lda qo'shish */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterLabel>{tr("Holat")}</FilterLabel>
        <Segmented label={tr("Holat")}>
          {presets.map((p) => (
            <SegItem key={p.id} active={sameSelection(selection, p.sel)} onClick={() => onChange(() => p.sel)} title={p.title}>
              {p.label}
            </SegItem>
          ))}
        </Segmented>
        <form
          className="ml-auto flex items-center"
          onSubmit={(e) => {
            e.preventDefault()
            addCustom()
          }}
        >
          <div
            className={cn(
              "flex h-9 items-center rounded-xl border bg-black/25 pl-3 pr-1 transition-colors focus-within:border-[#1fa694]/60",
              customError ? "border-[#d63f6b]/60" : "border-white/[0.07]"
            )}
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
              className="w-44 bg-transparent font-mono text-xs text-slate-100 placeholder:font-sans placeholder:text-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!custom.trim()}
              title={tr("Qo'shish")}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/[0.06] disabled:opacity-35"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
      {customError && (
        <p className="-mt-2 text-right text-[11px] text-[#ee8aa6]">
          {tr("Tushunarsiz qiymat. Masalan: 404 yoki 4xx yoki 500-504 (bir nechtasini vergul bilan)")}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.08] px-4 py-5 text-center text-xs text-slate-500">
          {tr("Hozircha holat kodlari yo'q — so'rovlar kelishi bilan shu yerda chiqadi")}
        </p>
      ) : (
        <>
          <div>
            <div className="mb-1 flex items-baseline justify-between text-[11px] text-slate-500">
              <span>{tr("Holatlar taqsimoti")}</span>
              <span className="font-mono tabular-nums">{tr("{{n}} ta so'rov", { n: total.toLocaleString("ru-RU") })}</span>
            </div>
            <Spectrum
              groups={groups}
              tokens={tokens}
              mode={mode}
              onToggle={(code) => onChange((cur) => toggleToken(cur, String(code)))}
            />
          </div>

          <div className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {groups.map((g) => {
              const clsOn = tokens.includes(g.cls)
              const vars = { "--c": CLASS_COLOR[g.cls] } as CSSProperties
              return (
                <div
                  key={g.cls}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.012] p-1.5"
                  style={vars}
                >
                  <button
                    type="button"
                    onClick={() => onChange((cur) => toggleToken(cur, g.cls))}
                    aria-pressed={clsOn}
                    title={tr("{{cls}} — barcha {{label}} kodlari", {
                      cls: g.cls,
                      label: tr(CLASS_LABELS[g.cls]).toLowerCase(),
                    })}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa694]/50",
                      !clsOn && "hover:bg-white/[0.04]",
                      clsOn && mode === "exclude" && "line-through decoration-slate-500"
                    )}
                    style={clsOn ? { background: tint(15), boxShadow: `inset 0 0 0 1px ${tint(45)}` } : undefined}
                  >
                    <StarMark
                      filled={!(clsOn && mode === "exclude")}
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300 motion-reduce:transition-none group-hover:rotate-45",
                        clsOn && "rotate-[22.5deg]"
                      )}
                      style={{ color: "var(--c)" }}
                    />
                    <span className="font-mono text-[13px] font-semibold text-[#f1e9d8]">{g.cls}</span>
                    <span className="truncate text-xs text-slate-400">{tr(CLASS_LABELS[g.cls])}</span>
                    <span className="ml-auto font-mono text-[11px] tabular-nums text-slate-400">
                      {g.total.toLocaleString("ru-RU")}
                    </span>
                  </button>

                  <div className="mt-1 space-y-0.5">
                    {g.codes.map(({ code, count }) => {
                      const state = rowState(tokens, code)
                      const label = statusLabel(code)
                      const excluded = mode === "exclude" && state !== "idle"
                      const faded = tokens.length > 0 && mode === "include" && state === "idle"
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => onChange((cur) => toggleToken(cur, String(code)))}
                          aria-pressed={state === "on"}
                          title={[String(code), label].filter(Boolean).join(" — ")}
                          className={cn(
                            "group relative flex w-full items-center gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-left text-xs transition-[background-color,opacity]",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa694]/50",
                            state === "idle" && "hover:bg-white/[0.04]",
                            faded && "opacity-50 hover:opacity-100",
                            excluded && "opacity-60"
                          )}
                          style={
                            state === "on"
                              ? { background: tint(excluded ? 6 : 16), boxShadow: `inset 0 0 0 1px ${tint(excluded ? 30 : 48)}` }
                              : state === "covered"
                                ? { background: tint(excluded ? 4 : 9), outline: `1px dashed ${tint(40)}`, outlineOffset: -1 }
                                : undefined
                          }
                        >
                          {/* Ulush — eng ko'p uchragan kodga nisbatan, qator ostida ingichka chiziq */}
                          <span
                            aria-hidden
                            className="absolute bottom-[3px] left-2 h-[2px] rounded-full"
                            style={{
                              width: `calc((100% - 16px) * ${count / maxCount})`,
                              minWidth: count ? 3 : 0,
                              background: tint(60),
                            }}
                          />
                          <StarMark
                            filled={!excluded}
                            className={cn(
                              "relative h-3 w-3 transition-transform duration-300 motion-reduce:transition-none group-hover:rotate-45",
                              state === "on" && "rotate-[22.5deg]"
                            )}
                            style={{ color: "var(--c)" }}
                          />
                          <span
                            className={cn(
                              "relative font-mono font-semibold text-slate-100",
                              excluded && "line-through decoration-[#d63f6b]/70"
                            )}
                          >
                            {code}
                          </span>
                          {label && (
                            <span className={cn("relative min-w-0 truncate text-slate-400", excluded && "line-through")}>
                              {label}
                            </span>
                          )}
                          <span className="relative ml-auto pl-1 font-mono text-[11px] tabular-nums text-slate-400">
                            {count.toLocaleString("ru-RU")}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/[0.1] bg-black/20 px-3 py-2">
          <span className="text-xs text-slate-400">{tr("Tanlangan:")}</span>
          {tokens.map((t) => (
            <span
              key={t}
              className="inline-flex h-6 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] pl-2 pr-0.5 font-mono text-[11px] text-slate-100"
            >
              <StarMark className="h-2.5 w-2.5" filled={mode === "include"} style={{ color: tokenColor(t) }} />
              <span className={cn(mode === "exclude" && "line-through decoration-[#d63f6b]/70")}>{t}</span>
              <button
                type="button"
                onClick={() => onChange((cur) => toggleToken(cur, t))}
                title={tr("Olib tashlash")}
                aria-label={tr("{{v}} ni olib tashlash", { v: t })}
                className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-slate-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Segmented label={tr("Tanlanganlar bilan nima qilinsin")}>
              <SegItem active={mode === "include"} onClick={() => onChange((cur) => ({ ...cur, mode: "include" }))}>
                <Check className="h-3 w-3" />
                {tr("Faqat shularni ko'rsatish")}
              </SegItem>
              <SegItem active={mode === "exclude"} onClick={() => onChange((cur) => ({ ...cur, mode: "exclude" }))}>
                <EyeOff className="h-3 w-3" />
                {tr("Shularni yashirish")}
              </SegItem>
            </Segmented>
            <button
              type="button"
              onClick={() => onChange(() => ({ tokens: [], mode: "include" }))}
              className="h-7 rounded-lg px-2.5 text-xs text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-100"
            >
              {tr("Tozalash")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
