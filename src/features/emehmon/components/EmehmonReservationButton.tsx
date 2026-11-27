import { IdCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { tr } from "@/i18n"
import { useAuthStore } from "@/store/auth"

import { useEmehmonConfig } from "../api/emehmon"
import { useEmehmonUi } from "../lib/store"

/* Bron oynasidagi «E-mehmon» tugmasi — bronning davlat ro'yxati varag'ini
   ochadi. Integratsiya yoqilmagan filialda (yoki xodim bron yuritmasa)
   umuman ko'rinmaydi; kirish rasmiylashtirilmagan bronda ham yo'q. */

const STAY_STATUSES = ["CHECKED_IN", "CHECKED_OUT"]

interface Props {
  reservationId: string | null | undefined
  status: string | null | undefined
  /** Bosilganda ota oyna yopilsin (ikki oyna ustma-ust turmasin) */
  onOpen?: () => void
}

export function EmehmonReservationButton({ reservationId, status, onOpen }: Props) {
  const user = useAuthStore((s) => s.user)
  const { data: cfg } = useEmehmonConfig(!!user)
  const openReservation = useEmehmonUi((s) => s.openReservation)

  if (!cfg?.enabled || !cfg.can_operate) return null
  if (!reservationId || !status || !STAY_STATUSES.includes(status)) return null

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        onOpen?.()
        openReservation(reservationId)
      }}
    >
      <IdCard className="mr-2 h-4 w-4" />
      {tr("E-mehmon")}
    </Button>
  )
}
