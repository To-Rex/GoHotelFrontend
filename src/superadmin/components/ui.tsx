import { cn } from "@/lib/utils"

/**
 * Panelning umumiy bo'laklari.
 *
 * Panel to'q fonda ishlaydi, mehmonxona tizimi esa yorug'da. Umumiy
 * `ui/` komponentlari yorug' fonga sozlangan — ularni bu yerda qayta
 * ranglash har faylda takrorlanardi, shuning uchun bir necha kichik
 * o'ram shu yerda turadi.
 */

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
        "rounded-xl border border-slate-800 bg-slate-900 p-4",
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
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-100">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
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
          "h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100",
          "placeholder:text-slate-600 focus:border-slate-500 focus:outline-none",
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
          "h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100",
          "focus:border-slate-500 focus:outline-none",
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
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-emerald-600 text-white hover:bg-emerald-500",
        variant === "ghost" &&
          "border border-slate-700 text-slate-300 hover:bg-slate-800",
        variant === "danger" &&
          "border border-red-900 text-red-300 hover:bg-red-950/60",
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
        "rounded-md border px-3 py-2 text-xs",
        tone === "error"
          ? "border-red-900 bg-red-950/60 text-red-300"
          : "border-emerald-900 bg-emerald-950/60 text-emerald-300"
      )}
    >
      {children}
    </p>
  )
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-800 py-10 text-center text-sm text-slate-500">
      {children}
    </p>
  )
}

/** To'q fondagi modal — panelda ishlatiladigan yagona oyna turi. */
export function PanelDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-bold text-slate-100">{title}</h2>
        {children}
      </div>
    </div>
  )
}
