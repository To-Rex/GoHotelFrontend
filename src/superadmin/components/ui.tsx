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
        // Yumshoq shisha sirt: to'q fonda chegara o'rniga oq rangning
        // juda past shaffofligi ishlatiladi — qattiq chiziqlar ekranni
        // to'rga bo'lib tashlardi
        "rounded-2xl border border-white/5 bg-white/[0.03] p-4",
        "transition-colors hover:border-white/10",
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          {title}
        </h1>
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
          "h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100",
          "placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none",
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
          "h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-sm text-slate-100",
          "focus:border-emerald-500/60 focus:outline-none",
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
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
        variant === "ghost" &&
          "border border-white/10 text-slate-300 hover:bg-white/5",
        variant === "danger" &&
          "border border-red-500/20 text-red-300 hover:bg-red-500/10",
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
          ? "border-red-500/20 bg-red-500/10 text-red-300"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      )}
    >
      {children}
    </p>
  )
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-slate-500">
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
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-bold text-slate-100">{title}</h2>
        {children}
      </div>
    </div>
  )
}
