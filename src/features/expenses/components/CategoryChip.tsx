import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import type { ExpenseCategory } from "../api/expenseCategories"
import { categoryVisual } from "../lib/categoryStyle"

/* Xarajat toifasining chipi: belgi + nom, toifa rangida.

   Nom bo'yicha ishlaydi (xarajatda toifa nom bilan saqlanadi). Ro'yxatda
   bo'lmagan eski nom ham belgisiz qolmaydi — teg belgisi va nomdan
   tanlangan rang. `onClick` berilsa — bosiladigan filtr tugmasi. */

export function CategoryChip({
  name,
  categories = [],
  className,
  active,
  onClick,
  size = "sm",
  title,
}: {
  name: string | null | undefined
  categories?: readonly ExpenseCategory[]
  className?: string
  /** Filtr tanlangan holati (faqat onClick bilan) */
  active?: boolean
  onClick?: () => void
  size?: "sm" | "md"
  title?: string
}) {
  const label = name ? tr(name) : "—"
  const { Icon, color } = categoryVisual(name, categories)
  const base = cn(
    "inline-flex max-w-full items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
    name ? color.chip : "bg-gray-100 text-gray-400",
    className
  )
  const icon = name ? (
    <Icon className={cn("flex-shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
  ) : null

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        title={title}
        className={cn(
          base,
          "cursor-pointer transition-[box-shadow,opacity] hover:opacity-90",
          active ? "ring-2 ring-offset-1 ring-gray-900/30" : "opacity-90"
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
      </button>
    )
  }
  return (
    <span className={base} title={title}>
      {icon}
      <span className="truncate">{label}</span>
    </span>
  )
}
