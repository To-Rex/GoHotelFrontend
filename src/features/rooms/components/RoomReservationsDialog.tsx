import { useMemo, useState } from "react"
import {
  CalendarCheck,
  ChevronDown,
  Users,
  CalendarDays,
  Clock,
  Loader2,
  Phone,
  Search,
  SlidersHorizontal,
  FilterX,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ReservationReceiptButton } from "@/features/reservations/components/ReservationReceiptButton"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import type { Room } from "@/types/api"
import { useRoomReservations, type RoomReservation } from "../api/rooms"
import {
  EMPTY_FILTERS,
  SORT_LABELS,
  applyFilters,
  hasActiveFilters,
  summarize,
  type ReservationFilters,
  type ReservationSort,
} from "../lib/reservationFilters"
import { buildDatePresets } from "@/lib/datePresets"
import { ReservationDetailDialog } from "./ReservationDetailDialog"
import { tr, trc } from "@/i18n"

/* Xonaning bandlovlari.

   Xona kartochkasidagi tugma shu oynani ochadi: shu xonada kim, qachon
   turgan va turadi. Har bir band bandlovlar ro'yxatidagidek to'liq —
   mehmon, muddat, kecha soni yoki soatlik oralig'i, chegirma, to'langan
   qismi, holat va to'lov belgilari — hamda chek chiqarish tugmasi bilan.

   Ro'yxat faqat oyna ochilganda so'raladi, ya'ni xonalar sahifasining o'zi
   og'irlashmaydi. */

const STATUS_LABELS: Record<string, string> = {
  PENDING: tr("Kutilmoqda"),
  CONFIRMED: tr("Tasdiqlangan"),
  CHECKED_IN: tr("Kirgan"),
  CHECKED_OUT: tr("Chiqgan"),
  NO_SHOW: tr("Kelmadi"),
  CANCELLED: tr("Bekor qilingan"),
}

const statusBadge: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-emerald-100 text-emerald-700",
  CHECKED_OUT: "bg-gray-200 text-gray-600",
  NO_SHOW: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-600",
}

const statusDot: Record<string, string> = {
  PENDING: "bg-amber-500",
  CONFIRMED: "bg-blue-500",
  CHECKED_IN: "bg-emerald-500",
  CHECKED_OUT: "bg-gray-400",
  NO_SHOW: "bg-gray-400",
  CANCELLED: "bg-red-500",
}

const statusEdge: Record<string, string> = {
  PENDING: "border-l-amber-400",
  CONFIRMED: "border-l-blue-400",
  CHECKED_IN: "border-l-emerald-400",
  CHECKED_OUT: "border-l-gray-300",
  NO_SHOW: "border-l-gray-300",
  CANCELLED: "border-l-red-400",
}

const PAY_LABELS: Record<string, string> = {
  UNPAID: tr("To'lanmagan"),
  PARTIALLY_PAID: tr("Qisman"),
  PAID: tr("To'langan"),
  REFUNDED: tr("Qaytarilgan"),
}

