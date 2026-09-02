import { useState } from "react"
import { Ban, Loader2, ShieldCheck } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiErrorMessage } from "@/lib/apiError"
import type { Guest } from "@/types/api"
import { useAddToBlacklist, useRemoveFromBlacklist } from "../api/blacklist"

/**
 * Mehmonni qora ro'yxatga qo'shish yoki chiqarish.
 *
 * Qo'shishda SABAB majburiy: "nega bu odam ro'yxatda?" degan savolga bir
 * yildan keyin ham javob bo'lishi kerak. Sababsiz yozuv ro'yxatning
 * ishonchini yo'qotadi va xodimlar uni chetlab o'ta boshlaydi — shuning
 * uchun maydon bo'sh bo'lsa tugma ishlamaydi.
 */

interface Props {
  guest: Guest | null
  onClose: () => void
}

export function BlacklistDialog({ guest, onClose }: Props) {
  const add = useAddToBlacklist()
  const remove = useRemoveFromBlacklist()
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  if (!guest) return null

  const listed = !!guest.blacklisted_at
  const name = `${guest.first_name} ${guest.last_name || ""}`.trim()
  const pending = add.isPending || remove.isPending

  const submit = async () => {
    setError(null)
    try {
      if (listed) {
        await remove.mutateAsync(guest.id)
      } else {
        const text = reason.trim()
        if (!text) {
          setError("Sababni yozing — ro'yxat sababsiz foydasiz bo'lib qoladi")
          return
        }
        await add.mutateAsync({ id: guest.id, reason: text })
      }
      setReason("")
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  return (
    <Dialog open={!!guest} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {listed ? (
              <>
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Qora ro'yxatdan chiqarish
              </>
            ) : (
              <>
                <Ban className="h-5 w-5 text-red-600" />
                Qora ro'yxatga qo'shish
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-700">
          <b>{name}</b>
          {listed
            ? " qora ro'yxatdan chiqariladi va unga yana xizmat ko'rsatish mumkin bo'ladi."
            : " qora ro'yxatga qo'shiladi. Sozlamada taqiq yoqiq bo'lsa, unga bron ochib bo'lmaydi."}
        </p>

        {listed && guest.blacklist_reason && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Ro'yxatga qo'shilish sababi
            </p>
            <p className="mt-0.5 text-sm text-gray-800">{guest.blacklist_reason}</p>
          </div>
        )}

        {!listed && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Sabab *</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masalan: janjal ko'targan, mol-mulkka zarar yetkazgan"
              autoFocus
            />
            <p className="text-[11px] text-gray-400">
              Sabab ro'yxatda saqlanadi — keyin "nega bu odam ro'yxatda?" degan
              savolga javob bo'ladi.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button
            variant={listed ? "default" : "destructive"}
            onClick={submit}
            disabled={pending}
          >
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {listed ? "Ro'yxatdan chiqarish" : "Qora ro'yxatga qo'shish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
