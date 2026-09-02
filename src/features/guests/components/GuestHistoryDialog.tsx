import { useMemo, useState } from "react"
import {
  BedDouble,
  CalendarDays,
  CalendarSearch,
  CheckCircle2,
  Clock,
  DoorOpen,
  FilterX,
  Loader2,
  Phone,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react"

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
import { cn } from "@/lib/utils"
import type { Guest } from "@/types/api"
import { useGuestHistory, type GuestStay } from "../api/guestHistory"
import {
  EMPTY_STAY_FILTER,
  filterStays,
  hasStayFilter,
  presenceVerdict,
  type StayDateFilter,
} from "../lib/guestStays"

/**
 * Mehmonning to'liq tarixi: qachon, qaysi xonada, kim bilan turgan.
 *
 * Mehmonlar ro'yxatida faqat kartochka bor edi — telefon, hujjat. "Bu odam
 * ilgari kelganmi, qaysi xonani yoqtiradi, kim bilan keladi" degan savolga
 * javob yo'q edi, holbuki resepsiya aynan shuni so'raydi.
 *
 * Ro'yxatda mehmon HAMROH bo'lib turgan bronlar ham bor va ular alohida
 * belgilanadi: ularni qo'shmasak, birga kelgan ikki kishidan faqat
 * bittasining tarixi ko'rinardi.
 */

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlangan",
  CHECKED_IN: "Kirgan",
  CHECKED_OUT: "Chiqgan",
  NO_SHOW: "Kelmadi",
  CANCELLED: "Bekor qilingan",
}

const statusBadge: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-emerald-100 text-emerald-700",
  CHECKED_OUT: "bg-gray-200 text-gray-600",
  NO_SHOW: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-600",
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

const pad = (n: number) => String(n).padStart(2, "0")

