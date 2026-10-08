import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import {
  Settings,
  AlertTriangle,
  Trash2,
  Loader2,
  CheckCircle2,
  Database,
  Users,
  Timer,
  Wallet,
  CalendarCog,
  Sparkles,
  Brush,
  Wrench,
  ClipboardCheck,
  ListChecks,
  Moon,
  Printer,
  ArrowRight,
  Search,
  RefreshCw,
  Receipt,
  ScanLine,
  ListOrdered,
  CalendarClock,
  Percent,
  Video,
  Monitor,
  MessageSquareText,
  type LucideIcon,
  Undo2,
  Ban,
  Clock,
  UserCog,
  ArrowRightLeft,
  Gavel,
  BellRing,
} from "lucide-react"
import { useResetData, type ResetDataResult } from "../api/maintenance"
import { NavOrderCard } from "../components/NavOrderCard"
import { VisionCamerasCard } from "@/features/vision/components/VisionCamerasCard"
import { VisionDevicesCard } from "@/features/vision/components/VisionDevicesCard"
import { DiscountRulesCard } from "../components/DiscountRulesCard"
import { MoveDiscountCard } from "../components/MoveDiscountCard"
import { PenaltySettingsCard } from "../components/PenaltySettingsCard"
import { DebtReminderCard } from "../components/DebtReminderCard"
import { SmsKeysCard } from "../components/SmsKeysCard"
import {
  useBookingDefaults,
  useSaveBookingDefaults,
  resolveBookingType,
  type BookingType,
} from "../api/bookingDefaults"
import {
  resolveDailyUnit,
  type DailyUnit,
} from "@/features/reservations/lib/dailyUnit"
import {
  useHkAutoSettings,
  useHkAssignMode,
  useSaveHkAssignMode,
  useSaveHkAutoSettings,
  type HkAssignMode,
} from "@/features/housekeeping/api/housekeeping"
import { ChecklistTemplateEditor } from "@/features/housekeeping/components/ChecklistTemplateEditor"
import { useShiftSettings, useSaveShiftSettings } from "@/features/shifts/api/shifts"
import {
  useWorkHoursSettings,
  useSaveWorkHoursSettings,
} from "../api/workHours"
import {
  useEditWindowSettings,
  useSaveEditWindowSettings,
  useCancellationSettings,
  useSaveCancellationSettings,
} from "@/features/reservations/api/reservations"
import {
  useBlacklistPolicy,
  useSaveBlacklistPolicy,
} from "@/features/guests/api/blacklist"
import {
  useScanSettings,
  useSaveScanSettings,
  type ScanMode,
  type ScanEngine,
} from "@/features/guests/api/scanSettings"
import { usePermissions } from "@/lib/permissions"
import { useAuthStore } from "@/store/auth"
import { apiErrorMessage } from "@/lib/apiError"
import {
  DEFAULT_TPRINTS_URL,
  getPrinterUrl,
  setPrinterUrl as savePrinterUrl,
  pingPrinter,
  printTest,
  discoverTPrints,
  type TPrintsInfo,
} from "@/lib/tprints"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { tr, trc } from "@/i18n"

// Natija jadvalidagi nomlarni o'zbekchaga o'girish
const TABLE_LABELS: Record<string, string> = {
  checklist_items: tr("Chek-list bandlari"),
  invoice_items: tr("Hisob-faktura bandlari"),
  problems: tr("Muammolar"),
  housekeeping_tasks: tr("Xo'jalik vazifalari"),
  reservation_services: tr("Bron xizmatlari"),
  payments: tr("To'lovlar"),
  invoice_line_items: tr("Hisob-faktura qatorlari"),
  journal_entry_lines: tr("Jurnal qatorlari"),
  journal_entries: tr("Jurnal yozuvlari"),
  invoices: tr("Hisob-fakturalar"),
  reservations: tr("Bronlar"),
  incoming_calls: tr("Kiruvchi qo'ng'iroqlar"),
  document_scans: tr("Telefon skanerlari"),
  notifications: tr("Bildirishnomalar"),
  audit_logs: tr("Audit loglari"),
  reports: tr("Hisobotlar"),
  room_status_history: tr("Xona holati tarixi"),
  shift_sessions: tr("Smenalar va kassa sessiyalari"),
  shop_sales: tr("Do'kon sotuvlari"),
  shop_sale_items: tr("Do'kon sotuv qatorlari"),
  shop_writeoffs: tr("Do'kon hisobdan chiqarishlari"),
  shop_batches: tr("Do'kon partiyalari"),
  shop_products: tr("Do'kon mahsulotlari"),
  file_attachments: tr("Fayllar"),
  rooms_reset: tr("Bo'sh holatga qaytarilgan xonalar"),
  user_permissions: tr("Ruxsat biriktiruvlari"),
  user_sessions: tr("Xodim sessiyalari"),
  users: tr("Xodimlar"),
}

// Avto-yakunlash sozlamasidagi vazifa turlari (nom + ikonka)
const HK_TYPES: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: "CLEANING", label: tr("Tozalash"), icon: Sparkles },
  { key: "DEEP_CLEANING", label: tr("Chuqur tozalash"), icon: Brush },
  { key: "MAINTENANCE", label: tr("Ta'mirlash"), icon: Wrench },
  { key: "INSPECTION", label: tr("Tekshiruv"), icon: ClipboardCheck },
  { key: "TURN_DOWN", label: tr("Kechki tayyorlash"), icon: Moon },
]

/* Sozlamalar bo'limlari.

   Sahifada o'nlab sozlama bor va ularning hammasi bir vaqtda ko'rinsa, kerakli
   bandni topish qiyin. Shuning uchun ular mavzu bo'yicha ajratilgan: bir
   vaqtda faqat bitta bo'lim ko'rinadi.

   `cards` — o'sha bo'limdagi kartalar id'lari. Eski havolalar (masalan
   `#receipt`) ishlashda davom etishi uchun shu ro'yxatdan foydalaniladi. */
const SETTING_GROUPS = [
  {
    key: "booking",
    label: tr("Bron va mehmonlar"),
    desc: tr("Bandlov oynasi qanday ochilishi, chegirma qoidalari, bronni tahrirlash, jarimalar va hujjat skaneri"),
    icon: CalendarClock,
    iconClass: "bg-indigo-50 text-indigo-600",
    cards: ["booking-default", "discount-rules", "booking-edit", "move-discount", "penalty", "scanner"],
  },
  {
    key: "cash",
    label: tr("Kassa va smena"),
    desc: tr("Smenali rejim, kunlik kassa kesimi va uning majburiyligi"),
    icon: Wallet,
    iconClass: "bg-violet-50 text-violet-600",
    cards: ["shift"],
  },
  {
    key: "staff",
    label: tr("Xodimlar"),
    desc: tr("Ish vaqti nazorati — xodimlar o'z ish vaqtidan tashqarida tizimda ishlay oladimi"),
    icon: UserCog,
    iconClass: "bg-orange-50 text-orange-600",
    cards: ["work-hours"],
  },
  {
    key: "receipt",
    label: tr("Chek va printer"),
    desc: tr("Chek printeriga ulanish va chekning ko'rinishi"),
    icon: Receipt,
    iconClass: "bg-emerald-50 text-emerald-600",
    cards: ["tprints", "receipt"],
  },
  {
    key: "housekeeping",
    label: tr("Xo'jalik ishlari"),
    desc: tr("Vazifalarni farroshlarga taqsimlash, ish bandlari va avtomatik yakunlash vaqtlari"),
    icon: Timer,
    iconClass: "bg-primary-50 text-primary-600",
    cards: ["assign-mode", "checklist-templates", "auto-complete"],
  },
  {
    key: "cameras",
    label: tr("Kameralar"),
    desc: tr("Yuz tanish kameralarini filiallarga biriktirish — qaysi filial xodimi qaysi suratlarni ko'radi"),
    icon: Video,
    iconClass: "bg-sky-50 text-sky-600",
    cards: ["vision-devices", "vision-cameras"],
  },
  {
    key: "appearance",
    label: tr("Ko'rinish"),
    desc: tr("Yon menyudagi sahifalar tartibi — shu filialning barcha xodimlari uchun"),
    icon: ListOrdered,
    iconClass: "bg-amber-50 text-amber-600",
    cards: ["nav-order"],
  },
  {
    key: "sms",
    label: tr("SMS xabarnomalar"),
    desc: tr("Har filial uchun Xabarchi API kaliti — bron va to'lovda mijozga SMS"),
    icon: MessageSquareText,
    iconClass: "bg-teal-50 text-teal-600",
    cards: ["sms-keys"],
  },
  {
    key: "danger",
    label: tr("Xavfli hudud"),
    desc: tr("Operatsion ma'lumotlarni tozalash — qaytarib bo'lmaydigan amal"),
    icon: AlertTriangle,
    iconClass: "bg-red-50 text-red-600",
    cards: ["reset"],
  },
] as const

