import { useMemo } from "react"
import { CalendarCheck, Loader2, User, Phone, Wallet, Clock } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import type { Room } from "@/types/api"
import { useRoomReservations, type RoomReservation } from "../api/rooms"

/* Xonaning bandlovlari.

   Xona kartochkasidagi tugma shu oynani ochadi: shu xonada kim, qachon
   turgan va turadi — eng yangisidan boshlab. Ro'yxat faqat oyna ochilganda
   so'raladi, ya'ni xonalar sahifasining o'zi og'irlashmaydi. */

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

const statusEdge: Record<string, string> = {
  PENDING: "bg-amber-400",
  CONFIRMED: "bg-blue-400",
  CHECKED_IN: "bg-emerald-400",
  CHECKED_OUT: "bg-gray-300",
  NO_SHOW: "bg-gray-300",
  CANCELLED: "bg-red-400",
}

const PAY_LABELS: Record<string, string> = {
  UNPAID: "To'lanmagan",
  PARTIALLY_PAID: "Qisman to'langan",
  PAID: "To'langan",
  REFUNDED: "Qaytarilgan",
}

const fmtMoney = (n: number) => Number(n || 0).toLocaleString()

const fmtDay = (value?: string | null) => {
  if (!value) return "—"
  const day = String(value).slice(0, 10)
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`
}

// Soatlik bronda aniq vaqt ham ko'rsatiladi, kunlikda faqat sana
const fmtMoment = (res: RoomReservation, side: "in" | "out") => {
  const hourly = (res.booking_type || "").toUpperCase() === "HOURLY"
  const stamp = side === "in" ? res.check_in_datetime : res.check_out_datetime
  const day = side === "in" ? res.check_in_date : res.check_out_date
  if (hourly && stamp) {
    const raw = String(stamp).slice(0, 16)
    return `${fmtDay(raw)} ${raw.slice(11, 16)}`
  }
  return fmtDay(day)
}

interface Props {
  room: Room | null
  onClose: () => void
}

export const RoomReservationsDialog = ({ room, onClose }: Props) => {
  const { data: reservations = [], isLoading, error } = useRoomReservations(room?.id)

  // Bekor qilingan/kelmagan bronlar pul hisobiga kirmaydi
  const stats = useMemo(() => {
    const live = reservations.filter(
      (r) => r.status !== "CANCELLED" && r.status !== "NO_SHOW"
    )
    return {
      total: reservations.length,
      income: live.reduce((sum, r) => sum + Number(r.paid_amount || 0), 0),
      active: reservations.filter(
        (r) => r.status === "CHECKED_IN" || r.status === "CONFIRMED"
      ).length,
    }
  }, [reservations])

  return (
    <Dialog open={!!room} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <CalendarCheck className="h-4 w-4" />
            </span>
            Bandlovlar — {room?.room_number}-xona
          </DialogTitle>
        </DialogHeader>

        {/* Qisqa jamlanma */}
        {!isLoading && !error && reservations.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Jami bandlov", value: String(stats.total) },
              { label: "Faol", value: String(stats.active) },
              { label: "Tushum", value: `${fmtMoney(stats.income)} so'm` },
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
        )}

        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-0.5">
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

          {!isLoading && !error && reservations.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
              <CalendarCheck className="h-8 w-8" />
              <p className="text-sm">Bu xonada hali bandlov yo'q</p>
            </div>
          )}

          {reservations.map((res) => {
            const debt = Number(res.total_amount || 0) - Number(res.paid_amount || 0)
            return (
              <div
                key={res.id}
                className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-3 pl-4"
              >
                {/* Chap chekkadagi holat chizig'i */}
                <span
                  className={cn(
                    "absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full",
                    statusEdge[res.status] || "bg-gray-300"
                  )}
                />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold text-gray-900">
                      <User className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      {res.guest_name || "Mehmon ko'rsatilmagan"}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                      <span className="font-medium text-gray-600">
                        {res.reservation_number}
                      </span>
                      {res.guest_phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {res.guest_phone}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold",
                      statusBadge[res.status] || "bg-gray-100 text-gray-500"
                    )}
                  >
                    {STATUS_LABELS[res.status] || res.status}
                  </span>
                </div>

                <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-600">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  {fmtMoment(res, "in")}
                  <span className="text-gray-300">→</span>
                  {fmtMoment(res, "out")}
                  {(res.adults || res.children) && (
                    <span className="text-gray-400">
                      · {res.adults}
                      {res.children ? `+${res.children}` : ""} kishi
                    </span>
                  )}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold tabular-nums text-gray-900">
                    <Wallet className="h-3.5 w-3.5 text-gray-400" />
                    {fmtMoney(res.total_amount)} so'm
                  </span>
                  <span className="tabular-nums text-gray-500">
                    To'langan: {fmtMoney(res.paid_amount)}
                  </span>
                  {debt > 0 && res.status !== "CANCELLED" && (
                    <span className="font-medium tabular-nums text-red-600">
                      Qarz: {fmtMoney(debt)}
                    </span>
                  )}
                  <span className="ml-auto text-gray-400">
                    {PAY_LABELS[res.payment_status] || res.payment_status}
                  </span>
                </div>

                {res.status === "CANCELLED" && res.cancelled_reason && (
                  <p className="mt-1.5 truncate text-[11px] text-red-500">
                    Sabab: {res.cancelled_reason}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
