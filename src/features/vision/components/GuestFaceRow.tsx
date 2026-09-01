import { useState } from "react"
import { Check, Loader2, ScanFace, Trash2, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  useDeleteGuestFace,
  useEnrollSighting,
  useGuestFaceStatus,
  type SightingGroup,
} from "../api/vision"
import { FacePickerDialog } from "./FacePickerDialog"

/**
 * Mavjud mehmonning yuz holati va uni biriktirish.
 *
 * Yangi mehmon oqimidan farqi bitta, lekin muhim: mehmon **allaqachon
 * mavjud**, ya'ni id bor va biriktirish saqlashni kutmaydi — darhol
 * bajariladi va natija shu yerda ko'rinadi. Yangi mehmonda esa id faqat
 * saqlashdan keyin paydo bo'ladi, shuning uchun u yerda tanlov eslab
 * qolinadi.
 *
 * Shu sababli bu komponent formadan mustaqil: uni bandlov dialogiga ham,
 * mehmonlar sahifasiga ham qo'yish mumkin.
 */

interface GuestFaceRowProps {
  guestId: string
  /** Qaysi filial kameralari ko'rsatiladi. */
  branchId?: string | null
  noBranchTitle?: string
  noBranchHint?: string
  /** O'chirish tugmasi ko'rsatilsinmi — rozilikni qaytarib olish uchun. */
  allowRemove?: boolean
  className?: string
}

export function GuestFaceRow({
  guestId,
  branchId,
  noBranchTitle,
  noBranchHint,
  allowRemove = false,
  className,
}: GuestFaceRowProps) {
  const { data, isLoading, isError, error: statusError } = useGuestFaceStatus(guestId)
  const enroll = useEnrollSighting()
  const remove = useDeleteGuestFace()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const attach = async (group: SightingGroup) => {
    setError(null)
    setMessage(null)
    try {
      await enroll.mutateAsync({
        sightingId: group.best_sighting_id,
        sightingIds: group.sighting_ids,
        guestId,
        // Xodim suratni ataylab tanladi va mehmon kamera oldida turibdi.
        consent: true,
      })
      setMessage(
        group.count > 1
          ? `${group.count} ta surat biriktirildi`
          : "Yuz biriktirildi"
      )
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Biriktirib bo'lmadi.")
    }
  }

  const drop = async () => {
    if (
      !window.confirm(
        "Mehmonning yuz ma'lumotlari butunlay o'chirilsinmi?\n\nShablonlar ham, saqlangan suratlar ham o'chadi va u boshqa avtomatik tanilmaydi."
      )
    )
      return
    setError(null)
    setMessage(null)
    try {
      await remove.mutateAsync(guestId)
      setMessage("Yuz ma'lumotlari o'chirildi")
    } catch (e: any) {
      setError(e?.response?.data?.detail || "O'chirib bo'lmadi.")
    }
  }

  /* Endpoint umuman yo'q (backend yangilanmagan) yoki ruxsat yo'q — jimgina
     yashiramiz: ishlamaydigan tugma ko'rsatishdan yaxshiroq.
     Boshqa xatolar (tarmoq uzilishi, 500) esa vaqtinchalik — ularda tugmani
     yashirish xodimni imkoniyat umuman yo'q deb o'ylashga majbur qilardi. */
  const status = (statusError as any)?.response?.status
  if (isError && (status === 404 || status === 403)) return null

  const enrolled = !!data?.enrolled

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {isLoading ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Yuz holati tekshirilmoqda…
          </span>
        ) : enrolled ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <ScanFace className="h-3.5 w-3.5" />
              Yuz biriktirilgan
              {data && data.profiles > 1 && ` (${data.profiles} ko'rinish)`}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              disabled={enroll.isPending}
            >
              <Video className="mr-1.5 h-3.5 w-3.5" />
              Yana qo'shish
            </Button>
            {allowRemove && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={drop}
                disabled={remove.isPending}
                className="text-red-600 hover:text-red-700"
              >
                {remove.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                O'chirish
              </Button>
            )}
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <ScanFace className="h-3.5 w-3.5 text-gray-400" />
              Yuz biriktirilmagan
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              disabled={enroll.isPending}
            >
              {enroll.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Video className="mr-1.5 h-3.5 w-3.5" />
              )}
              Kameradan biriktirish
            </Button>
          </>
        )}
      </div>

      {message && (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600">
          <Check className="h-3 w-3" />
          {message}
        </p>
      )}
      {error && <p className="text-[11px] text-red-500">{error}</p>}

      <FacePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        branchId={branchId}
        onSelect={attach}
        noBranchTitle={noBranchTitle}
        noBranchHint={noBranchHint}
      />
    </div>
  )
}
