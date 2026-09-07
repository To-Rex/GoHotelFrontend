import { useMemo, useState, type ReactNode } from "react"
import { format } from "date-fns"
import {
  BookOpenText,
  CircleCheck,
  CircleX,
  Clock3,
  DoorOpen,
  HandHelping,
  Lightbulb,
  Loader2,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import type {
  FeedbackPriority,
  FeedbackStatus,
  FeedbackType,
  GuestFeedback,
  Reservation,
} from "@/types/api"
import { usePermissions } from "@/lib/permissions"
import { useAuthStore } from "@/store/auth"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useReservations } from "@/features/reservations/api/reservations"
import { useRooms } from "@/features/rooms/api/rooms"
import { useGuests } from "@/features/guests/api/guests"
import { useEmployees } from "@/features/employees/api/employees"
import {
  useCreateFeedback,
  useDeleteFeedback,
  useFeedbackList,
  useSetFeedbackStatus,
  useUpdateFeedback,
} from "../api/feedback"
import {
  FEEDBACK_CREATE_CODES,
  FEEDBACK_MANAGE_CODES,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  TYPE_LABELS,
  TYPE_STYLES,
  countByStatus,
  defaultPriorityFor,
  filterFeedback,
  isClosed,
  nextStatuses,
  requiresResolution,
  type StatusTab,
} from "../lib/feedbackRules"

const selectClass =
  "w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
const textareaClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

const TYPES: FeedbackType[] = ["REQUEST", "SUGGESTION", "COMPLAINT"]
const PRIORITIES: FeedbackPriority[] = ["LOW", "MEDIUM", "HIGH"]
const STATUSES: FeedbackStatus[] = ["NEW", "IN_PROGRESS", "RESOLVED", "REJECTED"]

const TYPE_ICONS: Record<FeedbackType, LucideIcon> = {
  REQUEST: HandHelping,
  SUGGESTION: Lightbulb,
  COMPLAINT: TriangleAlert,
}

// "Ochiq" — standart ko'rinish: kitob bilan ishlaydigan xodimga hali
// yopilmaganlar kerak; yopilganlar tarix sifatida alohida tabda
const TABS: { key: StatusTab; label: string }[] = [
  { key: "OPEN", label: "Ochiq" },
  { key: "NEW", label: "Yangi" },
  { key: "IN_PROGRESS", label: "Ko'rib chiqilmoqda" },
  { key: "RESOLVED", label: "Hal qilindi" },
  { key: "REJECTED", label: "Rad etildi" },
  { key: "ALL", label: "Barchasi" },
]

const when = (iso?: string | null) =>
  iso ? format(new Date(iso), "dd.MM.yyyy HH:mm") : "—"

const Chip = ({ className, children }: { className: string; children: ReactNode }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
      className
    )}
  >
    {children}
  </span>
)

const TypeChip = ({ type }: { type: FeedbackType }) => {
  const Icon = TYPE_ICONS[type]
  return (
    <Chip className={TYPE_STYLES[type]}>
      <Icon className="h-3 w-3" />
      {TYPE_LABELS[type]}
    </Chip>
  )
}

const StatusChip = ({ status }: { status: FeedbackStatus }) => (
  <Chip className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Chip>
)