const payBadge: Record<string, string> = {
  UNPAID: "bg-red-100 text-red-600",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  REFUNDED: "bg-gray-100 text-gray-500",
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

// Mehmon avatari uchun bosh harflar
const initials = (name?: string | null) => {
  const parts = (name || "").trim().split(/\s+/)
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?"
}

// Kunlik bron uchun kechalar soni
const nights = (checkIn?: string, checkOut?: string): number => {
  if (!checkIn || !checkOut) return 0
  const a = new Date(checkIn).getTime()
  const b = new Date(checkOut).getTime()
  if (isNaN(a) || isNaN(b)) return 0
  return Math.max(Math.round((b - a) / 86400000), 0)
}

interface Props {
  room: Room | null
  onClose: () => void
}


export const RoomReservationsDialog = ({ room, onClose }: Props) => {
  const { data: reservations = [], isLoading, error } = useRoomReservations(room?.id)
  /* Filtrlar bitta obyektda: ular oltita bo'lib ketdi va har biriga
     alohida holat tutish tozalash va tekshirishni tarqoq qilardi. */
  const [filters, setFilters] = useState<ReservationFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ReservationSort>("newest")
  const [showMore, setShowMore] = useState(false)
  const patch = (part: Partial<ReservationFilters>) =>
    setFilters((prev) => ({ ...prev, ...part }))
  /* Bosilgan bandning ID'si — to'liq ma'lumot oynasi shu bilan ochiladi.
     Yozuvning nusxasi emas, aynan ID: oynada mehmonning telefoni yoki
     passporti tahrirlansa ro'yxat qayta so'raladi va oyna YANGI yozuvni
     ko'rsatishi kerak. Nusxa saqlansa u eskirib qolardi. */
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = useMemo(
    () => reservations.find((r) => r.id === detailId) || null,
    [reservations, detailId]
  )

  // Holatlar bo'yicha sonlar — filtr chiplarida ko'rsatiladi
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of reservations) m[r.status] = (m[r.status] || 0) + 1
    return m
  }, [reservations])

  /* Ro'yxat: filtrlab, so'ng tartiblab. Mantiq `lib/reservationFilters`
     da va test bilan qoplangan — bu yerda faqat chaqiriladi. */
  const filtered = useMemo(
    () => applyFilters(reservations, filters, sort),
    [reservations, filters, sort]
  )

  /* Jamlanma KO'RINIB TURGAN ro'yxat bo'yicha. Filtr qo'yilganda butun
     xona bo'yicha raqam ko'rsatish chalg'itardi: xodim "shu davrda qancha
     tushum bo'ldi?" degan savolga javob kutadi. */
  const stats = useMemo(() => summarize(filtered), [filtered])

  // Tez davr tugmalari — moliya va xarajatlar sahifalaridagi bilan bir xil
  const datePresets = useMemo(() => buildDatePresets(new Date()), [])

  const hasFilters = hasActiveFilters(filters)
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setSort("newest")
  }

  // Oyna yopilganda filtrlar keyingi xona uchun qolib ketmasin
  const close = () => {
    clearFilters()
    setDetailId(null)
    onClose()
  }

  return (
    <Dialog open={!!room} onOpenChange={(open) => !open && close()}>
      {/* Filtrlar qatori kengaydi (qidiruv, tartib, sana oralig'i, tur,
          to'lov) — 680px da ular juda tor qisilardi */}
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <CalendarCheck className="h-4 w-4" />
            </span>
            {tr("Bandlovlar — {{room_number}}-xona", { room_number: room?.room_number })}
          </DialogTitle>
        </DialogHeader>

        {!isLoading && !error && reservations.length > 0 && (
          <>
            {/* Jamlanma — ko'rinib turgan ro'yxat bo'yicha */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: tr("Bandlov"), value: String(stats.total) },
                { label: tr("Faol"), value: String(stats.active) },
                { label: tr("Tushum"), value: tr("{{income}} so'm", { income: fmt(stats.income) }) },
                { label: tr("Qarz"), value: tr("{{debt}} so'm", { debt: fmt(stats.debt) }) },
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

            {/* Qidiruv va holat filtri */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="h-9 pl-9"
                    placeholder={tr("Bandlov raqami, mehmon yoki telefon...")}
                    value={filters.search}
                    onChange={(e) => patch({ search: e.target.value })}
                  />
                </div>
                {/* Tartib — qidiruv yonida, chunki ikkalasi ham ro'yxatning
                    ko'rinishini boshqaradi */}
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ReservationSort)}
                  title={tr("Tartib")}
                >
                  {Object.entries(SORT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => setShowMore((v) => !v)}
                >
                  <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                  {tr("Filtrlar")}
                  <ChevronDown
                    className={cn(
                      "ml-1 h-3.5 w-3.5 transition-transform",
                      showMore && "rotate-180"
                    )}
                  />
                </Button>
              </div>

              {/* Qo'shimcha filtrlar — yopiq turadi, chunki ko'p hollarda
                  qidiruv va holat yetarli. Bittasi qo'yilgan bo'lsa panel
                  o'zi ochiq qoladi, aks holda ko'rinmas filtr ro'yxatni
                  qisqartirib turgandek tuyulardi. */}
              {(showMore || !!filters.dateFrom || !!filters.dateTo ||
                !!filters.paymentStatus || !!filters.bookingType) && (
                <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/60 p-2.5">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-gray-500">
                        {tr("Sanadan")}
                      </label>
                      <Input
                        type="date"
                        className="h-8 w-[140px] text-xs"
                        value={filters.dateFrom}
                        max={filters.dateTo || undefined}
                        onChange={(e) => patch({ dateFrom: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-gray-500">
                        {tr("Sanagacha")}
                      </label>
                      <Input
                        type="date"
                        className="h-8 w-[140px] text-xs"
                        value={filters.dateTo}
                        min={filters.dateFrom || undefined}
                        onChange={(e) => patch({ dateTo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-gray-500">
                        {tr("Bron turi")}
                      </label>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={filters.bookingType}
                        onChange={(e) => patch({ bookingType: e.target.value })}
                      >
                        <option value="">{tr("Barchasi")}</option>
                        <option value="DAILY">{tr("Kunlik")}</option>
                        <option value="HOURLY">{tr("Soatlik")}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-gray-500">
                        {tr("To'lov")}
                      </label>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={filters.paymentStatus}
                        onChange={(e) =>
                          patch({ paymentStatus: e.target.value })
                        }
                      >
                        <option value="">{tr("Barchasi")}</option>
                        {Object.entries(PAY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tez davrlar — moliya va xarajatlar sahifalaridagi bilan
                      bir xil ro'yxat va bir xil xatti-harakat */}
                  <div className="flex flex-wrap gap-1.5">
                    {datePresets.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => patch({ dateFrom: p.from, dateTo: p.to })}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                          filters.dateFrom === p.from && filters.dateTo === p.to
                            ? "border-primary-600 bg-primary-50 text-primary-700"
                            : "border-gray-200 text-gray-600 hover:bg-white"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {tr("Sana oralig'i turish davri bo'yicha: davrga tegib o'tgan bandlovlar ham ko'rinadi.")}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => patch({ status: "" })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    !filters.status
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {tr("Barchasi ({{count}})", { count: reservations.length })}
                </button>
                {Object.entries(STATUS_LABELS)
                  .filter(([value]) => statusCounts[value])
                  .map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        patch({ status: filters.status === value ? "" : value })
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        filters.status === value
                          ? "border-primary-600 bg-primary-50 text-primary-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          statusDot[value] || "bg-gray-400"
                        )}
                      />
                      {label} ({statusCounts[value]})
                    </button>
                  ))}
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-gray-500"
                    onClick={clearFilters}
                  >
                    <FilterX className="mr-1 h-3.5 w-3.5" />
                    {trc("clear", "Tozalash")}
                  </Button>
                )}
              </div>

              {/* Nechtasi ko'rinayotgani — filtr qo'yilganda ro'yxat qanchaga
                  qisqarganini bilish kerak */}
              {hasFilters && (
                <p className="text-[11px] text-gray-500">
                  {tr("{{count}} tadan", { count: reservations.length })}{" "}
                  <span className="font-semibold text-gray-700">
                    {filtered.length}
                  </span>{" "}{tr("ta ko'rsatilmoqda", { count: filtered.length })}
                </p>
              )}
            </div>
          </>
        )}

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-0.5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr("Yuklanmoqda...")}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {apiErrorMessage(error)}
            </p>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
              <CalendarCheck className="h-8 w-8" />
              <p className="text-sm">
                {hasFilters
                  ? tr("Filtr bo'yicha bandlov topilmadi")
                  : tr("Bu xonada hali bandlov yo'q")}
              </p>
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  {tr("Filtrlarni tozalash")}
                </Button>
              )}
            </div>
          )}

          {filtered.map((res) => (
            <ReservationItem
              key={res.id}
              res={res}
              roomNumber={room?.room_number}
              onOpen={() => setDetailId(res.id)}
            />
          ))}
        </div>
      </DialogContent>

      {/* Band ustiga bosilganda — to'liq ma'lumot. Ro'yxat oynasi ochiq
          qoladi, shuning uchun yopilgach xodim o'sha joyiga qaytadi. */}
      <ReservationDetailDialog
        reservation={detail}
        onClose={() => setDetailId(null)}
      />
    </Dialog>
  )
}

