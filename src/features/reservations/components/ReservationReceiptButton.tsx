import { useState } from "react"
import { Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth"
import { useReceiptSettings } from "@/features/shop/api/shop"
import { printReservationReceipt } from "@/lib/tprints"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import { buildReservationReceiptData, type ReceiptReservation } from "../lib/receipt"

// Tur shu yerdan ham olinadi (eski importlar buzilmasin)
export type { ReceiptReservation } from "../lib/receipt"

/* Bron cheki — istalgan bron uchun, jumladan eskilari uchun ham.

   Chek bronning o'zidagi ma'lumotdan quriladi (raqam, sana, summa, to'langan),
   shuning uchun u arxivdagi bronlar uchun ham ishlaydi — hech qanday qo'shimcha
   yozuv yoki migratsiya talab qilmaydi.

   Chek dizayni do'kon cheki bilan bir xil manbadan (mehmonxona sozlamasi)
   olinadi, ya'ni sarlavha, izohlar va QR ikkala hujjatda ham bir xil turadi. */

interface Props {
  reservation: ReceiptReservation
  /** Ro'yxatdagi qatorlar uchun ixcham ko'rinish */
  compact?: boolean
  guestName?: string | null
  roomNumber?: string | null
  roomType?: string | null
  createdByName?: string | null
  services?: Array<{ name: string; quantity?: number | null; amount: number }>
  className?: string
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

  const doPrint = async () => {
    setBusy(true)
    setError(null)
    setDone(false)
    // Soatlik bronda soat, kunlikda sutka — chek ma'lumoti umumiy yig'uvchidan
    // (avtomatik chek bilan bir xil)
    const data = buildReservationReceiptData(reservation, {
      guestName,
      roomNumber,
      roomType,
      createdByName,
      services,
    })
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
      setError(result.error || tr("Chek chiqmadi — printer ulanishini tekshiring"))
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
        title={tr("Bron cheki")}
        className="gap-2"
      >
        {busy ? (
          <Loader2 className={compact ? "h-4 w-4 animate-spin" : "h-4 w-4 animate-spin"} />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        {compact ? "" : done ? tr("Chek chiqdi") : tr("Chek chiqarish")}
      </Button>
      {error && (
        <span className="max-w-[260px] text-[11px] leading-snug text-red-600">
          {error}
        </span>
      )}
    </div>
  )
}
