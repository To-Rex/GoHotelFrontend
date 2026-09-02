import { useState } from "react"
import { Check, Loader2, Pencil, X } from "lucide-react"

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
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { useUpdateGuest } from "../api/guests"
import {
  DEFAULT_NATIONALITY,
  DOC_TYPES,
  NATIONALITIES,
  sanitizePassport,
} from "../constants"

/**
 * Mehmonni ish joyidan chiqmasdan tahrirlash.
 *
 * Bir xil ehtiyoj ikki joyda chiqadi: yangi bandlov dialogida tanlangan
 * mehmon va bandlov tafsilotidagi xonada turganlar. Ikkalasida ham xato
 * ma'lumot mehmon qarshingda turganda bilinadi, o'sha payt esa bron
 * jarayonini to'xtatib mehmonlar sahifasiga o'tish kiritilgan hamma
 * narsani yo'qotardi.
 *
 * Shakl mehmonlar sahifasidagi bilan bir xil qoidalarga bo'ysunadi, chunki
 * ikkalasi ham ayni bitta yozuvni tahrirlaydi:
 *
 *   - ism majburiy;
 *   - familiya bo'sh qoldirilsa YUBORILMAYDI (backendda min_length=1) —
 *     ya'ni avvalgi qiymati saqlanadi;
 *   - qolgan ixtiyoriy maydonlar bo'sh satr bilan TOZALANADI;
 *   - fuqarolik "Boshqa" bo'lsa yuborilmaydi;
 *   - passport raqami katta harfga o'tkazilib, harf-raqamdan boshqasi
 *     olib tashlanadi.
 *
 * Email shaklda yo'q — mehmonlar sahifasida ham yo'q va yuborilmagan
 * maydonga backend tegmaydi, ya'ni mavjud qiymat saqlanib qoladi.
 */

/** Tahrirlanadigan mehmon — chaqiruvchida bor maydonlar. */
export interface EditableGuest {
  guest_id?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  passport_number?: string | null
  id_document_type?: string | null
  id_document_number?: string | null
  nationality?: string | null
  birth_date?: string | null
  address?: string | null
}

interface Props {
  guest: EditableGuest
  /** Saqlangach chaqiriladi. */
  onSaved?: () => void
  className?: string
}

/** Sana maydoni "yyyy-MM-dd" kutadi; ISO qiymatdan kun qismi olinadi. */
const dateInputValue = (value?: string | null) =>
  value ? String(value).slice(0, 10) : ""

export function GuestQuickEdit({ guest, onSaved, className }: Props) {
  const { can } = usePermissions()
  const updateGuest = useUpdateGuest()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    passport_number: "",
    id_document_type: "",
    id_document_number: "",
    nationality: DEFAULT_NATIONALITY,
    birth_date: "",
    address: "",
  })
  const [error, setError] = useState<string | null>(null)

  const guestId = guest.guest_id
  /* Bazada yozuvi bo'lmagan mehmonni tahrirlab bo'lmaydi — bronda faqat ismi
     saqlangan hamroh shunday bo'ladi va o'zgartirish yoziladigan joy yo'q. */
  if (!can("guest.update") || !guestId) return null

  const start = () => {
    setForm({
      first_name: guest.first_name || "",
      last_name: guest.last_name || "",
      phone: guest.phone || "",
      passport_number: guest.passport_number || "",
      id_document_type: guest.id_document_type || "",
      id_document_number: guest.id_document_number || "",
      nationality: guest.nationality || DEFAULT_NATIONALITY,
      birth_date: dateInputValue(guest.birth_date),
      address: guest.address || "",
    })
    setError(null)
    setOpen(true)
  }

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    if (!form.first_name.trim()) {
      setError("Ism kiritilishi shart")
      return
    }
    setError(null)
    try {
      await updateGuest.mutateAsync({
        id: guestId,
        first_name: form.first_name.trim(),
        // Bo'sh familiya yuborilmaydi — avvalgi qiymati saqlanadi
        last_name: form.last_name.trim() || undefined,
        phone: form.phone.trim(),
        birth_date: form.birth_date || undefined,
        passport_number: form.passport_number
          ? sanitizePassport(form.passport_number)
          : "",
        id_document_type: form.id_document_type,
        id_document_number: form.id_document_number.trim(),
        nationality:
          form.nationality === "Boshqa" ? undefined : form.nationality || undefined,
        address: form.address.trim(),
      } as never)
      setOpen(false)
      onSaved?.()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const field = "h-9 text-sm"
  const selectClass =
    "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

  return (
    <>
      <button
        type="button"
        onClick={start}
        title="Mehmon ma'lumotlarini tahrirlash"
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-white hover:text-primary-700",
          className
        )}
      >
        <Pencil className="h-3 w-3" />
        Tahrirlash
      </button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Mehmon ma'lumotlari</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Ism *</label>
              <Input
                className={field}
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Familiya</label>
              <Input
                className={field}
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Telefon</label>
              <Input
                className={field}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+998 90 123 45 67"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">
                Tug'ilgan sana
              </label>
              <Input
                type="date"
                className={field}
                value={form.birth_date}
                onChange={(e) => set("birth_date", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">
                Passport raqami
              </label>
              <Input
                className={field}
                value={form.passport_number}
                onChange={(e) => set("passport_number", e.target.value)}
                placeholder="AA1234567"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Fuqarolik</label>
              <select
                className={selectClass}
                value={form.nationality}
                onChange={(e) => set("nationality", e.target.value)}
              >
                {/* Ro'yxatda yo'q qiymat ham saqlanib qolsin — eski
                    yozuvlarda uchraydi va tahrirlash uni yo'qotmasligi kerak */}
                {form.nationality && !NATIONALITIES.includes(form.nationality) && (
                  <option value={form.nationality}>{form.nationality}</option>
                )}
                {NATIONALITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">
                Hujjat turi
              </label>
              <select
                className={selectClass}
                value={form.id_document_type}
                onChange={(e) => set("id_document_type", e.target.value)}
              >
                {DOC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">
                Hujjat raqami
              </label>
              <Input
                className={field}
                value={form.id_document_number}
                onChange={(e) => set("id_document_number", e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-500">Manzil</label>
              <Input
                className={field}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <p className="text-[11px] text-gray-400">
            Bo'sh qoldirilgan ixtiyoriy maydon tozalanadi. Familiya bo'sh
            qoldirilsa avvalgi qiymati saqlanadi.
          </p>

          <DialogFooter className="flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={updateGuest.isPending}
            >
              <X className="mr-1.5 h-4 w-4" />
              Bekor qilish
            </Button>
            <Button type="button" onClick={save} disabled={updateGuest.isPending}>
              {updateGuest.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-4 w-4" />
              )}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
