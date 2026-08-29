import { useMemo, useState } from "react"
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  Loader2,
  Phone,
  Search,
  FilterX,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ReservationReceiptButton } from "@/features/reservations/components/ReservationReceiptButton"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import type { Room } from "@/types/api"
import { useRoomReservations, type RoomReservation } from "../api/rooms"

/* Xonaning bandlovlari.

   Xona kartochkasidagi tugma shu oynani ochadi: shu xonada kim, qachon
   turgan va turadi. Har bir band bandlovlar ro'yxatidagidek to'liq —
   mehmon, muddat, kecha soni yoki soatlik oralig'i, chegirma, to'langan
   qismi, holat va to'lov belgilari — hamda chek chiqarish tugmasi bilan.

   Ro'yxat faqat oyna ochilganda so'raladi, ya'ni xonalar sahifasining o'zi
   og'irlashmaydi. */

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlangan",
  CHECKED_IN: "Kirgan",
  CHECKED_OUT: "Chiqgan",
  NO_SHOW: "Kelmadi",
  CANCELLED: "Bekor qilingan",
}

const statusBadge: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-emerald-100 text-emerald-700",
  CHECKED_OUT: "bg-gray-200 text-gray-600",
  NO_SHOW: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-600",
}

const statusDot: Record<string, string> = {
  PENDING: "bg-amber-500",
  CONFIRMED: "bg-blue-500",
  CHECKED_IN: "bg-emerald-500",
  CHECKED_OUT: "bg-gray-400",
  NO_SHOW: "bg-gray-400",
  CANCELLED: "bg-red-500",
}

const statusEdge: Record<string, string> = {
  PENDING: "border-l-amber-400",
  CONFIRMED: "border-l-blue-400",
  CHECKED_IN: "border-l-emerald-400",
  CHECKED_OUT: "border-l-gray-300",
  NO_SHOW: "border-l-gray-300",
  CANCELLED: "border-l-red-400",
}

const PAY_LABELS: Record<string, string> = {
  UNPAID: "To'lanmagan",
  PARTIALLY_PAID: "Qisman",
  PAID: "To'langan",
  REFUNDED: "Qaytarilgan",
}

