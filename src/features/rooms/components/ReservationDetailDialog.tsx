import {
  ArrowRight,
  Banknote,
  BadgeCheck,
  Cake,
  CalendarDays,
  Clock,
  DoorOpen,
  FileText,
  Flag,
  History,
  IdCard,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  ScanFace,
  StickyNote,
  User as UserIcon,
  Users,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ReservationReceiptButton } from "@/features/reservations/components/ReservationReceiptButton"
import { GuestQuickEdit } from "@/features/guests/components/GuestQuickEdit"
import { cn } from "@/lib/utils"
import type { RoomReservation, ReservationOccupant } from "../api/rooms"
import {
  debtOf,
  formatDate,
  formatDateTime,
  hourCount,
  isHourly,
  nightCount,
  occupantsOf,
  overpaidOf,
  stayLabel,
} from "../lib/reservationDetail"

/**
 * Bitta bandlovning to'liq ma'lumoti: kim, qachon, qayerda, qancha.
 *
 * Bandlovlar ro'yxatidagi band ustiga bosilganda ochiladi. Ro'yxatdagi band
 * ataylab qisqa — ko'zdan kechirish uchun; bu yerda esa yozuvda bor
 * hamma narsa bir joyda, jumladan ro'yxatga sig'maydigan qismlari: kim
 * yaratgan va bekor qilgan, xona ko'chirishlar tarixi, chegirma foizi,
 * chiqish so'ralgan payt.
 *
 * Ma'lumot ro'yxat bilan bitta so'rovdan keladi — bosilganda yana kutib
 * turishning hojati yo'q.
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

const PAY_LABELS: Record<string, string> = {
  UNPAID: "To'lanmagan",
  PARTIALLY_PAID: "Qisman to'langan",
  PAID: "To'langan",
  REFUNDED: "Qaytarilgan",
}

const payBadge: Record<string, string> = {
  UNPAID: "bg-red-100 text-red-600",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  REFUNDED: "bg-gray-100 text-gray-500",
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

/** Bo'lim sarlavhasi bilan quti. */
const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserIcon
  title: string
  children: React.ReactNode
}) => (
  <section className="rounded-xl border border-gray-200 bg-white p-3.5">
    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
      <Icon className="h-3.5 w-3.5" />
      {title}
    </h3>
    {children}
  </section>
)

/**
 * Nomi va qiymati. Qiymat bo'sh bo'lsa qator umuman chizilmaydi — bo'sh
 * "—" lar ro'yxatni uzaytirib, muhimini ko'mib yuborardi.
 */
const Row = ({
  label,
  value,
  accent,
}: {
  label: string
  value?: React.ReactNode
  accent?: string
}) => {
  if (value === null || value === undefined || value === "") return null
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="flex-shrink-0 text-xs text-gray-500">{label}</span>
      <span
        className={cn(
          "min-w-0 break-words text-right text-sm font-medium text-gray-900",
          accent
        )}
      >
        {value}
      </span>
    </div>
  )
}

/** Mehmon kartochkasidagi bitta qator — qiymati bo'sh bo'lsa chizilmaydi. */
const Fact = ({
  icon: Icon,
  value,
  title,
}: {
  icon: typeof UserIcon
  value?: React.ReactNode
  title: string
}) => {
  if (value === null || value === undefined || value === "") return null
  return (
    <span
      title={title}
      className="inline-flex min-w-0 items-center gap-1 text-xs text-gray-600"
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
      <span className="break-words">{value}</span>
    </span>
  )
}

/**
 * Xonada turgan bir kishining kartochkasi.
 *
 * Hujjat, fuqarolik, tug'ilgan sana — xodim bularni ko'rish uchun mehmonlar
 * sahifasiga o'tib qidirishi kerak edi. Bo'sh maydonlar chizilmaydi, shuning
 * uchun ma'lumoti kam mehmon bir qatordan iborat bo'lib qoladi.
 *
 * TELEFON va PASSPORT shu yerning o'zida tahrirlanadi. Aynan shu ikkitasi
 * xato kiritiladi va aynan shu yerda — mehmon qarshisida turganda — bilinadi.
 * Qolgan maydonlar uchun mehmonlar sahifasi bor: to'liq shakl bu oynani
 * og'irlashtirardi.
 */
