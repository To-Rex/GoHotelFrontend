import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import {
  Search,
  X,
  CheckCircle2,
  BedDouble,
  Loader2,
  Upload,
  ArrowLeft,
  Camera,
  ScanLine,
  Video,
} from "lucide-react"

import { useCreateReservation, useReservations } from "../api/reservations"
import { useRooms, useRoomTypes } from "@/features/rooms/api/rooms"
import {
  isBlockedAlways,
  isRestrictedStatus,
  roomBookingBlock,
  statusLabel,
  type BookingWindow,
} from "@/features/rooms/lib/roomBookable"
import {
  useGuests,
  useCreateGuest,
  uploadGuestFile,
  GUEST_PHOTO_ACCEPT,
  GUEST_PHOTO_MAX_BYTES,
} from "@/features/guests/api/guests"
import { NATIONALITIES, DEFAULT_NATIONALITY } from "@/features/guests/constants"
import { BirthDateSelect } from "@/features/guests/components/BirthDateSelect"
import { DocumentScanner, type ScannedDoc } from "@/features/guests/components/DocumentScanner"
import { useAuthStore } from "@/store/auth"
import { usePermissions } from "@/lib/permissions"
import {
  useBookingDefaults,
  resolveBookingType,
} from "@/features/settings/api/bookingDefaults"
import {
  useDiscountRules,
  ruleFor,
  discountProblem,
  discountHint,
  discountAllowed,
  discountBlockedReason,
} from "@/features/settings/api/discountRules"
import { FacePickerDialog } from "@/features/vision/components/FacePickerDialog"
import { GuestFaceRow } from "@/features/vision/components/GuestFaceRow"
import { GuestContactEditor } from "@/features/guests/components/GuestContactEditor"
import {
  fetchSightingFile,
  useEnrollSighting,
  type SightingGroup,
} from "@/features/vision/api/vision"
import { CompanionGuests, type Companion } from "./CompanionGuests"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  DURATION_OPTIONS,
  HOURLY_TURNOVER_MIN,
  PAYMENT_METHOD_OPTIONS,
  addDaysStr,
  bookingErrorMessage,
  busyIntervalsFor,
  companionSlots,
  dayDiff,
  findFreeSlot,
  hourlyDuration,
  minToTime,
  missingCompanions,
  nextBookingStart,
  normalizeTime,
  sanitizePassport,
  timeToMin,
  todayStr as todayString,
} from "../lib/booking"

/* "Yangi bandlov" dialogi — YAGONA komponent.

   Uni bron sahifasi ham, xonalar sahifasi ham ochadi, shuning uchun bu yerda
   qilingan har qanday o'zgarish ikkala joyda birdan amal qiladi.

   Dialog o'z holatini o'zi boshqaradi: chaqiruvchi faqat "qaysi xona, qaysi
   sana/vaqtdan boshlab" degan so'rovni beradi. Ma'lumotlar (xonalar,
   mehmonlar, bronlar) o'sha react-query keshidan o'qiladi — qo'shimcha
   so'rov ketmaydi. */

export interface NewBookingRequest {
  /** Oldindan tanlangan xona. Berilmasa dialogda xona tanlash ro'yxati chiqadi */
  room?: any | null
  checkInDate: string
  checkOutDate: string
  /** Berilmasa — mehmonxona sozlamasidagi standart tur olinadi.
   *
   *  Chaqiruvchi turni O'ZI hisoblasa, sozlama hali yuklanmagan paytda
   *  bosilgan tugma noto'g'ri turni qotirib qo'yardi. Shuning uchun tanlov
   *  shu yerda — dialog sozlamani kutib, kelganda qo'llaydi. */
  bookingType?: "DAILY" | "HOURLY"
  checkInTime?: string
  checkOutTime?: string
  /** Oldindan tanlangan mehmon. Kamera tanigan mehmon ustiga bosilganda
   *  dialog o'sha mehmon bilan ochiladi — xodim uni qaytadan qidirmaydi. */
  guestId?: string
}

interface Props {
  /** null — dialog yopiq */
  request: NewBookingRequest | null
  onClose: () => void
  /** Bron yaratilgach — chaqiruvchi o'z tanlovini tozalashi uchun */
  onCreated?: () => void
  /** Xato xabarini chaqiruvchining dialogida ko'rsatish (bo'lmasa ichkarida) */
  onError?: (message: string) => void
}

// MRZ'dagi 3 harfli davlat kodini fuqarolik ro'yxatidagi nomga o'girish
const MRZ_COUNTRY: Record<string, string> = {
  UZB: "O'zbekiston",
  KAZ: "Qozog'iston",
  KGZ: "Qirg'iziston",
  TJK: "Tojikiston",
  TKM: "Turkmaniston",
  RUS: "Rossiya",
  AFG: "Afg'oniston",
  AZE: "Ozarbayjon",
  ARM: "Armaniston",
  BLR: "Belarus",
  GEO: "Gruziya",
  TUR: "Turkiya",
  CHN: "Xitoy",
  IND: "Hindiston",
  PAK: "Pokiston",
  IRN: "Eron",
  KOR: "Janubiy Koreya",
  JPN: "Yaponiya",
  USA: "AQSH",
  GBR: "Buyuk Britaniya",
  DEU: "Germaniya",
  FRA: "Fransiya",
  UKR: "Ukraina",
}

const reservationSchema = z
  .object({
    guest_id: z.string().optional(),
    room_id: z.string().min(1, "Xonani tanlash shart"),
    booking_type: z.enum(["DAILY", "HOURLY"]).default("DAILY"),
    check_in_date: z.string().min(1, "Kirish sanasi kiritilmagan"),
    check_out_date: z.string().min(1, "Chiqish sanasi kiritilmagan"),
    check_in_time: z.string().optional(),
    check_out_time: z.string().optional(),
    adults: z.coerce.number().min(1),
    children: z.coerce.number().min(0).optional(),
    notes: z.string().optional(),
    new_guest_first_name: z.string().optional(),
    new_guest_last_name: z.string().optional(),
    new_guest_phone: z.string().optional(),
    new_guest_passport_number: z.string().optional(),
    new_guest_id_document_type: z.string().optional(),
    new_guest_id_document_number: z.string().optional(),
    new_guest_birth_date: z.string().optional(),
    new_guest_nationality: z.string().optional(),
    new_guest_address: z.string().optional(),
    payment_amount: z.coerce.number().min(0).optional(),
    payment_method: z.string().optional(),
  })
  .refine((data) => !!data.guest_id || !!data.new_guest_first_name, {
    message: "Mehmonni tanlang yoki yangi mehmon ismini kiriting",
    path: ["guest_id"],
  })
  .refine(
    (data) => !(data.payment_amount && data.payment_amount > 0 && !data.payment_method),
    {
      message: "To'lov summasi kiritilganda to'lov turini tanlash majburiy",
      path: ["payment_method"],
    }
  )
  .refine(
    (data) =>
      data.booking_type !== "HOURLY" || (!!data.check_in_time && !!data.check_out_time),
    {
      message: "Soatlik bron uchun kirish va chiqish vaqtini kiriting",
      path: ["check_in_time"],
    }
  )
  .refine(
    (data) => !data.check_in_date || data.check_in_date >= format(new Date(), "yyyy-MM-dd"),
    { message: "O'tgan sanaga bron qilib bo'lmaydi", path: ["check_in_date"] }
  )

type BookingForm = z.infer<typeof reservationSchema>

