import { useEffect, useMemo, useState } from "react"
import { Search, ScanLine, UserPlus, Video, X, CheckCircle2, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DocumentScanner, type ScannedDoc } from "@/features/guests/components/DocumentScanner"
import { BirthDateSelect } from "@/features/guests/components/BirthDateSelect"
import { useCreateGuest, uploadGuestFile } from "@/features/guests/api/guests"
import { FacePickerDialog } from "@/features/vision/components/FacePickerDialog"
import {
  fetchSightingFile,
  useEnrollSighting,
  type SightingGroup,
} from "@/features/vision/api/vision"
import {
  DEFAULT_NATIONALITY,
  DOC_TYPES,
  MRZ_COUNTRY,
  NATIONALITIES,
} from "@/features/guests/constants"
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

/** Telefondan kelgan, hamrohga mo'ljallangan skan. `guestId` — server
    hujjat raqami bo'yicha mehmonni bazadan topgan bo'lsa. */
export interface CompanionScan {
  doc: ScannedDoc
  guestId?: string | null
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
  /** Bron qilinayotgan xonaning filiali — yuz tanlash oynasi shu bo'yicha
      filtrlanadi (asosiy mehmon formasidagi bilan bir xil) */
  branchId?: string | null
  /** Telefondan kelgan skan — birinchi bo'sh hamroh joyiga tushadi */
  incomingScan?: CompanionScan | null
  onIncomingScanHandled?: () => void
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
  branchId,
  incomingScan,
  onIncomingScanHandled,
  onError,
}: Props) => {
  const { can } = usePermissions()
  const canCreateGuest = can("guest.create")
  const createGuestMutation = useCreateGuest()
  const enrollFaceMutation = useEnrollSighting()

  // Nechta hamroh kerak — asosiy mehmondan tashqarisi
  const slots = Math.max(adults - 1, 0)

  const [search, setSearch] = useState("")
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [scanSlot, setScanSlot] = useState<number | null>(null)
  /* Yangi hamroh formasi ASOSIY mehmon formasi bilan bir xil maydonlarga
     ega: hamroh ham bazadagi to'la huquqli mijoz, uning yozuvi keyin
     qidiruvda chiqadi va hujjatlari saqlanadi — chala karta yaratmaymiz. */
  const [newGuest, setNewGuest] = useState<{
    first_name: string
    last_name: string
    phone: string
    passport_number: string
    birth_date: string
    nationality: string
    nationality_other: string
    id_document_type: string
    id_document_number: string
    address: string
  } | null>(null)

  /* Filial kamerasidan tanlangan yuz. Hamroh hali yaratilmagani uchun
     biriktirish saqlashda bo'ladi — asosiy mehmon formasidagi tartib. */
  const [facePickerOpen, setFacePickerOpen] = useState(false)
  const [pickedFace, setPickedFace] = useState<SightingGroup | null>(null)
  const [faceFile, setFaceFile] = useState<File | null>(null)

  const clearFace = () => {
    setPickedFace(null)
    setFaceFile(null)
  }

  /* Tanlangan yuzning surati mehmon kartasiga ham yuklanadi — rasm
     yuklanmasa ham biriktirish ishlayveradi: vektor serverda saqlangan. */
  const handleFacePicked = async (group: SightingGroup) => {
    try {
      const file = await fetchSightingFile(
        group.best_sighting_id,
        `kamera-${Date.now()}.jpg`
      )
      setFaceFile(file)
    } catch {
      setFaceFile(null)
      onError("Surat yuklanmadi, lekin yuz baribir biriktiriladi.")
    }
    setPickedFace(group)
  }

  const emptyNewGuest = () => ({
    first_name: "",
    last_name: "",
    phone: "",
    passport_number: "",
    birth_date: "",
    // Fuqarolik standart holda O'zbekiston bo'lib turadi
    nationality: DEFAULT_NATIONALITY,
    nationality_other: "",
    id_document_type: "",
    id_document_number: "",
    address: "",
  })

  // Allaqachon tanlanganlar va asosiy mehmon ro'yxatda ko'rinmaydi —
  // bir odam ikki marta yozilmasligi kerak
  const takenIds = useMemo(
    () => new Set([...(mainGuestId ? [mainGuestId] : []), ...value.map((c) => c.id)]),
    [mainGuestId, value]
  )

  /* Qidiruv asosiy Mehmon bo'limi bilan BIR XIL: bo'sh qidiruvda hech
     kim ko'rsatilmaydi (butun baza ro'yxat bo'lib turmaydi), natija esa
     BITTA — eng mos mijoz. Boshidan mos kelgani ichidan mos kelganidan
     ustun turadi ("ali" yozilganda "Alisher" "Xalil"dan oldin). */
  const found = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    const rank = (g: any): number => {
      const first = (g.first_name || "").toLowerCase()
      const last = (g.last_name || "").toLowerCase()
      const phone = g.phone || ""
      const passport = (g.passport_number || "").toLowerCase()
      if (
        first.startsWith(q) ||
        last.startsWith(q) ||
        phone.startsWith(q) ||
        passport.startsWith(q)
      )
        return 0
      if (
        first.includes(q) ||
        last.includes(q) ||
        phone.includes(q) ||
        passport.includes(q)
      )
        return 1
      return 2
    }
    return guests
      .filter((g) => !takenIds.has(g.id) && rank(g) < 2)
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 1)
  }, [guests, search, takenIds])

  /* Telefondan kelgan skan birinchi BO'SH joyga tushadi: mehmon server
     yoki hujjat raqami bo'yicha bazadan topilsa darhol tanlanadi, aks
     holda to'ldirilgan yangi mijoz formasi ochiladi — xodim tekshirib
     "Saqlash"ni bosadi, xolos. */
  useEffect(() => {
    if (!incomingScan) return
    onIncomingScanHandled?.()
    const index = value.length
    if (index >= slots) return
    const { doc, guestId } = incomingScan
    if (guestId && !takenIds.has(guestId)) {
      const g = guests.find((x) => x.id === guestId)
      setAt(index, {
        id: guestId,
        name: g
          ? guestName(g)
          : `${doc.firstName || ""} ${doc.lastName || ""}`.trim() || "Mehmon",
      })
      return
    }
    if (guestId) return // allaqachon asosiy mehmon yoki hamroh
    handleScan(index, doc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingScan])

  if (slots === 0) return null

  const setAt = (index: number, companion: Companion | null) => {
    const next = [...value]
    if (companion) next[index] = companion
    else next.splice(index, 1)
    onChange(next.filter(Boolean))
    setActiveSlot(null)
    setSearch("")
    setNewGuest(null)
    // Tanlangan yuz keyingi hamrohga meros bo'lib o'tmasligi kerak
    clearFace()
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
    clearFace()
    const mapped = doc.nationality ? MRZ_COUNTRY[doc.nationality] : undefined
    setNewGuest({
      ...emptyNewGuest(),
      first_name: doc.firstName || "",
      last_name: doc.lastName || "",
      passport_number: doc.documentNumber ? sanitizePassport(doc.documentNumber) : "",
      birth_date: doc.birthDate || "",
      nationality: doc.nationality
        ? mapped && NATIONALITIES.includes(mapped)
          ? mapped
          : "Boshqa"
        : DEFAULT_NATIONALITY,
      nationality_other: mapped ? "" : doc.nationality || "",
      id_document_type: doc.documentType || "",
      // Xalqaro MRZ'dagi qo'shimcha maydon avtomatik JSHSHIR emas —
      // faqat O'zbekiston hujjatida tasdiqlangan bo'lsa olinadi
      id_document_number: doc.pinflVerified ? doc.personalNumber || "" : "",
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
        birth_date: newGuest.birth_date || undefined,
        nationality:
          newGuest.nationality === "Boshqa"
            ? newGuest.nationality_other.trim() || undefined
            : newGuest.nationality || undefined,
        id_document_type: newGuest.id_document_type || undefined,
        id_document_number: newGuest.id_document_number.trim() || undefined,
        address: newGuest.address.trim() || undefined,
        hotelId,
      })

      /* Yuz tanlangan bo'lsa — endi mehmon id'si bor. Surat va biriktirish
         hamrohni BUZMAYDI: yiqilsa xodim ogohlantiriladi, yozuv esa
         saqlangan bo'ladi (yuzni keyin qabulxona panelidan biriktirsa
         bo'ladi) — asosiy mehmon formasidagi tartib. */
      if (faceFile) {
        try {
          await uploadGuestFile(created.id, faceFile, "photo", hotelId)
        } catch (uploadError) {
          console.error("Surat yuklashda xatolik", uploadError)
        }
      }
      if (pickedFace) {
        try {
          await enrollFaceMutation.mutateAsync({
            sightingId: pickedFace.best_sighting_id,
            // Guruhning hamma ko'rinishlari: bir necha epizoddan yig'ilgan
            // shablon aniqroq, qolganlari ro'yxatda qolib ketmaydi
            sightingIds: pickedFace.sighting_ids,
            guestId: created.id,
            // Xodim suratni ataylab tanladi — rozilik shu harakat bilan
            consent: true,
          })
        } catch (enrollError) {
          console.error("Yuzni biriktirishda xatolik", enrollError)
          onError(
            "Hamroh saqlandi, lekin yuz biriktirilmadi — uni qabulxona panelidan qayta biriktirishingiz mumkin."
          )
        }
      }

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
                {/* Hamroh ham mijoz — yangisini shu yerning o'zida qo'shish
                    mumkin (ilgari bu qidiruv ichidagi kichik havola edi) */}
                {canCreateGuest && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSlot(index)
                      setSearch("")
                      clearFace()
                      setNewGuest(emptyNewGuest())
                    }}
                    className="flex flex-shrink-0 items-center gap-1 rounded-md border border-primary-200 bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Yangi mijoz
                  </button>
                )}
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
                      Tug'ilgan sana
                    </label>
                    <BirthDateSelect
                      value={newGuest.birth_date}
                      onChange={(birthDate) =>
                        setNewGuest({ ...newGuest, birth_date: birthDate })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
                      Fuqaroligi
                    </label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={newGuest.nationality}
                      onChange={(e) =>
                        setNewGuest({ ...newGuest, nationality: e.target.value })
                      }
                    >
                      {NATIONALITIES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {newGuest.nationality === "Boshqa" && (
                  <Input
                    className="h-9"
                    placeholder="Fuqaroligini kiriting"
                    value={newGuest.nationality_other}
                    onChange={(e) =>
                      setNewGuest({ ...newGuest, nationality_other: e.target.value })
                    }
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
                      Hujjat turi
                    </label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={newGuest.id_document_type}
                      onChange={(e) =>
                        setNewGuest({ ...newGuest, id_document_type: e.target.value })
                      }
                    >
                      {DOC_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-gray-500">
                      Shaxsiy raqam/JSHSHIR
                    </label>
                    <Input
                      className="h-9"
                      placeholder="JSHSHIR"
                      value={newGuest.id_document_number}
                      onChange={(e) =>
                        setNewGuest({
                          ...newGuest,
                          id_document_number: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <Input
                  className="h-9"
                  placeholder="Manzil"
                  value={newGuest.address}
                  onChange={(e) =>
                    setNewGuest({ ...newGuest, address: e.target.value })
                  }
                />
                {/* Filial IP kamerasidan yuz — asosiy mehmon formasidagi
                    bilan bir xil imkoniyat: mehmon qabulxonaga kelganda
                    kamera uni allaqachon suratga olgan bo'ladi */}
                {pickedFace ? (
                  <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50/60 px-2.5 py-1.5">
                    <Video className="h-4 w-4 flex-shrink-0 text-primary-600" />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-primary-700">
                      {pickedFace.camera_name || pickedFace.camera_id} kamerasidan
                      {pickedFace.count > 1 ? ` · ${pickedFace.count} ta surat` : ""} —
                      hamroh saqlangach yuzi biriktiriladi
                    </span>
                    <button
                      type="button"
                      onClick={clearFace}
                      title="Yuz tanlovini bekor qilish"
                      className="flex-shrink-0 rounded-md p-0.5 text-primary-400 transition-colors hover:bg-primary-100 hover:text-primary-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFacePickerOpen(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-primary-300 bg-primary-50/40 px-2.5 py-2 text-xs font-medium text-primary-700 transition-colors hover:border-primary-500 hover:bg-primary-50"
                  >
                    <Video className="h-4 w-4 text-primary-500" />
                    Filial kamerasidan yuz biriktirish
                    <span className="font-normal text-primary-500/80">
                      · keyingi tashrifda avtomatik tanaladi
                    </span>
                  </button>
                )}
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
                    onClick={() => {
                      setNewGuest(null)
                      clearFace()
                    }}
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
                {search.trim() ? (
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
                        Mijoz topilmadi
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="px-1 text-xs leading-relaxed text-gray-400">
                    Mijozni topish uchun ism, telefon yoki passport raqamini
                    yozing — yoki hujjatini skanerlang
                  </p>
                )}
                <div className="flex items-center gap-2">
                  {canCreateGuest && (
                    <button
                      type="button"
                      onClick={() =>
                        setNewGuest(emptyNewGuest())
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      + Yangi mijoz qo'shish
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

      {/* Filial kamerasidan yuz tanlash — filial bron qilinayotgan
          xonadan olinadi, boshqa filial suratlari bu yerga tushmaydi */}
      <FacePickerDialog
        open={facePickerOpen}
        onOpenChange={setFacePickerOpen}
        branchId={branchId}
        onSelect={handleFacePicked}
      />

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
