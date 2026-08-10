import { useState, useEffect } from "react"
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
} from "lucide-react"
import { useResetData, type ResetDataResult } from "../api/maintenance"
import {
  useHkAutoSettings,
  useSaveHkAutoSettings,
} from "@/features/housekeeping/api/housekeeping"
import { useShiftSettings, useSaveShiftSettings } from "@/features/shifts/api/shifts"
import {
  useEditWindowSettings,
  useSaveEditWindowSettings,
} from "@/features/reservations/api/reservations"
import { usePermissions } from "@/lib/permissions"
import { useAuthStore } from "@/store/auth"
import { apiErrorMessage } from "@/lib/apiError"
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

// Natija jadvalidagi nomlarni o'zbekchaga o'girish
const TABLE_LABELS: Record<string, string> = {
  checklist_items: "Chek-list bandlari",
  invoice_items: "Hisob-faktura bandlari",
  problems: "Muammolar",
  housekeeping_tasks: "Xo'jalik vazifalari",
  reservation_services: "Bron xizmatlari",
  payments: "To'lovlar",
  invoice_line_items: "Hisob-faktura qatorlari",
  journal_entry_lines: "Jurnal qatorlari",
  journal_entries: "Jurnal yozuvlari",
  invoices: "Hisob-fakturalar",
  reservations: "Bronlar",
  guests: "Mehmonlar",
  notifications: "Bildirishnomalar",
  audit_logs: "Audit loglari",
  reports: "Hisobotlar",
  room_status_history: "Xona holati tarixi",
  file_attachments: "Fayllar",
  rooms_reset: "Bo'sh holatga qaytarilgan xonalar",
  user_permissions: "Ruxsat biriktiruvlari",
  user_sessions: "Xodim sessiyalari",
  users: "Xodimlar",
}

// Avto-yakunlash sozlamasidagi vazifa turlari nomlari
const HK_TYPE_LABELS: Record<string, string> = {
  CLEANING: "Tozalash",
  DEEP_CLEANING: "Chuqur tozalash",
  MAINTENANCE: "Ta'mirlash",
  INSPECTION: "Tekshiruv",
  TURN_DOWN: "Kechki tayyorlash",
}