/** "01.09.2026" — sof sana mintaqa siljishisiz o'qiladi. */
const fmtDate = (value?: string | null): string | null => {
  if (!value) return null
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (plain) return `${plain[3]}.${plain[2]}.${plain[1]}`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

/**
 * Bron vaqtidan soat.
 *
 * `new Date()` ishlatilmaydi: bu maydonlarga foydalanuvchi kiritgan devor
 * soati yoziladi va mintaqaga qayta hisoblansa qiymat siljib ketardi.
 * Izoh `rooms/lib/reservationDetail.ts` da.
 */
const timeOf = (value?: string | null): string | null => {
  if (!value) return null
  const m = /^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/.exec(String(value))
  return m ? m[1] : null
}

const nightsOf = (stay: GuestStay): number => {
  const a = new Date(stay.check_in_date).getTime()
  const b = new Date(stay.check_out_date).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(Math.round((b - a) / 86_400_000), 0)
}

/**
 * Soatlik turish matni.
 *
 * `check_out_date` ga ISHONIB BO'LMAYDI: bazada
 * check_out_date > check_in_date cheklovi bor, shuning uchun bir kunlik
 * soatlik bron uchun server u yerga ertangi kunni yozib qo'yadi. Sana ham,
 * soat ham aniq vaqtdan olinadi — shunda ular zid chiqmaydi.
 */
const hourlyLabel = (stay: GuestStay): string => {
  const start = stay.check_in_datetime
  const end = stay.check_out_datetime
  const day = start ? localDate(start) : fmtDate(stay.check_in_date)
  const from = timeOf(start)
  const to = timeOf(end)
  if (!from || !to) return day || ""
  const endDay = end ? localDate(end) : day
  return endDay && endDay !== day
    ? `${day}, ${from} – ${endDay}, ${to}`
    : `${day}, ${from} – ${to}`
}

/** Bron vaqtidan sana — soat bilan bir manbadan va bir usulda. */
const localDate = (value?: string | null): string | null => {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null
}

const StayCard = ({ stay }: { stay: GuestStay }) => {
  const hourly = (stay.booking_type || "").toUpperCase() === "HOURLY"
  const nights = hourly ? 0 : nightsOf(stay)

  // O'zidan boshqalar — "kim bilan kelgan" savoliga javob aynan shular
  const others = stay.people.filter((p) => !p.is_self && p.name)

  const place = [
    stay.room_number ? `${stay.room_number}-xona` : null,
    stay.room_type_name,
    stay.floor_number !== null && stay.floor_number !== undefined
      ? `${stay.floor_number}-qavat`
      : null,
    stay.branch_name,
  ].filter(Boolean)

  return (
    <div className="rounded-2xl border bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold leading-tight text-gray-900">
              {stay.reservation_number}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                statusBadge[stay.status] || "bg-gray-100 text-gray-500"
              )}
            >
              {STATUS_LABELS[stay.status] || stay.status}
            </span>
            {/* Hamroh bo'lib turgan bron — bu bronni boshqa odam ochgan */}
            {stay.role === "COMPANION" && (
              <span
                title="Bu bronni boshqa mehmon ochgan, bu odam hamroh bo'lgan"
                className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700"
              >
                Hamroh sifatida
              </span>
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-gray-700">
            {hourly ? (
              <Clock className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
            )}
            {hourly ? hourlyLabel(stay) : `${fmtDate(stay.check_in_date)} → ${fmtDate(stay.check_out_date)}`}
            <span className="text-xs text-gray-400">
              {hourly ? "soatlik" : nights ? `${nights} kecha` : "kunlik"}
            </span>
          </p>

          {place.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
              <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
              {place.join(" · ")}
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="text-sm font-bold tabular-nums text-gray-900">
            {fmt(stay.total_amount)} <span className="text-xs font-normal text-gray-400">So'm</span>
          </p>
          <p className="text-[11px] text-gray-500">
            {stay.adults} kattalar
            {stay.children ? `, ${stay.children} bolalar` : ""}
          </p>
        </div>
      </div>

      {/* KIM BILAN. O'zi ro'yxatdan chiqarilgan — savol boshqalari haqida */}
      {others.length > 0 && (
        <div className="mt-2.5 border-t border-gray-100 pt-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            <Users className="h-3.5 w-3.5" />
            Birga turganlar
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {others.map((p, i) => (
              <li
                key={p.guest_id || `${p.name}-${i}`}
                className="inline-flex items-center gap-1 text-sm text-gray-800"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
                {p.name}
                {p.is_primary && (
                  <span className="text-[11px] text-gray-400">(bron egasi)</span>
                )}
                {p.phone && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-400">
                    <Phone className="h-3 w-3" />
                    {p.phone}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface Props {
  guest: Guest | null
  onClose: () => void
}

export const GuestHistoryDialog = ({ guest, onClose }: Props) => {
  const { data, isLoading, error } = useGuestHistory(guest?.id)
  const summary = data?.summary
  const stays = useMemo(() => data?.stays || [], [data])

  /* Sana bo'yicha tekshirish. "Bu mehmon falon kuni kelganmi?" — resepsiya
     eng ko'p so'raydigan savol, va unga tarixni ko'z bilan qidirmasdan
     javob berish kerak. Mantiq `lib/guestStays` da va test bilan
     qulflangan: chiqish kunida mehmon endi xonada emas. */
  const [dateFilter, setDateFilter] = useState<StayDateFilter>(EMPTY_STAY_FILTER)
  const filtered = useMemo(() => filterStays(stays, dateFilter), [stays, dateFilter])
  const verdict = useMemo(
    () => presenceVerdict(stays, dateFilter),
    [stays, dateFilter]
  )
  const filterOn = hasStayFilter(dateFilter)

  return (
    <Dialog open={!!guest} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            <span className="break-words">
              {guest ? `${guest.first_name} ${guest.last_name || ""}`.trim() : ""}
            </span>
            {guest?.phone && (
              <span className="inline-flex items-center gap-1 text-sm font-normal text-gray-500">
                <Phone className="h-3.5 w-3.5" />
                {guest.phone}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Yuklanmoqda...
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {apiErrorMessage(error)}
          </p>
        )}

        {!isLoading && !error && (
          <>
            {/* Jamlanma. Bekor qilingan va kelmagan turishlar bu yerga
                kirmaydi — ular uchun mehmon xonada bo'lmagan. */}
            {!!summary && summary.total_stays > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Turishlar", value: String(summary.completed_stays) },
                  { label: "Jami kecha", value: String(summary.total_nights) },
                  { label: "To'langan", value: `${fmt(summary.total_paid)} so'm` },
                  {
                    label: "Ko'p turgan xona",
                    value: summary.favourite_room
                      ? `${summary.favourite_room}-xona`
                      : "—",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2"
                  >
                    <p className="text-[11px] text-gray-500">{s.label}</p>
                    <p className="truncate text-sm font-bold tabular-nums text-gray-900">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {!!summary && (summary.first_stay || summary.last_stay) && (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                <UserCheck className="h-3.5 w-3.5 text-gray-400" />
                Birinchi kelishi: <b className="text-gray-700">{fmtDate(summary.first_stay)}</b>
                <span className="text-gray-300">·</span>
                oxirgisi: <b className="text-gray-700">{fmtDate(summary.last_stay)}</b>
              </p>
            )}

            {/* SANA BO'YICHA TEKSHIRISH */}
            {stays.length > 0 && (
              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/60 p-2.5">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500">
                      Sanadan
                    </label>
                    <Input
                      type="date"
                      className="h-8 w-[140px] bg-white text-xs"
                      value={dateFilter.from}
                      max={dateFilter.to || undefined}
                      onChange={(e) =>
                        setDateFilter((p) => ({ ...p, from: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-500">
                      Sanagacha
                    </label>
                    <Input
                      type="date"
                      className="h-8 w-[140px] bg-white text-xs"
                      value={dateFilter.to}
                      min={dateFilter.from || undefined}
                      onChange={(e) =>
                        setDateFilter((p) => ({ ...p, to: e.target.value }))
                      }
                    />
                  </div>
                  {/* Bitta kunni tekshirish eng ko'p kerak bo'ladi —
                      ikkala maydonni qo'lda to'ldirish shart bo'lmasin */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      const today = new Date()
                      const pad = (n: number) => String(n).padStart(2, "0")
                      const d = `${today.getFullYear()}-${pad(
                        today.getMonth() + 1
                      )}-${pad(today.getDate())}`
                      setDateFilter({ from: d, to: d })
                    }}
                  >
                    <CalendarSearch className="mr-1 h-3.5 w-3.5" />
                    Bugun
                  </Button>
                  {filterOn && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-gray-500"
                      onClick={() => setDateFilter(EMPTY_STAY_FILTER)}
                    >
                      <FilterX className="mr-1 h-3.5 w-3.5" />
                      Tozalash
                    </Button>
                  )}
                </div>

                {/* JAVOB. Xodim ro'yxatni ko'z bilan qidirmasin — savolga
                    to'g'ridan-to'g'ri javob beriladi. */}
                {filterOn && (
                  <p
                    className={cn(
                      "flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium",
                      verdict.present
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-white text-gray-600"
                    )}
                  >
                    {verdict.present ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    )}
                    <span>
                      {verdict.day
                        ? verdict.present
                          ? `Ha — ${fmtDate(verdict.day)} kuni bu yerda turgan${
                              verdict.room ? `, ${verdict.room}-xonada` : ""
                            }.`
                          : `Yo'q — ${fmtDate(verdict.day)} kuni bu yerda turmagan.`
                        : verdict.present
                          ? `Bu davrda ${verdict.count} marta turgan.`
                          : "Bu davrda umuman turmagan."}
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="max-h-[50vh] space-y-2.5 overflow-y-auto pr-0.5">
              {stays.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
                  <BedDouble className="h-8 w-8" />
                  <p className="text-sm">Bu mehmon hali turmagan</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                  <CalendarSearch className="h-8 w-8" />
                  <p className="text-sm">Tanlangan sanada turish topilmadi</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDateFilter(EMPTY_STAY_FILTER)}
                  >
                    Butun tarixni ko'rsatish
                  </Button>
                </div>
              ) : (
                filtered.map((stay) => <StayCard key={stay.id} stay={stay} />)
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