const OccupantCard = ({ person }: { person: ReservationOccupant }) => {
  const doc =
    [person.id_document_type, person.id_document_number]
      .filter(Boolean)
      .join(" ") || null

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold leading-tight text-gray-900">
          {person.name || "Ism ko'rsatilmagan"}
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            person.is_primary
              ? "bg-primary-100 text-primary-700"
              : "bg-gray-200 text-gray-600"
          )}
        >
          {person.is_primary ? "Asosiy mehmon" : "Hamroh"}
        </span>
        {person.has_face && (
          <span
            title="Yuz biriktirilgan — kamera taniydi"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
          >
            <ScanFace className="h-3 w-3" />
            Yuz
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        <Fact icon={Phone} value={person.phone} title="Telefon" />
        <Fact icon={Mail} value={person.email} title="Email" />
        <Fact
          icon={BadgeCheck}
          value={person.passport_number}
          title="Passport raqami"
        />
        <Fact icon={IdCard} value={doc} title="Hujjat" />
        <Fact icon={Flag} value={person.nationality} title="Fuqaroligi" />
        <Fact
          icon={Cake}
          value={formatDate(person.birth_date)}
          title="Tug'ilgan sana"
        />
        <Fact icon={MapPinned} value={person.address} title="Manzil" />
        <Fact icon={StickyNote} value={person.notes} title="Mehmon haqida izoh" />
      </div>

      {/* Ma'lumotni shu yerning o'zida to'g'rilash */}
      <GuestQuickEdit guest={person} className="mt-1.5" />

      {/* Bronda ismi bor, lekin bazada topilmagan hamroh: o'chirilgan
          bo'lishi mumkin. Yozuv yo'qolmagani, faqat kartochkasi yo'qligi
          aytiladi — aks holda "ma'lumot yo'q" xatoga o'xshab ko'rinardi. */}
      {!person.guest_id && (
        <p className="mt-1 text-[11px] text-gray-400">
          Mehmonlar bazasida topilmadi — bronda saqlangan ism
        </p>
      )}
    </div>
  )
}

interface Props {
  reservation: RoomReservation | null
  onClose: () => void
}

