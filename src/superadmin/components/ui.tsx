import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

/**
 * Panelning umumiy bo'laklari.
 *
 * Panel to'q fonda ishlaydi, mehmonxona tizimi esa yorug'da. Umumiy
 * `ui/` komponentlari yorug' fonga sozlangan — ularni bu yerda qayta
 * ranglash har faylda takrorlanardi, shuning uchun bir necha kichik
 * o'ram shu yerda turadi.
 *
 * Dizayn qoidasi: gradient yo'q, ortiqcha soya yo'q. Faqat tekis sirt,
 * ingichka chegara va bitta zumrad urg'u.
 */

const SURFACE = "border-white/[0.07] bg-[#101216]"

export function PanelCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors hover:border-white/10",
        SURFACE,
        className
      )}
    >
      {children}
    </div>
  )
}

export function PanelHeading({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-100">
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function PanelSection({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function PanelStat({
  label,
  value,
  hint,
  icon: Icon,
  to,
}: {
  label: string
  value: number | string | null | undefined
  hint?: string
  icon?: React.ComponentType<{ className?: string }>
  to?: string
}) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-slate-100 tabular-nums">
          {value ?? 0}
        </p>
        {hint && <p className="mt-1.5 text-[11px] text-slate-500">{hint}</p>}
      </div>
      {Icon && (
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-white/[0.04] text-slate-400">
          <Icon className="h-4 w-4" />
        </span>
      )}
    </div>
  )
  return to ? (
    <Link to={to} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40">
      <PanelCard className="h-full hover:border-white/15">{body}</PanelCard>
    </Link>
  ) : (
    <PanelCard className="h-full">{body}</PanelCard>
  )
}

const BADGE_TONES: Record<string, string> = {
  neutral: "bg-white/[0.05] text-slate-400",
  success: "bg-emerald-500/10 text-emerald-300",
  warning: "bg-amber-500/10 text-amber-300",
  danger: "bg-rose-500/10 text-rose-300",
  info: "bg-sky-500/10 text-sky-300",
}

export function PanelBadge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info"
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium",
        BADGE_TONES[tone] || BADGE_TONES.neutral,
        className
      )}
    >
      {children}
    </span>
  )
}

export function PanelTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { key: T; label: string; count?: number }[]
  value: T
  onChange: (key: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 overflow-x-auto rounded-lg border border-white/[0.07] bg-[#0d0f13] p-1",
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.key === value
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              "inline-flex flex-shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-white/[0.07] text-slate-100"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
                  active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.05] text-slate-500"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function PanelInput({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block space-y-1">
      {label && (
        <span className="text-xs font-medium text-slate-400">{label}</span>
      )}
      <input
        {...props}
        className={cn(
          "h-9 w-full rounded-lg border border-white/[0.08] bg-[#0b0d10] px-3 text-sm text-slate-100",
          "placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />
    </label>
  )
}

export function PanelSelect({
  label,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block space-y-1">
      {label && (
        <span className="text-xs font-medium text-slate-400">{label}</span>
      )}
      <select
        {...props}
        className={cn(
          "h-9 w-full rounded-lg border border-white/[0.08] bg-[#0b0d10] px-2 text-sm text-slate-100",
          "focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/15",
          className
        )}
      >
        {children}
      </select>
    </label>
  )
}

export function PanelButton({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger"
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-emerald-400 text-[#07110d] hover:bg-emerald-300",
        variant === "ghost" &&
          "border border-white/[0.09] text-slate-300 hover:bg-white/[0.04] hover:text-slate-100",
        variant === "danger" &&
          "border border-rose-500/25 text-rose-300 hover:bg-rose-500/10",
        className
      )}
    />
  )
}

export function PanelNotice({
  tone = "error",
  children,
}: {
  tone?: "error" | "success"
  children: React.ReactNode
}) {
  if (!children) return null
  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-xs",
        tone === "error"
          ? "border-rose-500/20 bg-rose-500/[0.07] text-rose-300"
          : "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300"
      )}
    >
      {children}
    </p>
  )
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 py-12 text-center text-sm text-slate-500">
      {children}
    </p>
  )
}

/** To'q fondagi modal — panelda ishlatiladigan yagona oyna turi. */
export function PanelDialog({
  open,
  title,
  onClose,
  wide = false,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  /** Kengroq va uzun mazmun uchun ichidan aylanadigan oyna */
  wide?: boolean
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full rounded-xl border border-white/10 bg-[#111317] p-5",
          wide ? "max-h-[92vh] max-w-xl overflow-y-auto" : "max-w-md"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-slate-100">{title}</h2>
        {children}
      </div>
    </div>
  )
}
