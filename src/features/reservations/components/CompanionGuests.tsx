import { useMemo, useState } from "react"
import { Search, ScanLine, UserPlus, X, CheckCircle2, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DocumentScanner, type ScannedDoc } from "@/features/guests/components/DocumentScanner"
import { useCreateGuest } from "@/features/guests/api/guests"
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { sanitizePassport } from "../lib/booking"

/* Xonadagi hamrohlar.

   Mehmonlar soni 1 dan ko'p bo'lsa, qolgan har bir kishi ham mehmon
   sifatida ro'yxatga olinadi: bazadan tanlanadi yoki shu yerda yaratiladi.
   Ular bazada haqiqiy mehmon yozuvi bo'ladi, ya'ni keyingi safar qidiruvda
   topiladi va hujjati saqlanib qoladi.

   Sozlamada "majburiy" yoqilgan bo'lsa, ro'yxat to'lmaguncha bron
   yaratilmaydi — buni chaqiruvchi `onChange` orqali biladi. */

export interface Companion {
  id: string
  name: string
}

interface Props {
  /** Xonadagi jami mehmonlar soni (asosiy mehmon bilan birga) */
  adults: number
  /** Asosiy mehmon — hamroh sifatida ikkinchi marta tanlanmaydi */
  mainGuestId?: string
  guests: any[]
  value: Companion[]
  onChange: (next: Companion[]) => void
  /** Sozlamada majburiy qilinganmi — faqat ko'rsatish uchun */
  required: boolean
  hotelId?: string
  onError: (message: string) => void
}

const guestName = (g: any) =>
  `${g.first_name || ""} ${g.last_name || ""}`.trim() || "Ismsiz mehmon"

