import { useState } from "react"
import { Building2, ChevronDown, GitBranch } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuthStore } from "@/store/auth"
import { canSwitchContextType } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { useContextOptions } from "../api/context"
import { BranchPicker } from "./BranchPicker"
import { HotelContextPicker } from "./HotelContextPicker"
import { tr } from "@/i18n"

/* Navbar: sozlovchi va tizim ma'muri qaysi mehmonxona va filialda
   ishlayotgani — bosilsa boshqasiga o'tish oynasi ochiladi.
   Administrator — o'z mehmonxonasining filiallari orasida (filial bittadan
   ko'p bo'lsa). Xodimlarda umuman ko'rinmaydi: ular o'z filialida. */

export function ContextSwitcher() {
  const user = useAuthStore((s) => s.user)
  if (user?.user_type === "ADMIN") return <AdminBranchSwitcher />
  return <HotelSwitcher />
}

function AdminBranchSwitcher() {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const { data: hotels = [] } = useContextOptions(true)
  const hotel = hotels.find((h) => h.id === user?.hotel_id) ?? hotels[0]
  if (!hotel || hotel.branches.length < 2) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={tr("Filialni almashtirish")}
        className={cn(
          "flex max-w-[220px] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors",
          "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
        )}
      >
        <GitBranch className="h-4 w-4 shrink-0" />
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-xs font-semibold leading-tight">
            {user?.branch_name || tr("Filial")}
          </span>
          <span className="block truncate text-[11px] leading-tight text-sky-600/80">{hotel.name}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{tr("Filialni tanlash")}</DialogTitle>
          </DialogHeader>
          <BranchPicker hotel={hotel} currentBranchId={user?.branch_id ?? null} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function HotelSwitcher() {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  if (!canSwitchContextType(user?.user_type)) return null

  const hotelName = user?.hotel_name || (user?.hotel_id ? tr("Mehmonxona") : null)
  const label = hotelName ?? tr("Barcha mehmonxonalar")

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={tr("Mehmonxona va filialni almashtirish")}
        className={cn(
          "flex max-w-[220px] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors",
          "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
        )}
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-xs font-semibold leading-tight">{label}</span>
          {user?.branch_name && (
            <span className="block truncate text-[11px] leading-tight text-violet-600/80">
              {user.branch_name}
            </span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{tr("Mehmonxona va filial")}</DialogTitle>
          </DialogHeader>
          <HotelContextPicker
            className="min-h-0 flex-1"
            currentHotelId={user?.hotel_id ?? null}
            currentBranchId={user?.branch_id ?? null}
            allowAllHotels={user?.user_type === "SUPER_ADMIN"}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