/** Mehmon va xona — jadval, karta va oynada bir xil ko'rinish */
const WhoWhere = ({ item }: { item: GuestFeedback }) => (
  <div className="min-w-0 text-sm">
    <p className="flex items-center gap-1.5 truncate text-gray-800">
      <UserRound className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      {item.guest_name || <span className="text-gray-400">Mehmon ko'rsatilmagan</span>}
    </p>
    {(item.room_number || item.guest_phone) && (
      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
        {item.room_number && (
          <span className="inline-flex items-center gap-1">
            <DoorOpen className="h-3 w-3" />
            {item.room_number}-xona
          </span>
        )}
        {item.guest_phone && (
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {item.guest_phone}
          </span>
        )}
      </p>
    )}
  </div>
)

export const FeedbackPage = () => {
  const { can, isAdmin } = usePermissions()
  const user = useAuthStore((s) => s.user)
  // Qoidalar backend feedback_service.py bilan bir xil (feedbackRules.ts)
  const canCreate = can(...FEEDBACK_CREATE_CODES)
  const canManage = can(...FEEDBACK_MANAGE_CODES)
  // Kitobdan yozuv o'chirish — administrator yoki alohida feedback.manage
  const canDelete = isAdmin || can("feedback.manage")

  const [tab, setTab] = useState<StatusTab>("OPEN")
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "ALL">("ALL")
  const [query, setQuery] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading, isFetching } = useFeedbackList()
  // Bo'sh massiv ham memo'da — aks holda har renderda yangi bo'lib,
  // quyidagi hisoblar bekorga qayta ishlanardi
  const items = useMemo(() => data?.items ?? [], [data])
  const counts = useMemo(() => countByStatus(items), [items])
  const shown = useMemo(
    () => filterFeedback(items, { tab, type: typeFilter, query }),
    [items, tab, typeFilter, query]
  )
  // Ro'yxatdan olinadi (nusxa emas) — holat o'zgargach oyna ham yangilanadi
  const selected = items.find((f) => f.id === selectedId) ?? null

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Talab, taklif va shikoyatlar</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Talab, taklif va shikoyatlar</h1>
          <p className="mt-1 text-sm text-gray-500">
            Mehmon murojaatlari kitobi · ochiq: {counts.OPEN} · jami: {counts.ALL}
            {isFetching && (
              <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin text-gray-400" />
            )}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Yangi murojaat
          </Button>
        )}
      </div>

      {/* Holat kartalari — bosilsa o'sha holat filtrlanadi, qayta bosilsa "Ochiq" */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(tab === s ? "OPEN" : s)}
            aria-pressed={tab === s}
            className={cn(
              "rounded-lg border bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50",
              tab === s && "ring-2 ring-primary-500/40"
            )}
          >
            <p className="text-xs text-gray-500">{STATUS_LABELS[s]}</p>
            <p className="text-2xl font-bold text-gray-900">{counts[s]}</p>
          </button>
        ))}
      </div>

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.key
                  ? "border-primary-600 bg-primary-50 text-primary-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {t.label} · {counts[t.key]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", ...TYPES] as (FeedbackType | "ALL")[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              aria-pressed={typeFilter === t}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                typeFilter === t
                  ? t === "ALL"
                    ? "border-gray-800 bg-gray-800 text-white"
                    : TYPE_STYLES[t]
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {t === "ALL" ? "Hamma tur" : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-8"
            placeholder="Qidirish: mavzu, mehmon, xona…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* MOBIL: kartalar */}
      <div className="space-y-2.5 md:hidden">
        {shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
            Murojaatlar yo'q
          </div>
        ) : (
          shown.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              className="w-full rounded-2xl border bg-white p-3.5 text-left"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <TypeChip type={f.feedback_type} />
                <StatusChip status={f.status} />
                {f.priority === "HIGH" && (
                  <Chip className={PRIORITY_STYLES.HIGH}>Yuqori</Chip>
                )}
                <span className="ml-auto text-[11px] text-gray-400">{when(f.created_at)}</span>
              </div>
              <p className="mt-2 font-medium leading-tight text-gray-900">{f.subject}</p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-gray-500">{f.body}</p>
              <div className="mt-3 border-t border-gray-100 pt-2.5">
                <WhoWhere item={f} />
              </div>
            </button>
          ))
        )}
      </div>

      {/* DESKTOP/PLANSHET: jadval */}
      <div className="hidden overflow-hidden rounded-lg border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead>Sana</TableHead>
              <TableHead>Tur</TableHead>
              <TableHead>Murojaat</TableHead>
              <TableHead>Mehmon / xona</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>Mas'ul</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <BookOpenText className="h-8 w-8" />
                    <p className="text-sm">Murojaatlar yo'q</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              shown.map((f) => (
                <TableRow
                  key={f.id}
                  onClick={() => setSelectedId(f.id)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <TableCell className="whitespace-nowrap text-gray-600">
                    {when(f.created_at)}
                  </TableCell>
                  <TableCell>
                    <TypeChip type={f.feedback_type} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium leading-tight text-gray-900">{f.subject}</p>
                    <p className="mt-0.5 max-w-[320px] truncate text-xs leading-tight text-gray-400">
                      {f.body}
                    </p>
                  </TableCell>
                  <TableCell>
                    <WhoWhere item={f} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusChip status={f.status} />
                      {f.priority === "HIGH" && (
                        <Chip className={PRIORITY_STYLES.HIGH}>Yuqori</Chip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-700">
                    {f.assigned_to_name || <span className="text-gray-300">—</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {createOpen && (
        <CreateFeedbackDialog
          hotelId={user?.hotel_id}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {selected && (
        <FeedbackDetailDialog
          item={selected}
          canManage={canManage}
          canDelete={canDelete}
          hotelId={user?.hotel_id}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

/* Yangi murojaat. Komponent faqat oyna ochiq paytda mavjud — mehmon, xona va
   xodim ro'yxatlari ham shunda so'raladi (sahifa ochilishi bilan emas). */
function CreateFeedbackDialog({
  hotelId,
  onClose,
}: {
  hotelId?: string
  onClose: () => void
}) {
  const { data: reservations = [] } = useReservations("CHECKED_IN")
  const { data: rooms = [] } = useRooms()
  const { data: guests = [] } = useGuests()
  const { data: employees = [] } = useEmployees()
  const createMutation = useCreateFeedback()

  const [type, setType] = useState<FeedbackType>("REQUEST")
  const [priority, setPriority] = useState<FeedbackPriority>(defaultPriorityFor("REQUEST"))
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [reservationId, setReservationId] = useState("")
  const [roomId, setRoomId] = useState("")
  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Yashab turgan mehmonlar — "101-xona — Ali Valiyev" ko'rinishida
  const stayOptions = useMemo(() => {
    const roomNumber = (id: string) =>
      rooms.find((r) => r.id === id)?.room_number ?? "?"
    const guestNameOf = (r: Reservation) => {
      const g = guests.find((x) => x.id === r.guest_id)
      return g ? `${g.first_name} ${g.last_name}`.trim() : r.reservation_number
    }
    return reservations
      .map((r) => {
        const room = roomNumber(r.room_id)
        return { id: r.id, room, label: `${room}-xona — ${guestNameOf(r)}` }
      })
      .sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }))
  }, [reservations, rooms, guests])

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) =>
        String(a.room_number).localeCompare(String(b.room_number), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    [rooms]
  )
  const staff = useMemo(
    () => employees.filter((e) => e.status === "ACTIVE"),
    [employees]
  )

  const pickType = (t: FeedbackType) => {
    setType(t)
    setPriority(defaultPriorityFor(t))
  }

  const submit = async () => {
    if (!subject.trim()) {
      setError("Mavzuni kiriting")
      return
    }
    if (!body.trim()) {
      setError("Murojaat matnini kiriting")
      return
    }
    setError(null)
    // Bron tanlangan bo'lsa mehmon va xona serverda undan olinadi —
    // qo'lda yozilgan maydonlar yuborilmaydi
    const manual = !reservationId
    try {
      await createMutation.mutateAsync({
        feedback_type: type,
        priority,
        subject: subject.trim(),
        body: body.trim(),
        reservation_id: reservationId || undefined,
        room_id: manual && roomId ? roomId : undefined,
        guest_name: manual && guestName.trim() ? guestName.trim() : undefined,
        guest_phone: manual && guestPhone.trim() ? guestPhone.trim() : undefined,
        assigned_to: assignedTo || undefined,
        hotelId,
      })
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Yangi murojaat</DialogTitle>
          <DialogDescription>
            Mehmon aytganini kitobga yozing — shikoyat bo'lsa menejerlarga xabar ketadi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => {
              const Icon = TYPE_ICONS[t]
              const active = t === type
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickType(t)}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors",
                    active ? TYPE_STYLES[t] : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {TYPE_LABELS[t]}
                </button>
              )
            })}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Mavzu *</label>
            <Input
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Masalan: Konditsioner ishlamaydi"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Murojaat matni *</label>
            <textarea
              className={textareaClass}
              rows={4}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Mehmon nima dedi — o'z so'zlari bilan"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Muhimlik</label>
              <select
                className={selectClass}
                value={priority}
                onChange={(e) => setPriority(e.target.value as FeedbackPriority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            {staff.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Mas'ul xodim</label>
                <select
                  className={selectClass}
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                >
                  <option value="">— keyinroq —</option>
                  {staff.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border bg-gray-50/60 p-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Mehmon (yashab turganlardan)</label>
              <select
                className={selectClass}
                value={reservationId}
                onChange={(e) => setReservationId(e.target.value)}
              >
                <option value="">— bog'lanmagan / qo'lda yoziladi —</option>
                {stayOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400">
                Tanlansa mehmon, xona va bron avtomatik bog'lanadi.
              </p>
            </div>
            {!reservationId && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Ism-familiya</label>
                  <Input
                    value={guestName}
                    maxLength={200}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Mehmon ismi"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Telefon</label>
                  <Input
                    value={guestPhone}
                    maxLength={50}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+998 ..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Xona</label>
                  <select
                    className={selectClass}
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                  >
                    <option value="">—</option>
                    {sortedRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.room_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {error && <p className="whitespace-pre-line text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* Mas'ul xodimni tanlash — o'zgarishi bilan saqlanadi. Alohida komponent:
   xodimlar ro'yxati faqat boshqaruv huquqi borlarda so'raladi. */
function AssigneeSelect({ item, hotelId }: { item: GuestFeedback; hotelId?: string }) {
  const { data: employees = [] } = useEmployees()
  const updateMutation = useUpdateFeedback()
  const active = employees.filter((e) => e.status === "ACTIVE")
  const knownAssignee =
    !item.assigned_to || active.some((e) => e.id === item.assigned_to)

  const change = async (value: string) => {
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        hotelId,
        assigned_to: value || null,
      })
    } catch (e) {
      alert(apiErrorMessage(e))
    }
  }

  return (
    <select
      className={selectClass}
      value={item.assigned_to ?? ""}
      disabled={updateMutation.isPending}
      onChange={(e) => change(e.target.value)}
    >
      <option value="">— mas'ul yo'q —</option>
      {active.map((e) => (
        <option key={e.id} value={e.id}>
          {e.first_name} {e.last_name}
        </option>
      ))}
      {/* Ro'yxatda bo'lmagan (masalan ishdan ketgan) mas'ul ham ko'rinsin */}
      {!knownAssignee && (
        <option value={item.assigned_to ?? ""}>
          {item.assigned_to_name || "Noma'lum xodim"}
        </option>
      )}
    </select>
  )
}

function FeedbackDetailDialog({
  item,
  canManage,
  canDelete,
  hotelId,
  onClose,
}: {
  item: GuestFeedback
  canManage: boolean
  canDelete: boolean
  hotelId?: string
  onClose: () => void
}) {
  const statusMutation = useSetFeedbackStatus()
  const updateMutation = useUpdateFeedback()
  const deleteMutation = useDeleteFeedback()
  const [resolution, setResolution] = useState(item.resolution ?? "")
  const [error, setError] = useState<string | null>(null)
  const busy =
    statusMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const dirty = resolution.trim() !== (item.resolution ?? "").trim()

  const changeStatus = async (next: FeedbackStatus) => {
    const text = resolution.trim()
    // Server ham shuni talab qiladi (RESOLUTION_REQUIRED) — bu yerda
    // aniqroq matn bilan oldindan aytiladi
    if (requiresResolution(next) && !text) {
      setError("Yopishdan oldin «Javob» qatoriga nima qilinganini yozing")
      return
    }
    setError(null)
    try {
      await statusMutation.mutateAsync({
        id: item.id,
        hotelId,
        status: next,
        resolution: text || undefined,
      })
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const saveResolution = async () => {
    setError(null)
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        hotelId,
        resolution: resolution.trim() || null,
      })
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const remove = async () => {
    if (!confirm(`«${item.subject}» murojaatini o'chirasizmi?`)) return
    try {
      await deleteMutation.mutateAsync({ id: item.id, hotelId })
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeChip type={item.feedback_type} />
            <StatusChip status={item.status} />
            <Chip className={PRIORITY_STYLES[item.priority]}>
              Muhimlik: {PRIORITY_LABELS[item.priority]}
            </Chip>
          </div>
          <DialogTitle className="pr-6 leading-snug">{item.subject}</DialogTitle>
          <DialogDescription>
            {when(item.created_at)} · kiritdi: {item.created_by_name || "Noma'lum"}
            {item.reservation_number ? ` · ${item.reservation_number}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-800">
            {item.body}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-gray-500">Mehmon</p>
              <div className="mt-1">
                <WhoWhere item={item} />
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-gray-500">Mas'ul xodim</p>
              <div className="mt-1">
                {canManage ? (
                  <AssigneeSelect item={item} hotelId={hotelId} />
                ) : (
                  <p className="text-sm text-gray-800">
                    {item.assigned_to_name || (
                      <span className="text-gray-400">Belgilanmagan</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Javob / nima qilindi
              {!isClosed(item.status) && (
                <span className="font-normal text-gray-400"> (yopishda shart)</span>
              )}
            </label>
            {canManage ? (
              <>
                <textarea
                  className={textareaClass}
                  rows={3}
                  maxLength={5000}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Masalan: Konditsioner ta'mirlandi, mehmondan uzr so'raldi"
                />
                {dirty && (
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={saveResolution} disabled={busy}>
                      Javobni saqlash
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {item.resolution || <span className="text-gray-400">Hali javob yo'q</span>}
              </p>
            )}
            {item.resolved_at && (
              <p className="text-xs text-gray-400">
                Yopildi: {when(item.resolved_at)}
                {item.resolved_by_name ? ` · ${item.resolved_by_name}` : ""}
              </p>
            )}
          </div>

          {error && <p className="whitespace-pre-line text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:items-center">
          {canDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-600 disabled:opacity-60 sm:mr-auto"
            >
              <Trash2 className="h-4 w-4" />
              O'chirish
            </button>
          )}
          {canManage &&
            nextStatuses(item.status).map((s) => {
              const reopen = s === "IN_PROGRESS" && isClosed(item.status)
              const label =
                s === "RESOLVED"
                  ? "Hal qilindi"
                  : s === "REJECTED"
                    ? "Rad etish"
                    : reopen
                      ? "Qayta ochish"
                      : "Ko'rib chiqishga olish"
              const Icon =
                s === "RESOLVED"
                  ? CircleCheck
                  : s === "REJECTED"
                    ? CircleX
                    : reopen
                      ? RotateCcw
                      : Clock3
              const style =
                s === "RESOLVED"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : s === "REJECTED"
                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
              return (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => changeStatus(s)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                    style
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              )
            })}
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