export const CompanionGuests = ({
  adults,
  mainGuestId,
  guests,
  value,
  onChange,
  required,
  hotelId,
  onError,
}: Props) => {
  const { can } = usePermissions()
  const canCreateGuest = can("guest.create")
  const createGuestMutation = useCreateGuest()

  // Nechta hamroh kerak — asosiy mehmondan tashqarisi
  const slots = Math.max(adults - 1, 0)

  const [search, setSearch] = useState("")
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [scanSlot, setScanSlot] = useState<number | null>(null)
  const [newGuest, setNewGuest] = useState<{
    first_name: string
    last_name: string
    phone: string
    passport_number: string
  } | null>(null)

  // Allaqachon tanlanganlar va asosiy mehmon ro'yxatda ko'rinmaydi —
  // bir odam ikki marta yozilmasligi kerak
  const takenIds = useMemo(
    () => new Set([...(mainGuestId ? [mainGuestId] : []), ...value.map((c) => c.id)]),
    [mainGuestId, value]
  )

  const found = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = guests.filter((g) => !takenIds.has(g.id))
    if (!q) return list.slice(0, 10)
    return list
      .filter(
        (g) =>
          g.first_name?.toLowerCase().includes(q) ||
          g.last_name?.toLowerCase().includes(q) ||
          g.phone?.includes(q) ||
          g.passport_number?.toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [guests, search, takenIds])

  if (slots === 0) return null

  const setAt = (index: number, companion: Companion | null) => {
    const next = [...value]
    if (companion) next[index] = companion
    else next.splice(index, 1)
    onChange(next.filter(Boolean))
    setActiveSlot(null)
    setSearch("")
    setNewGuest(null)
  }

  const pickExisting = (index: number, g: any) =>
    setAt(index, { id: g.id, name: guestName(g) })

  // Skanerlangan hujjat bo'yicha bazadan qidirish; topilmasa yangi mehmon
  // formasi shu ma'lumot bilan to'ldiriladi
  const handleScan = (index: number, doc: ScannedDoc) => {
    const norm = (s?: string | null) => (s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    const pass = norm(doc.documentNumber)
    const personal = doc.pinflVerified ? norm(doc.personalNumber) : ""
    const match = guests.find(
      (g) =>
        !takenIds.has(g.id) &&
        ((pass.length >= 5 && norm(g.passport_number) === pass) ||
          (personal.length >= 8 && norm(g.id_document_number) === personal))
    )
    if (match) {
      pickExisting(index, match)
      return
    }
    setActiveSlot(index)
    setNewGuest({
      first_name: doc.firstName || "",
      last_name: doc.lastName || "",
      phone: "",
      passport_number: doc.documentNumber ? sanitizePassport(doc.documentNumber) : "",
    })
  }

  const saveNewGuest = async (index: number) => {
    if (!newGuest?.first_name.trim()) {
      onError("Hamroh mehmonning ismini kiriting.")
      return
    }
    try {
      const created = await createGuestMutation.mutateAsync({
        first_name: newGuest.first_name.trim(),
        last_name: newGuest.last_name.trim() || "",
        phone: newGuest.phone.trim() || undefined,
        passport_number: newGuest.passport_number.trim()
          ? sanitizePassport(newGuest.passport_number) || undefined
          : undefined,
        hotelId,
      })
      setAt(index, { id: created.id, name: guestName(created) })
    } catch (e: any) {
      onError(
        e?.response?.data?.detail || "Hamroh mehmonni saqlab bo'lmadi. Qayta urinib ko'ring."
      )
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-gray-700">
          Hamrohlar{" "}
          <span className={cn("text-xs", required ? "text-red-500" : "text-gray-400")}>
            ({value.length}/{slots}
            {required ? " — majburiy" : ""})
          </span>
        </label>
      </div>

      {Array.from({ length: slots }).map((_, index) => {
        const picked = value[index]
        if (picked) {
          return (
            <div
              key={index}
              className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                {picked.name}
              </span>
              <button
                type="button"
                onClick={() => setAt(index, null)}
                title="Ro'yxatdan olib tashlash"
                className="flex-shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        }

        const isActive = activeSlot === index
        return (
          <div
            key={index}
            className={cn(
              "rounded-lg border px-3 py-2",
              required ? "border-amber-300 bg-amber-50/40" : "border-dashed border-gray-300"
            )}
          >
            {!isActive ? (
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-gray-500">
                  {index + 2}-mehmon tanlanmagan
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSlot(index)
                    setNewGuest(null)
                    setSearch("")
                  }}
                  className="flex-shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Tanlash
                </button>
                <button
                  type="button"
                  onClick={() => setScanSlot(index)}
                  title="Passport yoki ID kartani skanerlash"
                  className="flex flex-shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <ScanLine className="h-3.5 w-3.5" />
                  Skaner
                </button>
              </div>
            ) : newGuest ? (
              /* Yangi hamroh — eng zarur maydonlar */
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    className="h-9"
                    placeholder="Ism *"
                    value={newGuest.first_name}
                    onChange={(e) =>
                      setNewGuest({ ...newGuest, first_name: e.target.value })
                    }
                  />
                  <Input
                    className="h-9"
                    placeholder="Familiya"
                    value={newGuest.last_name}
                    onChange={(e) =>
                      setNewGuest({ ...newGuest, last_name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    className="h-9"
                    placeholder="Telefon"
                    value={newGuest.phone}
                    onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                  />
                  <Input
                    className="h-9"
                    placeholder="Passport"
                    autoCapitalize="characters"
                    value={newGuest.passport_number}
                    onChange={(e) =>
                      setNewGuest({
                        ...newGuest,
                        passport_number: sanitizePassport(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveNewGuest(index)}
                    disabled={createGuestMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                  >
                    {createGuestMutation.isPending && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Saqlash
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewGuest(null)}
                    className="rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    Ro'yxatga qaytish
                  </button>
                </div>
              </div>
            ) : (
              /* Bazadan tanlash */
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="h-9 pl-8"
                    placeholder="Ism, telefon yoki passport..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-32 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
                  {found.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => pickExisting(index, g)}
                      className="w-full px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-gray-50"
                    >
                      <span className="font-medium">{guestName(g)}</span>
                      {g.phone && <span className="ml-2 text-gray-400">{g.phone}</span>}
                    </button>
                  ))}
                  {found.length === 0 && (
                    <p className="px-2.5 py-3 text-center text-xs text-gray-400">
                      Mehmon topilmadi
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canCreateGuest && (
                    <button
                      type="button"
                      onClick={() =>
                        setNewGuest({
                          first_name: "",
                          last_name: "",
                          phone: "",
                          passport_number: "",
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Yangi mehmon
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveSlot(null)}
                    className="ml-auto rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Hujjat skaneri — qaysi hamroh uchun ochilgan bo'lsa o'shanga */}
      <DocumentScanner
        open={scanSlot !== null}
        onOpenChange={(open) => !open && setScanSlot(null)}
        onResult={(doc) => {
          if (scanSlot !== null) handleScan(scanSlot, doc)
          setScanSlot(null)
        }}
      />
    </div>
  )
}