export const SettingsPage = () => {
  const { isAdmin } = usePermissions()
  const user = useAuthStore((s) => s.user)
  const resetMutation = useResetData()

  // --- Vazifalarni avtomatik yakunlash vaqtlari ---
  const { data: hkSettings } = useHkAutoSettings()
  const saveHkMutation = useSaveHkAutoSettings()
  const [durations, setDurations] = useState<Record<string, string>>({})
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
      await saveHkMutation.mutateAsync(payload)
      setHkSaved(true)
      window.setTimeout(() => setHkSaved(false), 3000)
    } catch (e) {
      setHkError(apiErrorMessage(e))
    }
  }

  // --- Smena va kassa rejimi ---
  const { data: shiftSettings } = useShiftSettings()
  const saveShiftMutation = useSaveShiftSettings()
  const [shiftMode, setShiftMode] = useState<"simple" | "cash">("simple")
  const [dayClose, setDayClose] = useState("00:00")
  const [shiftSaved, setShiftSaved] = useState(false)
  const [shiftError, setShiftError] = useState<string | null>(null)

  useEffect(() => {
    if (shiftSettings) {
      setShiftMode(shiftSettings.mode)
      setDayClose(shiftSettings.day_close)
    }
  }, [shiftSettings])

  const onSaveShift = async () => {
    setShiftError(null)
    setShiftSaved(false)
    try {
      await saveShiftMutation.mutateAsync({ mode: shiftMode, day_close: dayClose })
      setShiftSaved(true)
      window.setTimeout(() => setShiftSaved(false), 3000)
    } catch (e) {
      setShiftError(apiErrorMessage(e))
    }
  }

  // --- Bron tahriri vaqt oynasi (xona almashtirish, default 10 daqiqa) ---
  const { data: editWindow } = useEditWindowSettings()
  const saveEditWindowMutation = useSaveEditWindowSettings()
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
      setEditWinError("0 dan 1440 gacha daqiqa kiriting (0 — cheklovsiz)")
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

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Sozlamalar</h1>
        <p className="text-sm text-gray-500">
          Bu sahifa faqat administratorlar uchun.
        </p>
      </div>
    )
  }

  const options = [
    {
      key: "operational" as const,
      icon: Database,
      title: "Operatsion ma'lumotlarni tozalash",
      description:
        "Bronlar, hisob-fakturalar, to'lovlar, mehmonlar, xo'jalik vazifalari, bildirishnomalar va tarix o'chiriladi.",
      keeps: "Saqlanadi: xodimlar, ruxsatlar, xonalar, qavatlar, turlar, xizmatlar.",
    },
    {
      key: "full" as const,
      icon: Users,
      title: "To'liq tozalash (xodimlar bilan)",
      description:
        "Yuqoridagilarga qo'shimcha: barcha xodimlar (EMPLOYEE), ularning ruxsatlari va sessiyalari ham o'chiriladi.",
      keeps: "Saqlanadi: administrator hisoblari, ruxsatlar katalogi va mehmonxona tuzilmasi.",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
          <Settings className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sozlamalar</h1>
          <p className="text-sm text-gray-500">Tizim boshqaruvi</p>
        </div>
      </div>

      {/* Smena va kassa rejimi */}
      <div className="rounded-2xl border bg-white p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <Wallet className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Smena va kassa</h2>
            <p className="text-xs text-gray-500">
              Kassali rejimda xodimlar smenani ochadi/topshiradi, kassa "ko'r
              sanash" bilan yopiladi va har kuni belgilangan vaqtda kesiladi.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setShiftMode("simple")}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              shiftMode === "simple"
                ? "border-primary-400 ring-2 ring-primary-400/30 bg-primary-50/40"
                : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
            )}
          >
            <p className="text-sm font-semibold text-gray-900">Oddiy rejim</p>
            <p className="mt-1 text-xs text-gray-600 leading-snug">
              Smena va kassa nazorati yo'q — hamma hozirgidek ishlaydi. Kichik
              jamoalar uchun qulay.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setShiftMode("cash")}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              shiftMode === "cash"
                ? "border-primary-400 ring-2 ring-primary-400/30 bg-primary-50/40"
                : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
            )}
          >
            <p className="text-sm font-semibold text-gray-900">Kassali rejim</p>
            <p className="mt-1 text-xs text-gray-600 leading-snug">
              Smena topshirish (keyingi xodim parol bilan qabul qiladi), kassa
              "ko'r sanash" bilan yopiladi, farqlar xodim hisobiga yoziladi.
              Yopilmagan smena boshqa xodimni bloklaydi — menejer/admin majburiy
              yopa oladi.
            </p>
          </button>
        </div>

        {shiftMode === "cash" && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Kunlik kassa kesimi vaqti
              </label>
              <Input
                type="time"
                className="w-36"
                value={dayClose}
                onChange={(e) => setDayClose(e.target.value)}
              />
            </div>
            <p className="pb-2 text-xs text-gray-400">
              Shu vaqtda ochiq kassalar topshirilishi shart bo'ladi (tungi smena
              kesilmasligi uchun ertalabki soatni tanlash mumkin, masalan 06:00).
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={onSaveShift} disabled={saveShiftMutation.isPending}>
            {saveShiftMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Saqlash
          </Button>
          {shiftSaved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Saqlandi
            </span>
          )}
          {shiftError && <span className="text-sm text-red-500">{shiftError}</span>}
        </div>
      </div>

      {/* Bron tahriri vaqt oynasi */}
      <div className="rounded-2xl border bg-white p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <CalendarCog className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Bron tahriri</h2>
            <p className="text-xs text-gray-500">
              Xodim bron yaratilgandan keyin necha daqiqa ichida uni tahrirlashi
              (xonani almashtirishi) mumkin. Administrator istalgan payt
              tahrirlay oladi. 0 — cheklovsiz.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              Tahrirlash oynasi (daqiqa)
            </label>
            <Input
              type="number"
              min={0}
              max={1440}
              className="w-36"
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(e.target.value)}
              placeholder="10"
            />
          </div>
          <Button
            onClick={onSaveEditWindow}
            disabled={saveEditWindowMutation.isPending}
          >
            {saveEditWindowMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Saqlash
          </Button>
          {editWinSaved && (
            <span className="inline-flex items-center gap-1.5 pb-2 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Saqlandi
            </span>
          )}
          {editWinError && (
            <span className="pb-2 text-sm text-red-500">{editWinError}</span>
          )}
        </div>
      </div>

      {/* Vazifalarni avtomatik yakunlash vaqtlari */}
      <div className="rounded-2xl border bg-white p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Timer className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Vazifalarni avtomatik yakunlash
            </h2>
            <p className="text-xs text-gray-500">
              Belgilangan vaqt ichida qo'lda yakunlanmagan xo'jalik vazifasini
              tizim o'zi yopadi (jadvalda "avto" belgisi bilan ko'rinadi).
              0 — avtomatik yakunlash o'chirilgan.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          {Object.entries(HK_TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="space-y-1">
              <label className="text-xs font-medium text-gray-500">
                {label} (daqiqa)
              </label>
              <Input
                type="number"
                min={0}
                max={1440}
                value={durations[type] ?? ""}
                onChange={(e) =>
                  setDurations((d) => ({ ...d, [type]: e.target.value }))
                }
                placeholder={String(hkSettings?.defaults?.[type] ?? "")}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={onSaveHk} disabled={saveHkMutation.isPending}>
            {saveHkMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Saqlash
          </Button>
          {hkSaved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Saqlandi
            </span>
          )}
          {hkError && <span className="text-sm text-red-500">{hkError}</span>}
        </div>
      </div>

      {/* Muvaffaqiyat xabari */}
      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
            <CheckCircle2 className="h-4 w-4" />
            {result.message} — jami {result.total_deleted} ta yozuv o'chirildi
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
      <div className="rounded-lg border-2 border-red-200 bg-white">
        <div className="flex items-center gap-2 border-b border-red-100 bg-red-50/60 px-4 py-3 rounded-t-md">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h2 className="text-sm font-bold text-red-700">
            Xavfli hudud — ma'lumotlarni tozalash (Reset)
          </h2>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            Tizimni "yangidek" holatga qaytarish. Bu amal{" "}
            <span className="font-semibold text-red-600">qaytarib bo'lmaydi</span> va
            faqat sizning mehmonxonangiz ma'lumotlariga ta'sir qiladi.
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
                Tasdiqlash uchun <span className="font-mono font-bold">RESET</span> deb yozing
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
              Tozalashni boshlash
            </Button>
          </div>
        </div>
      </div>

      {/* Yakuniy tasdiqlash dialogi */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Rostdan ham tozalaysizmi?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm text-gray-600">
            <p>
              Tanlangan rejim:{" "}
              <span className="font-semibold text-gray-900">
                {options.find((o) => o.key === scope)?.title}
              </span>
            </p>
            <p>
              Bu amal <span className="font-semibold text-red-600">qaytarib bo'lmaydi</span>.
              {scope === "full" &&
                " Barcha xodimlar o'chiriladi — faqat administrator hisoblari qoladi."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="destructive"
              onClick={onExecute}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ha, tozalansin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
