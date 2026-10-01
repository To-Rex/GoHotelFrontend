import { useMemo, useState } from "react"
import { Building2, Check, GitBranch, Globe2, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  defaultBranchId,
  filterHotels,
  switchContext,
  useContextOptions,
  type ContextHotel,
} from "../api/context"
import { tr } from "@/i18n"

/* Mehmonxona va filialni tanlash — sozlovchi va tizim ma'muri uchun.

   Ikki joyda ishlatiladi: sozlovchi hali mehmonxona tanlamagan bo'lsa to'liq
   ekranda, keyin esa Navbar'dagi tugma orqali oynada. Tanlangach sahifa
   qayta yuklanadi (switchContext). */

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  SUSPENDED: "bg-amber-50 text-amber-700 ring-amber-200",
  INACTIVE: "bg-gray-100 text-gray-500 ring-gray-200",
  CLOSED: "bg-red-50 text-red-600 ring-red-200",
}

const statusLabel = (status: string): string => {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return tr("Faol")
    case "SUSPENDED":
      return tr("To'xtatilgan")
    case "CLOSED":
      return tr("Yopilgan")
    default:
      return tr("Nofaol")
  }
}

export function HotelContextPicker({
  currentHotelId,
  currentBranchId,
  allowAllHotels = false,
  className,
}: {
  currentHotelId?: string | null
  currentBranchId?: string | null
  /** Tizim ma'muri "barcha mehmonxonalar" holatiga qayta oladi */
  allowAllHotels?: boolean
  className?: string
}) {
  const { data: hotels = [], isLoading, isError, error } = useContextOptions()
  const [query, setQuery] = useState("")
  const [hotelId, setHotelId] = useState<string | null>(currentHotelId ?? null)
  const [branchId, setBranchId] = useState<string | null>(currentBranchId ?? null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const visible = useMemo(() => filterHotels(hotels, query), [hotels, query])
  const selected: ContextHotel | undefined = hotels.find((h) => h.id === hotelId)

  const pickHotel = (hotel: ContextHotel) => {
    setHotelId(hotel.id)
    setBranchId(hotel.id === currentHotelId && currentBranchId ? currentBranchId : defaultBranchId(hotel))
    setFailure(null)
  }

  const unchanged =
    !!hotelId && hotelId === currentHotelId && (branchId ?? null) === (currentBranchId ?? null)

  const submit = async (nextHotel: string | null, nextBranch: string | null) => {
    setBusy(true)
    setFailure(null)
    try {
      await switchContext(nextHotel, nextBranch)
    } catch (e) {
      setFailure(apiErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Mehmonxona yoki filial nomi, kodi")}
          className="h-10 pl-9"
          autoFocus
        />
      </div>

      {allowAllHotels && (
        <button
          type="button"
          disabled={busy || !currentHotelId}
          onClick={() => submit(null, null)}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
            !currentHotelId
              ? "border-primary-300 bg-primary-50/60"
              : "border-gray-200 hover:border-primary-300 hover:bg-primary-50/40"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            <Globe2 className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-gray-900">{tr("Barcha mehmonxonalar")}</span>
            <span className="block text-xs text-gray-500">{tr("Tizim ma'muri rejimi — mehmonxona tanlanmagan")}</span>
          </span>
          {!currentHotelId && <Check className="h-4 w-4 text-primary-600" />}
        </button>
      )}

      <div className="min-h-[160px] flex-1 overflow-y-auto rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("Yuklanmoqda...")}
          </div>
        ) : isError ? (
          <p className="p-4 text-sm text-red-600">{apiErrorMessage(error)}</p>
        ) : visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">{tr("Mehmonxona topilmadi")}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((hotel) => {
              const active = hotel.id === hotelId
              const current = hotel.id === currentHotelId
              return (
                <li key={hotel.id}>
                  <button
                    type="button"
                    onClick={() => pickHotel(hotel)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors",
                      active ? "bg-primary-50/70" : "hover:bg-gray-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-primary-600 text-white" : "bg-primary-50 text-primary-600"
                      )}
                    >
                      <Building2 className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-gray-900">{hotel.name}</span>
                        {hotel.code && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                            {hotel.code}
                          </span>
                        )}
                        {current && (
                          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                            {tr("Hozirgi")}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {tr("{{count}} ta filial", { count: hotel.branches.length })}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                        STATUS_STYLE[(hotel.status || "").toUpperCase()] ?? STATUS_STYLE.INACTIVE
                      )}
                    >
                      {statusLabel(hotel.status)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selected && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <GitBranch className="h-3.5 w-3.5" />
            {tr("Filial")}
          </label>
          {selected.branches.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {tr("Bu mehmonxonada hali filial yo'q — mehmonxona bo'yicha sozlash mumkin.")}
            </p>
          ) : (
            <select
              className="flex h-10 w-full items-center rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={branchId ?? ""}
              onChange={(e) => setBranchId(e.target.value || null)}
            >
              {selected.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.is_main ? ` — ${tr("asosiy")}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {failure && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{failure}</p>}

      <Button
        type="button"
        className="h-10 w-full"
        disabled={!selected || busy || unchanged}
        onClick={() => submit(hotelId, branchId)}
      >
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {selected
          ? tr("{{name}} — o'tish", { name: selected.name })
          : tr("Mehmonxonani tanlang")}
      </Button>
    </div>
  )
}
