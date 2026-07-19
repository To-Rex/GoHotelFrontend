import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  CheckCircle2,
  Clock,
  BedDouble,
  Loader2,
  Pencil,
  Ban,
  Upload,
  CalendarDays,
} from "lucide-react"
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameDay,
  isWithinInterval,
  parseISO,
  isToday,
  addDays,
} from "date-fns"

import {
  useReservations,
  useCreateReservation,
  useUpdateReservation,
  useCancelReservation,
} from "../api/reservations"
import { useRooms, useRoomTypes } from "@/features/rooms/api/rooms"
import {
  useGuests,
  useCreateGuest,
  uploadGuestFile,
  GUEST_PHOTO_ACCEPT,
  GUEST_PHOTO_MAX_BYTES,
} from "@/features/guests/api/guests"
import { useAuthStore } from "@/store/auth"
import { usePermissions } from "@/lib/permissions"

import { HourlyBoard } from "../components/HourlyBoard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const DAY_WIDTH = 120
const ROOM_COL_WIDTH = 200
const ROW_HEIGHT = 72

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-400 text-gray-900",
  CONFIRMED: "bg-blue-600 text-white",
  CHECKED_IN: "bg-emerald-600 text-white",
  CHECKED_OUT: "bg-gray-400 text-white",
  NO_SHOW: "bg-gray-500 text-white",
  CANCELLED: "bg-red-100 text-red-500 line-through",
}

const statusLabels: Record<string, string> = {
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlangan",
  CHECKED_IN: "Kirgan",
  CHECKED_OUT: "Chiqgan",
  NO_SHOW: "Kelmadi",
  CANCELLED: "Bekor qilingan",
}

const weekDays = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"]

function addDaysStr(dateStr: string, amount: number) {
  const d = parseISO(dateStr)
  return format(addDays(d, amount), "yyyy-MM-dd")
}

function dayDiff(startStr: string, endStr: string) {
  const start = parseISO(startStr)
  const end = parseISO(endStr)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

// Backend xatosidan o'qiladigan matn tuzish (FastAPI 422 -> detail massiv bo'lishi mumkin).
function apiErrorMessage(error: any): string {
  const detail = error?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : ""
        return field ? `${field}: ${d.msg}` : d.msg
      })
      .join("\n")
  }
  return "Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring."
}