// Bitta bandlov bandi — bandlovlar ro'yxatidagi qator bilan bir xil mazmun
const ReservationItem = ({
  res,
  roomNumber,
  onOpen,
}: {
  res: RoomReservation
  roomNumber?: string
  onOpen: () => void
}) => {
  const isHourly = (res.booking_type || "").toUpperCase() === "HOURLY"
  const timeRange =
    isHourly && res.check_in_datetime && res.check_out_datetime
      ? `${String(res.check_in_datetime).slice(11, 16)} – ${String(res.check_out_datetime).slice(11, 16)}`
      : ""
  const nightCount = isHourly ? 0 : nights(res.check_in_date, res.check_out_date)
  const debt = Number(res.total_amount || 0) - Number(res.paid_amount || 0)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      title={tr("To'liq ma'lumot")}
      className={cn(
        "cursor-pointer rounded-2xl border border-l-4 bg-white p-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        statusEdge[res.status] || "border-l-transparent"
      )}
    >
      {/* Yuqori qator: bandlov raqami + turi, o'ng tomonda chek tugmasi */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-tight text-gray-900">
            {res.reservation_number || res.id.slice(0, 8)}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs leading-tight text-gray-400">
            {isHourly ? (
              <>
                <Clock className="h-3 w-3" />{" "}{tr("Soatlik")}
              </>
            ) : (
              <>
                <CalendarDays className="h-3 w-3" />{" "}{tr("Kunlik")}
              </>
            )}
          </p>
        </div>
        {/* Chek — arxivdagi bronlar uchun ham; bron ma'lumotidan quriladi,
            shuning uchun qo'shimcha yozuv talab qilmaydi.
            Bosilishi bandning o'ziga o'tmasin: aks holda chek bilan birga
            tafsilot oynasi ham ochilardi. */}
        <span onClick={(e) => e.stopPropagation()}>
          <ReservationReceiptButton
            reservation={res}
            compact
            guestName={res.guest_name}
            roomNumber={roomNumber}
          />
        </span>
      </div>

      {/* Mehmon: avatar + ism + telefon */}
      <div className="mt-2.5">
        {res.guest_name ? (
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700">
              {initials(res.guest_name)}
            </span>
            <span className="min-w-0">
              <p className="truncate leading-tight text-gray-900">{res.guest_name}</p>
              {res.guest_phone && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs leading-tight text-gray-400">
                  <Phone className="h-3 w-3" />
                  {res.guest_phone}
                </p>
              )}
            </span>
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </div>

      {/* Hamrohlar — xonada yana kim turgani */}
      {res.companions && res.companions.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
          <Users className="h-3.5 w-3.5 text-gray-400" />
          {res.companions
            // Turish davomida ketgani ham ro'yxatda qoladi — belgisi bilan
            .map((c) => (c.name || tr("Ismsiz mehmon")) + (c.left_at ? tr(" (ketdi)") : ""))
            .join(", ")}
        </p>
      )}

      {/* Muddat va summa (chegirma / to'langan qismi bilan) */}
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {isHourly ? (
            <>
              <p className="leading-tight text-gray-700">{res.check_in_date}</p>
              <p className="mt-0.5 text-xs leading-tight text-gray-400">
                {timeRange || "—"}
              </p>
            </>
          ) : (
            <>
              <p className="leading-tight text-gray-700">
                {res.check_in_date} → {res.check_out_date}
              </p>
              <p className="mt-0.5 text-xs leading-tight text-gray-400">
                {tr("{{nightCount}} kecha", { nightCount })}
              </p>
            </>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-semibold leading-tight tabular-nums text-gray-900">
            {fmt(res.total_amount)}{" "}
            <span className="text-xs font-normal text-gray-400">{tr("So'm")}</span>
          </p>
          {Number(res.discount_amount || 0) > 0 && (
            <p className="mt-0.5 text-xs leading-tight text-red-500">
              {tr("Chegirma: −{{discount_amount}}", { discount_amount: fmt(res.discount_amount) })}
            </p>
          )}
          {Number(res.paid_amount || 0) > 0 &&
            Number(res.paid_amount) < Number(res.total_amount || 0) && (
              <p className="mt-0.5 text-xs leading-tight text-emerald-600">
                {tr("To'landi: {{paid_amount}}", { paid_amount: fmt(res.paid_amount) })}
              </p>
            )}
          {debt > 0 && res.status !== "CANCELLED" && (
            <p className="mt-0.5 text-xs font-medium leading-tight tabular-nums text-red-600">
              {tr("Qarz: {{debt}}", { debt: fmt(debt) })}
            </p>
          )}
        </div>
      </div>

      {/* Pastki qator: holat va to'lov belgilari */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2.5">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            statusBadge[res.status] || statusBadge.PENDING
          )}
        >
          {STATUS_LABELS[res.status] || res.status}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            payBadge[res.payment_status] || payBadge.UNPAID
          )}
        >
          {PAY_LABELS[res.payment_status] || res.payment_status}
        </span>
        {(res.adults || res.children) && (
          <span className="text-xs text-gray-400">
            {tr("{{adults}}{{v}} kishi", { adults: res.adults, v: res.children ? `+${res.children}` : "" })}
          </span>
        )}
        {res.status === "CANCELLED" && res.cancelled_reason && (
          <span className="w-full truncate text-[11px] text-red-500">
            {tr("Sabab: {{cancelled_reason}}", { cancelled_reason: res.cancelled_reason })}
          </span>
        )}
      </div>
    </div>
  )
}