type GroupKey = (typeof SETTING_GROUPS)[number]["key"]

// Karta id'sidan bo'limni topish — eski `#anchor` havolalari uchun
const GROUP_OF_CARD: Record<string, GroupKey> = Object.fromEntries(
  SETTING_GROUPS.flatMap((g) => g.cards.map((c) => [c, g.key]))
) as Record<string, GroupKey>

// Bo'lim menyusi: keng ekranda chapda ustun, tor ekranda tepada qator
function SettingsNav({
  active,
  onSelect,
}: {
  active: GroupKey
  onSelect: (key: GroupKey) => void
}) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:w-60 lg:flex-shrink-0 lg:flex-col lg:overflow-visible lg:pb-0">
      {SETTING_GROUPS.map((g) => {
        const isActive = active === g.key
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onSelect(g.key)}
            className={cn(
              "flex flex-shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors lg:w-full",
              isActive
                ? "border-primary-300 bg-primary-50/60 text-primary-800"
                : "border-transparent text-gray-600 hover:bg-gray-100"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                g.iconClass
              )}
            >
              <g.icon className="h-4 w-4" />
            </span>
            <span className="whitespace-nowrap text-sm font-medium lg:whitespace-normal">
              {g.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

// Sozlama kartasi qobig'i: sarlavha bandi (ikonka + nom + izoh) va tanasi
function SettingCard({
  id,
  icon: Icon,
  iconClass,
  title,
  desc,
  children,
}: {
  id: string
  icon: LucideIcon
  iconClass: string
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="overflow-hidden rounded-2xl border bg-white scroll-mt-4">
      <div className="flex items-start gap-3 border-b bg-gray-50/70 px-5 py-4">
        <span
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl",
            iconClass
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{desc}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

// Saqlash qatori: tugma + "Saqlandi"/xato holati (barcha kartalarda bir xil)
function SaveRow({
  onSave,
  pending,
  saved,
  error,
}: {
  onSave: () => void
  pending: boolean
  saved: boolean
  error: string | null
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
      <Button onClick={onSave} disabled={pending} className="min-w-[120px]">
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {tr("Saqlash")}
      </Button>
      {saved && (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />{" "}{tr("Saqlandi")}
        </span>
      )}
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  )
}

export const SettingsPage = () => {
  // Sozlamalar — faqat sozlovchi va tizim ma'muri (marshrut ham yopiq;
  // bu yerdagi tekshiruv qo'shimcha himoya). Server ham faqat shularga
  // o'zgartirishga ruxsat beradi.
  const { canManageSettings } = usePermissions()

  /* Ochiq bo'lim. Sahifaga `#receipt` kabi havola bilan kelingan bo'lsa —
     eski havolalar ishlashda davom etishi uchun — o'sha karta joylashgan
     bo'lim ochiladi va karta ko'rinishga suriladi. */
  const [group, setGroupState] = useState<GroupKey>(() => {
    try {
      const anchor = window.location.hash.replace("#", "")
      if (GROUP_OF_CARD[anchor]) return GROUP_OF_CARD[anchor]
      // Havola bo'lmasa — oxirgi ochilgan bo'lim (brauzerda eslab qolinadi)
      const saved = localStorage.getItem("settings_group") as GroupKey | null
      if (saved && SETTING_GROUPS.some((g) => g.key === saved)) return saved
    } catch {}
    return "booking"
  })
  const setGroup = (key: GroupKey) => {
    setGroupState(key)
    try {
      localStorage.setItem("settings_group", key)
    } catch {}
  }
  const activeGroup =
    SETTING_GROUPS.find((g) => g.key === group) ?? SETTING_GROUPS[0]

  useEffect(() => {
    const anchor = window.location.hash.replace("#", "")
    if (!anchor || GROUP_OF_CARD[anchor] !== group) return
    // Karta chizilgandan keyin suriladi
    const id = window.setTimeout(
      () => document.getElementById(anchor)?.scrollIntoView({ block: "start" }),
      0
    )
    return () => window.clearTimeout(id)
  }, [group])

  const user = useAuthStore((s) => s.user)
  const resetMutation = useResetData()

  // --- Vazifa taqsimlash rejimi (navbat / hammaga) ---
  const { data: assignSettings } = useHkAssignMode()
  const saveAssignMutation = useSaveHkAssignMode()
  const [assignMode, setAssignMode] = useState<HkAssignMode>("queue")
  const [assignSaved, setAssignSaved] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  useEffect(() => {
    // Eski backend bu endpointni bilmasa — standart "queue" qoladi
    if (assignSettings?.mode) setAssignMode(assignSettings.mode)
  }, [assignSettings])

  const onSaveAssignMode = async () => {
    setAssignError(null)
    setAssignSaved(false)
    try {
      await saveAssignMutation.mutateAsync(assignMode)
      setAssignSaved(true)
      window.setTimeout(() => setAssignSaved(false), 3000)
    } catch (e) {
      setAssignError(apiErrorMessage(e))
    }
  }

  // --- Vazifalarni avtomatik yakunlash vaqtlari ---
  const { data: hkSettings } = useHkAutoSettings()
  const saveHkMutation = useSaveHkAutoSettings()
  const [durations, setDurations] = useState<Record<string, string>>({})
  // Umumiy o'chirgich: o'chirilganda tizim hech qanday vazifani o'zi
  // yopmaydi — xona holati faqat farrosh/menejer yakunlaganda o'zgaradi.
  // Daqiqalar saqlanib qoladi (qayta yoqilganda tiklanadi).
  const [hkEnabled, setHkEnabled] = useState(true)
  const [hkSaved, setHkSaved] = useState(false)
  const [hkError, setHkError] = useState<string | null>(null)

  useEffect(() => {
    if (hkSettings?.durations) {
      setDurations(
        Object.fromEntries(
          Object.entries(hkSettings.durations).map(([k, v]) => [k, String(v)])
        )
      )
    }
    // Eski backend `enabled` qaytarmasa — yoqilgan deb olinadi
    if (hkSettings) setHkEnabled(hkSettings.enabled !== false)
  }, [hkSettings])

  const onSaveHk = async () => {
    setHkError(null)
    setHkSaved(false)
    try {
      const payload: Record<string, number> = {}
      for (const [k, v] of Object.entries(durations)) {
        const n = parseInt(v, 10)
        payload[k] = isNaN(n) || n < 0 ? 0 : Math.min(n, 1440)
      }
      await saveHkMutation.mutateAsync({ durations: payload, enabled: hkEnabled })
      setHkSaved(true)
      window.setTimeout(() => setHkSaved(false), 3000)
    } catch (e) {
      setHkError(apiErrorMessage(e))
    }
  }

  // --- Yangi bandlov dialogining standart turi ---
  const { data: bookingDefaults } = useBookingDefaults()
  const saveBookingDefaultsMutation = useSaveBookingDefaults()
  const [bookingType, setBookingType] = useState<BookingType>("DAILY")
  const [requireAllGuests, setRequireAllGuests] = useState(false)
  // Kunlik bron hisobi: 12 soatlik (avvalgidek) yoki 24 soatlik
  const [dailyUnit, setDailyUnit] = useState<DailyUnit>("12h")
  const [bookingSaved, setBookingSaved] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)

  useEffect(() => {
    if (bookingDefaults) {
      setBookingType(resolveBookingType(bookingDefaults))
      setRequireAllGuests(bookingDefaults.require_all_guests === true)
      setDailyUnit(resolveDailyUnit(bookingDefaults))
    }
  }, [bookingDefaults])

  const onSaveBookingDefaults = async () => {
    setBookingError(null)
    setBookingSaved(false)
    try {
      await saveBookingDefaultsMutation.mutateAsync({
        default_type: bookingType,
        require_all_guests: requireAllGuests,
        daily_unit: dailyUnit,
      })
      setBookingSaved(true)
      window.setTimeout(() => setBookingSaved(false), 3000)
    } catch (e) {
      setBookingError(apiErrorMessage(e))
    }
  }

  // --- Smena va kassa rejimi ---
  const { data: shiftSettings } = useShiftSettings()
  const saveShiftMutation = useSaveShiftSettings()
  const [shiftMode, setShiftMode] = useState<"simple" | "cash">("simple")
  const [dayClose, setDayClose] = useState("00:00")
  const [dayCloseRequired, setDayCloseRequired] = useState(true)
  const [shiftSaved, setShiftSaved] = useState(false)
  const [shiftError, setShiftError] = useState<string | null>(null)

  useEffect(() => {
    if (shiftSettings) {
      setShiftMode(shiftSettings.mode)
      setDayClose(shiftSettings.day_close)
      setDayCloseRequired(shiftSettings.day_close_required !== false)
    }
  }, [shiftSettings])

  const onSaveShift = async () => {
    setShiftError(null)
    setShiftSaved(false)
    try {
      await saveShiftMutation.mutateAsync({
        mode: shiftMode,
        day_close: dayClose,
        day_close_required: dayCloseRequired,
      })
      setShiftSaved(true)
      window.setTimeout(() => setShiftSaved(false), 3000)
    } catch (e) {
      setShiftError(apiErrorMessage(e))
    }
  }

  // --- Ish vaqti nazorati: xodim ish vaqtidan tashqarida ishlay oladimi ---
  // Standart — o'chiq. Qaror serverda; mustasnolar kartada sanab o'tilgan.
  const { data: workHoursSettings } = useWorkHoursSettings()
  const saveWorkHoursMutation = useSaveWorkHoursSettings()
  const [workHoursEnforce, setWorkHoursEnforce] = useState(false)
  const [workHoursSaved, setWorkHoursSaved] = useState(false)
  const [workHoursError, setWorkHoursError] = useState<string | null>(null)

  useEffect(() => {
    if (workHoursSettings) setWorkHoursEnforce(workHoursSettings.enforce)
  }, [workHoursSettings])

  const onSaveWorkHours = async () => {
    setWorkHoursError(null)
    setWorkHoursSaved(false)
    try {
      await saveWorkHoursMutation.mutateAsync({ enforce: workHoursEnforce })
      setWorkHoursSaved(true)
      window.setTimeout(() => setWorkHoursSaved(false), 3000)
    } catch (e) {
      setWorkHoursError(apiErrorMessage(e))
    }
  }

  // --- Bron tahriri vaqt oynasi (xona almashtirish, default 10 daqiqa) ---
  const { data: editWindow } = useEditWindowSettings()
  const saveEditWindowMutation = useSaveEditWindowSettings()

  /* Bekor qilishda ushlab qolinadigan foiz. Mehmonxonalar bu masalada bir
     xil emas — biri to'lovni to'liq qaytaradi, biri jarima oladi. */
  /* Qora ro'yxat qoidasi. Standart holda taqiq YOQIQ: administrator
     kimnidir ro'yxatga qo'shganda unga xizmat ko'rsatilmasligini kutadi.
     Lekin mehmonxonalar bir xil emas — birida bu qat'iy taqiq, birida
     faqat ogohlantirish bo'lishi kerak. */
  const { data: blacklistPolicy } = useBlacklistPolicy()
  const saveBlacklistMutation = useSaveBlacklistPolicy()
  const [blockBooking, setBlockBooking] = useState(true)
  const [blSaved, setBlSaved] = useState(false)
  const [blError, setBlError] = useState<string | null>(null)
  useEffect(() => {
    if (blacklistPolicy) setBlockBooking(blacklistPolicy.block_booking)
  }, [blacklistPolicy])

  const onSaveBlacklist = async (next: boolean) => {
    setBlockBooking(next)
    setBlError(null)
    try {
      await saveBlacklistMutation.mutateAsync(next)
      setBlSaved(true)
      setTimeout(() => setBlSaved(false), 2000)
    } catch (e) {
      // Saqlanmasa eski holatga qaytaramiz — ekranda yolg'on holat qolmasin
      setBlockBooking(!next)
      setBlError(apiErrorMessage(e))
    }
  }

  const { data: cancelPolicy } = useCancellationSettings()
  const saveCancelPolicyMutation = useSaveCancellationSettings()
  const [feePercent, setFeePercent] = useState("0")
  const [feeSaved, setFeeSaved] = useState(false)
  const [feeError, setFeeError] = useState<string | null>(null)
  useEffect(() => {
    if (cancelPolicy) setFeePercent(String(cancelPolicy.fee_percent))
  }, [cancelPolicy])

  const onSaveFeePercent = async () => {
    const n = Number(feePercent)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setFeeError(tr("Foiz 0 dan 100 gacha bo'lishi kerak"))
      return
    }
    setFeeError(null)
    try {
      await saveCancelPolicyMutation.mutateAsync(n)
      setFeeSaved(true)
      setTimeout(() => setFeeSaved(false), 2000)
    } catch (e) {
      setFeeError(apiErrorMessage(e))
    }
  }
  const [windowMinutes, setWindowMinutes] = useState("10")
  const [editWinSaved, setEditWinSaved] = useState(false)
  const [editWinError, setEditWinError] = useState<string | null>(null)

  useEffect(() => {
    if (editWindow) setWindowMinutes(String(editWindow.window_minutes))
  }, [editWindow])

  const onSaveEditWindow = async () => {
    setEditWinError(null)
    setEditWinSaved(false)
    const n = parseInt(windowMinutes, 10)
    if (Number.isNaN(n) || n < 0 || n > 1440) {
      setEditWinError(tr("0 dan 1440 gacha daqiqa kiriting (0 — cheklovsiz)"))
      return
    }
    try {
      await saveEditWindowMutation.mutateAsync(n)
      setEditWinSaved(true)
      window.setTimeout(() => setEditWinSaved(false), 3000)
    } catch (e) {
      setEditWinError(apiErrorMessage(e))
    }
  }

  // --- Hujjat skaneri rejimi (MRZ / vizual / avtomatik) ---
  const { data: scanSettings } = useScanSettings()
  const saveScanMutation = useSaveScanSettings()
  const [scanMode, setScanMode] = useState<ScanMode>("auto")
  const [scanEngine, setScanEngine] = useState<ScanEngine>("server")
  const [scanStoreImages, setScanStoreImages] = useState(true)
  const [scanSaved, setScanSaved] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  useEffect(() => {
    if (scanSettings?.mode) setScanMode(scanSettings.mode)
    if (scanSettings?.engine) setScanEngine(scanSettings.engine)
    if (typeof scanSettings?.store_images === "boolean") setScanStoreImages(scanSettings.store_images)
  }, [scanSettings])

  const onSaveScan = async () => {
    setScanError(null)
    setScanSaved(false)
    try {
      await saveScanMutation.mutateAsync({
        mode: scanMode,
        engine: scanEngine,
        store_images: scanStoreImages,
      })
      setScanSaved(true)
      window.setTimeout(() => setScanSaved(false), 3000)
    } catch (e) {
      setScanError(apiErrorMessage(e))
    }
  }

  const [scope, setScope] = useState<"operational" | "full">("operational")
  const [confirmText, setConfirmText] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [result, setResult] = useState<ResetDataResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const canSubmit = confirmText.trim().toUpperCase() === "RESET"

  const onExecute = async () => {
    setErrorMsg(null)
    try {
      const res = await resetMutation.mutateAsync({
        scope,
        hotelId: user?.hotel_id,
      })
      setResult(res)
      setDialogOpen(false)
      setConfirmText("")
    } catch (e) {
      setErrorMsg(apiErrorMessage(e))
      setDialogOpen(false)
    }
  }

  // ---- Chek printeri (TPrints) — sozlama SHU qurilmada saqlanadi ----
  const [tpUrl, setTpUrl] = useState(getPrinterUrl)
  const [tpMsg, setTpMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [tpBusy, setTpBusy] = useState<null | "check" | "test" | "scan">(null)
  const [tpFound, setTpFound] = useState<TPrintsInfo[]>([])
  const [tpProgress, setTpProgress] = useState<[number, number] | null>(null)
  const [tpSaved, setTpSaved] = useState(false)

  const tpSave = () => {
    savePrinterUrl(tpUrl)
    setTpSaved(true)
    window.setTimeout(() => setTpSaved(false), 2500)
  }

  const tpCheck = async () => {
    savePrinterUrl(tpUrl)
    setTpBusy("check")
    setTpMsg(null)
    const r = await pingPrinter()
    setTpMsg({ ok: r.ok, text: r.msg })
    setTpBusy(null)
  }

  const tpTest = async () => {
    savePrinterUrl(tpUrl)
    setTpBusy("test")
    setTpMsg(null)
    const r = await printTest()
    setTpMsg(
      r.ok
        ? { ok: true, text: tr("Sinov chek yuborildi — printerni tekshiring") }
        : { ok: false, text: r.error || tr("Xato") }
    )
    setTpBusy(null)
  }

  const tpScan = async () => {
    setTpBusy("scan")
    setTpMsg(null)
    setTpFound([])
    setTpProgress([0, 0])
    const found = await discoverTPrints(tpUrl, (d, t) => setTpProgress([d, t]))
    setTpProgress(null)
    setTpFound(found)
    setTpMsg(
      found.length
        ? { ok: true, text: tr("{{count}} ta TPrints server topildi — kerakligini tanlang", { count: found.length }) }
        : {
            ok: false,
            text: tr("TPrints topilmadi — kassa kompyuterida dastur ishlab turganini tekshiring"),
          }
    )
    setTpBusy(null)
  }

  // Topilgan serverni tanlash — darhol saqlanadi
  const tpPick = (u: string) => {
    setTpUrl(u)
    savePrinterUrl(u)
    setTpMsg({ ok: true, text: tr("Tanlandi va saqlandi: {{u}}", { u }) })
  }

  if (!canManageSettings) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{tr("Sozlamalar")}</h1>
        <p className="text-sm text-gray-500">
          {tr("Bu sahifa faqat sozlovchi uchun.")}
        </p>
      </div>
    )
  }

  const options = [
    {
      key: "operational" as const,
      icon: Database,
      title: tr("Operatsion ma'lumotlarni tozalash"),
      description:
        tr("Bronlar, hisob-fakturalar, to'lovlar, xarajatlar, xo'jalik vazifalari, do'kon (sotuvlar, mahsulotlar va ombor qoldig'i), smenalar va kassa sessiyalari, bildirishnomalar va tarix o'chiriladi. Mehmonlar bazasi va hujjatlari SAQLANADI — mehmon hech qachon o'chirilmaydi."),
      keeps: tr("Saqlanadi: xodimlar, ruxsatlar, xonalar, qavatlar, turlar, xizmatlar."),
    },
    {
      key: "full" as const,
      icon: Users,
      title: tr("To'liq tozalash (xodimlar bilan)"),
      description:
        tr("Yuqoridagilarga qo'shimcha: shu filialning barcha xodimlari (EMPLOYEE), ularning ruxsatlari va sessiyalari ham o'chiriladi."),
      keeps: tr("Saqlanadi: administrator hisoblari, ruxsatlar katalogi va mehmonxona tuzilmasi."),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-500/25">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{tr("Sozlamalar")}</h1>
            <p className="text-sm text-gray-500">
              {user?.branch_name
                ? tr("{{hotel}} · {{branch}} filiali sozlamalari", {
                    hotel: user?.hotel_name || tr("Mehmonxona"),
                    branch: user.branch_name,
                  })
                : tr("{{v}} uchun tizim sozlamalari", { v: user?.hotel_name || tr("Mehmonxona") })}
            </p>
            <p className="text-xs text-gray-400">
              {tr("Har filialning sozlamalari alohida — boshqa filialni yuqoridagi tanlagich orqali sozlaysiz.")}
            </p>
          </div>
        </div>
      </div>

      {/* Bo'lim menyusi va tanlangan bo'lim kartalari */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <SettingsNav active={group} onSelect={setGroup} />

        <div className="min-w-0 flex-1 space-y-4">
          {/* Bo'lim sarlavhasi — nima sozlanayotgani bir qatorda */}
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900">
              {activeGroup.label}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">{activeGroup.desc}</p>
          </div>

          {group === "booking" && (
            <>
              {/* Yangi bandlov dialogining standart turi */}
              <SettingCard
                id="booking-default"
                icon={CalendarClock}
                iconClass="bg-indigo-50 text-indigo-600"
                title={tr("Standart bron turi")}
                desc={tr("Xonalar sahifasida va boshqa joylardan ochiladigan «Yangi bandlov» oynasi qaysi tur bilan ochilishi. Bron qilish sahifasida tur tanlangan tabga qarab: Kalendar — kunlik, Soatlik bron — soatlik. Xodim oynada turni istagancha almashtira oladi.")}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    {
                      key: "DAILY" as const,
                      title: tr("Kunlik"),
                      text: tr("Oyna kunlik bron bilan ochiladi: kirish va chiqish sanasi tanlanadi."),
                    },
                    {
                      key: "HOURLY" as const,
                      title: tr("Soatlik"),
                      text: tr("Oyna soatlik bron bilan ochiladi: bo'sh vaqt avtomatik tanlanib, davomiylik bir bosishda belgilanadi."),
                    },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setBookingType(m.key)}
                      className={cn(
                        "relative rounded-xl border p-4 text-left transition-all",
                        bookingType === m.key
                          ? "border-primary-400 bg-primary-50/40 ring-2 ring-primary-400/30"
                          : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
                      )}
                    >
                      {bookingType === m.key && (
                        <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary-600" />
                      )}
                      <p className="pr-6 text-sm font-semibold text-gray-900">{m.title}</p>
                      <p className="mt-1 text-xs leading-snug text-gray-600">{m.text}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-gray-400">
                  {tr("Xona bugun allaqachon soatlik bronlar bilan ishlayotgan bo'lsa, oyna standart turdan qat'i nazar soatlik ochiladi — xodim yana soat qo'shmoqchi bo'lishi ehtimoli yuqori.")}
                </p>

                {/* Kunlik bron hisobi — kalendarda tanlangan kunlar qanday
                    hisoblanadi (reservations/lib/dailyUnit) */}
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-900">{tr("Kunlik bron hisobi")}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                    {tr("Kalendarda tanlangan kunlar qanday hisoblanishi va bir kun narxi. O'zgartirish faqat yangi bronlarga ta'sir qiladi — mavjud bronlar narxi o'zgarmaydi.")}
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {[
                      {
                        key: "12h" as const,
                        title: tr("12 soatlik"),
                        text: tr("Tanlangan oxirgi kun — chiqish kuni. Bugun va ertaga tanlansa — 1 kecha, narx 1 barobar (kirish bugun, chiqish ertaga). Hozirgi tartib."),
                      },
                      {
                        key: "24h" as const,
                        title: tr("24 soatlik"),
                        text: tr("Har tanlangan kun to'liq 24 soat: bir kun = 2 × 12 soatlik narx (250 000 so'mlik xona — kuniga 500 000 so'm). Bugun va ertaga tanlansa — 2 kun (chiqish — indinga)."),
                      },
                    ].map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setDailyUnit(m.key)}
                        className={cn(
                          "relative rounded-xl border p-4 text-left transition-all",
                          dailyUnit === m.key
                            ? "border-primary-400 bg-primary-50/40 ring-2 ring-primary-400/30"
                            : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
                        )}
                      >
                        {dailyUnit === m.key && (
                          <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary-600" />
                        )}
                        <p className="pr-6 text-sm font-semibold text-gray-900">{m.title}</p>
                        <p className="mt-1 text-xs leading-snug text-gray-600">{m.text}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Xonadagi har bir kishini ro'yxatga olish */}
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 border-t border-gray-100 pt-4">
                  <Checkbox
                    checked={requireAllGuests}
                    onCheckedChange={(v) => setRequireAllGuests(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    <b className="font-medium text-gray-900">
                      {tr("Xonadagi har bir mehmon ro'yxatga olinsin")}
                    </b>
                    <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                      {requireAllGuests
                        ? tr("Mehmonlar soni nechta bo'lsa, shuncha mehmon kiritilmaguncha bron yaratilmaydi. Hamrohlar bazaga qo'shiladi — keyingi safar qidiruvda topiladi va hujjati saqlanib qoladi.")
                        : tr("Hamrohlarni kiritish ixtiyoriy: xodim faqat asosiy mehmon bilan ham bron qila oladi. Hamrohlar bo'limi baribir ko'rinadi, xohlasa to'ldiradi.")}
                    </span>
                  </span>
                </label>
                <SaveRow
                  onSave={onSaveBookingDefaults}
                  pending={saveBookingDefaultsMutation.isPending}
                  saved={bookingSaved}
                  error={bookingError}
                />
              </SettingCard>

              {/* Chegirma qoidalari — administrator belgilaydi, qolganlar ishlatadi */}
          <SettingCard
            id="discount-rules"
            icon={Percent}
            iconClass="bg-rose-50 text-rose-600"
            title={tr("Chegirma qoidalari")}
            desc={tr("Kim qancha chegirma bera olishi. Kunlik va soatlik bron alohida sozlanadi; 0 qiymati «cheklovsiz» degani.")}
          >
            <DiscountRulesCard />
          </SettingCard>

          {/* Bron tahriri vaqt oynasi */}
              <SettingCard
                id="booking-edit"
                icon={CalendarCog}
                iconClass="bg-sky-50 text-sky-600"
                title={tr("Bron tahriri")}
                desc={tr("Xodim bron yaratilgandan keyin necha daqiqa ichida xonani almashtira olishi. Administrator istalgan payt tahrirlaydi. 0 — cheklovsiz.")}
              >
                <label className="text-xs font-medium text-gray-600">
                  {tr("Tahrirlash oynasi (daqiqa)")}
                </label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={1440}
                    className="w-28"
                    value={windowMinutes}
                    onChange={(e) => setWindowMinutes(e.target.value)}
                    placeholder="10"
                  />
                  {/* Tez tanlovlar */}
                  {["5", "10", "15", "30", "0"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setWindowMinutes(m)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                        windowMinutes === m
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {m === "0" ? tr("Cheklovsiz") : tr("{{m}} daq", { m })}
                    </button>
                  ))}
                </div>
                <SaveRow
                  onSave={onSaveEditWindow}
                  pending={saveEditWindowMutation.isPending}
                  saved={editWinSaved}
                  error={editWinError}
                />
              </SettingCard>

              {/* Xona almashtirishda chegirma — qimmatroq xonaga o'tganda
                  resepshn narx farqidan chegirma bera oladimi va qancha */}
              <SettingCard
                id="move-discount"
                icon={ArrowRightLeft}
                iconClass="bg-violet-50 text-violet-600"
                title={tr("Xona almashtirishda chegirma")}
                desc={tr("Mehmon xonani yoqtirmay qimmatroq xonaga o'tganda resepshn narx farqidan chegirma qila oladimi va eng ko'p qancha.")}
              >
                <MoveDiscountCard />
              </SettingCard>

              {/* Jarimalar — kech chiqish summasini taklif qilish qoidasi.
                  Jarimaning o'zini resepshn bron oynasida yozadi */}
              <SettingCard
                id="penalty"
                icon={Gavel}
                iconClass="bg-rose-50 text-rose-600"
                title={tr("Jarimalar")}
                desc={tr("Mehmon kech chiqsa yoki biror narsani buzsa jarima yoziladi. Bu yerda kech chiqish uchun soatiga summa va imtiyozli vaqt belgilanadi — bron oynasida summa avtomatik taklif qilinadi.")}
              >
                <PenaltySettingsCard />
              </SettingCard>

              {/* Qarz eslatmalari — qarz unutilmasin */}
              <SettingCard
                id="debts"
                icon={BellRing}
                iconClass="bg-red-50 text-red-600"
                title={tr("Qarz eslatmalari")}
                desc={tr("Mehmon qarzlari ko'rinib tursin va unutilmasin: qanchalik tez-tez eslatilishini tanlang. Har qarzning sababi ko'rsatiladi.")}
              >
                <DebtReminderCard />
              </SettingCard>

              {/* Qora ro'yxat qoidasi */}
              <SettingCard
                id="blacklist"
                icon={Ban}
                iconClass="bg-red-50 text-red-600"
                title={tr("Qora ro'yxat")}
                desc={tr("Qora ro'yxatdagi mehmonga bron ochishni taqiqlash. Yoqilgan bo'lsa xodim unga umuman bron ocha olmaydi; o'chirilgan bo'lsa ro'yxat faqat belgi bo'lib qoladi va qaror xodimga havola qilinadi. Ro'yxatga qo'shishni faqat administrator bajaradi.")}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={blockBooking}
                    onChange={(e) => onSaveBlacklist(e.target.checked)}
                    disabled={saveBlacklistMutation.isPending}
                  />
                  <span className="text-sm text-gray-700">
                    {tr("Qora ro'yxatdagi mehmonga bron ochish taqiqlansin")}
                    <span className="block text-xs text-gray-400">
                      {tr("Standart holat — taqiqlangan")}
                    </span>
                  </span>
                </label>
                {blSaved && (
                  <p className="mt-2 text-xs font-medium text-emerald-600">
                    {tr("Saqlandi")}
                  </p>
                )}
                {blError && (
                  <p className="mt-2 text-xs font-medium text-red-600">{blError}</p>
                )}
              </SettingCard>

              {/* Bekor qilishda pul qaytarish */}
              <SettingCard
                id="cancellation"
                icon={Undo2}
                iconClass="bg-rose-50 text-rose-600"
                title={tr("Bekor qilishda qaytarim")}
                desc={tr("Bron bekor qilinganda mehmonga to'langan pulning qancha qismi qaytariladi. Bu yerda ushlab qolinadigan foiz ko'rsatiladi: 0% — pul to'liq qaytariladi, 100% — umuman qaytarilmaydi. Bekor qilish oynasida xodim summani o'zgartira oladi.")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-28"
                    value={feePercent}
                    onChange={(e) => setFeePercent(e.target.value)}
                    placeholder="0"
                  />
                  <span className="text-sm text-gray-500">{tr("% ushlab qolinadi")}</span>
                  {/* Tez tanlovlar */}
                  {["0", "10", "25", "50", "100"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFeePercent(v)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                        feePercent === v
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {v === "0" ? tr("To'liq qaytarish") : `${v}%`}
                    </button>
                  ))}
                </div>
                <SaveRow
                  onSave={onSaveFeePercent}
                  pending={saveCancelPolicyMutation.isPending}
                  saved={feeSaved}
                  error={feeError}
                />
              </SettingCard>

              {/* Hujjat skaneri rejimi */}
              <SettingCard
                id="scanner"
                icon={ScanLine}
                iconClass="bg-sky-50 text-sky-600"
                title={tr("Hujjat skaneri")}
                desc={tr("Passport va ID kartadan ma'lumot olish usuli. Quyidagi rejim faqat QURILMADA o'qishga taalluqli: serverda o'qilganda MRZ ham, hujjat yuzasidagi yozuvlar ham har doim o'qilib, bir-biriga solishtiriladi.")}
              >
                <div className="grid gap-2.5">
                  {(
                    [
                      {
                        key: "auto" as const,
                        title: tr("Avtomatik (tavsiya etiladi)"),
                        text: tr("Avval MRZ o'qiladi — topilmasa hujjat yuzasidagi yozuvlarga o'tadi. Har qanday hujjat bilan ishlaydi."),
                      },
                      {
                        key: "mrz" as const,
                        title: tr("Faqat MRZ"),
                        text: tr("Faqat mashina o'qiydigan zona. Eng tez va eng aniq: nazorat raqamlari bilan tekshiriladi, xato o'qish formaga tushmaydi."),
                      },
                      {
                        key: "visual" as const,
                        title: tr("Faqat vizual"),
                        text: tr("Hujjat yuzasidagi yozuvlar o'qiladi. MRZ zonasi yo'q yoki shikastlangan hujjatlar uchun; aniqligi yorug'likka bog'liq."),
                      },
                    ]
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setScanMode(m.key)}
                      className={cn(
                        "relative rounded-xl border p-3.5 text-left transition-all",
                        scanMode === m.key
                          ? "border-primary-400 bg-primary-50/40 ring-2 ring-primary-400/30"
                          : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
                      )}
                    >
                      {scanMode === m.key && (
                        <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary-600" />
                      )}
                      <p className="pr-6 text-sm font-semibold text-gray-900">
                        {m.title}
                      </p>
                      <p className="mt-1 text-xs leading-snug text-gray-600">
                        {m.text}
                      </p>
                    </button>
                  ))}
                </div>

                <p className="mt-5 mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {tr("O'qish qayerda bajariladi")}
                </p>
                <div className="grid gap-2.5">
                  {(
                    [
                      {
                        key: "server" as const,
                        title: tr("Serverda (tavsiya etiladi)"),
                        text: tr("Telefon faqat suratga oladi, tanish serverda bajariladi — bir necha barobar tez va aniqroq, zaif qurilmalarda ham bir xil ishlaydi. Aloqa uzilsa qurilmadagi o'qishga avtomatik qaytadi."),
                      },
                      {
                        key: "device" as const,
                        title: tr("Qurilmada"),
                        text: tr("O'qish uchun rasm serverga yuborilmaydi. Sekinroq va telefonni band qiladi; internetsiz ham ishlaydi."),
                      },
                    ]
                  ).map((m) => {
                    const unavailable = m.key === "server" && !scanSettings?.serverAvailable
                    return (
                      <button
                        key={m.key}
                        type="button"
                        disabled={unavailable}
                        onClick={() => setScanEngine(m.key)}
                        className={cn(
                          "relative rounded-xl border p-3.5 text-left transition-all",
                          unavailable && "cursor-not-allowed opacity-55",
                          scanEngine === m.key && !unavailable
                            ? "border-primary-400 bg-primary-50/40 ring-2 ring-primary-400/30"
                            : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
                        )}
                      >
                        {scanEngine === m.key && !unavailable && (
                          <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary-600" />
                        )}
                        <p className="pr-6 text-sm font-semibold text-gray-900">{m.title}</p>
                        <p className="mt-1 text-xs leading-snug text-gray-600">{m.text}</p>
                        {unavailable && (
                          <p className="mt-1.5 text-xs font-medium text-amber-700">
                            {tr("Bu serverda o'qish moduli o'rnatilmagan — hozircha faqat qurilmada ishlaydi.")}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Hujjat surati mehmon kartasiga saqlanadimi (MinIO) */}
                <p className="mt-5 mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {tr("Hujjat suratini saqlash")}
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {(
                    [
                      {
                        key: true,
                        title: tr("Saqlansin (tavsiya etiladi)"),
                        text: tr("Pasport yoki ID karta qayerda skanerlansa ham (telefon yoki veb) surati mehmon kartasiga yoziladi va keyin ko'rish mumkin."),
                      },
                      {
                        key: false,
                        title: tr("Saqlanmasin"),
                        text: tr("Faqat o'qilgan ma'lumotlar yoziladi, hujjat surati saqlanmaydi."),
                      },
                    ]
                  ).map((m) => (
                    <button
                      key={String(m.key)}
                      type="button"
                      onClick={() => setScanStoreImages(m.key)}
                      className={cn(
                        "relative rounded-xl border p-3.5 text-left transition-all",
                        scanStoreImages === m.key
                          ? "border-primary-400 bg-primary-50/40 ring-2 ring-primary-400/30"
                          : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
                      )}
                    >
                      {scanStoreImages === m.key && (
                        <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary-600" />
                      )}
                      <p className="pr-6 text-sm font-semibold text-gray-900">{m.title}</p>
                      <p className="mt-1 text-xs leading-snug text-gray-600">{m.text}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-gray-400">
                  {scanStoreImages
                    ? tr("Hujjat surati fayl omborida (MinIO) saqlanadi va faqat shu filialning mehmonlar bilan ishlaydigan xodimlariga ko'rinadi.")
                    : tr("Qaysi usul tanlangan bo'lsa ham, hujjat rasmi hech qaerda saqlanmaydi: serverda faqat xotirada o'qiladi va javob qaytgach yo'qoladi.")}
                </p>
                <SaveRow
                  onSave={onSaveScan}
                  pending={saveScanMutation.isPending}
                  saved={scanSaved}
                  error={scanError}
                />
              </SettingCard>

            </>
          )}

          {group === "cash" && (
            <>
              {/* Smena va kassa rejimi */}
              <SettingCard
                id="shift"
                icon={Wallet}
                iconClass="bg-violet-50 text-violet-600"
                title={tr("Smena va kassa")}
                desc={tr("Kassali rejimda xodimlar smenani ochadi/topshiradi, kassa \"ko'r sanash\" bilan yopiladi va har kuni belgilangan vaqtda kesiladi.")}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    {
                      key: "simple" as const,
                      title: tr("Oddiy rejim"),
                      text: tr("Smena va kassa nazorati yo'q — hamma hozirgidek ishlaydi. Kichik jamoalar uchun qulay."),
                    },
                    {
                      key: "cash" as const,
                      title: tr("Kassali rejim"),
                      text: tr("Smena topshirish (keyingi xodim parol bilan qabul qiladi), kassa \"ko'r sanash\" bilan yopiladi, farqlar xodim hisobiga yoziladi. Yopilmagan smena boshqa xodimni bloklaydi."),
                    },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setShiftMode(m.key)}
                      className={cn(
                        "relative rounded-xl border p-4 text-left transition-all",
                        shiftMode === m.key
                          ? "border-primary-400 bg-primary-50/40 ring-2 ring-primary-400/30"
                          : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
                      )}
                    >
                      {shiftMode === m.key && (
                        <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary-600" />
                      )}
                      <p className="pr-6 text-sm font-semibold text-gray-900">{m.title}</p>
                      <p className="mt-1 text-xs leading-snug text-gray-600">{m.text}</p>
                    </button>
                  ))}
                </div>

                {shiftMode === "cash" && (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/60 p-3.5">
                    <label className="text-xs font-medium text-gray-600">
                      {tr("Kunlik kassa kesimi vaqti")}
                    </label>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Input
                        type="time"
                        className="w-32 bg-white"
                        value={dayClose}
                        onChange={(e) => setDayClose(e.target.value)}
                      />
                      {/* Tez tanlovlar */}
                      {["00:00", "06:00"].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setDayClose(t)}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                            dayClose === t
                              ? "bg-primary-600 text-white"
                              : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      {tr("Tungi smena kesilib qolmasligi uchun ertalabki soat (06:00) qulay.")}
                    </p>

                    {/* Kesim majburiymi — ish to'xtaydimi yoki faqat eslatiladimi */}
                    <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-t border-gray-200 pt-3">
                      <Checkbox
                        checked={dayCloseRequired}
                        onCheckedChange={(v) => setDayCloseRequired(v === true)}
                        className="mt-0.5"
                      />
                      <span className="text-sm">
                        <b className="font-medium text-gray-900">
                          {tr("Kesim vaqtida kassa topshirish majburiy")}
                        </b>
                        <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                          {dayCloseRequired
                            ? tr("Kesim vaqti kelgach xodim kassani topshirmaguncha bron va to'lov qabul qila olmaydi — faqat kassa va hisobot sahifalari ochiq qoladi.")
                            : tr("Xodim ishlashda davom etaveradi, kassa hisobotlari sahifasida esa eslatma turadi. Diqqat: topshirilmagan pul kassada yig'ilib boradi va har kungi farqni kuzatish qiyinlashadi.")}
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                <SaveRow
                  onSave={onSaveShift}
                  pending={saveShiftMutation.isPending}
                  saved={shiftSaved}
                  error={shiftError}
                />
              </SettingCard>

            </>
          )}

          {group === "staff" && (
            <>
              {/* Ish vaqti nazorati — xodim ish vaqtidan tashqarida ishlay
                  oladimi. Qaror serverda; bu yerda faqat sozlama. */}
              <SettingCard
                id="work-hours"
                icon={Clock}
                iconClass="bg-orange-50 text-orange-600"
                title={tr("Ish vaqti nazorati")}
                desc={tr("Xodim o'z ish vaqtidan tashqarida tizimda ishlay oladimi. Har bir xodimning ish vaqti «Xodimlar» sahifasida, xodimni qo'shish yoki tahrirlash oynasida belgilanadi.")}
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox
                    checked={workHoursEnforce}
                    onCheckedChange={(v) => setWorkHoursEnforce(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    <b className="font-medium text-gray-900">
                      {tr("Ish vaqtidan tashqarida ishlash taqiqlansin")}
                    </b>
                    <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                      {workHoursEnforce
                        ? tr("Ish vaqti tugagan yoki hali boshlanmagan xodim tizimga kirsa ham ishlay olmaydi — ish vaqti boshlanishini kutish sahifasini ko'radi. Ish vaqti boshlangach sahifa o'zi ochiladi.")
                        : tr("Cheklov yo'q — xodimlar avvalgidek istalgan vaqtda ishlaydi.")}
                    </span>
                  </span>
                </label>

                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/60 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {tr("Kimlar cheklanmaydi")}
                  </p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-gray-600">
                    <li>{tr("Administratorlar — hech qachon cheklanmaydi.")}</li>
                    <li>
                      {tr("«Ish vaqtidan tashqari ham ishlay oladi» belgisi qo'yilgan xodimlar. Belgini faqat administrator xodimni qo'shish yoki tahrirlash oynasida qo'yadi.")}
                    </li>
                    <li>
                      {tr("Kassasi ochiq xodim (resepshn): ish vaqti tugaganda avvalgidek «Davom etish» tugmasi bilan ishlashda davom etadi, kassani yopishi va smenani topshirishi mumkin.")}
                    </li>
                    <li>{tr("Ish vaqti 24 soat qilib belgilangan xodimlar.")}</li>
                  </ul>
                  <p className="mt-2.5 text-xs leading-relaxed text-gray-400">
                    {tr("Ish vaqti belgilanmagan xodimga 09:00–18:00 amal qiladi — yoqishdan oldin xodimlar jadvalini tekshiring.")}
                  </p>
                </div>

                {/* Oddiy rejimda kassa sessiyasi yo'q — «Davom etish» ham yo'q */}
                {shiftSettings?.mode === "simple" && (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    {tr("Smena oddiy rejimda: kassa ochilmaydi, shuning uchun resepshn xodimi ham ish vaqtidan keyin boshqalar kabi cheklanadi. Kerak bo'lsa, unga «Ish vaqtidan tashqari ham ishlay oladi» belgisini qo'ying.")}
                  </p>
                )}

                <Link
                  to="/employees"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
                >
                  {tr("Xodimlar sahifasiga o'tish")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                <SaveRow
                  onSave={onSaveWorkHours}
                  pending={saveWorkHoursMutation.isPending}
                  saved={workHoursSaved}
                  error={workHoursError}
                />
              </SettingCard>
            </>
          )}

          {group === "receipt" && (
            <>
              {/* Chek printeri (TPrints) — sozlama shu qurilmada saqlanadi */}
              <SettingCard
                id="tprints"
                icon={Printer}
                iconClass="bg-slate-100 text-slate-600"
                title={tr("Chek printeri (TPrints)")}
                desc={tr("Do'kon cheklari kassa kompyuterida ishlab turgan TPrints dasturi orqali chiqadi. Manzil har kassa qurilmasining o'zida saqlanadi — mehmonxona bo'ylab umumiy emas.")}
              >
                <label className="text-xs font-medium text-gray-600">
                  {tr("Print-server manzili")}
                </label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Input
                    value={tpUrl}
                    onChange={(e) => setTpUrl(e.target.value)}
                    placeholder={DEFAULT_TPRINTS_URL}
                    className="w-full max-w-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={tpSave}
                    className="gap-1.5"
                  >
                    {tpSaved && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {tpSaved ? tr("Saqlandi") : tr("Saqlash")}
                  </Button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-400">
                  {tr("Odatiy: http://127.0.0.1:9100 (shu kompyuter). Printer boshqa kompyuterda bo'lsa o'sha kompyuter IP'sini yozing — \"Qidirish\" maydondagi IP tarmog'ini ham to'liq skan qiladi (masalan http://192.168.1.1:9100 yozib qidirsangiz, 192.168.1.* tekshiriladi).")}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={tpBusy !== null}
                    onClick={tpCheck}
                  >
                    {tpBusy === "check" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {tr("Tekshirish")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={tpBusy !== null}
                    onClick={tpTest}
                  >
                    {tpBusy === "test" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Receipt className="h-4 w-4" />
                    )}
                    {tr("Sinov chek")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={tpBusy !== null}
                    onClick={tpScan}
                  >
                    {tpBusy === "scan" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {tr("Qidirish")}
                  </Button>
                  {tpProgress && (
                    <span className="text-xs tabular-nums text-gray-400">
                      {tr("skan: {{v}}/{{v2}}", { v: tpProgress[0], v2: tpProgress[1] })}
                    </span>
                  )}
                </div>

                {tpMsg && (
                  <p
                    className={cn(
                      "mt-3 text-xs font-medium",
                      tpMsg.ok ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {tpMsg.text}
                  </p>
                )}

                {/* Topilgan serverlar — bosilsa tanlanadi va saqlanadi */}
                {tpFound.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {tpFound.map((f) => (
                      <button
                        key={f.url}
                        type="button"
                        onClick={() => tpPick(f.url)}
                        className={cn(
                          "flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-left transition-all",
                          tpUrl === f.url
                            ? "border-primary-400 bg-primary-50/40 ring-2 ring-primary-400/30"
                            : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-gray-900">
                            {f.url}
                          </span>
                          <span className="block text-[11px] text-gray-500">
                            {tr("{{app}} {{version}} · {{printers}} ta printer{{v}}", { app: f.app, version: f.version, printers: f.printers, v: f.defaultPrinter ? tr(" · standart: {{defaultPrinter}}", { defaultPrinter: f.defaultPrinter }) : "" })}
                          </span>
                        </span>
                        {tpUrl === f.url && (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </SettingCard>

              {/* Chek dizayni — alohida tahrirlash sahifasiga olib boradi */}
              <SettingCard
                id="receipt"
                icon={Printer}
                iconClass="bg-emerald-50 text-emerald-600"
                title={tr("Chek dizayni")}
                desc={tr("Do'kon chekining ko'rinishi: sarlavha, izohlar, ko'rsatiladigan maydonlar, QR-kod va qog'oz kengligi. Har filial o'z dizaynini alohida saqlaydi — boshqalar bilan aralashmaydi.")}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-xs text-sm leading-relaxed text-gray-600">
                    {tr("Chek jonli ko'rinish bilan alohida sahifada tahrirlanadi va printerda sinab ko'riladi.")}
                  </p>
                  <Button asChild>
                    <Link to="/settings/receipt" className="gap-2">
                      {tr("Tahrirlash")}{" "}<ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </SettingCard>

            </>
          )}

          {group === "housekeeping" && (
            <>
              {/* Vazifa qaysi farroshga tushishi */}
              <SettingCard
                id="assign-mode"
                icon={Users}
                iconClass="bg-violet-50 text-violet-600"
                title={tr("Vazifalarni taqsimlash")}
                desc={tr("Tozalash vazifasi yaratilganda u qaysi farroshga tushadi. Ikkala rejimda ham faqat ish vaqtidagi farroshlar hisobga olinadi.")}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    {
                      key: "queue" as const,
                      title: tr("Navbat bilan biriktirish"),
                      text: tr("Vazifa bitta farroshga biriktiriladi: avval bo'sh turgani, band bo'lsa eng kam vazifalisi, teng bo'lsa navbatdagisi. Xabar faqat o'shanga boradi."),
                    },
                    {
                      key: "claim" as const,
                      title: tr("Hammaga yuborish — kim birinchi olsa"),
                      text: tr("Vazifa biriktirilmaydi: ish vaqtidagi barcha farroshlarga xabar va ro'yxatda ko'rinadi. Kim birinchi «Boshlash»ni bossa, vazifa o'shanga o'tadi."),
                    },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setAssignMode(m.key)}
                      className={cn(
                        "relative rounded-xl border p-4 text-left transition-all",
                        assignMode === m.key
                          ? "border-primary-400 bg-primary-50/40 ring-2 ring-primary-400/30"
                          : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
                      )}
                    >
                      {assignMode === m.key && (
                        <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary-600" />
                      )}
                      <p className="pr-6 text-sm font-semibold text-gray-900">{m.title}</p>
                      <p className="mt-1 text-xs leading-snug text-gray-600">{m.text}</p>
                    </button>
                  ))}
                </div>
                <SaveRow
                  onSave={onSaveAssignMode}
                  pending={saveAssignMutation.isPending}
                  saved={assignSaved}
                  error={assignError}
                />
              </SettingCard>

              {/* Farrosh mobil ilovada belgilaydigan ish bandlari */}
              <SettingCard
                id="checklist-templates"
                icon={ListChecks}
                iconClass="bg-emerald-50 text-emerald-600"
                title={tr("Vazifa bandlari")}
                desc={tr("Farrosh mobil ilovada shu ro'yxatni ko'radi va har bandni belgilab boradi. Hammasi belgilanganda vazifa yakunlanadi va xona bo'shaydi.")}
              >
                <ChecklistTemplateEditor />
              </SettingCard>

              {/* Vazifalarni avtomatik yakunlash vaqtlari */}
              <SettingCard
                id="auto-complete"
                icon={Timer}
                iconClass="bg-primary-50 text-primary-600"
                title={tr("Vazifalarni avtomatik yakunlash")}
                desc={tr("Belgilangan vaqt ichida qo'lda yakunlanmagan xo'jalik vazifasini tizim o'zi yopadi (jadvalda \"avto\" belgisi bilan). 0 — shu tur uchun o'chirilgan.")}
              >
                {/* Umumiy o'chirgich — o'chirilganda quyidagi vaqtlar ishlamaydi,
                    lekin saqlanib turadi */}
                <label className="mb-4 flex cursor-pointer items-start gap-2.5">
                  <Checkbox
                    checked={hkEnabled}
                    onCheckedChange={(v) => setHkEnabled(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    <b className="font-medium text-gray-900">
                      {tr("Vazifalar avtomatik yakunlansin")}
                    </b>
                    <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                      {hkEnabled
                        ? tr("Quyidagi vaqt o'tgach tizim vazifani o'zi yopadi va xona holatini yangilaydi.")
                        : tr("O'chirilgan: tizim hech qanday vazifani o'zi yopmaydi. Xona holati faqat farrosh yoki menejer/admin vazifani yakunlaganda o'zgaradi. Vaqtlar saqlanib turadi — qayta yoqilganda tiklanadi.")}
                    </span>
                  </span>
                </label>
                <div
                  className={cn(
                    "grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]",
                    !hkEnabled && "pointer-events-none opacity-50"
                  )}
                  aria-disabled={!hkEnabled}
                >
                  {HK_TYPES.map((t) => (
                    <div
                      key={t.key}
                      className="rounded-xl border border-gray-200 p-3"
                    >
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        <t.icon className="h-3.5 w-3.5 text-gray-400" />
                        {t.label}
                      </label>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={1440}
                          className="h-9"
                          disabled={!hkEnabled}
                          value={durations[t.key] ?? ""}
                          onChange={(e) =>
                            setDurations((d) => ({ ...d, [t.key]: e.target.value }))
                          }
                          placeholder={String(hkSettings?.defaults?.[t.key] ?? "")}
                        />
                        <span className="text-[11px] text-gray-400">{tr("daq")}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <SaveRow
                  onSave={onSaveHk}
                  pending={saveHkMutation.isPending}
                  saved={hkSaved}
                  error={hkError}
                />
              </SettingCard>

            </>
          )}

          {group === "cameras" && (
            <>
              {/* Kamerani filialga biriktirish. Bu sozlanmagunicha kameraning
                  suratlari hech qaysi filial ro'yxatiga tushmaydi va yangi
                  mehmonga yuz biriktirib bo'lmaydi. */}
              <SettingCard
                id="vision-devices"
                icon={Monitor}
                iconClass="bg-sky-50 text-sky-600"
                title={tr("Kamera kompyuterlari va tokenlar")}
                desc={tr("Har bir kamera kompyuteriga bitta token yarating va uni GoHotels Vision ilovasiga kiriting. Tokensiz agent serverga ulanmaydi va quyidagi kameralar ro'yxati bo'sh qoladi.")}
              >
                <VisionDevicesCard />
              </SettingCard>

              <SettingCard
                id="vision-cameras"
                icon={Video}
                iconClass="bg-sky-50 text-sky-600"
                title={tr("Yuz tanish kameralari")}
                desc={tr("Har bir kamera qaysi filialda turishini belgilang. Yangi mehmonga yuz biriktirishda xodim faqat o'z filiali kameralaridan kelgan suratlarni ko'radi — boshqa filialning odamini tasodifan biriktirib qo'ymasligi uchun.")}
              >
                <VisionCamerasCard />
              </SettingCard>
            </>
          )}

          {group === "appearance" && (
            <>
              {/* Yon menyu tartibi — filialning barcha xodimlariga amal qiladi */}
              <SettingCard
                id="nav-order"
                icon={ListOrdered}
                iconClass="bg-amber-50 text-amber-600"
                title={tr("Menyu tartibi")}
                desc={tr("Chapdagi menyuda sahifalar qanday ketma-ketlikda turishini belgilang. Tartib shu filialning barcha xodimlariga amal qiladi.")}
              >
                <NavOrderCard />
              </SettingCard>

            </>
          )}

          {group === "sms" && <SmsKeysCard />}

          {group === "danger" && (
            <>
              {/* Muvaffaqiyat xabari */}
              {result && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    {tr("{{message}} — jami {{total_deleted}} ta yozuv o'chirildi", { message: result.message, total_deleted: result.total_deleted })}
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1">
                    {Object.entries(result.deleted)
                      .filter(([, n]) => n > 0)
                      .map(([table, n]) => (
                        <div key={table} className="flex justify-between text-xs text-emerald-800">
                          <span>{TABLE_LABELS[table] || table}</span>
                          <span className="font-semibold">{n}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 whitespace-pre-line">
                  {errorMsg}
                </div>
              )}

              {/* Xavfli hudud */}
              <div id="reset" className="overflow-hidden rounded-2xl border-2 border-red-200 bg-white scroll-mt-4">
                <div className="flex items-center gap-3 border-b border-red-100 bg-red-50/60 px-5 py-4">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-bold text-red-700">{tr("Xavfli hudud — ma'lumotlarni tozalash")}</h2>
                    <p className="mt-0.5 text-xs text-red-600/70">
                      {tr("Qaytarib bo'lmaydigan amal — faqat to'liq ishonch bilan bajaring")}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <p className="text-sm text-gray-600">
                    {tr("Tizimni \"yangidek\" holatga qaytarish. Bu amal")}{" "}
                    <span className="font-semibold text-red-600">{tr("qaytarib bo'lmaydi")}</span>{" "}{tr("va faqat shu filial ma'lumotlariga ta'sir qiladi — boshqa filiallarga tegilmaydi.")}
                  </p>

                  {/* Rejim tanlash */}
                  <div className="grid gap-3 md:grid-cols-2">
                    {options.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setScope(opt.key)}
                        className={cn(
                          "rounded-lg border p-4 text-left transition-all",
                          scope === opt.key
                            ? "border-red-400 ring-2 ring-red-400/30 bg-red-50/40"
                            : "border-gray-200 hover:border-red-200 hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg",
                              scope === opt.key
                                ? "bg-red-100 text-red-600"
                                : "bg-gray-100 text-gray-500"
                            )}
                          >
                            <opt.icon className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{opt.title}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-600 leading-snug">{opt.description}</p>
                        <p className="mt-1.5 text-[11px] text-emerald-700 leading-snug">{opt.keeps}</p>
                      </button>
                    ))}
                  </div>

                  {/* Tasdiqlash */}
                  <div className="flex flex-wrap items-end gap-3 border-t pt-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">
                        {tr("Tasdiqlash uchun")}{" "}<span className="font-mono font-bold">RESET</span>{" "}{tr("deb yozing")}
                      </label>
                      <Input
                        className="w-56"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="RESET"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      disabled={!canSubmit || resetMutation.isPending}
                      onClick={() => setDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {trc("clear", "Tozalashni boshlash")}
                    </Button>
                  </div>
                </div>
              </div>

            </>
          )}

        </div>
      </div>

      {/* Yakuniy tasdiqlash dialogi */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {tr("Rostdan ham tozalaysizmi?")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm text-gray-600">
            <p>
              {tr("Tanlangan rejim:")}{" "}
              <span className="font-semibold text-gray-900">
                {options.find((o) => o.key === scope)?.title}
              </span>
            </p>
            <p>
              {tr("Bu amal")}{" "}<span className="font-semibold text-red-600">{tr("qaytarib bo'lmaydi")}</span>.
              {scope === "full" &&
                tr(" Barcha xodimlar o'chiriladi — faqat administrator hisoblari qoladi.")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tr("Bekor qilish")}
            </Button>
            <Button
              variant="destructive"
              onClick={onExecute}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tr("Ha, tozalansin")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
