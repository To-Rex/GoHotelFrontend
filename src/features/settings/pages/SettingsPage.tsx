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
  Sparkles,
  Brush,
  Wrench,
  ClipboardCheck,
  Moon,
  type LucideIcon,
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

// Avto-yakunlash sozlamasidagi vazifa turlari (nom + ikonka)
const HK_TYPES: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: "CLEANING", label: "Tozalash", icon: Sparkles },
  { key: "DEEP_CLEANING", label: "Chuqur tozalash", icon: Brush },
  { key: "MAINTENANCE", label: "Ta'mirlash", icon: Wrench },
  { key: "INSPECTION", label: "Tekshiruv", icon: ClipboardCheck },
  { key: "TURN_DOWN", label: "Kechki tayyorlash", icon: Moon },
]

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
        Saqlash
      </Button>
      {saved && (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> Saqlandi
        </span>
      )}
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  )
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

  const NAV_CHIPS = [
    { href: "#shift", label: "Smena va kassa", dot: "bg-violet-500" },
    { href: "#booking-edit", label: "Bron tahriri", dot: "bg-sky-500" },
    { href: "#auto-complete", label: "Avto-yakunlash", dot: "bg-primary-600" },
    { href: "#reset", label: "Tozalash", dot: "bg-red-500" },
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
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Sozlamalar</h1>
            <p className="text-sm text-gray-500">
              {user?.hotel_name || "Mehmonxona"} uchun tizim sozlamalari
            </p>
          </div>
        </div>
        {/* Bo'limlarga tez o'tish */}
        <div className="flex flex-wrap gap-1.5">
          {NAV_CHIPS.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
            >
              <span className={cn("h-2 w-2 rounded-full", c.dot)} />
              {c.label}
            </a>
          ))}
        </div>
      </div>

      {/* Sozlamalar — keng ekranda ikki ustun */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {/* Smena va kassa rejimi */}
        <SettingCard
          id="shift"
          icon={Wallet}
          iconClass="bg-violet-50 text-violet-600"
          title="Smena va kassa"
          desc='Kassali rejimda xodimlar smenani ochadi/topshiradi, kassa "ko&apos;r sanash" bilan yopiladi va har kuni belgilangan vaqtda kesiladi.'
        >
          <div className="grid gap-3 md:grid-cols-2">
            {[
              {
                key: "simple" as const,
                title: "Oddiy rejim",
                text: "Smena va kassa nazorati yo'q — hamma hozirgidek ishlaydi. Kichik jamoalar uchun qulay.",
              },
              {
                key: "cash" as const,
                title: "Kassali rejim",
                text: "Smena topshirish (keyingi xodim parol bilan qabul qiladi), kassa \"ko'r sanash\" bilan yopiladi, farqlar xodim hisobiga yoziladi. Yopilmagan smena boshqa xodimni bloklaydi.",
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
                Kunlik kassa kesimi vaqti
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
                Shu vaqtda ochiq kassalar topshirilishi shart bo'ladi. Tungi
                smena kesilib qolmasligi uchun ertalabki soat (06:00) qulay.
              </p>
            </div>
          )}

          <SaveRow
            onSave={onSaveShift}
            pending={saveShiftMutation.isPending}
            saved={shiftSaved}
            error={shiftError}
          />
        </SettingCard>

        <div className="grid gap-4">
          {/* Bron tahriri vaqt oynasi */}
          <SettingCard
            id="booking-edit"
            icon={CalendarCog}
            iconClass="bg-sky-50 text-sky-600"
            title="Bron tahriri"
            desc="Xodim bron yaratilgandan keyin necha daqiqa ichida xonani almashtira olishi. Administrator istalgan payt tahrirlaydi. 0 — cheklovsiz."
          >
            <label className="text-xs font-medium text-gray-600">
              Tahrirlash oynasi (daqiqa)
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
                  {m === "0" ? "Cheklovsiz" : `${m} daq`}
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

          {/* Vazifalarni avtomatik yakunlash vaqtlari */}
          <SettingCard
            id="auto-complete"
            icon={Timer}
            iconClass="bg-primary-50 text-primary-600"
            title="Vazifalarni avtomatik yakunlash"
            desc='Belgilangan vaqt ichida qo&apos;lda yakunlanmagan xo&apos;jalik vazifasini tizim o&apos;zi yopadi (jadvalda "avto" belgisi bilan). 0 — o&apos;chirilgan.'
          >
            <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
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
                      value={durations[t.key] ?? ""}
                      onChange={(e) =>
                        setDurations((d) => ({ ...d, [t.key]: e.target.value }))
                      }
                      placeholder={String(hkSettings?.defaults?.[t.key] ?? "")}
                    />
                    <span className="text-[11px] text-gray-400">daq</span>
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
      <div id="reset" className="overflow-hidden rounded-2xl border-2 border-red-200 bg-white scroll-mt-4">
        <div className="flex items-center gap-3 border-b border-red-100 bg-red-50/60 px-5 py-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-red-700">Xavfli hudud — ma'lumotlarni tozalash</h2>
            <p className="mt-0.5 text-xs text-red-600/70">
              Qaytarib bo'lmaydigan amal — faqat to'liq ishonch bilan bajaring
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
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
