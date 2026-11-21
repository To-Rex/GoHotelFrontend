import { useMemo, useState } from "react"
import { Check, MessageSquarePlus, Pencil, Plus, Search, Trash2, X } from "lucide-react"

import { tr } from "@/i18n"
import { hotelClock } from "@/lib/hotelTime"
import { cn } from "@/lib/utils"

import {
  useCreatePlan,
  useDeleteConversation,
  usePlans,
  useRenameConversation,
  type AiLimits,
  type AiPlan,
  type Conversation,
} from "../api/assistant"
import { formatCompact } from "../lib/format"
import { PlanRow } from "./SmallBlocks"

// ---------------------------------------------------------------- suhbatlar --

function when(iso: string | null): string {
  const c = hotelClock(iso)
  if (!c) return ""
  const today = hotelClock(new Date())
  return today && today.ymd === c.ymd ? c.time ?? "" : c.short
}

export function ConversationList({
  items,
  activeId,
  loading,
  search,
  onSearch,
  onSelect,
  onNew,
  onDeleted,
}: {
  items: Conversation[]
  activeId: string | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  onSelect: (id: string) => void
  onNew: () => void
  onDeleted: (id: string) => void
}) {
  const rename = useRenameConversation()
  const remove = useDeleteConversation()
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const save = async (id: string) => {
    const t = title.trim()
    if (t) await rename.mutateAsync({ id, title: t }).catch(() => undefined)
    setEditing(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <MessageSquarePlus className="h-4 w-4" />
          {tr("Yangi suhbat")}
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={tr("Suhbatlarni qidirish")}
            className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {loading && !items.length ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">{tr("Yuklanmoqda...")}</p>
        ) : !items.length ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {search ? tr("Hech narsa topilmadi") : tr("Hali suhbat yo'q")}
          </p>
        ) : (
          items.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
                c.id === activeId ? "bg-primary/10" : "hover:bg-muted",
              )}
            >
              {editing === c.id ? (
                <>
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save(c.id)
                      if (e.key === "Escape") setEditing(null)
                    }}
                    className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                  <button type="button" onClick={() => save(c.id)} className="rounded p-1 text-emerald-600 hover:bg-emerald-50">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : confirmDelete === c.id ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-xs text-red-600">{tr("O'chirilsinmi?")}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await remove.mutateAsync(c.id).catch(() => undefined)
                      setConfirmDelete(null)
                      onDeleted(c.id)
                    }}
                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                  >
                    {tr("Ha")}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(null)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => onSelect(c.id)} className="min-w-0 flex-1 text-left">
                    <p className={cn("truncate text-[13px]", c.id === activeId ? "font-semibold text-primary" : "text-foreground")}>
                      {c.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{when(c.updated_at)}</p>
                  </button>
                  <div className="flex flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                    <button
                      type="button"
                      title={tr("Nomini o'zgartirish")}
                      onClick={() => {
                        setEditing(c.id)
                        setTitle(c.title)
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title={tr("Ro'yxatdan olib tashlash")}
                      onClick={() => setConfirmDelete(c.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-background hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ rejalar --

function group(plans: AiPlan[]) {
  const today = hotelClock(new Date())?.ymd ?? ""
  const out: Record<"overdue" | "today" | "later" | "nodate" | "closed", AiPlan[]> = {
    overdue: [], today: [], later: [], nodate: [], closed: [],
  }
  for (const p of plans) {
    if (p.status !== "open") out.closed.push(p)
    else if (p.overdue) out.overdue.push(p)
    else if (!p.due_local) out.nodate.push(p)
    else if (p.due_local.slice(0, 10) === today) out.today.push(p)
    else out.later.push(p)
  }
  return out
}

export function PlansPanel() {
  const { data: plans = [], isLoading } = usePlans("recent")
  const create = useCreatePlan()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<AiPlan["kind"]>("task")
  const [due, setDue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const groups = useMemo(() => group(plans), [plans])

  const add = async () => {
    if (!title.trim()) return
    setError(null)
    try {
      await create.mutateAsync({ title: title.trim(), kind, due_at: due || null })
      setTitle("")
      setDue("")
      setAdding(false)
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || tr("Saqlanmadi"))
    }
  }

  const section = (label: string, items: AiPlan[], cls?: string) =>
    items.length ? (
      <div className="space-y-1.5">
        <p className={cn("px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", cls)}>
          {label} · {items.length}
        </p>
        {items.map((p) => (
          <PlanRow key={p.id} plan={p} compact />
        ))}
      </div>
    ) : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <p className="text-sm font-semibold text-foreground">{tr("Rejalar")}</p>
        <button
          type="button"
          onClick={() => setAdding((x) => !x)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5" />
          {tr("Qo'shish")}
        </button>
      </div>
      {adding && (
        <div className="space-y-2 border-b border-border p-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={tr("Masalan: kassani tekshirish")}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as AiPlan["kind"])}
              className="h-8 rounded-md border border-input bg-background px-1.5 text-xs text-foreground outline-none"
            >
              <option value="task">{tr("Ish")}</option>
              <option value="reminder">{tr("Eslatma")}</option>
              <option value="note">{tr("Qayd")}</option>
            </select>
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-xs text-foreground outline-none"
            />
          </div>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <button
            type="button"
            onClick={add}
            disabled={!title.trim() || create.isPending}
            className="w-full rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {tr("Saqlash")}
          </button>
        </div>
      )}
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-center text-xs text-muted-foreground">{tr("Yuklanmoqda...")}</p>
        ) : !plans.length ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {tr("Rejalar yo'q. Yordamchiga ayting: «ertaga 9:00 da kassani tekshirishni eslat»")}
          </div>
        ) : (
          <>
            {section(tr("Muddati o'tgan"), groups.overdue, "text-red-600")}
            {section(tr("Bugun"), groups.today)}
            {section(tr("Keyinroq"), groups.later)}
            {section(tr("Muddatsiz"), groups.nodate)}
            {section(tr("Yopilgan"), groups.closed)}
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- token sarfi --

export function UsageMeter({ limits }: { limits: AiLimits | null | undefined }) {
  if (!limits) return null
  const limit = limits.remaining !== null ? limits.month_tokens + limits.remaining : limits.monthly_limit
  const pct = limit ? Math.min(100, Math.round((limits.month_tokens / Math.max(limit, 1)) * 100)) : 0
  return (
    <div
      className="hidden min-w-[150px] sm:block"
      title={tr("Shu oy ishlatilgan tokenlar (kiruvchi + chiquvchi)")}
    >
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{tr("Token")}</span>
        <span className={cn("font-semibold tabular-nums", limits.blocked ? "text-red-600" : "text-foreground")}>
          {formatCompact(limits.month_tokens)}
          {limit ? ` / ${formatCompact(limit)}` : ` · ${tr("cheklanmagan")}`}
        </span>
      </div>
      {limit ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}
