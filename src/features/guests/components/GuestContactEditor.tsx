import { useState } from "react"
import { Check, Loader2, Pencil, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiErrorMessage } from "@/lib/apiError"
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { useUpdateGuest } from "../api/guests"

/**
 * Mehmonning telefoni va passportini joyida tahrirlash.
 *
 * Faqat shu ikki maydon: aynan ular xato kiritiladi va aynan mehmon
 * qarshingda turganda bilinadi. Qolgan maydonlar uchun mehmonlar sahifasi
 * bor — to'liq shakl bu kichik oynalarni og'irlashtirardi.
 *
 * Umumiy komponent, chunki bir xil ehtiyoj ikki joyda chiqadi: yangi bandlov
 * dialogida tanlangan mehmon va bandlov tafsilotidagi xonada turganlar.
 * Ikkalasi bir xil ishlashi kerak — bo'sh qoldirilsa maydon tozalanishi ham
 * shunga kiradi.
 */

interface Props {
  guestId?: string | null
  phone?: string | null
  passport?: string | null
  /** Saqlangach chaqiriladi — chaqiruvchi kerak bo'lsa o'zini yangilaydi. */
  onSaved?: () => void
  className?: string
}

export function GuestContactEditor({
  guestId,
  phone,
  passport,
  onSaved,
  className,
}: Props) {
  const { can } = usePermissions()
  const updateGuest = useUpdateGuest()

  const [editing, setEditing] = useState(false)
  const [phoneValue, setPhoneValue] = useState("")
  const [passportValue, setPassportValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  /* Bazada yozuvi bo'lmagan mehmonni tahrirlab bo'lmaydi — bronda faqat
     ismi saqlangan hamroh shunday bo'ladi va o'zgartirish yoziladigan joy
     yo'q. */
  if (!can("guest.update") || !guestId) return null

  const startEdit = () => {
    setPhoneValue(phone || "")
    setPassportValue(passport || "")
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    setError(null)
    try {
      // Bo'sh satr maydonni TOZALAYDI — mehmonlar sahifasidagi bilan bir xil.
      // Xato kiritilgan raqamni o'chirish ham kerak bo'ladi.
      await updateGuest.mutateAsync({
        id: guestId,
        phone: phoneValue.trim(),
        passport_number: passportValue.trim(),
      })
      setEditing(false)
      onSaved?.()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        title="Telefon va passportni tahrirlash"
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-white hover:text-primary-700",
          className
        )}
      >
        <Pencil className="h-3 w-3" />
        Tahrirlash
      </button>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">Telefon</label>
          <Input
            className="h-8 bg-white text-xs"
            value={phoneValue}
            onChange={(e) => setPhoneValue(e.target.value)}
            placeholder="+998 90 123 45 67"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">
            Passport raqami
          </label>
          <Input
            className="h-8 bg-white text-xs"
            value={passportValue}
            onChange={(e) => setPassportValue(e.target.value)}
            placeholder="AA1234567"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          onClick={save}
          disabled={updateGuest.isPending}
        >
          {updateGuest.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Check className="mr-1 h-3 w-3" />
          )}
          Saqlash
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setEditing(false)}
          disabled={updateGuest.isPending}
        >
          <X className="mr-1 h-3 w-3" />
          Bekor qilish
        </Button>
        <span className="text-[11px] text-gray-400">
          Bo'sh qoldirilsa maydon tozalanadi
        </span>
      </div>
    </div>
  )
}