export const ReservationDetailDialog = ({ reservation, onClose }: Props) => {
  const res = reservation
  if (!res) return null

  const hourly = isHourly(res)
  const nights = nightCount(res)
  const hours = hourCount(res)
  const debt = debtOf(res)
  const overpaid = overpaidOf(res)
  const occupants = occupantsOf(res)
  const moves = res.room_moves || []

  // "3-qavat" yoki nomi berilgan bo'lsa o'sha
  const floorLabel =
    res.floor_name ||
    (res.floor_number !== null && res.floor_number !== undefined
      ? `${res.floor_number}-qavat`
      : null)

  const place = [res.branch_name, floorLabel].filter(Boolean).join(" · ")

  return (
    <Dialog open={!!res} onOpenChange={(open) => !open && onClose()}>
      {/* Ro'yxat oynasidan kengroq: bu yerda ustunli ma'lumot ko'p */}
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            <span className="break-all">
              {res.reservation_number || res.id.slice(0, 8)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                statusBadge[res.status] || "bg-gray-100 text-gray-500"
              )}
            >
              {STATUS_LABELS[res.status] || res.status}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                payBadge[res.payment_status] || "bg-gray-100 text-gray-500"
              )}
            >
              {PAY_LABELS[res.payment_status] || res.payment_status}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* ------------------------------------------------------ KIM */}
          <Section icon={UserIcon} title="Xonada turganlar">
            <Row
              label="Mehmonlar soni"
              value={
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-gray-400" />
                  {res.adults} kattalar
                  {res.children ? `, ${res.children} bolalar` : ""}
                </span>
              }
            />
            {/* Har bir kishi o'z kartochkasi bilan: hujjat, fuqarolik,
                tug'ilgan sana. Eski bronlarda bu ma'lumot kelmasligi
                mumkin — o'shanda bron yozuviga qaytamiz. */}
            <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
              {occupants.length > 0 ? (
                occupants.map((person, i) => (
                  <OccupantCard key={person.guest_id || `${person.name}-${i}`} person={person} />
                ))
              ) : (
                <p className="text-sm text-gray-400">Mehmon ko'rsatilmagan</p>
              )}
            </div>
          </Section>

          {/* --------------------------------------------------- QACHON */}
          <Section icon={hourly ? Clock : CalendarDays} title="Muddat">
            <p className="text-base font-semibold leading-tight text-gray-900">
              {stayLabel(res)}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {hourly
                ? `Soatlik${hours ? ` · ${hours} soat` : ""}`
                : `Kunlik${nights ? ` · ${nights} kecha` : ""}`}
            </p>
            <div className="mt-2 border-t border-gray-100 pt-2">
              <Row label="Kirish sanasi" value={formatDate(res.check_in_date)} />
              <Row label="Chiqish sanasi" value={formatDate(res.check_out_date)} />
              <Row
                label="Chiqish so'ralgan"
                value={formatDateTime(res.checkout_requested_at)}
              />
            </div>
          </Section>

          {/* --------------------------------------------------- QAYERDA */}
          <Section icon={MapPin} title="Joylashuv">
            <p className="flex items-center gap-1.5 text-base font-semibold leading-tight text-gray-900">
              <DoorOpen className="h-4 w-4 text-gray-400" />
              {res.room_number ? `${res.room_number}-xona` : "Xona"}
            </p>
            <div className="mt-2 border-t border-gray-100 pt-2">
              <Row label="Xona turi" value={res.room_type_name} />
              <Row label="Filial" value={res.branch_name} />
              <Row label="Qavat" value={floorLabel} />
              {!place && !res.room_type_name && (
                <p className="py-1 text-xs text-gray-400">
                  Qo'shimcha ma'lumot yo'q
                </p>
              )}
            </div>
          </Section>

          {/* --------------------------------------------------- QANCHA */}
          <Section icon={Banknote} title="Hisob-kitob">
            <p className="text-base font-bold tabular-nums leading-tight text-gray-900">
              {fmt(res.total_amount)} so'm
            </p>
            <p className="mt-0.5 text-xs text-gray-500">Jami summa</p>
            <div className="mt-2 border-t border-gray-100 pt-2">
              <Row
                label="Chegirma"
                value={
                  Number(res.discount_amount) || Number(res.discount_percent)
                    ? [
                        Number(res.discount_amount)
                          ? `${fmt(res.discount_amount)} so'm`
                          : null,
                        Number(res.discount_percent)
                          ? `${res.discount_percent}%`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : null
                }
              />
              <Row
                label="To'langan"
                value={`${fmt(res.paid_amount)} so'm`}
                accent="text-emerald-600"
              />
              <Row
                label="Qarz"
                value={debt ? `${fmt(debt)} so'm` : null}
                accent="text-red-600"
              />
              <Row
                label="Ortiqcha to'langan"
                value={overpaid ? `${fmt(overpaid)} so'm` : null}
                accent="text-amber-600"
              />
            </div>
          </Section>
        </div>

        {/* ------------------------------------------ XONA KO'CHIRISHLARI */}
        {moves.length > 0 && (
          <Section icon={History} title="Xona ko'chirishlari">
            <ul className="space-y-2">
              {moves.map((m, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                >
                  <span className="font-medium text-gray-900">
                    {m.from_room_number || "?"}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                  <span className="font-medium text-gray-900">
                    {m.to_room_number || "?"}
                  </span>
                  {m.moved_by_name && (
                    <span className="text-xs text-gray-500">
                      · {m.moved_by_name}
                    </span>
                  )}
                  {formatDateTime(m.moved_at) && (
                    <span className="text-xs text-gray-400">
                      · {formatDateTime(m.moved_at)}
                    </span>
                  )}
                  {Number(m.old_total) !== Number(m.new_total) && (
                    <span className="text-xs tabular-nums text-gray-500">
                      · {fmt(Number(m.old_total))} → {fmt(Number(m.new_total))} so'm
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ----------------------------------------------- XIZMAT YOZUVI */}
        <Section icon={FileText} title="Yozuv tarixi">
          <Row
            label="Yaratilgan"
            value={
              [formatDateTime(res.created_at), res.created_by_name]
                .filter(Boolean)
                .join(" · ") || null
            }
          />
          <Row
            label="O'zgartirilgan"
            value={
              // Yaratilgan payt bilan bir xil bo'lsa ko'rsatishning ma'nosi yo'q
              formatDateTime(res.updated_at) !== formatDateTime(res.created_at)
                ? formatDateTime(res.updated_at)
                : null
            }
          />
          <Row
            label="Bekor qilingan"
            value={
              [formatDateTime(res.cancelled_at), res.cancelled_by_name]
                .filter(Boolean)
                .join(" · ") || null
            }
            accent="text-red-600"
          />
          <Row label="Bekor qilish sababi" value={res.cancelled_reason} />
          <Row label="Izoh" value={res.notes} />
        </Section>

        <DialogFooter className="flex-wrap gap-2">
          <ReservationReceiptButton
            reservation={res}
            guestName={res.guest_name || undefined}
            roomNumber={res.room_number || undefined}
            roomType={res.room_type_name || undefined}
          />
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