export const NewBookingDialog = ({ request, onClose, onCreated, onError }: Props) => {
  const open = !!request
  const presetRoom = request?.room ?? null

  const { data: roomsData = [] } = useRooms()
  const rooms = useMemo<any[]>(
    () =>
      [...roomsData].sort((a: any, b: any) =>
        String(a.room_number).localeCompare(String(b.room_number), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    [roomsData]
  )
  const { data: reservations = [] } = useReservations()
  const { data: guests = [] } = useGuests()
  const { data: roomTypesData = [] } = useRoomTypes()
  const { user } = useAuthStore()
  const { can } = usePermissions()
  const canCreateGuest = can("guest.create")

  const createReservationMutation = useCreateReservation()
  const createGuestMutation = useCreateGuest()
  const enrollFaceMutation = useEnrollSighting()

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const rt of roomTypesData) map[rt.id] = rt.base_price ?? 0
    return map
  }, [roomTypesData])

  const getRoomPrice = useCallback(
    (room: any): number => {
      if (room?.base_price && room.base_price > 0) return room.base_price
      if (room?.room_type_id && priceMap[room.room_type_id]) return priceMap[room.room_type_id]
      return 0
    },
    [priceMap]
  )

  const todayStr = todayString()

  // --- Dialog holati ---
  const [guestSearch, setGuestSearch] = useState("")
  const [showNewGuest, setShowNewGuest] = useState(false)
  const [nationalityOther, setNationalityOther] = useState("")
  const [scanOpen, setScanOpen] = useState(false)
  const [guestScanOpen, setGuestScanOpen] = useState(false)
  const [guestScanNotFound, setGuestScanNotFound] = useState<ScannedDoc | null>(null)
  const [guestPhoto, setGuestPhoto] = useState<File | null>(null)
  const [guestPhotoPreview, setGuestPhotoPreview] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  /* Filial kamerasidan tanlangan yuz. Bron saqlanguncha faqat shu yerda
     turadi: mehmon hali yaratilmagan, biriktirish esa mehmon id'sini
     talab qiladi. */
  const [facePickerOpen, setFacePickerOpen] = useState(false)
  const [pickedFace, setPickedFace] = useState<SightingGroup | null>(null)
  const [selectedGuestId, setSelectedGuestId] = useState<string>("")
  const [bookingType, setBookingType] = useState<"DAILY" | "HOURLY">("DAILY")
  const [extraPayments, setExtraPayments] = useState<Array<{ amount: string; method: string }>>([])
  const [discountType, setDiscountType] = useState<"AMOUNT" | "PERCENT">("AMOUNT")
  const [discountValue, setDiscountValue] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  // Xonadagi hamrohlar — mehmonlar soni 1 dan ko'p bo'lganda
  const [companions, setCompanions] = useState<Companion[]>([])
  const { data: bookingDefaults } = useBookingDefaults()
  const guestsRequired = bookingDefaults?.require_all_guests === true
  const { data: discountRules } = useDiscountRules()

  /* So'rovda tur ko'rsatilmagan bo'lsa u sozlamadan olinadi. Sozlama hali
     kelmagan bo'lsa dialog vaqtincha kunlik bilan ochiladi va javob kelgach
     o'ziga keladi — bu bayroq shuni kuzatadi. Xodim turni qo'lda
     almashtirsa bayroq tushadi va sozlama uni bosib ketmaydi. */
  const typePendingRef = useRef(false)

  // Xato: chaqiruvchi o'z dialogida ko'rsatsa o'shanga, bo'lmasa shu yerda
  const showError = (message: string) => {
    if (onError) onError(message)
    else setLocalError(message)
  }

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<BookingForm>({
    resolver: zodResolver(reservationSchema) as any,
  })

  const handlePhotoChange = (file: File | null) => {
    // Fayl yoki veb-kameradan olingan surat kameradan tanlangan yuzning
    // o'rnini bosadi — biriktirish ham u bilan birga bekor bo'lishi kerak,
    // aks holda boshqa odamning yuzi biriktirilib qolardi.
    setPickedFace(null)
    if (guestPhotoPreview) URL.revokeObjectURL(guestPhotoPreview)
    if (!file) {
      setGuestPhoto(null)
      setGuestPhotoPreview(null)
      return
    }
    if (!GUEST_PHOTO_ACCEPT.split(",").includes(file.type)) {
      showError("Faqat JPG, PNG yoki WEBP formatdagi rasm yuklash mumkin.")
      return
    }
    if (file.size > GUEST_PHOTO_MAX_BYTES) {
      showError("Rasm hajmi 5 MB dan oshmasligi kerak.")
      return
    }
    setGuestPhoto(file)
    setGuestPhotoPreview(URL.createObjectURL(file))
  }

  const clearGuestPhoto = () => handlePhotoChange(null)

  /* Tanlangan yuz oddiy surat kabi ko'rinadi: xodim uchun farqi yo'q, u
     shunchaki suratni ko'radi. Farq saqlashda — surat yuklanadi VA yuz
     mehmonga biriktiriladi, ya'ni keyingi tashrifda u tanaladi. */
  const handleFacePicked = async (group: SightingGroup) => {
    try {
      const file = await fetchSightingFile(
        group.best_sighting_id,
        `kamera-${Date.now()}.jpg`
      )
      handlePhotoChange(file)
    } catch {
      // Surat yuklanmasa ham biriktirish ishlaydi: vektor serverda saqlangan,
      // rasm faqat ko'rsatish uchun. Xodimga to'sqinlik qilmaymiz.
      showError("Surat yuklanmadi, lekin yuz baribir biriktiriladi.")
    }
    // handlePhotoChange tanlovni tozalaydi, shuning uchun undan KEYIN.
    setPickedFace(group)
  }

  // --- Kamera orqali surat olish ---
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }, [])

  const startCamera = async () => {
    setCameraError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Bu brauzer kamerani qo'llab-quvvatlamaydi. Faylni tanlang.")
      return
    }
    try {
      // Telefonda orqa kamera afzal, kompyuterda mavjud kamera ochiladi
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      setCameraOpen(true)
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Kameraga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering."
          : err?.name === "NotFoundError"
            ? "Kamera topilmadi."
            : "Kamerani ochib bo'lmadi. Faylni tanlashingiz mumkin."
      )
    }
  }

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraOpen])

  // Dialog yopilganda yoki komponent o'chganda kamerani albatta to'xtatamiz
  useEffect(() => {
    if (!open) stopCamera()
  }, [open, stopCamera])
  useEffect(() => () => stopCamera(), [stopCamera])

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" })
        handlePhotoChange(file)
        stopCamera()
      },
      "image/jpeg",
      0.9
    )
  }

  const applyScannedDoc = (doc: ScannedDoc) => {
    if (doc.firstName) setValue("new_guest_first_name", doc.firstName, { shouldDirty: true })
    if (doc.lastName) setValue("new_guest_last_name", doc.lastName, { shouldDirty: true })
    if (doc.birthDate) setValue("new_guest_birth_date", doc.birthDate, { shouldDirty: true })
    if (doc.documentNumber)
      setValue("new_guest_passport_number", sanitizePassport(doc.documentNumber))
    // Xalqaro MRZ'dagi qo'shimcha maydon avtomatik JSHSHIR emas — skaner uni
    // faqat O'zbekiston hujjatida tasdiqlangan bo'lsa belgilaydi
    if (doc.personalNumber && doc.pinflVerified)
      setValue("new_guest_id_document_number", doc.personalNumber)
    if (doc.documentType) setValue("new_guest_id_document_type", doc.documentType)
    if (doc.nationality) {
      const mapped = MRZ_COUNTRY[doc.nationality]
      if (mapped && NATIONALITIES.includes(mapped)) {
        setValue("new_guest_nationality", mapped)
      } else {
        setValue("new_guest_nationality", "Boshqa")
        setNationalityOther(doc.nationality)
      }
    }
  }

  const handleGuestSearchScan = (doc: ScannedDoc) => {
    const norm = (s?: string | null) => (s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    const pass = norm(doc.documentNumber)
    const personal = doc.pinflVerified ? norm(doc.personalNumber) : ""
    const found = (guests as any[]).find(
      (g) =>
        (pass.length >= 5 && norm(g.passport_number) === pass) ||
        (personal.length >= 8 && norm(g.id_document_number) === personal)
    )
    if (found) {
      setValue("guest_id", found.id)
      setSelectedGuestId(found.id)
      setGuestSearch("")
      setGuestScanNotFound(null)
    } else {
      setGuestScanNotFound(doc)
    }
  }

  const startNewGuestFromScan = (doc: ScannedDoc) => {
    setValue("new_guest_nationality", DEFAULT_NATIONALITY)
    setShowNewGuest(true)
    applyScannedDoc(doc)
    setGuestScanNotFound(null)
  }

  const backToGuestList = () => {
    setShowNewGuest(false)
    setValue("new_guest_first_name", "")
    setValue("new_guest_last_name", "")
    setValue("new_guest_phone", "")
    setValue("new_guest_passport_number", "")
    setValue("new_guest_id_document_type", "")
    setValue("new_guest_id_document_number", "")
    setValue("new_guest_birth_date", "")
    setValue("new_guest_nationality", DEFAULT_NATIONALITY)
    setValue("new_guest_address", "")
    setNationalityOther("")
    clearGuestPhoto()
  }

  const filteredGuests = useMemo(() => {
    // Mehmonlar bazasi GLOBAL — mehmonxona bo'yicha filtrlash yo'q
    if (!guestSearch.trim()) return guests.slice(0, 20)
    const q = guestSearch.toLowerCase()
    return guests
      .filter(
        (g) =>
          g.first_name?.toLowerCase().includes(q) ||
          g.last_name?.toLowerCase().includes(q) ||
          g.phone?.includes(q)
      )
      .slice(0, 20)
  }, [guests, guestSearch])

  /* Berilgan xona va kun uchun birinchi bo'sh soat oralig'i.

     Bugungi kun bo'lsa qidiruv HOZIRDAN boshlanadi — o'tib ketgan soatni
     taklif qilishning ma'nosi yo'q. Joy topilmasa null qaytadi va odatdagi
     14:00 qo'yiladi: xodim sanani o'zgartirishi mumkin, kesishuv haqidagi
     ogohlantirish esa o'z o'rnida turadi. */
  const freeSlotFor = (roomId: string, dateStr: string): [string, string] | null => {
    if (!roomId || !dateStr) return null
    const busy = busyIntervalsFor(reservations, roomId, dateStr)
    const now = new Date()
    const starts =
      dateStr === todayStr
        ? [now.getHours() * 60 + now.getMinutes()]
        : [8 * 60, 0]
    const slot = findFreeSlot(busy, starts)
    return slot ? [minToTime(slot[0]), minToTime(slot[1])] : null
  }

  /* Dialog ochilganda (yoki boshqa so'rov bilan qayta ochilganda) forma
     to'liq tozalanadi va so'rovdagi qiymatlar bilan to'ldiriladi — eski
     tanlov keyingi bronga o'tib ketmasligi kerak. */
  useEffect(() => {
    if (!request) return
    const room = request.room ?? null
    const price = room ? getRoomPrice(room) : 0
    // Sanalardan biri bo'sh bo'lsa kecha soni hisoblanmaydi — aks holda
    // to'lov maydoniga NaN tushib qolardi
    const rawNights =
      request.checkInDate && request.checkOutDate
        ? dayDiff(request.checkInDate, request.checkOutDate)
        : 0
    const nights = Number.isFinite(rawNights) ? Math.max(rawNights, 0) : 0
    reset()
    // Yangi bron oldingisidan surat yoki tanlangan yuzni meros qilib
    // olmasligi kerak — aks holda yuz boshqa mehmonga biriktirilardi.
    handlePhotoChange(null)
    // Tur: so'rovda ko'rsatilgan bo'lsa o'sha, bo'lmasa sozlamadan
    const wanted = request.bookingType ?? resolveBookingType(bookingDefaults)
    typePendingRef.current = !request.bookingType && !bookingDefaults
    setBookingType(wanted)
    setValue("booking_type", wanted)
    setValue("room_id", room?.id || "")
    setValue("check_in_date", request.checkInDate)
    setValue("check_out_date", request.checkOutDate)
    // Soatlikda vaqt berilmagan bo'lsa — o'sha kunning birinchi bo'sh
    // oralig'i (band soatlar va tanaffus hisobga olinadi)
    const slot =
      wanted === "HOURLY" && !request.checkInTime && room
        ? freeSlotFor(room.id, request.checkInDate)
        : null
    setValue("check_in_time", request.checkInTime || (slot ? slot[0] : "14:00"))
    setValue("check_out_time", request.checkOutTime || (slot ? slot[1] : "16:00"))
    // Mehmonlar soni standart 2 (odatda juftlik keladi)
    setValue("adults", 2)
    setValue("children", 0)
    // Oldindan berilgan mehmon tanlangan holatda ochiladi. Berilmasa —
    // avvalgidek bo'sh, xodim ro'yxatdan qidiradi.
    setValue("guest_id", request.guestId || "")
    setValue("new_guest_nationality", DEFAULT_NATIONALITY)
    setValue("payment_amount", wanted === "HOURLY" ? price : nights * price)
    setValue("payment_method", "CASH")
    setExtraPayments([])
    setDiscountType("AMOUNT")
    setDiscountValue("")
    setSelectedGuestId(request.guestId || "")
    setGuestSearch("")
    setShowNewGuest(false)
    setNationalityOther("")
    setGuestScanNotFound(null)
    setLocalError(null)
    setCompanions([])
    clearGuestPhoto()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  /* Sozlama kechroq kelsa — dialog vaqtincha kunlik bilan ochilgan bo'lsa —
     turni bir marta to'g'rilaymiz. Xodim turni qo'lda tanlagan bo'lsa
     bayroq tushgan bo'ladi va bu yerga kirilmaydi. */
  useEffect(() => {
    if (!open || !typePendingRef.current || !bookingDefaults) return
    typePendingRef.current = false
    if (resolveBookingType(bookingDefaults) === "DAILY") return
    setBookingType("HOURLY")
    setValue("booking_type", "HOURLY")
    const roomId = getValues("room_id") || presetRoom?.id || ""
    const slot = freeSlotFor(roomId, getValues("check_in_date"))
    setValue("check_in_time", slot ? slot[0] : "14:00")
    setValue("check_out_time", slot ? slot[1] : "16:00")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingDefaults])

  const watchInTime = watch("check_in_time")
  const watchOutTime = watch("check_out_time")
  const watchFormDate = watch("check_in_date")
  const watchFormOutDate = watch("check_out_date")
  const watchFormRoom = watch("room_id")

  /* AMALDAGI XONA — bitta manba.

     Dialog xona bosilib ochilganda `request.room` keladi va u formaga
     darhol yoziladi, shuning uchun odatda ikkalasi bir xil. Farq xodim
     ro'yxatdan boshqasini tanlaganda chiqadi: o'shanda forma qiymati ustun
     turishi kerak. Ilgari hamma joyda `presetRoom?.id || watchFormRoom`
     yozilgan edi — preset ustun edi va tanlangan xona e'tiborga
     olinmasdi. */
  const activeRoomId = watchFormRoom || presetRoom?.id || ""
  const activeRoom = useMemo(
    () =>
      presetRoom?.id === activeRoomId
        ? presetRoom
        : rooms.find((r) => r.id === activeRoomId) || null,
    [presetRoom, activeRoomId, rooms]
  )

  /* Bron qilinayotgan xonaning filiali — yuz tanlash oynasi shu bo'yicha
     filtrlanadi. Xona tanlanmagunicha oyna hech narsa ko'rsatmaydi va nima
     uchun ekanini aytadi: filialsiz ro'yxat butun mehmonxonani qaytarardi. */
  const activeBranchId = useMemo(
    () => activeRoom?.branch_id || user?.branch_id || null,
    [activeRoom, user?.branch_id]
  )
  const watchNationality = watch("new_guest_nationality")
  const watchBirthDate = watch("new_guest_birth_date")
  const watchNewPassport = watch("new_guest_passport_number")
  const watchNewPhone = watch("new_guest_phone")

  const hourCount = bookingType === "HOURLY" ? hourlyDuration(watchInTime, watchOutTime) : 0

  /* XONA HOLATI BO'YICHA TO'SIQ.

     Ta'mir/tekshiruv/xizmatdan tashqari — holat almashtirilmaguncha hech
     qanday sanaga bron qilinmaydi. Tozalash esa faqat mehmon aynan hozir
     kirmoqchi bo'lsa to'sadi: u qisqa va o'z-o'zidan tugaydi, kelgusi
     sanalarga xalaqit bermaydi.

     Server ham xuddi shu qoidani qo'llaydi — bu yerdagisi xodim so'rov
     yuborishdan oldin sababni ko'rishi uchun. */
  const bookingWindow: BookingWindow = useMemo(
    () => ({
      bookingType,
      checkInDate: watchFormDate,
      checkOutDate: watchFormOutDate,
      checkInAt: watchFormDate && watchInTime ? `${watchFormDate}T${watchInTime}` : null,
      checkOutAt:
        watchFormDate && watchInTime && watchOutTime
          ? // Chiqish vaqti kirishdan kichik bo'lsa — keyingi kunga o'tadi
            `${watchOutTime <= watchInTime ? addDaysStr(watchFormDate, 1) : watchFormDate}T${watchOutTime}`
          : null,
    }),
    [bookingType, watchFormDate, watchFormOutDate, watchInTime, watchOutTime]
  )
  const roomBlockReason = activeRoom
    ? roomBookingBlock(
        // Ro'yxatdagi yangi nusxa ustun — preset eskirgan bo'lishi mumkin
        rooms.find((r) => r.id === activeRoom.id) || activeRoom,
        bookingWindow,
        new Date()
      )
    : null

  /* Hamrohlar hisobi. Mehmonlar soni kamaytirilsa ortiqcha tanlovlar
     yig'ilib qolmasligi uchun ro'yxat shu yerda qirqiladi. */
  const adultsCount = Math.max(Number(watch("adults")) || 1, 1)
  const trimmedCompanions = useMemo(
    () => companions.slice(0, companionSlots(adultsCount)),
    [companions, adultsCount]
  )
  const companionsMissing = missingCompanions(adultsCount, trimmedCompanions.length)

  // Yangi mehmon formasida passport/telefon terilishi bilan mavjud mehmonni
  // jonli aniqlash — dublikat yaratmaslik va ishni tezlashtirish uchun
  const existingGuestMatch = useMemo(() => {
    const passNorm = (s?: string | null) =>
      (s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    const digitsOf = (s?: string | null) => (s || "").replace(/\D/g, "")
    const pass = passNorm(watchNewPassport)
    if (pass.length >= 5) {
      const g = (guests as any[]).find(
        (x) => passNorm(x.passport_number) && passNorm(x.passport_number) === pass
      )
      if (g) return g
    }
    const digits = digitsOf(watchNewPhone)
    if (digits.length >= 9) {
      const tail = digits.slice(-9)
      const g = (guests as any[]).find(
        (x) => digitsOf(x.phone).length >= 9 && digitsOf(x.phone).slice(-9) === tail
      )
      if (g) return g
    }
    return null
  }, [watchNewPassport, watchNewPhone, guests])

  const dialogBusyTimes = useMemo(() => {
    if (!open || bookingType !== "HOURLY") return []
    if (!activeRoomId || !watchFormDate) return []
    return busyIntervalsFor(reservations, activeRoomId, watchFormDate)
  }, [open, bookingType, activeRoomId, watchFormDate, reservations])

  const selectedTimeConflict = useMemo(() => {
    if (bookingType !== "HOURLY" || !watchInTime || !watchOutTime) return false
    const s = timeToMin(normalizeTime(watchInTime))
    const e = timeToMin(normalizeTime(watchOutTime))
    const eClamped = e <= s ? 24 * 60 : e + HOURLY_TURNOVER_MIN
    return dialogBusyTimes.some(([bs, be]) => bs < eClamped && be > s)
  }, [bookingType, watchInTime, watchOutTime, dialogBusyTimes])

  /* Keyingi mijozning kunlariga bosib kirmaslik (KUNLIK bron).

     Kirish sanasidan keyin boshlanadigan eng yaqin bron chegara bo'ladi:
     chiqish sanasi undan oshsa, yangi bron keyinroqqa bron qilgan boshqa
     mijozning vaqtiga kirib ketadi. Sana maydonida `max` bo'lib ham
     qo'yiladi — bunday sanani tanlashning o'zi mumkin bo'lmaydi. */
  const nextGuestStart = useMemo(() => {
    if (bookingType !== "DAILY") return null
    if (!activeRoomId || !watchFormDate) return null
    return nextBookingStart(reservations, activeRoomId, watchFormDate)
  }, [bookingType, activeRoomId, watchFormDate, reservations])

  const dailyRangeConflict =
    bookingType === "DAILY" &&
    !!nextGuestStart &&
    !!watchFormOutDate &&
    watchFormOutDate > nextGuestStart

  /* Dialogdagi vaqtni real vaqtda yangilab turish: dialog ochiq turganda
     daqiqalar o'tsa, bugungi soatlik bronning kirish vaqti o'tmishda qolib
     ketmasligi kerak — boshlanish joriy vaqtga suriladi, davomiylik saqlanadi */
  const [nowTick, setNowTick] = useState(() => new Date())
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setNowTick(new Date()), 10_000)
    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open || bookingType !== "HOURLY") return
    if (watchFormDate !== format(nowTick, "yyyy-MM-dd")) return // faqat bugungi kun
    if (!watchInTime || !watchOutTime) return
    const nowMin = nowTick.getHours() * 60 + nowTick.getMinutes()
    const s = timeToMin(normalizeTime(watchInTime))
    if (s >= nowMin) return // boshlanish hali kelmagan — tegmaymiz
    let durMin = timeToMin(normalizeTime(watchOutTime)) - s
    if (durMin <= 0) durMin += 24 * 60
    setValue("check_in_time", minToTime(nowMin))
    setValue("check_out_time", minToTime((nowMin + durMin) % (24 * 60)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingType, nowTick, watchFormDate, watchInTime, watchOutTime])

  // --- Jonli hisob-kitob: sanalar/xona o'zgarsa narx darhol qayta hisoblanadi
  const dialogRoom = activeRoom
  const dialogRoomPrice = dialogRoom ? getRoomPrice(dialogRoom) : 0
  const roomPrice = dialogRoomPrice
  const dialogNightCount =
    watchFormDate && watchFormOutDate ? Math.max(dayDiff(watchFormDate, watchFormOutDate), 0) : 0
  const dialogDailyTotal = dialogNightCount * dialogRoomPrice
  const totalPrice = dialogDailyTotal
  // Soatlik bron narxi davomiylikka BOG'LIQ EMAS — kunlik narx to'liq olinadi
  const hourlyTotal = dialogRoomPrice
  const effectiveTotal = bookingType === "HOURLY" ? hourlyTotal : dialogDailyTotal

  // Chegirma hisobi — backend bilan bir xil mantiq
  const rawDiscount = Number(discountValue) || 0
  const discountAmount =
    discountType === "PERCENT"
      ? Math.round((effectiveTotal * Math.min(Math.max(rawDiscount, 0), 100)) / 100)
      : Math.min(Math.max(rawDiscount, 0), effectiveTotal)
  const finalTotal = Math.max(effectiveTotal - discountAmount, 0)

  /* Chegirma qoidasi — administrator sozlaydi, xodim shu doirada ishlaydi.
     Bu yerdagi tekshiruv xodimga DARHOL javob berish uchun; haqiqiy to'siq
     serverda, ya'ni brauzerni chetlab o'tib bo'lmaydi. */
  const discountRule = ruleFor(discountRules, bookingType)
  const discountDuration = bookingType === "HOURLY" ? hourCount : dialogNightCount
  const discountError = discountProblem(
    discountRule,
    bookingType,
    discountDuration,
    effectiveTotal,
    discountType === "AMOUNT" ? rawDiscount : 0,
    discountType === "PERCENT" ? rawDiscount : 0
  )
  const discountLimitText = discountHint(discountRule, bookingType)

  /* Chegirma umuman berilmaydigan holat (o'chirilgan yoki davomiylik
     shartiga tushmaydi) — maydon yopiladi. Foiz/summa chegarasi esa
     maydonni yopmaydi: unda raqam kiritiladi, faqat chegara qo'yiladi. */
  const discountOpen = discountAllowed(discountRule, discountDuration)
  const discountBlockText = discountBlockedReason(
    discountRule,
    bookingType,
    discountDuration
  )

  /* Davomiylik o'zgarib chegirma taqiqlangan bo'lsa — kiritilgan qiymat
     tozalanadi. Aks holda u ko'rinmay turib yuborilar va server rad
     etardi (masalan 3 soatga 10% qo'yilib, keyin 1 soatga tushirilsa). */
  useEffect(() => {
    if (!open || discountOpen || !discountValue) return
    setDiscountValue("")
  }, [open, discountOpen, discountValue])

  useEffect(() => {
    if (!open) return
    setValue("payment_amount", finalTotal)
    setExtraPayments([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingType, finalTotal])

  const watchPaymentAmount = watch("payment_amount")
  const paidTotal =
    (Number(watchPaymentAmount) || 0) +
    extraPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const remainingAmount = Math.max(finalTotal - paidTotal, 0)

  const addExtraPayment = () => {
    setExtraPayments((prev) => [
      ...prev,
      { amount: remainingAmount > 0 ? String(remainingAmount) : "", method: "" },
    ])
  }

  const updateExtraPayment = (
    index: number,
    patch: Partial<{ amount: string; method: string }>
  ) => {
    setExtraPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  const removeExtraPayment = (index: number) => {
    setExtraPayments((prev) => prev.filter((_, i) => i !== index))
  }

  const applyDuration = (hours: number) => {
    const inT = normalizeTime(watchInTime || "14:00")
    const outMin = (timeToMin(inT) + hours * 60) % (24 * 60)
    setValue("check_in_time", inT)
    setValue("check_out_time", minToTime(outMin))
    setValue("payment_amount", roomPrice)
    // Summa qayta hisoblandi — qo'shimcha to'lov qatorlari eskirdi
    setExtraPayments([])
  }

  const durationConflicts = (hours: number): boolean => {
    if (!watchInTime) return false
    const s = timeToMin(normalizeTime(watchInTime))
    const e = s + hours * 60 + HOURLY_TURNOVER_MIN
    const eClamped = Math.min(e, 24 * 60)
    return dialogBusyTimes.some(([bs, be]) => bs < eClamped && be > s)
  }

  const onSubmit = async (values: BookingForm) => {
    // Surat yuklanmay qolsa — bron yaratilgandan keyin ogohlantiramiz
    let photoUploadFailed = false
    let faceEnrollFailed = false

    const paymentRows = [
      {
        amount: Number(values.payment_amount) || 0,
        payment_method: values.payment_method || "",
      },
      ...extraPayments.map((p) => ({
        amount: Number(p.amount) || 0,
        payment_method: p.method,
      })),
    ].filter((p) => p.amount > 0)

    if (paymentRows.some((p) => !p.payment_method)) {
      showError("Har bir to'lov qatorida to'lov turini tanlang.")
      return
    }
    // Chegirma qoidasi — serverdan oldin shu yerda, xabar tushunarli bo'lsin
    if (discountError) {
      showError(discountError)
      return
    }

    // Majburiy rejim: xonadagi har bir kishi ro'yxatga olinishi shart.
    // Serverdan oldin shu yerda to'xtatamiz — xabar tushunarli bo'lishi uchun
    if (guestsRequired && companionsMissing > 0) {
      showError(
        `Xonadagi har bir mehmon ro'yxatga olinishi kerak: ${adultsCount} kishidan ` +
          `${adultsCount - companionsMissing} tasi kiritilgan. Qolgan ${companionsMissing} ta ` +
          `mehmonni "Hamrohlar" bo'limida tanlang yoki yangi qo'shing.`
      )
      return
    }

    const paymentsTotal = paymentRows.reduce((s, p) => s + p.amount, 0)
    if (finalTotal > 0 && paymentsTotal > finalTotal) {
      showError(
        `To'lovlar yig'indisi (${paymentsTotal.toLocaleString()} So'm) chegirma bilan hisoblangan jami narxdan (${finalTotal.toLocaleString()} So'm) oshib ketdi. Iltimos, summalarni to'g'rilang.`
      )
      return
    }

    try {
      // Bron aynan bir xona uchun — branch_id va hotel_id ni o'sha xonadan olamiz
      /* Ro'yxatdagi yangi nusxa ustun turadi. `presetRoom` — dialog
         ochilgan paytdagi surat; xona holati o'shandan beri o'zgargan
         bo'lishi mumkin (masalan tozalash tugab, yoki aksincha ta'mirga
         qo'yilib). Holat tekshiruvi eng yangi ma'lumotga tayanishi kerak. */
      const chosenRoom =
        rooms.find((r) => r.id === values.room_id) ||
        (presetRoom?.id === values.room_id ? presetRoom : undefined)

      // Xona holati yo'l qo'yadimi. Server ham tekshiradi, lekin sabab shu
      // yerda aniqroq aytiladi — xodim nima qilishini biladi.
      const blocked = chosenRoom
        ? roomBookingBlock(chosenRoom, bookingWindow, new Date())
        : null
      if (blocked) {
        showError(blocked)
        return
      }
      const branchId = chosenRoom?.branch_id || user?.branch_id || ""
      const hotelId = chosenRoom?.hotel_id || user?.hotel_id || undefined

      let guestId = values.guest_id

      if (!guestId && values.new_guest_first_name) {
        const guest = await createGuestMutation.mutateAsync({
          first_name: values.new_guest_first_name,
          last_name: values.new_guest_last_name || "",
          phone: values.new_guest_phone || undefined,
          passport_number: values.new_guest_passport_number
            ? sanitizePassport(values.new_guest_passport_number) || undefined
            : undefined,
          id_document_type: values.new_guest_id_document_type || undefined,
          id_document_number: values.new_guest_id_document_number || undefined,
          birth_date: values.new_guest_birth_date || undefined,
          nationality:
            values.new_guest_nationality === "Boshqa"
              ? nationalityOther.trim() || undefined
              : values.new_guest_nationality || undefined,
          address: values.new_guest_address || undefined,
          hotelId,
        })
        guestId = guest.id

        // Surat tanlangan bo'lsa — mehmon yaratilgandan keyin yuklaymiz.
        // Yuklash muvaffaqiyatsiz bo'lsa bron yaratish to'xtatilmaydi
        if (guestPhoto && guestId) {
          try {
            setPhotoUploading(true)
            await uploadGuestFile(guestId, guestPhoto, "photo", hotelId)
          } catch (uploadError) {
            console.error("Surat yuklashda xatolik", uploadError)
            photoUploadFailed = true
          } finally {
            setPhotoUploading(false)
          }
        }

        /* Kameradan yuz tanlangan bo'lsa — endi mehmon id'si bor, uni
           biriktiramiz. Shundan keyin mehmon kamera oldidan o'tsa avtomatik
           tanaladi.

           Bron BUZILMAYDI: biriktirish alohida, ixtiyoriy qadam va u
           yiqilsa xodim bron yaratganini yo'qotmaydi — yuzni keyin
           qabulxona panelidan biriktirish mumkin. */
        if (pickedFace && guestId) {
          try {
            await enrollFaceMutation.mutateAsync({
              sightingId: pickedFace.best_sighting_id,
              // Guruhning hamma ko'rinishlari: bir necha epizoddan yig'ilgan
              // shablon bittasidan aniqroq, va qolganlari "tanilmagan" bo'lib
              // ro'yxatda qolib ketmaydi.
              sightingIds: pickedFace.sighting_ids,
              guestId,
              // Xodim suratni ataylab tanladi va mehmon kamera oldida
              // turibdi — rozilik shu harakat bilan tasdiqlanadi.
              consent: true,
            })
          } catch (enrollError) {
            console.error("Yuzni biriktirishda xatolik", enrollError)
            faceEnrollFailed = true
          }
        }
      }

      const basePayload = {
        guest_id: guestId || "",
        room_id: values.room_id,
        branch_id: branchId,
        hotelId,
        adults: values.adults,
        children: values.children || 0,
        // Hamrohlar — har biri bazadagi haqiqiy mehmon
        companion_guest_ids: trimmedCompanions.map((c) => c.id),
        notes: values.notes,
        payment_amount: paymentsTotal,
        payment_method: (paymentRows[0]?.payment_method as any) || null,
        payments: paymentRows,
        // Chegirma: foiz ustuvor — backend foizdan summani o'zi hisoblaydi
        discount_percent:
          discountType === "PERCENT" ? Math.min(Math.max(rawDiscount, 0), 100) : 0,
        discount_amount: discountType === "AMOUNT" ? discountAmount : 0,
      }

      let payload: any
      if (values.booking_type === "HOURLY") {
        let inTime = normalizeTime(values.check_in_time)
        let outTime = normalizeTime(values.check_out_time)

        // Hozirgi vaqtdan oldingi vaqtga bron qilib bo'lmaydi: boshlanish
        // o'tib ketgan bo'lsa uni joriy vaqtga surib, davomiylikni saqlaymiz
        const submitNow = new Date()
        if (values.check_in_date === format(submitNow, "yyyy-MM-dd")) {
          const nowMin = submitNow.getHours() * 60 + submitNow.getMinutes()
          const s0 = timeToMin(inTime)
          if (s0 < nowMin) {
            let durMin = timeToMin(outTime) - s0
            if (durMin <= 0) durMin += 24 * 60
            inTime = minToTime(nowMin)
            outTime = minToTime((nowMin + durMin) % (24 * 60))
            setValue("check_in_time", inTime)
            setValue("check_out_time", outTime)
          }
        }

        // Chiqish vaqti kirishdan kichik/teng bo'lsa keyingi kunga o'tadi
        const overnight = outTime <= inTime
        const checkInDate = values.check_in_date
        const checkOutDate = overnight ? addDaysStr(checkInDate, 1) : checkInDate

        // Band soat bilan kesishishga yo'l qo'ymaymiz
        const busy = busyIntervalsFor(reservations, values.room_id, checkInDate)
        const s = timeToMin(inTime)
        const eClamped = overnight ? 24 * 60 : timeToMin(outTime)
        if (busy.some(([bs, be]) => bs < eClamped + HOURLY_TURNOVER_MIN && be > s)) {
          showError(
            `Tanlangan vaqt band soatlar bilan kesishadi. Har bir bron orasida xonani tayyorlash uchun ${HOURLY_TURNOVER_MIN} daqiqa tanaffus bo'lishi kerak. Iltimos, bo'sh vaqtni tanlang.`
          )
          return
        }

        payload = {
          ...basePayload,
          booking_type: "HOURLY",
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          check_in_datetime: `${checkInDate}T${inTime}:00`,
          check_out_datetime: `${checkOutDate}T${outTime}:00`,
        }
      } else {
        // Keyinroqqa bron qilgan boshqa mijozning kunlariga bosib kirmaslik —
        // serverdan oldin shu yerda to'xtatamiz, xabar tushunarli bo'lishi uchun
        const limit = nextBookingStart(reservations, values.room_id, values.check_in_date)
        if (limit && values.check_out_date > limit) {
          showError(
            `Bu xona ${limit} sanasidan boshlab boshqa mijozga bron qilingan. Chiqish sanasi ${limit} dan keyin bo'la olmaydi.`
          )
          return
        }
        payload = {
          ...basePayload,
          booking_type: "DAILY",
          check_in_date: values.check_in_date,
          check_out_date: values.check_out_date,
        }
      }

      await createReservationMutation.mutateAsync(payload)

      setShowNewGuest(false)
      setSelectedGuestId("")
      setBookingType("DAILY")
      clearGuestPhoto()
      setNationalityOther("")
      setExtraPayments([])
      setDiscountValue("")
      setDiscountType("AMOUNT")
      handlePhotoChange(null)
      reset()
      onCreated?.()
      onClose()

      if (photoUploadFailed) {
        showError(
          "Bron va mehmon saqlandi, lekin suratni yuklab bo'lmadi. Suratni keyinroq qayta yuklashingiz mumkin."
        )
      } else if (faceEnrollFailed) {
        showError(
          "Bron va mehmon saqlandi, lekin yuz biriktirilmadi — keyingi tashrifda avtomatik tanilmaydi. " +
            "Yuzni qabulxona panelidan qayta biriktirishingiz mumkin."
        )
      }
    } catch (error: any) {
      console.error(error)
      showError(bookingErrorMessage(error))
    }
  }

  return (
    <>
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Yangi bandlov</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 py-4">
        {/* Bron turi: Kunlik / Soatlik */}
        <div className="flex rounded-lg bg-gray-100 p-1">
          {([
            { key: "DAILY", label: "Kunlik" },
            { key: "HOURLY", label: "Soatlik" },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                // Qo'lda tanlangan tur sozlama bilan bosib ketilmasin
                typePendingRef.current = false
                setBookingType(opt.key)
                setValue("booking_type", opt.key)
                if (opt.key === "HOURLY") {
                  // Band soatlarni chetlab birinchi bo'sh vaqtni avtomatik tanlaymiz
                  const roomId = activeRoomId
                  const dateStr = watchFormDate || ""
                  const busy =
                    roomId && dateStr ? busyIntervalsFor(reservations, roomId, dateStr) : []
                  const slot = findFreeSlot(busy)
                  const inT = slot ? minToTime(slot[0]) : "14:00"
                  const outT = slot ? minToTime(slot[1]) : "16:00"
                  setValue("check_in_time", inT)
                  setValue("check_out_time", outT)
                  setValue(
                    "payment_amount",
                    roomPrice
                  )
                } else {
                  setValue("payment_amount", totalPrice)
                }
                // To'lov summasi qayta hisoblanganda qo'shimcha to'lov
                // qatorlari eskirib qoladi — tozalaymiz
                setExtraPayments([])
              }}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                bookingType === opt.key
                  ? "bg-white text-primary-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* XONA. Ilgari dialog xona bosilib ochilganda xona qat'iy edi:
            ro'yxat umuman ko'rsatilmasdi va boshqasiga o'tish uchun dialogni
            yopib, taxtadan boshqa xonani bosish kerak bo'lardi. Endi ro'yxat
            doim ochiq. Yuqoridagi karta esa qoldi — u tanlangan xonani
            (endi preset emas, AMALDAGI xonani) sana/soat xulosasi bilan
            ko'rsatadi. */}
        {activeRoom && (
          <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg">
            <BedDouble className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {activeRoom.room_number}
              </p>
              {bookingType === "HOURLY" ? (
                <p className="text-xs text-gray-500">
                  Soatlik bron{hourCount > 0 ? ` (${hourCount} soat)` : ""}
                </p>
              ) : (
                watchFormDate && watchFormOutDate && (
                  <p className="text-xs text-gray-500">
                    {watchFormDate} → {watchFormOutDate} ({dialogNightCount} kecha)
                  </p>
                )
              )}
            </div>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium">Xona *</label>
          <select
            className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register("room_id")}
          >
            <option value="">Xonani tanlang</option>
            {rooms.map(r => (
              <option
                key={r.id}
                value={r.id}
                /* Ta'mir/tekshiruv/xizmatdan tashqari xonalar tanlanmaydi.
                   Tozalanayotgani esa ro'yxatda qoladi — u kelgusi sanalarga
                   bron qilinishi mumkin, faqat hozirgi payt uchun emas. */
                disabled={isBlockedAlways(r.current_status)}
              >
                {r.room_number} ({r.room_type?.name}) - {getRoomPrice(r)} So'm
                {isRestrictedStatus(r.current_status)
                  ? ` — ${statusLabel(r.current_status)}`
                  : ""}
              </option>
            ))}
          </select>
          {errors.room_id && <p className="text-xs text-red-500">{errors.room_id.message}</p>}
          {/* Sabab yuborishdan oldin ko'rinadi — xodim sanani o'zgartirsa
              yoki tozalash tugasa yozuv o'zi yo'qoladi. */}
          {roomBlockReason && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {roomBlockReason}
            </p>
          )}
        </div>

        {bookingType === "HOURLY" ? (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium">Sana *</label>
              <Input type="date" min={todayStr} {...register("check_in_date")} />
              {errors.check_in_date && <p className="text-xs text-red-500">{errors.check_in_date.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Kirish vaqti *</label>
              <Input type="time" {...register("check_in_time")} />
              {errors.check_in_time && <p className="text-xs text-red-500">{errors.check_in_time.message}</p>}
              {watchFormDate === todayStr && (
                <p className="text-[11px] text-gray-400">
                  Vaqt o'tsa, kirish vaqti avtomatik joriy vaqtga suriladi —
                  tanlangan davomiylik saqlanadi
                </p>
              )}
            </div>

            {/* Davomiylikni tanlash — bir bosishda chiqish vaqti hisoblanadi */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Necha soat?</label>
              <div className="grid grid-cols-6 gap-1.5">
                {DURATION_OPTIONS.map((h) => {
                  const conflict = durationConflicts(h)
                  const active = Math.abs(hourCount - h) < 0.01
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => applyDuration(h)}
                      className={cn(
                        "h-9 rounded-md text-sm font-semibold border transition-colors",
                        active
                          ? "bg-primary-600 text-white border-primary-600"
                          : conflict
                            ? "border-red-100 bg-red-50 text-red-300 hover:border-red-200"
                            : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      )}
                      title={
                        conflict
                          ? "Bu davomiylik band soatlar bilan kesishadi"
                          : `${h} soat`
                      }
                    >
                      {h}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-gray-400">
                Tugmani bosing yoki chiqish vaqtini qo'lda kiriting
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Chiqish vaqti *</label>
              <Input type="time" {...register("check_out_time")} />
            </div>
            {dialogBusyTimes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-gray-500">Band soatlar:</span>
                {dialogBusyTimes.map(([s, e], i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100 font-medium"
                  >
                    {minToTime(s)} - {minToTime(e)}
                  </span>
                ))}
              </div>
            )}
            {selectedTimeConflict && (
              <p className="text-xs text-red-500 font-medium">
                Tanlangan vaqt band soatlar bilan kesishadi. Iltimos, bo'sh vaqtni tanlang.
              </p>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Kirish sanasi *</label>
              <Input type="date" min={todayStr} {...register("check_in_date")} />
              {errors.check_in_date && <p className="text-xs text-red-500">{errors.check_in_date.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Chiqish sanasi *</label>
              {/* max — keyingi mijozning kirish sanasi: bron uning kunlariga
                  bosib kirmasligi uchun bundan narini tanlab bo'lmaydi */}
              <Input
                type="date"
                min={todayStr}
                max={nextGuestStart || undefined}
                {...register("check_out_date")}
              />
              {errors.check_out_date && <p className="text-xs text-red-500">{errors.check_out_date.message}</p>}
            </div>
          </div>
        )}

        {/* Keyingi mijozning kunlariga bosib kirmaslik — ogohlantirish */}
        {bookingType === "DAILY" && nextGuestStart && (
          <p
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-medium",
              dailyRangeConflict
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-amber-200 bg-amber-50 text-amber-700"
            )}
          >
            {dailyRangeConflict
              ? `Chiqish sanasi ${nextGuestStart} dan oshib ketdi — bu xona o'sha kundan boshlab boshqa mijozga bron qilingan.`
              : `Bu xona ${nextGuestStart} sanasidan band. Chiqish sanasi shu kundan oshmasligi kerak.`}
          </p>
        )}

        {/* Guest selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Mehmon *
          </label>

          {!showNewGuest ? (
            (() => {
              // Tanlangan mehmon ALOHIDA karta bo'lib ko'rsatiladi —
              // kim tanlangani bir qarashda aniq; "O'zgartirish" bosilsa
              // qidiruv ro'yxati qaytadi (tanlov bekor bo'ladi)
              const selectedGuestObj = selectedGuestId
                ? (guests as any[]).find((g) => g.id === selectedGuestId)
                : null
              if (selectedGuestObj) {
                const initials = `${selectedGuestObj.first_name?.[0] ?? ""}${
                  selectedGuestObj.last_name?.[0] ?? ""
                }`.toUpperCase()
                return (
                  <div className="space-y-2 rounded-lg border-2 border-primary-200 bg-primary-50 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                      {initials || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary-600" />
                        <span className="truncate">
                          {selectedGuestObj.first_name} {selectedGuestObj.last_name}
                        </span>
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {[selectedGuestObj.phone, selectedGuestObj.passport_number]
                          .filter(Boolean)
                          .join(" · ") || "Qo'shimcha ma'lumot yo'q"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setValue("guest_id", "")
                        setSelectedGuestId("")
                        setGuestSearch("")
                      }}
                      className="flex-shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                    >
                      O'zgartirish
                    </button>
                  </div>
                  {/* Telefon yoki passport xato kiritilgan bo'lsa shu
                      yerning o'zida to'g'rilanadi — bron yaratishni to'xtatib,
                      mehmonlar sahifasiga o'tish shart emas. */}
                  <GuestContactEditor
                    guestId={selectedGuestObj.id}
                    phone={selectedGuestObj.phone}
                    passport={selectedGuestObj.passport_number}
                    className="border-t border-primary-200/70 pt-2"
                  />
                  {/* Mavjud mehmonning yuzi bo'lmasa — hoziroq biriktirish.
                      Mehmon allaqachon bor, shuning uchun bron saqlanishini
                      kutmaydi: darhol biriktiriladi va natija shu yerda
                      ko'rinadi. */}
                  <GuestFaceRow
                    guestId={selectedGuestObj.id}
                    branchId={activeBranchId}
                    className="border-t border-primary-200/70 pt-2"
                  />
                  </div>
                )
              }
              return (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Mijozni qidirish..."
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                  />
                </div>
                {/* Hujjatni skanerlab mijozni topish */}
                <button
                  type="button"
                  onClick={() => {
                    setGuestScanNotFound(null)
                    setGuestScanOpen(true)
                  }}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                  title="Passport yoki ID kartani skanerlab mijozni topish"
                >
                  <ScanLine className="h-4 w-4" />
                  Skaner
                </button>
              </div>

              {/* Skanerlangan hujjat bo'yicha mijoz topilmadi */}
              {guestScanNotFound && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                  <p className="min-w-0 text-sm font-medium text-amber-800">
                    Mijoz topilmadi
                    {guestScanNotFound.firstName
                      ? ` (${guestScanNotFound.firstName} ${guestScanNotFound.lastName || ""})`
                      : ""}{" "}
                    — yangi qo'shilsinmi?
                  </p>
                  <div className="flex shrink-0 gap-1.5">
                    {canCreateGuest && (
                      <button
                        type="button"
                        onClick={() => startNewGuestFromScan(guestScanNotFound)}
                        className="rounded-md bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        + Qo'shish
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setGuestScanNotFound(null)}
                      className="rounded-md px-2 py-1.5 text-xs text-amber-700 hover:bg-amber-100"
                    >
                      Yopish
                    </button>
                  </div>
                </div>
              )}

              {/* Qidiruv uchun skaner (yangi mijoz formasidagidan alohida) */}
              <DocumentScanner
                open={guestScanOpen}
                onOpenChange={setGuestScanOpen}
                onResult={handleGuestSearchScan}
              />
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                {filteredGuests.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors",
                      selectedGuestId === g.id && "bg-primary-50 text-primary-700"
                    )}
                    onClick={() => {
                      setValue("guest_id", g.id)
                      setSelectedGuestId(g.id)
                      setGuestSearch("")
                    }}
                  >
                    <span className="font-medium">
                      {g.first_name} {g.last_name}
                    </span>
                    {g.phone && (
                      <span className="text-gray-400 ml-2">{g.phone}</span>
                    )}
                  </button>
                ))}
                {filteredGuests.length === 0 && (
                  <p className="px-3 py-4 text-sm text-gray-400 text-center">
                    Mijoz topilmadi
                  </p>
                )}
              </div>
              {canCreateGuest && (
                <button
                  type="button"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  onClick={() => {
                    // Fuqarolik standart holda O'zbekiston bo'lib turadi
                    setValue("new_guest_nationality", DEFAULT_NATIONALITY)
                    setShowNewGuest(true)
                  }}
                >
                  + Yangi mijoz qo'shish
                </button>
              )}
              {errors.guest_id && <p className="text-xs text-red-500">{errors.guest_id.message}</p>}
            </div>
              )
            })()
          ) : (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
              {/* Blok sarlavhasi + ro'yxatga qaytish tugmasi (forma uzun bo'lgani
                  uchun qaytish tugmasi tepada ham, pastda ham mavjud) */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-900">Yangi mehmon</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setScanOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    title="Passport yoki ID kartani kamera bilan skanerlash"
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                    Skanerlash
                  </button>
                  <button
                    type="button"
                    onClick={backToGuestList}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Ro'yxatga qaytish
                  </button>
                </div>
              </div>

              {/* Hujjat skaneri — MRZ o'qib formani avtomatik to'ldiradi */}
              <DocumentScanner
                open={scanOpen}
                onOpenChange={setScanOpen}
                onResult={applyScannedDoc}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Ism *</label>
                  <Input placeholder="Ism" {...register("new_guest_first_name")} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Familiya</label>
                  <Input placeholder="Familiya" {...register("new_guest_last_name")} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Telefon</label>
                <Input placeholder="Telefon" {...register("new_guest_phone")} />
              </div>

              {/* Mavjud mehmon topildi — qayta yaratmasdan bir klikda tanlash */}
              {existingGuestMatch && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                  <div className="min-w-0 text-sm text-amber-800">
                    <p className="truncate font-semibold">
                      Bu mijoz bazada mavjud: {existingGuestMatch.first_name}{" "}
                      {existingGuestMatch.last_name}
                    </p>
                    {/* Maxfiylik: passport raqami ko'rsatilmaydi, faqat telefon */}
                    {existingGuestMatch.phone && (
                      <p className="truncate text-xs">{existingGuestMatch.phone}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      backToGuestList()
                      setValue("guest_id", existingGuestMatch.id)
                      setSelectedGuestId(existingGuestMatch.id)
                    }}
                    className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
                  >
                    Tanlash
                  </button>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium">Tug'ilgan sana</label>
                {/* Maydon RHF'da ro'yxatdan o'tgan bo'lishi uchun yashirin input */}
                <input type="hidden" {...register("new_guest_birth_date")} />
                <BirthDateSelect
                  value={watchBirthDate}
                  onChange={(v) =>
                    setValue("new_guest_birth_date", v, { shouldDirty: true })
                  }
                />
              </div>

              {/* Passport / hujjat ma'lumotlari */}
              <div className="pt-2 border-t border-gray-200 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Hujjat ma'lumotlari
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Passport raqami</label>
                    <Input
                      placeholder="AA1234567"
                      autoCapitalize="characters"
                      {...register("new_guest_passport_number", {
                        // Harflar doim bosh harfda; bo'sh joy, tire va boshqa
                        // belgilar qabul qilinmaydi — faqat A-Z va 0-9
                        onChange: (e) =>
                          setValue(
                            "new_guest_passport_number",
                            sanitizePassport(e.target.value)
                          ),
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Fuqaroligi</label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      {...register("new_guest_nationality")}
                    >
                      {NATIONALITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {/* "Boshqa" tanlansa — davlat nomini qo'lda kiritish */}
                    {watchNationality === "Boshqa" && (
                      <Input
                        className="mt-1.5"
                        placeholder="Davlat nomini yozing"
                        value={nationalityOther}
                        onChange={(e) => setNationalityOther(e.target.value)}
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Hujjat turi</label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      {...register("new_guest_id_document_type")}
                    >
                      <option value="">Tanlang</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="ID_CARD">ID karta</option>
                      <option value="DRIVER_LICENSE">Haydovchilik guvohnomasi</option>
                      <option value="BIRTH_CERTIFICATE">Tug'ilganlik guvohnomasi</option>
                      <option value="OTHER">Boshqa</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Shaxsiy raqam/JSHSHIR</label>
                    <Input placeholder="Shaxsiy raqam/JSHSHIR" {...register("new_guest_id_document_number")} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Manzil</label>
                  <Input placeholder="Yashash manzili" {...register("new_guest_address")} />
                </div>
              </div>

              {/* Mehmon surati / passport nusxasi */}
              <div className="pt-2 border-t border-gray-200 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Surat (ixtiyoriy)
                </p>
                {guestPhotoPreview ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={guestPhotoPreview}
                      alt="Mehmon surati"
                      className="h-20 w-20 rounded-lg object-cover border border-gray-200"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-600 truncate">{guestPhoto?.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {guestPhoto ? Math.round(guestPhoto.size / 1024) : 0} KB
                      </p>
                      <button
                        type="button"
                        className="mt-1 text-xs text-red-600 hover:text-red-700 font-medium"
                        onClick={clearGuestPhoto}
                      >
                        O'chirish
                      </button>
                    </div>
                  </div>
                ) : cameraOpen ? (
                  /* Kamera rejimi: jonli ko'rinish + kadr olish */
                  <div className="space-y-2">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-44 object-cover rounded-lg bg-black"
                    />
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={capturePhoto}>
                        <Camera className="h-4 w-4 mr-2" />
                        Suratga olish
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={stopCamera}>
                        Bekor qilish
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col items-center justify-center gap-1 h-24 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-primary-400 hover:bg-white transition-colors">
                      <Upload className="h-5 w-5 text-gray-400" />
                      <span className="text-xs text-gray-600 font-medium">Fayl tanlash</span>
                      <span className="text-[11px] text-gray-400">JPG, PNG, WEBP · 5 MB</span>
                      <input
                        type="file"
                        accept={GUEST_PHOTO_ACCEPT}
                        className="hidden"
                        onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex flex-col items-center justify-center gap-1 h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-white transition-colors"
                    >
                      <Camera className="h-5 w-5 text-gray-400" />
                      <span className="text-xs text-gray-600 font-medium">Kamera</span>
                      <span className="text-[11px] text-gray-400">Hoziroq suratga olish</span>
                    </button>
                    {/* Filial IP kamerasidan tanlash — mehmon qabulxonaga
                        kelganda kamera uni allaqachon suratga olgan bo'ladi */}
                    <button
                      type="button"
                      onClick={() => setFacePickerOpen(true)}
                      className="col-span-2 flex flex-col items-center justify-center gap-1 h-20 rounded-lg border-2 border-dashed border-primary-300 bg-primary-50/40 hover:border-primary-500 hover:bg-primary-50 transition-colors"
                    >
                      <Video className="h-5 w-5 text-primary-500" />
                      <span className="text-xs text-primary-700 font-medium">
                        Filial kamerasidan tanlash
                      </span>
                      <span className="text-[11px] text-primary-500/80">
                        Keyingi tashrifda avtomatik tanaladi
                      </span>
                    </button>
                  </div>
                )}
                {cameraError && <p className="text-xs text-red-500">{cameraError}</p>}
                {pickedFace && (
                  <p className="flex items-center gap-1.5 text-[11px] text-primary-700">
                    <Video className="h-3.5 w-3.5" />
                    {pickedFace.camera_name || pickedFace.camera_id} kamerasidan
                    {pickedFace.count > 1 && ` · ${pickedFace.count} ta surat`} — mehmon
                    saqlangach yuzi biriktiriladi
                  </p>
                )}
              </div>

              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium"
                onClick={backToGuestList}
              >
                <ArrowLeft className="h-4 w-4" />
                Mehmonlar ro'yxatiga qaytish
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Mehmonlar soni</label>
          <Input type="number" min="1" {...register("adults")} />
          {errors.adults && <p className="text-xs text-red-500">{errors.adults.message}</p>}
        </div>

        {/* Xonadagi qolgan mehmonlar ham ro'yxatga olinadi */}
        <CompanionGuests
          adults={adultsCount}
          mainGuestId={selectedGuestId || undefined}
          guests={guests}
          value={trimmedCompanions}
          onChange={setCompanions}
          required={guestsRequired}
          hotelId={activeRoom?.hotel_id || user?.hotel_id || undefined}
          onError={showError}
        />
        {companionsMissing > 0 && guestsRequired && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            Xonadagi har bir mehmon ro'yxatga olinishi kerak — yana{" "}
            {companionsMissing} ta mehmon kiritilishi zarur.
          </p>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium">Qo'shimcha izoh</label>
          <Input placeholder="Izoh..." {...register("notes")} />
        </div>

        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              {bookingType === "HOURLY"
                ? `Xona narxi (${hourCount} soat)`
                : `Xona narxi (${dialogNightCount} kecha)`}
            </span>
            <span className="text-sm font-semibold text-gray-900">{effectiveTotal.toLocaleString()} So'm</span>
          </div>

          {/* Chegirma: so'mda yoki foizda — qoida doirasida */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-600">
              Chegirma
              {discountLimitText && (
                <span className="mt-0.5 block text-[11px] font-normal text-gray-400">
                  {discountLimitText}
                </span>
              )}
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                // Qoidadagi chegara maydonning o'zida ham turadi
                max={
                  discountType === "PERCENT"
                    ? Math.min(discountRule.max_percent || 100, 100)
                    : Math.min(discountRule.max_amount || effectiveTotal, effectiveTotal)
                }
                disabled={!discountOpen}
                title={discountBlockText || undefined}
                className="h-8 w-28 text-right disabled:cursor-not-allowed disabled:bg-gray-100"
                placeholder="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-gray-100"
                value={discountType}
                disabled={!discountOpen}
                title={discountBlockText || undefined}
                onChange={(e) => {
                  setDiscountType(e.target.value as "AMOUNT" | "PERCENT")
                  setDiscountValue("")
                }}
              >
                <option value="AMOUNT">So'm</option>
                <option value="PERCENT">%</option>
              </select>
            </div>
          </div>

          {!discountOpen && discountBlockText ? (
            <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
              {discountBlockText}
            </p>
          ) : (
            discountError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {discountError}
              </p>
            )
          )}

          {/* Chegirma qo'llangan bo'lsa — yakuniy jami */}
          {discountAmount > 0 && (
            <div className="flex justify-between items-center border-t border-gray-200 pt-2">
              <span className="text-sm font-medium text-gray-700">
                Jami to'lov{" "}
                <span className="text-xs font-normal text-red-500">
                  (−{discountAmount.toLocaleString()} So'm chegirma)
                </span>
              </span>
              <span className="text-sm font-bold text-primary-700">
                {finalTotal.toLocaleString()} So'm
              </span>
            </div>
          )}

          <div className="border-t border-gray-200 pt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              To'lov summasi
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="payment_amount"
                type="number"
                min={0}
                max={finalTotal}
                placeholder="0"
                {...register("payment_amount", { valueAsNumber: true })}
              />
              <select
                className="w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                {...register("payment_method")}
              >
                <option value="">To'lov turini tanlang</option>
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            {errors.payment_method && <p className="text-xs text-red-500 mt-1">{errors.payment_method.message}</p>}

            {/* Qisman (bo'lib) to'lov: qo'shimcha qatorlar — masalan bir
                qismi naqd, qolgani bank kartasi bilan */}
            {extraPayments.map((p, i) => (
              <div key={i} className="mt-2 flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={p.amount}
                  onChange={(e) => updateExtraPayment(i, { amount: e.target.value })}
                  className="flex-1"
                />
                <select
                  className="flex-1 flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={p.method}
                  onChange={(e) => updateExtraPayment(i, { method: e.target.value })}
                >
                  <option value="">To'lov turini tanlang</option>
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeExtraPayment(i)}
                  className="flex-shrink-0 p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                  title="Qatorni o'chirish"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={addExtraPayment}
                className="text-xs font-medium text-primary-700 hover:text-primary-800"
              >
                + To'lov usulini qo'shish
              </button>
              {(extraPayments.length > 0 || paidTotal > 0) && (
                <span
                  className={cn(
                    "text-xs text-right",
                    finalTotal > 0 && paidTotal > finalTotal
                      ? "text-red-500 font-medium"
                      : "text-gray-500"
                  )}
                >
                  Jami to'lov: {paidTotal.toLocaleString()} So'm
                  {finalTotal > 0 && paidTotal <= finalTotal && remainingAmount > 0 && (
                    <> · Qolgan: {remainingAmount.toLocaleString()} So'm</>
                  )}
                  {finalTotal > 0 && paidTotal > finalTotal && " (narxdan oshiq!)"}
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            disabled={
              createReservationMutation.isPending ||
              createGuestMutation.isPending ||
              photoUploading ||
              selectedTimeConflict ||
              dailyRangeConflict ||
              // Xona holati yo'l qo'ymasa tugma ham bosilmaydi — xodim
              // xatoni bosgandan keyin emas, oldin ko'radi
              !!roomBlockReason ||
              !!discountError ||
              (guestsRequired && companionsMissing > 0)
            }
          >
            {(createReservationMutation.isPending ||
              createGuestMutation.isPending ||
              photoUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tasdiqlash
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
      {/* Filial kamerasidan yuz tanlash. Filial bron qilinayotgan xonadan
          olinadi — boshqa filialning suratlari bu yerga tushmaydi. */}
      <FacePickerDialog
        open={facePickerOpen}
        onOpenChange={setFacePickerOpen}
        branchId={activeBranchId}
        onSelect={handleFacePicked}
      />

      {/* Ichki xato dialogi — chaqiruvchi o'zinikini bermagan bo'lsa */}
      <Dialog open={!!localError} onOpenChange={(o) => !o && setLocalError(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Xatolik</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-line py-2 text-sm text-gray-700">{localError}</p>
          <DialogFooter>
            <Button onClick={() => setLocalError(null)}>Tushunarli</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