// Vaqtni "HH:MM" ko'rinishiga normallash (ba'zi brauzerlar sekund qo'shib yuboradi:
// "14:00:00" -> "14:00"). Aks holda ISO datetime buzilib 422 xatosi keladi.
function normalizeTime(t?: string): string {
  if (!t) return "00:00"
  const [h = "00", m = "00"] = t.split(":")
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`
}

// Soatlik bron davomiyligi (soatlarda). Chiqish vaqti kirishdan kichik/teng bo'lsa
// keyingi kunga o'tadi (tunab qolish).
function hourlyDuration(inTime?: string, outTime?: string): number {
  if (!inTime || !outTime) return 0
  const [ih, im] = inTime.split(":").map(Number)
  const [oh, om] = outTime.split(":").map(Number)
  let mins = oh * 60 + om - (ih * 60 + im)
  if (mins <= 0) mins += 24 * 60
  return Math.max(1, Math.round((mins / 60) * 100) / 100)
}

// Kalendarда bron egallagan kunlarni aniqlash uchun samarali sanalar.
// Soatlik bronда backend check_out_date ni majburan check_in + 1 kun qilib saqlaydi,
// shuning uchun kun oralig'ини datetime maydonlaridan (sana qismidan) olamiz —
// aks holda 2 soatlik bron 2 kunni egallab ko'rinadi.
function resStartDate(r: any): string {
  if (r.booking_type === "HOURLY" && r.check_in_datetime) {
    return r.check_in_datetime.slice(0, 10)
  }
  return r.check_in_date
}

function resEndDate(r: any): string {
  if (r.booking_type === "HOURLY" && r.check_out_datetime) {
    return r.check_out_datetime.slice(0, 10)
  }
  return r.check_out_date
}

// Soatlik bron uchun "HH:MM" ko'rinishidagi vaqt (datetime satridan).
function resTimeRange(r: any): string {
  if (r.booking_type !== "HOURLY" || !r.check_in_datetime || !r.check_out_datetime) return ""
  return `${r.check_in_datetime.slice(11, 16)} - ${r.check_out_datetime.slice(11, 16)}`
}

// "HH:MM" -> kun boshidan o'tgan minutlar
function timeToMin(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number)
  return h * 60 + m
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

// Berilgan xona va sana uchun band vaqt oraliqlari (minutlarda, boshlanish bo'yicha
// saralangan). Tunab qoluvchi soatlik bronlar kun chegarasida kesiladi.
function busyIntervalsFor(list: any[], roomId: string, dateStr: string): Array<[number, number]> {
  const res: Array<[number, number]> = []
  for (const r of list) {
    if (r.room_id !== roomId || r.status === "CANCELLED" || r.booking_type !== "HOURLY") continue
    if (!r.check_in_datetime || !r.check_out_datetime) continue
    const ciDate = r.check_in_datetime.slice(0, 10)
    const coDate = r.check_out_datetime.slice(0, 10)
    const ciMin = timeToMin(r.check_in_datetime.slice(11, 16))
    const coMin = timeToMin(r.check_out_datetime.slice(11, 16))
    if (ciDate === dateStr && coDate === dateStr) res.push([ciMin, coMin])
    else if (ciDate === dateStr) res.push([ciMin, 24 * 60])
    else if (coDate === dateStr) res.push([0, coMin])
  }
  return res.sort((a, b) => a[0] - b[0])
}

// Birinchi bo'sh vaqt oralig'ini topish: avval kunduzgi (08:00 dan keyingi) slot
// afzal — 2 soatlik, bo'lmasa 1 soatlik, bo'lmasa 30 daqiqalik; kunduzi umuman
// joy bo'lmasa tungi vaqtlardan izlanadi.
function findFreeSlot(busy: Array<[number, number]>): [number, number] | null {
  for (const preferStart of [8 * 60, 0]) {
    for (const dur of [120, 60, 30]) {
      let cursor = preferStart
      let found: [number, number] | null = null
      for (const [bs, be] of busy) {
        if (bs - cursor >= dur) {
          found = [cursor, cursor + dur]
          break
        }
        cursor = Math.max(cursor, be)
      }
      if (!found && 24 * 60 - cursor >= dur) found = [cursor, cursor + dur]
      if (found) return found
    }
  }
  return null
}

export function BookingPage() {
  // Sahifa tablari: "calendar" — avvalgi oylik kalendar (o'zgarishsiz),
  // "hourly" — kalendarsiz, bir kunlik soatlik bron taxtasi.
  const [activeTab, setActiveTab] = useState<"calendar" | "hourly">("calendar")
  const [hourlyDate, setHourlyDate] = useState(() => format(new Date(), "yyyy-MM-dd"))

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null)
  const [selectionStart, setSelectionStart] = useState<string | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [guestSearch, setGuestSearch] = useState("")
  const [showNewGuest, setShowNewGuest] = useState(false)

  // Yangi mehmon surati (passport rasmi / mehmon fotosi)
  const [guestPhoto, setGuestPhoto] = useState<File | null>(null)
  const [guestPhotoPreview, setGuestPhotoPreview] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)

  // Tanlangan faylni tekshirib, oldindan ko'rish uchun URL tayyorlash
  const handlePhotoChange = (file: File | null) => {
    if (guestPhotoPreview) URL.revokeObjectURL(guestPhotoPreview)
    if (!file) {
      setGuestPhoto(null)
      setGuestPhotoPreview(null)
      return
    }
    if (!GUEST_PHOTO_ACCEPT.split(",").includes(file.type)) {
      setErrorDialog("Faqat JPG, PNG yoki WEBP formatdagi rasm yuklash mumkin.")
      return
    }
    if (file.size > GUEST_PHOTO_MAX_BYTES) {
      setErrorDialog("Rasm hajmi 5 MB dan oshmasligi kerak.")
      return
    }
    setGuestPhoto(file)
    setGuestPhotoPreview(URL.createObjectURL(file))
  }

  const clearGuestPhoto = () => handlePhotoChange(null)
  const [selectedGuestId, setSelectedGuestId] = useState<string>("")
  const [bookingType, setBookingType] = useState<"DAILY" | "HOURLY">("DAILY")

  // Xato xabarini brauzer alert() o'rniga dialog sifatida ko'rsatish
  const [errorDialog, setErrorDialog] = useState<string | null>(null)

  // Bir kunga bir nechta bron bo'lganda ro'yxatni ko'rsatadigan dialog
  const [dayList, setDayList] = useState<{
    roomId: string
    roomNumber: string
    date: string
  } | null>(null)

  // Bronni boshqarish (ko'rish / tahrirlash / bekor qilish) modali holati
  const [manageOpen, setManageOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [cancelMode, setCancelMode] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [editValues, setEditValues] = useState<any>({})

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const { data: roomsData = [], isLoading: roomsLoading } = useRooms()

  // Xonalarni doim barqaror tartibda (xona raqami bo'yicha) ko'rsatamiz —
  // aks holda bron bekor qilinganda API xonalarni boshqa tartibda qaytarib,
  // kalendar qatorlari joyi almashib ketadi.
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

  // Ruxsatlar: tugma va amallar shularga qarab ko'rsatiladi
  const { can } = usePermissions()
  const canCreate = can("reservation.create")
  const canUpdate = can("reservation.update")
  const canCancel = can("reservation.cancel")
  const canCreateGuest = can("guest.create")

  const createReservationMutation = useCreateReservation()
  const createGuestMutation = useCreateGuest()
  const updateReservationMutation = useUpdateReservation()
  const cancelReservationMutation = useCancelReservation()

  // Ro'yxat dialogidagi bronlar — reservations o'zgarsa (tahrir/bekor) yangilanadi
  const dayListItems = useMemo(() => {
    if (!dayList) return []
    return reservations
      .filter(
        (r) =>
          r.room_id === dayList.roomId &&
          r.status !== "CANCELLED" &&
          r.booking_type === "HOURLY" &&
          resStartDate(r) === dayList.date
      )
      .sort((a, b) => (a.check_in_datetime || "").localeCompare(b.check_in_datetime || ""))
  }, [dayList, reservations])

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const rt of roomTypesData) {
      map[rt.id] = rt.base_price ?? 0
    }
    return map
  }, [roomTypesData])

  const getRoomPrice = useCallback(
    (room: any): number => {
      if (room.base_price && room.base_price > 0) return room.base_price
      if (room.room_type_id && priceMap[room.room_type_id]) return priceMap[room.room_type_id]
      return 0
    },
    [priceMap]
  )

  const filteredGuests = useMemo(() => {
    let list = guests
    // Mehmonlarni tanlangan xonaning mehmonxonasi bo'yicha filtrlaymiz — aks holda
    // boshqa hoteldagi mehmonni tanlab qo'yish 404 (Guest not found) beradi.
    if (selectedRoom?.hotel_id) {
      list = list.filter((g) => g.hotel_id === selectedRoom.hotel_id)
    }
    if (!guestSearch.trim()) return list.slice(0, 20)
    const q = guestSearch.toLowerCase()
    return list
      .filter(
        (g) =>
          g.first_name?.toLowerCase().includes(q) ||
          g.last_name?.toLowerCase().includes(q) ||
          g.phone?.includes(q)
      )
      .slice(0, 20)
  }, [guests, guestSearch, selectedRoom])

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
      // Passport / hujjat ma'lumotlari (ixtiyoriy)
      new_guest_passport_number: z.string().optional(),
      new_guest_id_document_type: z.string().optional(),
      new_guest_id_document_number: z.string().optional(),
      new_guest_birth_date: z.string().optional(),
      new_guest_nationality: z.string().optional(),
      new_guest_address: z.string().optional(),
      payment_amount: z.coerce.number().min(0).optional(),
      payment_method: z.string().optional(),
    })
    .refine(
      (data) => {
        if (!data.guest_id && !data.new_guest_first_name) return false
        return true
      },
      { message: "Mehmonni tanlang yoki yangi mehmon ismini kiriting", path: ["guest_id"] }
    )
    .refine(
      (data) => {
        if (data.payment_amount && data.payment_amount > 0 && !data.payment_method) return false
        return true
      },
      { message: "To'lov summasi kiritilganda to'lov turini tanlash majburiy", path: ["payment_method"] }
    )
    .refine(
      (data) => {
        if (data.booking_type === "HOURLY") {
          return !!data.check_in_time && !!data.check_out_time
        }
        return true
      },
      { message: "Soatlik bron uchun kirish va chiqish vaqtini kiriting", path: ["check_in_time"] }
    )

  type BookingForm = z.infer<typeof reservationSchema>

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookingForm>({
    resolver: zodResolver(reservationSchema) as any,
  })

  const roomReservations = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const r of reservations) {
      if (r.status === "CANCELLED") continue
      if (!map[r.room_id]) map[r.room_id] = []
      map[r.room_id].push(r)
    }
    return map
  }, [reservations])

  // Kun faqat KUNLIK bron bilan band hisoblanadi. Soatlik bronlar kunni to'liq
  // egallamaydi — o'sha kunning boshqa soatlariga yangi bron qilish mumkin
  // (vaqt kesishuvini backend tekshiradi).
  const isDateOccupied = useCallback(
    (roomId: string, date: Date): boolean => {
      const roomRes = roomReservations[roomId] || []
      for (const r of roomRes) {
        if (!r.check_in_date || !r.check_out_date) continue
        if (r.booking_type === "HOURLY") continue
        const checkIn = parseISO(resStartDate(r))
        const checkOut = parseISO(resEndDate(r))
        if (
          isWithinInterval(date, { start: checkIn, end: checkOut }) ||
          isSameDay(date, checkIn) ||
          isSameDay(date, checkOut)
        ) {
          return true
        }
      }
      return false
    },
    [roomReservations]
  )

  const handleCellClick = (room: any, date: Date) => {
    // Bron yaratish ruxsati bo'lmasa — kunlarni tanlash ham mantiqsiz
    if (!canCreate) return
    if (isDateOccupied(room.id, date)) return

    const dateStr = format(date, "yyyy-MM-dd")

    if (!selectedRoom || selectedRoom.id !== room.id) {
      setSelectedRoom(room)
      setSelectionStart(dateStr)
      setSelectionEnd(dateStr)
      return
    }

    if (!selectionStart) {
      setSelectionStart(dateStr)
      setSelectionEnd(dateStr)
      return
    }

    const startDate = parseISO(selectionStart)
    if (date < startDate) {
      setSelectionStart(dateStr)
      setSelectionEnd(dateStr)
      return
    }

    const rangeEnd = eachDayOfInterval({ start: startDate, end: date })
    const hasOccupied = rangeEnd.some((d) => isDateOccupied(room.id, d))
    if (hasOccupied) {
      setSelectionStart(dateStr)
      setSelectionEnd(dateStr)
      return
    }

    setSelectionEnd(dateStr)
  }

  const isInSelectionRange = (roomId: string, date: Date): boolean => {
    if (!selectedRoom || selectedRoom.id !== roomId) return false
    if (!selectionStart || !selectionEnd) return false
    const start = parseISO(selectionStart)
    const end = parseISO(selectionEnd)
    return (
      isWithinInterval(date, { start, end }) ||
      isSameDay(date, start) ||
      isSameDay(date, end)
    )
  }

  const isSelectionStartDay = (date: Date): boolean => {
    if (!selectionStart) return false
    return isSameDay(date, parseISO(selectionStart))
  }

  const isSelectionEndDay = (date: Date): boolean => {
    if (!selectionEnd) return false
    return isSameDay(date, parseISO(selectionEnd))
  }

  const getGuestName = (reservation: any): string => {
    if (reservation.guest) {
      return `${reservation.guest.first_name} ${reservation.guest.last_name || ''}`
    }
    const g = guests.find((x) => x.id === reservation.guest_id)
    return g ? `${g.first_name} ${g.last_name || ''}` : reservation.reservation_number || 'Band'
  }

  const openBookingModal = () => {
    // Tanlangan kunda soatlik bronlar bo'lsa — foydalanuvchi katta ehtimol yana
    // soat qo'shmoqchi, shuning uchun standart turni "Soatlik" qilamiz.
    const hasHourlyOnDay =
      !!selectedRoom &&
      !!selectionStart &&
      selectionStart === selectionEnd &&
      reservations.some(
        (r) =>
          r.room_id === selectedRoom.id &&
          r.status !== "CANCELLED" &&
          r.booking_type === "HOURLY" &&
          resStartDate(r) === selectionStart
      )
    const initialType: "DAILY" | "HOURLY" = hasHourlyOnDay ? "HOURLY" : "DAILY"
    // Soatlik rejimda band soatlarni chetlab, birinchi bo'sh vaqtni avtomatik tanlaymiz
    let inT = "14:00"
    let outT = "16:00"
    if (initialType === "HOURLY" && selectedRoom && selectionStart) {
      const busy = busyIntervalsFor(reservations, selectedRoom.id, selectionStart)
      const slot = findFreeSlot(busy)
      if (slot) {
        inT = minToTime(slot[0])
        outT = minToTime(slot[1])
      }
    }
    setBookingType(initialType)
    setValue("booking_type", initialType)
    setValue("room_id", selectedRoom?.id || "")
    setValue("check_in_date", selectionStart || "")
    setValue("check_out_date", selectionEnd ? addDaysStr(selectionEnd, 1) : "")
    setValue("check_in_time", inT)
    setValue("check_out_time", outT)
    setValue("adults", 1)
    setValue("children", 0)
    setValue("guest_id", "")
    // To'lov summasini umumiy narx bilan avtomatik to'ldirish
    setValue(
      "payment_amount",
      initialType === "HOURLY"
        ? Math.round((getRoomPrice(selectedRoom || {}) / 24) * hourlyDuration(inT, outT))
        : totalPrice
    )
    setValue("payment_method", "CASH")
    setSelectedGuestId("")
    setGuestSearch("")
    setModalOpen(true)
  }

  // Soatlik taxtada bo'sh oraliq bosilganda — o'sha xona/kun/vaqt bilan
  // xuddi shu "Yangi bandlov" modalini soatlik rejimda ochamiz.
  const openHourlyModal = (room: any, startMin: number, endMin: number) => {
    const inT = minToTime(startMin)
    const outT = minToTime(endMin)
    setSelectedRoom(room)
    setSelectionStart(hourlyDate)
    setSelectionEnd(hourlyDate)
    setBookingType("HOURLY")
    setValue("booking_type", "HOURLY")
    setValue("room_id", room.id)
    setValue("check_in_date", hourlyDate)
    setValue("check_out_date", addDaysStr(hourlyDate, 1))
    setValue("check_in_time", inT)
    setValue("check_out_time", outT)
    setValue("adults", 1)
    setValue("children", 0)
    setValue("guest_id", "")
    setValue(
      "payment_amount",
      Math.round((getRoomPrice(room) / 24) * hourlyDuration(inT, outT))
    )
    setValue("payment_method", "CASH")
    setSelectedGuestId("")
    setGuestSearch("")
    setModalOpen(true)
  }

  const onSubmit = async (values: BookingForm) => {
    // Surat yuklanmay qolsa — bron yaratilgandan keyin ogohlantiramiz
    let photoUploadFailed = false
    try {
      // Bron aynan bir xona uchun — branch_id va hotel_id ni o'sha xonadan olamiz.
      // (Foydalanuvchida hotel/branch bo'lmasligi mumkin: masalan SUPER_ADMIN.)
      const chosenRoom =
        selectedRoom?.id === values.room_id
          ? selectedRoom
          : rooms.find((r) => r.id === values.room_id)
      const branchId = chosenRoom?.branch_id || user?.branch_id || ""
      const hotelId = chosenRoom?.hotel_id || user?.hotel_id || undefined

      let guestId = values.guest_id

      if (!guestId && values.new_guest_first_name) {
        const guest = await createGuestMutation.mutateAsync({
          first_name: values.new_guest_first_name,
          last_name: values.new_guest_last_name || "",
          phone: values.new_guest_phone || undefined,
          // Passport / hujjat ma'lumotlari — bo'sh maydonlar yuborilmaydi
          passport_number: values.new_guest_passport_number || undefined,
          id_document_type: values.new_guest_id_document_type || undefined,
          id_document_number: values.new_guest_id_document_number || undefined,
          birth_date: values.new_guest_birth_date || undefined,
          nationality: values.new_guest_nationality || undefined,
          address: values.new_guest_address || undefined,
          hotelId,
        })
        guestId = guest.id

        // Surat tanlangan bo'lsa — mehmon yaratilgandan keyin yuklaymiz.
        // Yuklash muvaffaqiyatsiz bo'lsa bron yaratish to'xtatilmaydi, faqat
        // oxirida ogohlantirish ko'rsatiladi (mehmon va bron saqlanib qoladi).
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
      }

      const basePayload = {
        guest_id: guestId || "",
        room_id: values.room_id,
        branch_id: branchId,
        hotelId,
        adults: values.adults,
        children: values.children || 0,
        notes: values.notes,
        payment_amount: values.payment_amount || 0,
        payment_method: (values.payment_method as any) || null,
      }

      let payload: any
      if (values.booking_type === "HOURLY") {
        const inTime = normalizeTime(values.check_in_time)
        const outTime = normalizeTime(values.check_out_time)
        // Chiqish vaqti kirishdan kichik/teng bo'lsa keyingi kunga o'tadi (tunab qolish).
        const overnight = outTime <= inTime
        const checkInDate = values.check_in_date
        const checkOutDate = overnight ? addDaysStr(checkInDate, 1) : checkInDate

        // Band soat bilan kesishishga yo'l qo'ymaymiz — bo'sh vaqt tanlanishi shart
        const busy = busyIntervalsFor(reservations, values.room_id, checkInDate)
        const s = timeToMin(inTime)
        const eClamped = overnight ? 24 * 60 : timeToMin(outTime)
        if (busy.some(([bs, be]) => bs < eClamped && be > s)) {
          setErrorDialog(
            "Tanlangan vaqt oralig'i band soatlar bilan kesishadi. Iltimos, bo'sh vaqtni tanlang."
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
        payload = {
          ...basePayload,
          booking_type: "DAILY",
          check_in_date: values.check_in_date,
          check_out_date: values.check_out_date,
        }
      }

      await createReservationMutation.mutateAsync(payload)

      setModalOpen(false)
      setSelectedRoom(null)
      setSelectionStart(null)
      setSelectionEnd(null)
      setShowNewGuest(false)
      setSelectedGuestId("")
      setBookingType("DAILY")
      clearGuestPhoto()
      reset()

      if (photoUploadFailed) {
        setErrorDialog(
          "Bron va mehmon saqlandi, lekin suratni yuklab bo'lmadi. Suratni keyinroq qayta yuklashingiz mumkin."
        )
      }
    } catch (error: any) {
      console.error(error)
      setErrorDialog(apiErrorMessage(error))
    }
  }

  // Bron chizig'iga bosilganda boshqaruv modalini ochish
  const openManageModal = (res: any) => {
    const isHourly = res.booking_type === "HOURLY"
    setSelectedReservation(res)
    setEditValues({
      booking_type: res.booking_type || "DAILY",
      check_in_date: resStartDate(res),
      check_out_date: isHourly ? resStartDate(res) : res.check_out_date,
      check_in_time: isHourly ? (res.check_in_datetime || "").slice(11, 16) || "14:00" : "14:00",
      check_out_time: isHourly ? (res.check_out_datetime || "").slice(11, 16) || "16:00" : "16:00",
      adults: res.adults ?? 1,
      children: res.children ?? 0,
      notes: res.notes || "",
    })
    setEditMode(false)
    setCancelMode(false)
    setCancelReason("")
    setManageOpen(true)
  }

  const closeManageModal = () => {
    setManageOpen(false)
    setSelectedReservation(null)
    setEditMode(false)
    setCancelMode(false)
    setCancelReason("")
  }

  const handleUpdateReservation = async () => {
    if (!selectedReservation) return
    try {
      const ev = editValues
      const base = {
        id: selectedReservation.id,
        hotelId: selectedReservation.hotel_id || undefined,
        adults: Number(ev.adults) || 1,
        children: Number(ev.children) || 0,
        notes: ev.notes || "",
      }
      let payload: any
      if (ev.booking_type === "HOURLY") {
        const inTime = normalizeTime(ev.check_in_time)
        const outTime = normalizeTime(ev.check_out_time)
        const overnight = outTime <= inTime
        const checkInDate = ev.check_in_date
        // Chiqish vaqtining kuni (tunab qolsa keyingi kun)
        const outDatetimeDate = overnight ? addDaysStr(checkInDate, 1) : checkInDate
        // DB cheklovi (check_out_date > check_in_date) uchun sana maydonini har doim
        // +1 kun qilamiz; haqiqiy vaqt oralig'i datetime maydonlarida saqlanadi.
        const checkOutDateField = addDaysStr(checkInDate, 1)
        payload = {
          ...base,
          booking_type: "HOURLY",
          check_in_date: checkInDate,
          check_out_date: checkOutDateField,
          check_in_datetime: `${checkInDate}T${inTime}:00`,
          check_out_datetime: `${outDatetimeDate}T${outTime}:00`,
        }
      } else {
        if (ev.check_out_date <= ev.check_in_date) {
          setErrorDialog("Chiqish sanasi kirish sanasidan keyin bo'lishi kerak.")
          return
        }
        payload = {
          ...base,
          booking_type: "DAILY",
          check_in_date: ev.check_in_date,
          check_out_date: ev.check_out_date,
        }
      }
      await updateReservationMutation.mutateAsync(payload)
      closeManageModal()
    } catch (error: any) {
      console.error(error)
      setErrorDialog(apiErrorMessage(error))
    }
  }

  const handleCancelReservation = async () => {
    if (!selectedReservation) return
    try {
      await cancelReservationMutation.mutateAsync({
        id: selectedReservation.id,
        reason: cancelReason || undefined,
        hotelId: selectedReservation.hotel_id || undefined,
      })
      closeManageModal()
    } catch (error: any) {
      console.error(error)
      setErrorDialog(apiErrorMessage(error))
    }
  }

  // --- Bron chizig'ini surib (drag) boshqa kunga ko'chirish ---
  // Bosish (4px dan kam siljish) avvalgidek boshqaruv modalini ochadi;
  // surish esa bronni gorizontal ravishda kunlar bo'ylab ko'chiradi.
  const [dragRes, setDragRes] = useState<any | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const dragStartX = useRef(0)
  const dragOffsetRef = useRef(0)
  const dragMoved = useRef(false)

  // Surib ko'chirishni tasdiqlash dialogi (window.confirm o'rniga)
  const [moveConfirm, setMoveConfirm] = useState<{
    res: any
    offset: number
    from: string
    to: string
  } | null>(null)

  const performMove = async () => {
    if (!moveConfirm) return
    const { res, offset, from } = moveConfirm
    try {
      if (res.booking_type === "HOURLY") {
        const ciDt = res.check_in_datetime || `${from}T14:00:00`
        const coDt = res.check_out_datetime || `${from}T16:00:00`
        const newCiDate = addDaysStr(ciDt.slice(0, 10), offset)
        const newCoDate = addDaysStr(coDt.slice(0, 10), offset)
        await updateReservationMutation.mutateAsync({
          id: res.id,
          hotelId: res.hotel_id || undefined,
          booking_type: "HOURLY",
          check_in_date: newCiDate,
          // DB cheklovi (check_out_date > check_in_date) uchun +1 kun
          check_out_date: addDaysStr(newCiDate, 1),
          check_in_datetime: `${newCiDate}T${ciDt.slice(11, 19) || "00:00:00"}`,
          check_out_datetime: `${newCoDate}T${coDt.slice(11, 19) || "00:00:00"}`,
        })
      } else {
        await updateReservationMutation.mutateAsync({
          id: res.id,
          hotelId: res.hotel_id || undefined,
          booking_type: res.booking_type || "DAILY",
          check_in_date: addDaysStr(res.check_in_date, offset),
          check_out_date: addDaysStr(res.check_out_date, offset),
        })
      }
      setMoveConfirm(null)
    } catch (error: any) {
      console.error(error)
      setMoveConfirm(null)
      setErrorDialog(apiErrorMessage(error))
    }
  }

  const handleBarMouseDown = (e: React.MouseEvent, res: any) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragStartX.current = e.clientX
    dragOffsetRef.current = 0
    dragMoved.current = false
    setDragOffset(0)
    setDragRes(res)
  }

  useEffect(() => {
    if (!dragRes) return

    // Tahrirlash ruxsati bo'lmasa surib ko'chirish ishlamaydi (bosish — ko'rish uchun qoladi)
    const locked =
      !canUpdate || ["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(dragRes.status)

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartX.current
      if (Math.abs(dx) > 4) dragMoved.current = true
      if (!locked) {
        const off = Math.round(dx / DAY_WIDTH)
        if (off !== dragOffsetRef.current) {
          dragOffsetRef.current = off
          setDragOffset(off)
        }
      }
    }

    const onUp = async () => {
      const res = dragRes
      const offset = dragOffsetRef.current
      setDragRes(null)
      setDragOffset(0)

      // Siljimagan bo'lsa — oddiy bosish: boshqaruv modalini ochamiz
      if (!dragMoved.current) {
        openManageModal(res)
        return
      }
      if (locked || offset === 0) return

      const fromDate = resStartDate(res)
      const toDate = addDaysStr(fromDate, offset)
      // Tasdiqlashni dialog orqali so'raymiz (window.confirm o'rniga)
      setMoveConfirm({ res, offset, from: fromDate, to: toDate })
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragRes])

  const clearSelection = () => {
    setSelectedRoom(null)
    setSelectionStart(null)
    setSelectionEnd(null)
  }

  const nightCount =
    selectionStart && selectionEnd
      ? dayDiff(selectionStart, selectionEnd) + 1
      : 0

  const roomPrice = selectedRoom ? getRoomPrice(selectedRoom) : 0
  const totalPrice = nightCount * roomPrice

  // Soatlik bron uchun reaktiv hisob-kitob (modaldagi vaqt maydonlariga bog'liq)
  const watchInTime = watch("check_in_time")
  const watchOutTime = watch("check_out_time")
  const hourCount =
    bookingType === "HOURLY" ? hourlyDuration(watchInTime, watchOutTime) : 0
  const hourlyTotal = Math.round((roomPrice / 24) * hourCount)

  // Yangi bandlov dialogida tanlangan sana/xona uchun band soat oraliqlari
  const watchFormDate = watch("check_in_date")
  const watchFormRoom = watch("room_id")
  const dialogBusyTimes = useMemo(() => {
    if (!modalOpen || bookingType !== "HOURLY") return []
    const roomId = selectedRoom?.id || watchFormRoom
    if (!roomId || !watchFormDate) return []
    return busyIntervalsFor(reservations, roomId, watchFormDate)
  }, [modalOpen, bookingType, selectedRoom, watchFormRoom, watchFormDate, reservations])

  // Tanlangan vaqt band oraliqlar bilan kesishadimi (dialogda ogohlantirish uchun)
  const selectedTimeConflict = useMemo(() => {
    if (bookingType !== "HOURLY" || !watchInTime || !watchOutTime) return false
    const s = timeToMin(normalizeTime(watchInTime))
    const e = timeToMin(normalizeTime(watchOutTime))
    const eClamped = e <= s ? 24 * 60 : e // tunab qolsa shu kunning oxirigacha tekshiramiz
    return dialogBusyTimes.some(([bs, be]) => bs < eClamped && be > s)
  }, [bookingType, watchInTime, watchOutTime, dialogBusyTimes])
  const effectiveTotal = bookingType === "HOURLY" ? hourlyTotal : totalPrice

  const calendarWidth = days.length * DAY_WIDTH

  return (
    // Layout booking sahifasini "full bleed" qilib beradi (padding/max-width yo'q),
    // shuning uchun bu yerda h-full bilan mavjud balandlikni to'liq egallaymiz.
    <div className="flex flex-col h-full w-full min-w-0">
      {/* Tablar: Kalendar (oylik ko'rinish) / Soatlik bron (bir kunlik taxta) */}
      <div className="flex-shrink-0 flex items-center gap-1 px-6 pt-3 bg-white border-b border-gray-200">
        {([
          { key: "calendar", label: "Kalendar", icon: CalendarDays },
          { key: "hourly", label: "Soatlik bron", icon: Clock },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "hourly" ? (
        <HourlyBoard
          date={hourlyDate}
          onDateChange={setHourlyDate}
          rooms={rooms}
          reservations={reservations}
          onSlotClick={openHourlyModal}
          onReservationClick={openManageModal}
          canCreate={canCreate}
          getRoomPrice={getRoomPrice}
          getGuestName={getGuestName}
          statusColors={statusColors}
        />
      ) : (
      <>
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-bold text-gray-900 min-w-[200px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>
            Bugun
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {selectedRoom && selectionStart && selectionEnd && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
              <span className="font-semibold text-gray-900">{selectedRoom.room_number}</span>
              <span>·</span>
              <span>{selectionStart} → {selectionEnd}</span>
              <span>·</span>
              <span>{nightCount} kecha</span>
              <span>·</span>
              <span className="font-medium text-primary-700">{totalPrice.toLocaleString()} So'm</span>
              <button
                onClick={clearSelection}
                className="ml-2 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 flex items-center gap-5 px-6 py-2 bg-white border-b border-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-600" />
          <span>Tasdiqlangan</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-600" />
          <span>Kirgan</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-400" />
          <span>Kutilmoqda</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary-100 border border-primary-300" />
          <span>Tanlangan</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-400" />
          <span>Chiqgan</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {roomsLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="min-w-max h-full">
            {/* Header row */}
            <div className="sticky top-0 z-30 flex bg-white border-b border-gray-200 shadow-sm">
              <div
                className="flex-shrink-0 h-14 flex items-center px-4 bg-gray-50 border-r border-gray-200 sticky left-0 z-40"
                style={{ width: ROOM_COL_WIDTH }}
              >
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Xonalar
                </span>
              </div>
              <div className="flex" style={{ width: calendarWidth }}>
                {days.map((day) => {
                  const weekend = day.getDay() === 0 || day.getDay() === 6
                  const today = isToday(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "flex-shrink-0 border-r border-gray-200 flex flex-col items-center justify-center h-14",
                        today && "bg-primary-50",
                        weekend && !today && "bg-gray-50"
                      )}
                      style={{ width: DAY_WIDTH }}
                    >
                      <span
                        className={cn(
                          "text-xs font-medium",
                          today ? "text-primary-700" : weekend ? "text-red-400" : "text-gray-400"
                        )}
                      >
                        {weekDays[(day.getDay() + 6) % 7]}
                      </span>
                      <span
                        className={cn(
                          "text-lg font-bold",
                          today ? "text-primary-700" : weekend ? "text-red-500" : "text-gray-900"
                        )}
                      >
                        {format(day, "dd")}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Room rows */}
            <div>
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex border-b border-gray-100 bg-white hover:bg-gray-50/50 transition-colors"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Room info - sticky left */}
                  <div
                    className="flex-shrink-0 flex flex-col justify-center px-4 bg-white border-r border-gray-200 sticky left-0 z-20"
                    style={{ width: ROOM_COL_WIDTH }}
                  >
                    <span className="text-sm font-bold text-gray-900">
                      {room.room_number}
                    </span>
                    <span className="text-xs text-gray-400 truncate">
                      {room.room_type?.name || "Standard"}
                    </span>
                    {getRoomPrice(room) > 0 && (
                      <span className="text-[10px] text-primary-600 font-medium">
                        {getRoomPrice(room).toLocaleString()} So'm
                      </span>
                    )}
                  </div>

                  {/* Day cells */}
                  <div
                    className="flex relative"
                    style={{ width: calendarWidth }}
                  >
                    {/* Grid lines */}
                    {days.map((day) => (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "flex-shrink-0 border-r border-gray-50 h-full",
                          canCreate ? "cursor-pointer" : "cursor-default",
                          isToday(day) && "bg-primary-50/30",
                          isInSelectionRange(room.id, day) && "bg-primary-100/70"
                        )}
                        style={{ width: DAY_WIDTH }}
                        onClick={() => handleCellClick(room, day)}
                      />
                    ))}

                    {/* Booking bars */}
                    {reservations
                      .filter(
                        (r) =>
                          r.room_id === room.id && r.status !== "CANCELLED" && r.check_in_date && r.check_out_date
                      )
                      .map((res) => {
                        const checkIn = parseISO(resStartDate(res))
                        const checkOut = parseISO(resEndDate(res))
                        const startDayIdx = days.findIndex((d) =>
                          isSameDay(d, checkIn)
                        )
                        const endDayIdx = days.findIndex((d) =>
                          isSameDay(d, checkOut)
                        )
                        if (startDayIdx === -1 && endDayIdx === -1) return null

                        const left =
                          startDayIdx >= 0
                            ? startDayIdx * DAY_WIDTH + 4
                            : 4
                        const width =
                          startDayIdx >= 0 && endDayIdx >= 0
                            ? (endDayIdx - startDayIdx + 1) * DAY_WIDTH - 8
                            : startDayIdx >= 0
                              ? (days.length - startDayIdx) * DAY_WIDTH - 8
                              : endDayIdx >= 0
                                ? (endDayIdx + 1) * DAY_WIDTH - 8
                                : calendarWidth - 8

                        const colorClass =
                          statusColors[res.status] || statusColors.PENDING

                        // Bir kunda bir nechta soatlik bron bo'lsa — ingichka chiziqlar
                        // o'rniga bitta "N ta bron" belgisi ko'rsatamiz (bosilsa ro'yxat).
                        if (res.booking_type === "HOURLY") {
                          const sameDay = reservations
                            .filter(
                              (r) =>
                                r.room_id === room.id &&
                                r.status !== "CANCELLED" &&
                                r.booking_type === "HOURLY" &&
                                resStartDate(r) === resStartDate(res)
                            )
                            .sort((a, b) =>
                              (a.check_in_datetime || "").localeCompare(b.check_in_datetime || "")
                            )
                          if (sameDay.length > 1 && startDayIdx >= 0) {
                            // Faqat guruhning birinchi a'zosi belgini chizadi
                            if (sameDay[0].id !== res.id) return null
                            return (
                              <div
                                key={res.id}
                                className="absolute top-2 h-12 rounded-xl shadow-sm flex items-center justify-center gap-2 z-10 select-none cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02] transition-all"
                                style={{
                                  left: startDayIdx * DAY_WIDTH + 4,
                                  width: DAY_WIDTH - 8,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDayList({
                                    roomId: room.id,
                                    roomNumber: room.room_number,
                                    date: resStartDate(res),
                                  })
                                }}
                                title="Bronlar ro'yxatini ko'rish"
                              >
                                <Clock className="h-4 w-4 flex-shrink-0" />
                                <span className="text-sm font-bold">
                                  {sameDay.length} ta bron
                                </span>
                              </div>
                            )
                          }
                        }

                        return (
                          <div
                            key={res.id}
                            className={cn(
                              "absolute top-2 h-12 rounded-xl shadow-sm flex items-center px-3 gap-2 z-10 select-none",
                              dragRes?.id === res.id
                                ? "cursor-grabbing z-30 ring-2 ring-primary-400 shadow-lg opacity-90"
                                : "cursor-pointer hover:scale-[1.01] transition-transform",
                              colorClass
                            )}
                            style={{
                              left,
                              width,
                              transform:
                                dragRes?.id === res.id && dragOffset !== 0
                                  ? `translateX(${dragOffset * DAY_WIDTH}px)`
                                  : undefined,
                            }}
                            onMouseDown={(e) => handleBarMouseDown(e, res)}
                            title="Bosish: boshqarish · Surish: boshqa kunga ko'chirish"
                          >
                            {res.status === "CONFIRMED" || res.status === "CHECKED_IN" ? (
                              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                            ) : res.status === "PENDING" ? (
                              <Clock className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <BedDouble className="h-4 w-4 flex-shrink-0" />
                            )}
                            <div className="overflow-hidden min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {getGuestName(res)}
                              </p>
                              <p className="text-[10px] opacity-80 truncate">
                                {res.booking_type === "HOURLY"
                                  ? `${resStartDate(res)} · ${resTimeRange(res)}`
                                  : `${res.check_in_date} → ${res.check_out_date}`}
                              </p>
                            </div>
                          </div>
                        )
                      })}

                    {/* Selection indicator */}
                    {selectedRoom?.id === room.id &&
                      selectionStart &&
                      selectionEnd &&
                      days.map((day) => {
                        if (!isInSelectionRange(room.id, day)) return null
                        const start = isSelectionStartDay(day)
                        const end = isSelectionEndDay(day)
                        const idx = days.findIndex((d) => isSameDay(d, day))
                        return (
                          <div
                            key={`sel-${day.toISOString()}`}
                            className={cn(
                              "absolute top-2 h-12 z-10 flex items-center justify-center text-[11px] font-bold pointer-events-none",
                              start && end
                                ? "bg-primary-500 text-white rounded-xl"
                                : start
                                  ? "bg-primary-500 text-white rounded-l-xl"
                                  : end
                                    ? "bg-primary-500 text-white rounded-r-xl"
                                    : "bg-primary-200/80 text-primary-800"
                            )}
                            style={{
                              left: idx * DAY_WIDTH + (start ? 4 : 0),
                              width:
                                start && end
                                  ? DAY_WIDTH - 8
                                  : start
                                    ? DAY_WIDTH - 4
                                    : end
                                      ? DAY_WIDTH - 4
                                      : DAY_WIDTH,
                            }}
                          >
                            {start && end ? "Kirish - Chiqish" : start ? "Kirish" : end ? "Chiqish" : ""}
                          </div>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="text-sm text-gray-500">
          {rooms.length} xonalar · {format(currentMonth, "MMMM yyyy")}
        </div>
        <div className="flex items-center gap-3">
          {canCreate ? (
            <>
              <Button variant="secondary" onClick={clearSelection} disabled={!selectedRoom}>
                Bekor qilish
              </Button>
              <Button
                onClick={openBookingModal}
                disabled={!selectedRoom || !selectionStart || !selectionEnd}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Tasdiqlash
              </Button>
            </>
          ) : (
            <span className="text-xs text-gray-400">
              Yangi bron yaratish uchun ruxsatingiz yo'q
            </span>
          )}
        </div>
      </div>
      </>
      )}

      {/* Booking Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
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
                    setBookingType(opt.key)
                    setValue("booking_type", opt.key)
                    if (opt.key === "HOURLY") {
                      // Band soatlarni chetlab birinchi bo'sh vaqtni avtomatik tanlaymiz
                      const roomId = selectedRoom?.id || watchFormRoom
                      const dateStr = watchFormDate || selectionStart || ""
                      const busy =
                        roomId && dateStr ? busyIntervalsFor(reservations, roomId, dateStr) : []
                      const slot = findFreeSlot(busy)
                      const inT = slot ? minToTime(slot[0]) : "14:00"
                      const outT = slot ? minToTime(slot[1]) : "16:00"
                      setValue("check_in_time", inT)
                      setValue("check_out_time", outT)
                      setValue(
                        "payment_amount",
                        Math.round((roomPrice / 24) * hourlyDuration(inT, outT))
                      )
                    } else {
                      setValue("payment_amount", totalPrice)
                    }
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

            {selectedRoom ? (
              <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg">
                <BedDouble className="h-5 w-5 text-primary-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedRoom.room_number}
                  </p>
                  {bookingType === "HOURLY" ? (
                    <p className="text-xs text-gray-500">
                      Soatlik bron{hourCount > 0 ? ` (${hourCount} soat)` : ""}
                    </p>
                  ) : (
                    selectionStart && selectionEnd && (
                      <p className="text-xs text-gray-500">
                        {selectionStart} → {selectionEnd} ({nightCount} kecha)
                      </p>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-sm font-medium">Xona *</label>
                <select
                  className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...register("room_id")}
                >
                  <option value="">Xonani tanlang</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.room_number} ({r.room_type?.name}) - {getRoomPrice(r)} So'm</option>
                  ))}
                </select>
                {errors.room_id && <p className="text-xs text-red-500">{errors.room_id.message}</p>}
              </div>
            )}

            {bookingType === "HOURLY" ? (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Sana *</label>
                  <Input type="date" {...register("check_in_date")} />
                  {errors.check_in_date && <p className="text-xs text-red-500">{errors.check_in_date.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Kirish vaqti *</label>
                    <Input type="time" {...register("check_in_time")} />
                    {errors.check_in_time && <p className="text-xs text-red-500">{errors.check_in_time.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Chiqish vaqti *</label>
                    <Input type="time" {...register("check_out_time")} />
                  </div>
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
                  <Input type="date" {...register("check_in_date")} />
                  {errors.check_in_date && <p className="text-xs text-red-500">{errors.check_in_date.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Chiqish sanasi *</label>
                  <Input type="date" {...register("check_out_date")} />
                  {errors.check_out_date && <p className="text-xs text-red-500">{errors.check_out_date.message}</p>}
                </div>
              </div>
            )}

            {/* Guest selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mehmon *
              </label>

              {!showNewGuest ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder="Mijozni qidirish..."
                      value={guestSearch}
                      onChange={(e) => setGuestSearch(e.target.value)}
                    />
                  </div>
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
                      onClick={() => setShowNewGuest(true)}
                    >
                      + Yangi mijoz qo'shish
                    </button>
                  )}
                  {errors.guest_id && <p className="text-xs text-red-500">{errors.guest_id.message}</p>}
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Telefon</label>
                      <Input placeholder="Telefon" {...register("new_guest_phone")} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Tug'ilgan sana</label>
                      <Input type="date" {...register("new_guest_birth_date")} />
                    </div>
                  </div>

                  {/* Passport / hujjat ma'lumotlari */}
                  <div className="pt-2 border-t border-gray-200 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Hujjat ma'lumotlari
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Passport raqami</label>
                        <Input placeholder="AA1234567" {...register("new_guest_passport_number")} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Fuqaroligi</label>
                        <Input placeholder="O'zbekiston" {...register("new_guest_nationality")} />
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
                        <label className="text-xs font-medium">Hujjat raqami</label>
                        <Input placeholder="Hujjat raqami" {...register("new_guest_id_document_number")} />
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
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-1 h-24 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-primary-400 hover:bg-white transition-colors">
                        <Upload className="h-5 w-5 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          Passport surati yoki mehmon fotosini tanlang
                        </span>
                        <span className="text-[11px] text-gray-400">JPG, PNG, WEBP · maks. 5 MB</span>
                        <input
                          type="file"
                          accept={GUEST_PHOTO_ACCEPT}
                          className="hidden"
                          onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                  </div>

                  <button
                    type="button"
                    className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                    onClick={() => {
                      setShowNewGuest(false)
                      setValue("new_guest_first_name", "")
                      setValue("new_guest_last_name", "")
                      setValue("new_guest_phone", "")
                      setValue("new_guest_passport_number", "")
                      setValue("new_guest_id_document_type", "")
                      setValue("new_guest_id_document_number", "")
                      setValue("new_guest_birth_date", "")
                      setValue("new_guest_nationality", "")
                      setValue("new_guest_address", "")
                      clearGuestPhoto()
                    }}
                  >
                    Beketish
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Kattalar soni</label>
                <Input type="number" min="1" {...register("adults")} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Bolalar soni</label>
                <Input type="number" min="0" {...register("children")} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Qo'shimcha izoh</label>
              <Input placeholder="Izoh..." {...register("notes")} />
            </div>

            <div className="p-3 bg-gray-50 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {bookingType === "HOURLY"
                    ? `Xona narxi (${hourCount} soat)`
                    : `Xona narxi (${nightCount} kecha)`}
                </span>
                <span className="text-sm font-semibold text-gray-900">{effectiveTotal.toLocaleString()} So'm</span>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  To'lov summasi
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    id="payment_amount"
                    type="number"
                    min={0}
                    max={effectiveTotal}
                    placeholder="0"
                    {...register("payment_amount", { valueAsNumber: true })}
                  />
                  <select
                    className="w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    {...register("payment_method")}
                  >
                    <option value="">To'lov turini tanlang</option>
                    <option value="CASH">Naqd pul</option>
                    <option value="CREDIT_CARD">Kredit karta</option>
                    <option value="DEBIT_CARD">Debit karta</option>
                    <option value="BANK_TRANSFER">Bank o'tkazmasi</option>
                    <option value="MOBILE_PAYMENT">Mobil to'lov</option>
                    <option value="ONLINE">Onlayn</option>
                  </select>
                </div>
                {errors.payment_method && <p className="text-xs text-red-500 mt-1">{errors.payment_method.message}</p>}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Bekor qilish
              </Button>
              <Button
                type="submit"
                disabled={
                  createReservationMutation.isPending ||
                  createGuestMutation.isPending ||
                  photoUploading ||
                  selectedTimeConflict
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

      {/* Bronni boshqarish modali: ko'rish / tahrirlash / bekor qilish */}
      <Dialog open={manageOpen} onOpenChange={(o) => (o ? setManageOpen(true) : closeManageModal())}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedReservation && (() => {
            const res = selectedReservation
            const isHourly = editValues.booking_type === "HOURLY"
            // Yakunlangan holatdagi bronni tahrirlab ham, bekor qilib ham bo'lmaydi
            const statusLocked = ["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(res.status)
            // Tahrirlash / bekor qilish alohida ruxsatlarga bog'liq
            const locked = !canUpdate || statusLocked
            const cancelLocked = !canCancel || statusLocked
            const roomObj = rooms.find((r) => r.id === res.room_id)
            const saving = updateReservationMutation.isPending
            const cancelling = cancelReservationMutation.isPending
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Bron · {res.reservation_number || ""}
                    <span
                      className={cn(
                        "text-[11px] font-medium px-2 py-0.5 rounded-full",
                        statusColors[res.status] || statusColors.PENDING
                      )}
                    >
                      {statusLabels[res.status] || res.status}
                    </span>
                  </DialogTitle>
                </DialogHeader>

                <div className="py-3 space-y-4">
                  {/* Umumiy ma'lumot */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <BedDouble className="h-5 w-5 text-primary-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {getGuestName(res)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {roomObj?.room_number || res.room_id?.slice(0, 8)} ·{" "}
                        {res.booking_type === "HOURLY"
                          ? `${resStartDate(res)} · ${resTimeRange(res)}`
                          : `${res.check_in_date} → ${res.check_out_date}`}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Jami: {Number(res.total_amount || 0).toLocaleString()} So'm · To'langan:{" "}
                        {Number(res.paid_amount || 0).toLocaleString()} So'm
                      </p>
                    </div>
                  </div>

                  {/* TAHRIRLASH rejimi */}
                  {editMode && !locked && (
                    <div className="space-y-4">
                      <div className="flex rounded-lg bg-gray-100 p-1">
                        {([
                          { key: "DAILY", label: "Kunlik" },
                          { key: "HOURLY", label: "Soatlik" },
                        ] as const).map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setEditValues((v: any) => ({ ...v, booking_type: opt.key }))}
                            className={cn(
                              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                              editValues.booking_type === opt.key
                                ? "bg-white text-primary-700 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {isHourly ? (
                        <>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Sana</label>
                            <Input
                              type="date"
                              value={editValues.check_in_date || ""}
                              onChange={(e) =>
                                setEditValues((v: any) => ({ ...v, check_in_date: e.target.value }))
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Kirish vaqti</label>
                              <Input
                                type="time"
                                value={editValues.check_in_time || ""}
                                onChange={(e) =>
                                  setEditValues((v: any) => ({ ...v, check_in_time: e.target.value }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Chiqish vaqti</label>
                              <Input
                                type="time"
                                value={editValues.check_out_time || ""}
                                onChange={(e) =>
                                  setEditValues((v: any) => ({ ...v, check_out_time: e.target.value }))
                                }
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Kirish sanasi</label>
                            <Input
                              type="date"
                              value={editValues.check_in_date || ""}
                              onChange={(e) =>
                                setEditValues((v: any) => ({ ...v, check_in_date: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Chiqish sanasi</label>
                            <Input
                              type="date"
                              value={editValues.check_out_date || ""}
                              onChange={(e) =>
                                setEditValues((v: any) => ({ ...v, check_out_date: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Kattalar soni</label>
                          <Input
                            type="number"
                            min="1"
                            value={editValues.adults ?? 1}
                            onChange={(e) =>
                              setEditValues((v: any) => ({ ...v, adults: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Bolalar soni</label>
                          <Input
                            type="number"
                            min="0"
                            value={editValues.children ?? 0}
                            onChange={(e) =>
                              setEditValues((v: any) => ({ ...v, children: e.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium">Qo'shimcha izoh</label>
                        <Input
                          placeholder="Izoh..."
                          value={editValues.notes || ""}
                          onChange={(e) =>
                            setEditValues((v: any) => ({ ...v, notes: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* BEKOR QILISH tasdiqi */}
                  {cancelMode && (
                    <div className="space-y-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-sm text-red-700 font-medium">
                        Ushbu bronni bekor qilmoqchimisiz?
                      </p>
                      <Input
                        placeholder="Bekor qilish sababi (ixtiyoriy)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                      />
                    </div>
                  )}

                  {locked && cancelLocked && !cancelMode && (
                    <p className="text-xs text-gray-400">
                      {statusLocked
                        ? "Bu holatdagi bronni tahrirlab bo'lmaydi."
                        : "Bu bronni o'zgartirish uchun ruxsatingiz yo'q."}
                    </p>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  {cancelMode ? (
                    <>
                      <Button variant="outline" onClick={() => setCancelMode(false)} disabled={cancelling}>
                        Orqaga
                      </Button>
                      <Button variant="destructive" onClick={handleCancelReservation} disabled={cancelling}>
                        {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Ha, bekor qilish
                      </Button>
                    </>
                  ) : editMode ? (
                    <>
                      <Button variant="outline" onClick={() => setEditMode(false)} disabled={saving}>
                        Orqaga
                      </Button>
                      <Button onClick={handleUpdateReservation} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Saqlash
                      </Button>
                    </>
                  ) : (
                    <div className="flex w-full items-center justify-between">
                      {!cancelLocked ? (
                        <Button
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setCancelMode(true)}
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Bronni bekor qilish
                        </Button>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={closeManageModal}>
                          Yopish
                        </Button>
                        {!locked && (
                          <Button onClick={() => setEditMode(true)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Tahrirlash
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Surib ko'chirishni tasdiqlash dialogi */}
      <Dialog open={!!moveConfirm} onOpenChange={(o) => !o && setMoveConfirm(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Bronni ko'chirish</DialogTitle>
          </DialogHeader>
          {moveConfirm && (
            <div className="py-2 space-y-2">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{getGuestName(moveConfirm.res)}</span> bronini
                boshqa kunga ko'chirmoqchimisiz?
              </p>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm">
                <span className="text-gray-500">{moveConfirm.from}</span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
                <span className="font-semibold text-primary-700">{moveConfirm.to}</span>
                {moveConfirm.res?.booking_type === "HOURLY" && (
                  <span className="text-gray-400 text-xs ml-1">
                    ({resTimeRange(moveConfirm.res)})
                  </span>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveConfirm(null)}
              disabled={updateReservationMutation.isPending}
            >
              Bekor qilish
            </Button>
            <Button onClick={performMove} disabled={updateReservationMutation.isPending}>
              {updateReservationMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Ha, ko'chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bir kundagi bronlar ro'yxati dialogi */}
      <Dialog open={!!dayList} onOpenChange={(o) => !o && setDayList(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {dayList?.roomNumber} xona · {dayList?.date} — bronlar ({dayListItems.length})
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 max-h-80 overflow-y-auto divide-y divide-gray-100">
            {dayListItems.map((r) => (
              <button
                key={r.id}
                type="button"
                className="w-full flex items-center justify-between gap-3 px-2 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                onClick={() => {
                  setDayList(null)
                  openManageModal(r)
                }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {resTimeRange(r)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{getGuestName(r)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full",
                      statusColors[r.status] || statusColors.PENDING
                    )}
                  >
                    {statusLabels[r.status] || r.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </button>
            ))}
            {dayListItems.length === 0 && (
              <p className="py-6 text-sm text-gray-400 text-center">Bronlar topilmadi</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayList(null)}>
              Yopish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Xato dialogi (brauzer alert o'rniga) */}
      <Dialog open={!!errorDialog} onOpenChange={(o) => !o && setErrorDialog(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" />
              Xatolik
            </DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-gray-700 whitespace-pre-line">{errorDialog}</p>
          <DialogFooter>
            <Button onClick={() => setErrorDialog(null)}>Tushunarli</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
