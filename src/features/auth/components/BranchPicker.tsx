import { useState } from "react"
import { Check, GitBranch, Loader2 } from "lucide-react"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import { switchContext, type ContextHotel } from "../api/context"
import { tr } from "@/i18n"

/* Administrator: o'z mehmonxonasining filialini tanlash.

   Filiallar to'liq ajratilgan — xonalar, mehmonlar, bronlar, kassa,
   hisobotlar va sozlamalar har filialniki. Administrator boshqa filial
   ma'lumotini faqat shu yerda o'sha filialni tanlab ko'radi. Tanlangach
   sahifa to'liq qayta yuklanadi (switchContext): oldingi filial keshi
   yangisiga aralashmaydi. */

export function BranchPicker({
  hotel,
  currentBranchId,
}: {
  hotel: ContextHotel
  currentBranchId?: string | null
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const choose = async (branchId: string) => {
    if (branchId === currentBranchId || busy) return
    setBusy(branchId)
    setFailure(null)
    try {
      await switchContext(hotel.id, branchId)
    } catch (e) {
      setFailure(apiErrorMessage(e))
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <p className="text-sm text-gray-500">
        {tr("Har filialning xonalari, mehmonlari, kassasi va hisobotlari alohida. Tanlangan filial ma'lumotlari ochiladi.")}
      </p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {hotel.branches.map((branch) => {
          const current = branch.id === currentBranchId
          return (
            <button
              key={branch.id}
              type="button"
              disabled={!!busy}
              onClick={() => choose(branch.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                current
                  ? "border-primary-300 bg-primary-50/60"
                  : "border-gray-200 hover:border-primary-300 hover:bg-primary-50/40",
                busy && !current && "opacity-60"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  current ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-600"
                )}
              >
                <GitBranch className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-900">{branch.name}</span>
                <span className="block truncate text-xs text-gray-500">
                  {[branch.code, branch.is_main ? tr("Asosiy filial") : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              {busy === branch.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
              ) : current ? (
                <Check className="h-4 w-4 text-primary-600" />
              ) : null}
            </button>
          )
        })}
      </div>
      {failure && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{failure}</p>
      )}
    </div>
  )
}
