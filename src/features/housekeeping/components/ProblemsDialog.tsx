import { useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  PROBLEM_CATEGORIES,
  PROBLEM_STATUSES,
  useProblems,
  useUpdateProblemStatus,
  type Problem,
  type ProblemStatus,
} from "../api/problems"

/**
 * Xodimlar xabar bergan muammolar.
 *
 * Farrosh mobil ilovadan yuboradi — singan jihoz, tugagan buyum. Ilgari
 * bu xabarlar bazaga tushardi-yu, boshqaruv ularni ko'rmasdi: xabar
 * yuborish tugmasi bor edi, xabarni o'qiydigan ekran yo'q edi.
 *
 * Ochiq muammolar birinchi turadi: hal qilinganlari ro'yxat boshini
 * band qilmasligi kerak.
 */

const statusBadge: Record<ProblemStatus, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
}

const ORDER: Record<ProblemStatus, number> = {
  OPEN: 0,
  IN_PROGRESS: 1,
  RESOLVED: 2,
}

export function ProblemsDialog({
  open,
  onOpenChange,
  canManage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Holatni faqat admin yoki menejer o'zgartira oladi */
  canManage: boolean
}) {
  const [filter, setFilter] = useState<ProblemStatus | "">("")
  const { data: problems = [], isLoading } = useProblems(filter, open)
  const update = useUpdateProblemStatus()
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const sorted = [...problems].sort((a, b) => {
    const byStatus = ORDER[a.status] - ORDER[b.status]
    if (byStatus !== 0) return byStatus
    return (b.created_at || "").localeCompare(a.created_at || "")
  })

  const setStatus = async (problem: Problem, status: ProblemStatus) => {
    setBusyId(problem.id)
    setError(null)
    try {
      await update.mutateAsync({ id: problem.id, status })
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const openCount = problems.filter((p) => p.status === "OPEN").length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Xabar berilgan muammolar
            {openCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                {openCount} ochiq
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filter === ""} onClick={() => setFilter("")}>
            Barchasi
          </FilterChip>
          {PROBLEM_STATUSES.map((s) => (
            <FilterChip
              key={s.key}
              active={filter === s.key}
              onClick={() => setFilter(s.key)}
            >
              {s.label}
            </FilterChip>
          ))}
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            {filter ? "Bu holatda muammo yo'q" : "Hozircha muammo xabari yo'q"}
          </p>
        ) : (
          <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {sorted.map((p) => (
              <li key={p.id} className="rounded-xl border bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-900">
                      {PROBLEM_CATEGORIES[p.category] || p.category}
                      {p.room_number && (
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                          {p.room_number}-xona
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {p.reported_by_name || "Xodim"}
                      {p.created_at
                        ? ` · ${p.created_at.slice(0, 10)} ${p.created_at.slice(11, 16)}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      statusBadge[p.status]
                    )}
                  >
                    {PROBLEM_STATUSES.find((s) => s.key === p.status)?.label ||
                      p.status}
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-line rounded-lg bg-gray-50 px-2.5 py-2 text-sm text-gray-700">
                  {p.description}
                </p>

                {canManage && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {PROBLEM_STATUSES.filter((s) => s.key !== p.status).map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => setStatus(p, s.key)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                          busyId === p.id
                            ? "cursor-not-allowed border-gray-100 text-gray-300"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {busyId === p.id && (
                          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                        )}
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary-600 bg-primary-50 text-primary-700"
          : "border-gray-200 text-gray-600 hover:bg-gray-50"
      )}
    >
      {children}
    </button>
  )
}