const payBadge: Record<string, string> = {
  UNPAID: "bg-red-100 text-red-600",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  REFUNDED: "bg-gray-100 text-gray-500",
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

// Mehmon avatari uchun bosh harflar
const initials = (name?: string | null) => {
  const parts = (name || "").trim().split(/\s+/)
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?"
}

// Kunlik bron uchun kechalar soni
const nights = (checkIn?: string, checkOut?: string): number => {
  if (!checkIn || !checkOut) return 0
  const a = new Date(checkIn).getTime()
  const b = new Date(checkOut).getTime()
  if (isNaN(a) || isNaN(b)) return 0
  return Math.max(Math.round((b - a) / 86400000), 0)
}

interface Props {
  room: Room | null
  onClose: () => void
}

export const RoomReservationsDialog = ({ room, onClose }: Props) => {
  const { data: reservations = [], isLoading, error } = useRoomReservations(room?.id)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  // Holatlar bo'yicha sonlar — filtr chiplarida ko'rsatiladi
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of reservations) m[r.status] = (m[r.status] || 0) + 1
    return m
  }, [reservations])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reservations.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false
      if (!q) return true
      return (
        (r.reservation_number || "").toLowerCase().includes(q) ||
        (r.guest_name || "").toLowerCase().includes(q) ||
        (r.guest_phone || "").toLowerCase().includes(q)
      )
    })
  }, [reservations, search, statusFilter])

  // Bekor qilingan/kelmagan bronlar pul hisobiga kirmaydi
  const stats = useMemo(() => {
    const live = reservations.filter(
      (r) => r.status !== "CANCELLED" && r.status !== "NO_SHOW"
    )
    return {
      total: reservations.length,
      active: reservations.filter(
        (r) => r.status === "CHECKED_IN" || r.status === "CONFIRMED"
      ).length,
      income: live.reduce((sum, r) => sum + Number(r.paid_amount || 0), 0),
    }
  }, [reservations])

  const hasFilters = !!search.trim() || !!statusFilter
  const clearFilters = () => {
    setSearch("")
    setStatusFilter("")
  }

  // Oyna yopilganda filtrlar keyingi xona uchun qolib ketmasin
  const close = () => {
    clearFilters()
    onClose()
  }

  return (
    <Dialog open={!!room} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <CalendarCheck className="h-4 w-4" />
            </span>
            Bandlovlar — {room?.room_number}-xona
          </DialogTitle>
        </DialogHeader>

        {!isLoading && !error && reservations.length > 0 && (
          <>
            {/* Qisqa jamlanma */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Jami bandlov", value: String(stats.total) },
                { label: "Faol", value: String(stats.active) },
                { label: "Tushum", value: `${fmt(stats.income)} so'm` },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2"
                >
                  <p className="text-[11px] text-gray-500">{s.label}</p>
                  <p className="truncate text-sm font-bold tabular-nums text-gray-900">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Qidiruv va holat filtri */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="h-9 pl-9"
                  placeholder="Bandlov raqami, mehmon yoki telefon..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter("")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    !statusFilter
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  Barchasi ({reservations.length})
                </button>
                {Object.entries(STATUS_LABELS)
                  .filter(([value]) => statusCounts[value])
                  .map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setStatusFilter(statusFilter === value ? "" : value)
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        statusFilter === value
                          ? "border-primary-600 bg-primary-50 text-primary-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          statusDot[value] || "bg-gray-400"
                        )}
                      />
                      {label} ({statusCounts[value]})
                    </button>
                  ))}
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-gray-500"
                    onClick={clearFilters}
                  >
                    <FilterX className="mr-1 h-3.5 w-3.5" />
                    Tozalash
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-0.5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Yuklanmoqda...
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {apiErrorMessage(error)}
            </p>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
              <CalendarCheck className="h-8 w-8" />
              <p className="text-sm">
                {hasFilters
                  ? "Filtr bo'yicha bandlov topilmadi"
                  : "Bu xonada hali bandlov yo'q"}
              </p>
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Filtrlarni tozalash
                </Button>
              )}
            </div>
          )}

          {filtered.map((res) => (
            <ReservationItem key={res.id} res={res} roomNumber={room?.room_number} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Bitta bandlov bandi — bandlovlar ro'yxatidagi qator bilan bir xil mazmun
const ReservationItem = ({
  res,
  roomNumber,
}: {
  res: RoomReservation
  roomNumber?: string
}) => {
  const isHourly = (res.booking_type || "").toUpperCase() === "HOURLY"
  const timeRange =
    isHourly && res.check_in_datetime && res.check_out_datetime
      ? `${String(res.check_in_datetime).slice(11, 16)} – ${String(res.check_out_datetime).slice(11, 16)}`
      : ""
  const nightCount = isHourly ? 0 : nights(res.check_in_date, res.check_out_date)
  const debt = Number(res.total_amount || 0) - Number(res.paid_amount || 0)

  return (
    <div
      className={cn(
        "rounded-2xl border border-l-4 bg-white p-3.5",
        statusEdge[res.status] || "border-l-transparent"
      )}
    >
      {/* Yuqori qator: bandlov raqami + turi, o'ng tomonda chek tugmasi */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-tight text-gray-900">
            {res.reservation_number || res.id.slice(0, 8)}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs leading-tight text-gray-400">
            {isHourly ? (
              <>
                <Clock className="h-3 w-3" /> Soatlik
              </>
            ) : (
              <>
                <CalendarDays className="h-3 w-3" /> Kunlik
              </>
            )}
          </p>
        </div>
        {/* Chek — arxivdagi bronlar uchun ham; bron ma'lumotidan quriladi,
            shuning uchun qo'shimcha yozuv talab qilmaydi */}
        <ReservationReceiptButton
          reservation={res}
          compact
          guestName={res.guest_name}
          roomNumber={roomNumber}
        />
      </div>

      {/* Mehmon: avatar + ism + telefon */}
      <div className="mt-2.5">
        {res.guest_name ? (
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700">
              {initials(res.guest_name)}
            </span>
            <span className="min-w-0">
              <p className="truncate leading-tight text-gray-900">{res.guest_name}</p>
              {res.guest_phone && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs leading-tight text-gray-400">
                  <Phone className="h-3 w-3" />
                  {res.guest_phone}
                </p>
              )}
            </span>
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </div>

      {/* Muddat va summa (chegirma / to'langan qismi bilan) */}
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {isHourly ? (
            <>
              <p className="leading-tight text-gray-700">{res.check_in_date}</p>
              <p className="mt-0.5 text-xs leading-tight text-gray-400">
                {timeRange || "—"}
              </p>
            </>
          ) : (
            <>
              <p className="leading-tight text-gray-700">
                {res.check_in_date} → {res.check_out_date}
              </p>
              <p className="mt-0.5 text-xs leading-tight text-gray-400">
                {nightCount} kecha
              </p>
            </>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-semibold leading-tight tabular-nums text-gray-900">
            {fmt(res.total_amount)}{" "}
            <span className="text-xs font-normal text-gray-400">So'm</span>
          </p>
          {Number(res.discount_amount || 0) > 0 && (
            <p className="mt-0.5 text-xs leading-tight text-red-500">
              Chegirma: −{fmt(res.discount_amount)}
            </p>
          )}
          {Number(res.paid_amount || 0) > 0 &&
            Number(res.paid_amount) < Number(res.total_amount || 0) && (
              <p className="mt-0.5 text-xs leading-tight text-emerald-600">
                To'landi: {fmt(res.paid_amount)}
              </p>
            )}
          {debt > 0 && res.status !== "CANCELLED" && (
            <p className="mt-0.5 text-xs font-medium leading-tight tabular-nums text-red-600">
              Qarz: {fmt(debt)}
            </p>
          )}
        </div>
      </div>

      {/* Pastki qator: holat va to'lov belgilari */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2.5">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            statusBadge[res.status] || statusBadge.PENDING
          )}
        >
          {STATUS_LABELS[res.status] || res.status}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            payBadge[res.payment_status] || payBadge.UNPAID
          )}
        >
          {PAY_LABELS[res.payment_status] || res.payment_status}
        </span>
        {(res.adults || res.children) && (
          <span className="text-xs text-gray-400">
            {res.adults}
            {res.children ? `+${res.children}` : ""} kishi
          </span>
        )}
        {res.status === "CANCELLED" && res.cancelled_reason && (
          <span className="w-full truncate text-[11px] text-red-500">
            Sabab: {res.cancelled_reason}
          </span>
        )}
      </div>
    </div>
  )
}
