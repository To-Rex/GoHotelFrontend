import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react"

import { tr } from "@/i18n"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"

import { confirmAction, rejectAction, undoAction, type ActionField, type AiAction } from "../api/assistant"
import { formatNumber } from "../lib/format"
import { actionStatusMeta, changedValues, editable, fieldDisplay, inputValue, resultSummary } from "../lib/actions"

/* Amal kartasi — AI taklif qilgan yozuvchi amal (bron, to'lov, xarajat...).

   Hech narsa xodim "Tasdiqlash"ni bosmaguncha bajarilmaydi. Karta forma
   bo'lib ham ishlaydi: AI to'ldirmagan majburiy maydonlarni xodim shu
   yerda kiritadi, AI to'ldirganini o'zgartirishi mumkin. Bajarilgandan
   keyin — natija va (mumkin bo'lsa) "Orqaga qaytarish". */

const INPUT =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-70"

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ActionField
  value: unknown
  onChange: (v: unknown) => void
  disabled: boolean
}) {
  const v = inputValue(field, value)
  switch (field.kind) {
    case "select":
      return (
        <select className={INPUT} value={String(v)} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">{tr("— tanlang —")}</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case "checkbox":
      return (
        <label className="inline-flex h-8 items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={!!value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          {value ? tr("Ha") : tr("Yo'q")}
        </label>
      )
    case "textarea":
      return (
        <textarea
          className={cn(INPUT, "h-16 resize-y py-1.5")}
          value={String(v)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case "number":
    case "integer":
      return (
        <input
          type="number"
          inputMode="decimal"
          step={field.kind === "integer" ? 1 : "any"}
          className={cn(INPUT, "tabular-nums")}
          value={String(v)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        />
      )
    case "date":
      return (
        <input type="date" className={INPUT} value={String(v)} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} />
      )
    case "datetime":
      return (
        <input
          type="datetime-local"
          className={INPUT}
          value={String(v)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )
    case "id":
    case "json":
      // Bog'langan yozuv yoki murakkab qiymat — AI tanlaydi; xodimga nomi ko'rinadi
      if (value !== null && value !== undefined && value !== "") {
        return (
          <p className="flex h-8 items-center truncate rounded-md bg-muted px-2 text-sm text-foreground" title={String(fieldDisplay(field, value))}>
            {fieldDisplay(field, value)}
          </p>
        )
      }
      if (field.kind === "json") {
        return <p className="flex h-8 items-center px-1 text-xs text-muted-foreground">{tr("AI'dan to'ldirishni so'rang")}</p>
      }
      return (
        <input
          className={cn(INPUT, "font-mono text-xs")}
          placeholder="ID"
          value={String(v)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.trim() || null)}
        />
      )
    default:
      return (
        <input className={INPUT} value={String(v)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )
  }
}

export function ActionCard({
  action,
  mode,
  onUpdate,
  onContinue,
}: {
  action: AiAction
  mode?: "undo"
  onUpdate: (a: AiAction) => void
  onContinue: (actionId: string) => void
}) {
  const initial = useMemo(() => Object.fromEntries(action.fields.map((f) => [f.name, f.value])), [action.fields])
  const [values, setValues] = useState<Record<string, unknown>>(initial)
  const [showExtra, setShowExtra] = useState(false)
  const [pending, setPending] = useState<"confirm" | "reject" | "undo" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [askUndo, setAskUndo] = useState(false)

  const canEdit = editable(action.status)
  const meta = actionStatusMeta(action.status)
  const main = action.fields.filter((f) => f.required || f.in_body)
  const extra = action.fields.filter((f) => !f.required && !f.in_body)
  const missing = action.fields.filter(
    (f) => f.required && (values[f.name] === null || values[f.name] === undefined || values[f.name] === ""),
  )

  const run = async (kind: "confirm" | "reject" | "undo") => {
    setPending(kind)
    setError(null)
    try {
      const next =
        kind === "confirm"
          ? await confirmAction(action.id, changedValues(action.fields, initial, values))
          : kind === "reject"
            ? await rejectAction(action.id)
            : await undoAction(action.id)
      onUpdate(next)
      setAskUndo(false)
      if (kind === "confirm" && next.status === "executed" && next.continue_after) onContinue(next.id)
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setPending(null)
    }
  }

  const summary = resultSummary(action.result)
  const risky = action.risk === "high"
  // Pastki qator — faqat ko'rsatadigan narsa bo'lsa (qaytarilgan/rad etilgan kartada bo'sh qolmasin)
  const footer =
    canEdit ||
    action.can_undo ||
    (action.status === "executed" && (!!action.page || !action.undo_supported))

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        action.status === "proposed" || action.status === "failed"
          ? risky
            ? "border-red-200"
            : "border-primary/30"
          : "border-border",
      )}
    >
      <div className="flex items-start gap-2.5 border-b border-border px-3 py-2.5">
        <span
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
            risky ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary",
          )}
        >
          {risky ? <ShieldAlert className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{tr(action.title)}</p>
          {action.summary && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{action.summary}</p>}
        </div>
        <span className={cn("flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.cls)}>
          {meta.label}
        </span>
      </div>

      {main.length > 0 && (
        <div className="grid gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-2">
          {main.map((f) => (
            <label key={f.name} className={cn("min-w-0", (f.kind === "textarea" || f.kind === "json") && "sm:col-span-2")}>
              <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">
                {tr(f.label)}
                {f.required && canEdit && <span className="text-red-500"> *</span>}
              </span>
              {canEdit ? (
                <FieldInput
                  field={f}
                  value={values[f.name]}
                  disabled={!!pending}
                  onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                />
              ) : (
                <p className="truncate text-sm text-foreground">{fieldDisplay(f, values[f.name])}</p>
              )}
            </label>
          ))}
        </div>
      )}

      {canEdit && extra.length > 0 && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => setShowExtra((x) => !x)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary"
          >
            {showExtra ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {tr("Qo'shimcha maydonlar ({{n}})", { n: extra.length })}
          </button>
          {showExtra && (
            <div className="mt-2 grid gap-x-3 gap-y-2 sm:grid-cols-2">
              {extra.map((f) => (
                <label key={f.name} className={cn("min-w-0", f.kind === "textarea" && "sm:col-span-2")}>
                  <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">{tr(f.label)}</span>
                  <FieldInput
                    field={f}
                    value={values[f.name]}
                    disabled={!!pending}
                    onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {(summary.length > 0 || action.error || error) && (
        <div className="space-y-1.5 px-3 pb-2.5">
          {summary.length > 0 && action.status !== "failed" && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700">
              {summary.map((s) => (
                <span key={s.label}>
                  {s.label}: <b className="tabular-nums">{typeof s.value === "number" ? formatNumber(s.value) : s.value}</b>
                </span>
              ))}
            </div>
          )}
          {(error || action.error) && (
            <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 [overflow-wrap:anywhere]">
              {error || action.error}
            </p>
          )}
        </div>
      )}

      {footer && (
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-3 py-2">
        {canEdit ? (
          <>
            <button
              type="button"
              disabled={!!pending || missing.length > 0}
              onClick={() => run("confirm")}
              title={missing.length ? tr("Majburiy maydonlarni to'ldiring") : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50",
                risky ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90",
              )}
            >
              {pending === "confirm" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {action.status === "failed" ? tr("Qayta urinish") : tr("Tasdiqlash")}
            </button>
            <button
              type="button"
              disabled={!!pending}
              onClick={() => run("reject")}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {pending === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              {tr("Rad etish")}
            </button>
            {action.status === "failed" && (
              <button
                type="button"
                disabled={!!pending}
                onClick={() => onContinue(action.id)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Wand2 className="h-3.5 w-3.5" />
                {tr("AI bilan tuzatish")}
              </button>
            )}
            {missing.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {tr("To'ldiring: {{fields}}", { fields: missing.map((f) => tr(f.label)).join(", ") })}
              </span>
            )}
          </>
        ) : (
          <>
            {action.page && action.status === "executed" && (
              <Link
                to={action.page}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {tr("Sahifada ko'rish")}
              </Link>
            )}
            {action.can_undo &&
              (askUndo ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-xs text-foreground">{tr("Rostdan qaytarilsinmi?")}</span>
                  <button
                    type="button"
                    disabled={!!pending}
                    onClick={() => run("undo")}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {pending === "undo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    {tr("Ha, qaytarish")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAskUndo(false)}
                    className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    {tr("Yo'q")}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAskUndo(true)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                    mode === "undo" ? "bg-amber-600 text-white hover:bg-amber-700" : "text-amber-700 hover:bg-amber-50",
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {tr("Orqaga qaytarish")}
                </button>
              ))}
            {action.status === "executed" && !action.undo_supported && (
              <span className="text-[11px] text-muted-foreground">{tr("Bu amalni avtomatik qaytarib bo'lmaydi")}</span>
            )}
          </>
        )}
      </div>
      )}
    </div>
  )
}
