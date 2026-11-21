import { useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  CircleDot,
  Download,
  FileSpreadsheet,
  ListTodo,
  Loader2,
  StickyNote,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react"

import { tr } from "@/i18n"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"

import {
  downloadAiFile,
  useUpdatePlan,
  type AiPlan,
  type FileBlock,
  type NavBlock,
  type PlanBlock,
  type StatsBlock,
} from "../api/assistant"
import { formatBytes, formatLocalDue, formatNumber } from "../lib/format"

// ------------------------------------------------------------ ko'rsatkichlar --

const TONE_ICON = {
  good: { Icon: TrendingUp, cls: "text-emerald-600" },
  bad: { Icon: TrendingDown, cls: "text-red-600" },
  warn: { Icon: AlertTriangle, cls: "text-amber-600" },
  neutral: { Icon: CircleDot, cls: "text-muted-foreground" },
} as const

export function StatsBlockView({ block }: { block: StatsBlock }) {
  return (
    <div className={cn("grid gap-2", block.items.length >= 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
      {block.items.map((it, i) => {
        const tone = it.tone ? TONE_ICON[it.tone] : null
        return (
          <div key={i} className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5">
            <p className="flex items-center gap-1 truncate text-[11px] font-medium text-muted-foreground">
              {tone && <tone.Icon className={cn("h-3.5 w-3.5 flex-shrink-0", tone.cls)} />}
              <span className="truncate">{it.label}</span>
            </p>
            <p className="mt-0.5 truncate text-lg font-bold tabular-nums tracking-tight text-foreground">
              {typeof it.value === "number" ? formatNumber(it.value) : it.value}
              {it.unit && <span className="ml-1 text-xs font-medium text-muted-foreground">{it.unit}</span>}
            </p>
            {it.hint && <p className="truncate text-[11px] text-muted-foreground">{it.hint}</p>}
          </div>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ fayl --

export function FileBlockView({ block }: { block: FileBlock }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      await downloadAiFile(block.file_id, block.name)
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        <FileSpreadsheet className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{block.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {tr("{{rows}} qator · {{size}}", { rows: formatNumber(block.rows), size: formatBytes(block.size) })}
        </p>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {tr("Yuklab olish")}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- havola --

export function NavBlockView({ block }: { block: NavBlock }) {
  return (
    <Link
      to={block.path}
      className="group flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 transition-colors hover:bg-primary/10"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-primary">{block.label}</p>
        {block.note && <p className="truncate text-[11px] text-muted-foreground">{block.note}</p>}
      </div>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

// ---------------------------------------------------------------- variantlar --

export function RepliesView({
  options,
  onPick,
  disabled,
}: {
  options: string[]
  onPick: (text: string) => void
  disabled?: boolean
}) {
  if (!options.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o, i) => (
        <button
          key={`${i}:${o}`}
          type="button"
          disabled={disabled}
          onClick={() => onPick(o)}
          className="rounded-full border border-primary/30 bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          {o}
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ reja --

const PLAN_KIND = {
  reminder: { Icon: BellRing, label: () => tr("Eslatma"), cls: "bg-amber-50 text-amber-600" },
  task: { Icon: ListTodo, label: () => tr("Ish"), cls: "bg-primary/10 text-primary" },
  note: { Icon: StickyNote, label: () => tr("Qayd"), cls: "bg-muted text-muted-foreground" },
} as const

export function PlanRow({ plan, compact }: { plan: AiPlan; compact?: boolean }) {
  const update = useUpdatePlan()
  // Suhbatdagi reja kartasi o'z holatini eslab qoladi (xabar qayta yuklanmaguncha)
  const [local, setLocal] = useState<AiPlan | null>(null)
  const p = local && local.id === plan.id ? local : plan
  const kind = PLAN_KIND[p.kind] ?? PLAN_KIND.task
  const set = async (status: AiPlan["status"]) => {
    try {
      setLocal(await update.mutateAsync({ id: p.id, status }))
    } catch {
      // xato — holat o'zgarmaydi
    }
  }
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border border-border bg-card", compact ? "p-2.5" : "p-3")}>
      <span className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", kind.cls)}>
        <kind.Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium text-foreground [overflow-wrap:anywhere]",
            p.status !== "open" && "text-muted-foreground line-through",
          )}
        >
          {p.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span>{kind.label()}</span>
          {p.due_local && (
            <span className={cn(p.overdue && "font-semibold text-red-600")}>{formatLocalDue(p.due_local)}</span>
          )}
          {p.status === "done" && <span className="text-emerald-600">{tr("bajarildi")}</span>}
          {p.status === "cancelled" && <span>{tr("bekor qilindi")}</span>}
        </p>
        {p.note && !compact && <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{p.note}</p>}
      </div>
      {p.status === "open" ? (
        <div className="flex flex-shrink-0 gap-1">
          <button
            type="button"
            title={tr("Bajarildi")}
            disabled={update.isPending}
            onClick={() => set("done")}
            className="rounded-md p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={tr("Bekor qilish")}
            disabled={update.isPending}
            onClick={() => set("cancelled")}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={update.isPending}
          onClick={() => set("open")}
          className="flex-shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
        >
          {tr("Qayta ochish")}
        </button>
      )}
    </div>
  )
}

export function PlanBlockView({ block }: { block: PlanBlock }) {
  return <PlanRow plan={block.plan} />
}
