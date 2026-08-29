import { useState } from "react"
import { Loader2, Printer } from "lucide-react"
import { differenceInCalendarDays, differenceInHours, format } from "date-fns"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth"
import { useReceiptSettings } from "@/features/shop/api/shop"
import { printReservationReceipt, type ReservationReceiptData } from "@/lib/tprints"
import type { Reservation } from "@/types/api"
import { cn } from "@/lib/utils"

/* Bron cheki — istalgan bron uchun, jumladan eskilari uchun ham.

   Chek bronning o'zidagi ma'lumotdan quriladi (raqam, sana, summa, to'langan),
   shuning uchun u arxivdagi bronlar uchun ham ishlaydi — hech qanday qo'shimcha
   yozuv yoki migratsiya talab qilmaydi.

   Chek dizayni do'kon cheki bilan bir xil manbadan (mehmonxona sozlamasi)
   olinadi, ya'ni sarlavha, izohlar va QR ikkala hujjatda ham bir xil turadi. */

interface Props {
  reservation: Reservation
  /** Ro'yxatdagi qatorlar uchun ixcham ko'rinish */
  compact?: boolean
  guestName?: string | null
  roomNumber?: string | null
  roomType?: string | null
  createdByName?: string | null
  services?: Array<{ name: string; quantity?: number | null; amount: number }>
  className?: string
}

const fmtDate = (value?: string | null, withTime = false) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return format(date, withTime ? "dd.MM.yyyy HH:mm" : "dd.MM.yyyy")
}

export const ReservationReceiptButton = ({
  reservation,
  compact = false,
  guestName,
  roomNumber,
  roomType,
  createdByName,
  services,
  className,
}: Props) => {
  const user = useAuthStore((s) => s.user)
  const { data: design } = useReceiptSettings()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const hourly = (reservation.booking_type || "").toUpperCase() === "HOURLY"
  const checkIn = reservation.check_in_datetime || reservation.check_in_date
  const checkOut = reservation.check_out_datetime || reservation.check_out_date

  // Soatlik bronda soat, kunlikda sutka sanaladi — chekda o'lchov birligi
  // ham shunga qarab yoziladi
  const duration = (() => {
    const from = new Date(checkIn)
    const to = new Date(checkOut)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
    const value = hourly
      ? differenceInHours(to, from)
      : differenceInCalendarDays(to, from)
    return value > 0 ? value : null
  })()

  const doPrint = async () => {
    setBusy(true)
    setError(null)
    setDone(false)
    const data: ReservationReceiptData = {
      reservation_number: reservation.reservation_number,
      guest_name: guestName,
      room_number: roomNumber,
      room_type: roomType,
      check_in: fmtDate(checkIn, hourly),
      check_out: fmtDate(checkOut, hourly),
      nights: duration,
      booking_type: reservation.booking_type,
      adults: reservation.adults,
      children: reservation.children,
      total_amount: Number(reservation.total_amount || 0),
      paid_amount: Number(reservation.paid_amount || 0),
      discount_amount: Number(reservation.discount_amount || 0),
      services,
      created_at: reservation.created_at,
      created_by_name: createdByName,
      status: reservation.status,
    }
    const result = await printReservationReceipt(
      data,
      user?.hotel_name || "GoHotel",
      design
    )
    setBusy(false)
    if (result.ok) {
      setDone(true)
      window.setTimeout(() => setDone(false), 2500)
    } else {
      setError(result.error || "Chek chiqmadi — printer ulanishini tekshiring")
    }
  }

  return (
    <div className={cn("inline-flex flex-col items-start gap-1", className)}>
      <Button
        type="button"
        variant={compact ? "ghost" : "outline"}
        size={compact ? "sm" : "default"}
        onClick={doPrint}
        disabled={busy}
        title="Bron cheki"
        className="gap-2"
      >
        {busy ? (
          <Loader2 className={compact ? "h-4 w-4 animate-spin" : "h-4 w-4 animate-spin"} />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        {compact ? "" : done ? "Chek chiqdi" : "Chek chiqarish"}
      </Button>
      {error && (
        <span className="max-w-[260px] text-[11px] leading-snug text-red-600">
          {error}
        </span>
      )}
    </div>
  )
}
