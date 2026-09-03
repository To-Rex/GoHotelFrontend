import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { SortDir } from "@/features/finance/lib/tableState"

/**
 * Sahifalanadigan jadvallarning umumiy bo'laklari: saralanadigan ustun
 * sarlavhasi, qidiruv maydoni va sahifalagich.
 *
 * Uchta jadval (to'lovlar, hisob-fakturalar, do'kon savdosi) bir xil
 * ko'rinishi va bir xil ishlashi kerak — xodim bittasini o'rgansa
 * qolganini ham biladi.
 */

interface SortableHeadProps {
  /** Serverga yuboriladigan ustun nomi */
  column: string
  active: string
  dir: SortDir
  onSort: (column: string) => void
  align?: "left" | "right"
  className?: string
  children: React.ReactNode
}

export function SortableHead({
  column,
  active,
  dir,
  onSort,
  align = "left",
  className,
  children,
}: SortableHeadProps) {
  const isActive = active === column
  // Tanlanmagan ustunda ham belgi turadi — aks holda ustunni bosish
  // mumkinligi bilinmasdi
  const Icon = !isActive ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown
  return (
    <TableHead className={cn("p-0", className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : "none"}
        className={cn(
          "flex h-10 w-full items-center gap-1 px-2 text-left font-medium transition-colors hover:text-primary-700",
          align === "right" && "justify-end",
          isActive ? "text-primary-700" : "text-foreground"
        )}
      >
        <span className="truncate">{children}</span>
        <Icon
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0",
            isActive ? "opacity-100" : "opacity-30"
          )}
        />
      </button>
    </TableHead>
  )
}

interface TableSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function TableSearch({
  value,
  onChange,
  placeholder = "Qidirish...",
  className,
}: TableSearchProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input
        className="h-9 pl-8 pr-8"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Qidiruvni tozalash"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

interface TablePagerProps {
  page: number
  pageCount: number
  /** "51–100 / 1240" ko'rinishidagi yozuv */
  label: string
  onPage: (page: number) => void
  /** Yangi sahifa kelayotganda tugmalar bloklanadi */
  busy?: boolean
}

export function TablePager({
  page,
  pageCount,
  label,
  onPage,
  busy = false,
}: TablePagerProps) {
  // Bitta sahifa bo'lsa tugmalar keraksiz, lekin qatorlar soni foydali
  const many = pageCount > 1
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-gray-500">
      <span className="tabular-nums">{label}</span>
      {many && (
        <div className="flex items-center gap-1">
          <PagerButton
            disabled={busy || page <= 0}
            onClick={() => onPage(page - 1)}
          >
            Oldingi
          </PagerButton>
          <span className="px-1.5 tabular-nums">
            {page + 1} / {pageCount}
          </span>
          <PagerButton
            disabled={busy || page >= pageCount - 1}
            onClick={() => onPage(page + 1)}
          >
            Keyingi
          </PagerButton>
        </div>
      )}
    </div>
  )
}

function PagerButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 font-medium transition-colors",
        disabled
          ? "cursor-not-allowed border-gray-100 text-gray-300"
          : "border-gray-200 text-gray-600 hover:bg-gray-50"
      )}
    >
      {children}
    </button>
  )
}
