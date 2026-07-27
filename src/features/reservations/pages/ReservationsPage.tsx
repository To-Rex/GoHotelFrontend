import { useState, useMemo } from "react"
import {
  CalendarCheck,
  Search,
  Clock,
  CalendarDays,
  BedDouble,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  FilterX,
} from "lucide-react"
import { useReservations } from "../api/reservations"
import { useGuests } from "@/features/guests/api/guests"
import { useRooms, useFloors } from "@/features/rooms/api/rooms"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const selectClass =
  "flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

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

const statusDot: Record<string, string> = {
  PENDING: "bg-amber-500",
  CONFIRMED: "bg-blue-500",
  CHECKED_IN: "bg-emerald-500",
  CHECKED_OUT: "bg-gray-400",
  NO_SHOW: "bg-gray-400",
  CANCELLED: "bg-red-500",
}

const PAY_LABELS: Record<string, string> = {
  UNPAID: "To'lanmagan",
  PARTIALLY_PAID: "Qisman",
  PAID: "To'langan",
}

const payBadge: Record<string, string> = {
  UNPAID: "bg-red-100 text-red-600",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

// Kunlik bron uchun kechalar soni
function nights(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0
  const a = new Date(checkIn).getTime()
  const b = new Date(checkOut).getTime()
  return Math.max(Math.round((b - a) / 86400000), 0)
}

type SortKey = "number" | "guest" | "room" | "date" | "amount"
type SortState = { key: SortKey; dir: "asc" | "desc" } | null

export const ReservationsPage = () => {
  const { data: reservations = [], isLoading, isError } = useReservations()
  const { data: guests = [] } = useGuests()
  const { data: rooms = [] } = useRooms()
  const { data: floors = [] } = useFloors()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  // Qo'shimcha filtrlar: qavat, xona, bron turi, to'lov holati, kirish sanasi oralig'i
  const [floorFilter, setFloorFilter] = useState("")
  const [roomFilter, setRoomFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [payFilter, setPayFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  // Saralash: null bo'lsa API tartibi (eng yangi bronlar birinchi)
  const [sort, setSort] = useState<SortState>(null)

  const guestMap = useMemo(() => {
    const m: Record<string, { name: string; phone?: string }> = {}
    for (const g of guests) {
      m[g.id] = {
        name: `${g.first_name} ${g.last_name || ""}`.trim(),
        phone: g.phone,
      }
    }
    return m
  }, [guests])

  const roomMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const r of rooms) m[r.id] = r.room_number
    return m
  }, [rooms])

  // Xona -> qavat bog'lanishi (qavat filtri uchun)
  const roomFloorMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const r of rooms) m[r.id] = r.floor_id
    return m
  }, [rooms])

  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => a.floor_number - b.floor_number),
    [floors]
  )

  // Xona tanlovi ro'yxati — qavat tanlangan bo'lsa faqat o'sha qavatdagilar
  const roomOptions = useMemo(
    () =>
      [...rooms]
        .filter((r) => !floorFilter || r.floor_id === floorFilter)
        .sort((a, b) =>
          String(a.room_number).localeCompare(String(b.room_number), undefined, {
            numeric: true,
            sensitivity: "base",
          })
        ),
    [rooms, floorFilter]
  )

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of reservations) m[r.status] = (m[r.status] || 0) + 1
    return m
  }, [reservations])

  const filtered = useMemo(
    () =>
      reservations
        .filter((r) => !statusFilter || r.status === statusFilter)
        .filter((r) => !typeFilter || r.booking_type === typeFilter)
        .filter((r) => !payFilter || r.payment_status === payFilter)
        .filter((r) => !roomFilter || r.room_id === roomFilter)
        .filter((r) => !floorFilter || roomFloorMap[r.room_id] === floorFilter)
        .filter((r) => {
          // Kirish sanasi bo'yicha oraliq
          if (dateFrom && (r.check_in_date || "") < dateFrom) return false
          if (dateTo && (r.check_in_date || "") > dateTo) return false
          return true
        })
        .filter((r) => {
          if (!search.trim()) return true
          const q = search.toLowerCase()
          const guest = guestMap[r.guest_id]
          return (
            (r.reservation_number || "").toLowerCase().includes(q) ||
            (guest?.name || "").toLowerCase().includes(q) ||
            (guest?.phone || "").includes(q) ||
            (roomMap[r.room_id] || "").toLowerCase().includes(q)
          )
        }),
    [
      reservations,
      statusFilter,
      typeFilter,
      payFilter,
      roomFilter,
      floorFilter,
      dateFrom,
      dateTo,
      search,
      guestMap,
      roomMap,
      roomFloorMap,
    ]
  )

  // Saralash — tanlangan ustun bo'yicha; tanlanmagan bo'lsa API tartibi
  const sorted = useMemo(() => {
    if (!sort) return filtered
    const dir = sort.dir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "number":
          return (
            dir *
            String(a.reservation_number || "").localeCompare(
              String(b.reservation_number || ""),
              undefined,
              { numeric: true }
            )
          )
        case "guest":
          return (
            dir *
            (guestMap[a.guest_id]?.name || "").localeCompare(
              guestMap[b.guest_id]?.name || ""
            )
          )
        case "room":
          return (
            dir *
            (roomMap[a.room_id] || "").localeCompare(roomMap[b.room_id] || "", undefined, {
              numeric: true,
            })
          )
        case "date":
          return (
            dir *
            String(a.check_in_datetime || a.check_in_date || "").localeCompare(
              String(b.check_in_datetime || b.check_in_date || "")
            )
          )
        case "amount":
          return dir * (Number(a.total_amount || 0) - Number(b.total_amount || 0))
        default:
          return 0
      }
    })
  }, [filtered, sort, guestMap, roomMap])

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === "asc"
          ? { key, dir: "desc" }
          : null // uchinchi bosishda saralash bekor bo'ladi
        : { key, dir: "asc" }
    )
  }

  const hasActiveFilters =
    !!statusFilter ||
    !!floorFilter ||
    !!roomFilter ||
    !!typeFilter ||
    !!payFilter ||
    !!dateFrom ||
    !!dateTo ||
    !!search.trim()

  const clearFilters = () => {
    setSearch("")
    setStatusFilter("")
    setFloorFilter("")
    setRoomFilter("")
    setTypeFilter("")
    setPayFilter("")
    setDateFrom("")
    setDateTo("")
  }

  // Saralanadigan ustun sarlavhasi
  const sortHead = (key: SortKey, label: string, alignRight = false) => (
    <TableHead className={alignRight ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        title="Saralash"
        className={cn(
          "inline-flex items-center gap-1 hover:text-gray-900 transition-colors",
          alignRight && "w-full justify-end"
        )}
      >
        {label}
        {sort?.key === key ? (
          sort.dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 text-primary-600" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-primary-600" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Bandlovlar</h1>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  if (isError) {
    return <div>Xatolik yuz berdi. Iltimos qayta urining.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bandlovlar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Barcha bronlar tarixi · jami {reservations.length} ta
            {hasActiveFilters && (
              <span className="text-primary-700"> · natija: {sorted.length} ta</span>
            )}
          </p>
        </div>
      </div>

      {/* Qidiruv + holat bo'yicha filtr chiplari */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Raqam, mehmon yoki xona bo'yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              !statusFilter
                ? "border-primary-600 bg-primary-50 text-primary-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            Barchasi ({reservations.length})
          </button>
          {Object.entries(STATUS_LABELS)
            .filter(([value]) => statusCounts[value])
            .map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(statusFilter === value ? "" : value)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  statusFilter === value
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", statusDot[value] || "bg-gray-400")} />
                {label} ({statusCounts[value]})
              </button>
            ))}
        </div>
      </div>

      {/* Qo'shimcha filtrlar: qavat, xona, tur, to'lov, sana oralig'i */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Qavat</label>
          <select
            className={cn(selectClass, "w-36")}
            value={floorFilter}
            onChange={(e) => {
              setFloorFilter(e.target.value)
              // Qavat almashsa, unga tegishli bo'lmagan xona filtri tozalanadi
              setRoomFilter("")
            }}
          >
            <option value="">Barcha qavatlar</option>
            {sortedFloors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name || `${f.floor_number}-qavat`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Xona</label>
          <select
            className={cn(selectClass, "w-36")}
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
          >
            <option value="">Barcha xonalar</option>
            {roomOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_number}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Bron turi</label>
          <select
            className={cn(selectClass, "w-32")}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Barchasi</option>
            <option value="DAILY">Kunlik</option>
            <option value="HOURLY">Soatlik</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">To'lov</label>
          <select
            className={cn(selectClass, "w-36")}
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value)}
          >
            <option value="">Barchasi</option>
            {Object.entries(PAY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Kirish sanasi (dan)</label>
          <Input
            type="date"
            className="w-40"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Kirish sanasi (gacha)</label>
          <Input
            type="date"
            className="w-40"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="text-gray-500" onClick={clearFilters}>
            <FilterX className="h-4 w-4 mr-1.5" />
            Tozalash
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              {sortHead("number", "Bandlov")}
              {sortHead("guest", "Mehmon")}
              {sortHead("room", "Xona")}
              {sortHead("date", "Muddat")}
              <TableHead>Holati</TableHead>
              <TableHead>To'lov</TableHead>
              {sortHead("amount", "Summa", true)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <CalendarCheck className="h-8 w-8" />
                    <p className="text-sm">
                      {hasActiveFilters
                        ? "Filtr bo'yicha bandlov topilmadi"
                        : "Hozircha bandlovlar yo'q"}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" className="mt-1" onClick={clearFilters}>
                        Filtrlarni tozalash
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((res) => {
                const isHourly = res.booking_type === "HOURLY"
                const guest = guestMap[res.guest_id]
                const timeRange =
                  isHourly && res.check_in_datetime && res.check_out_datetime
                    ? `${res.check_in_datetime.slice(11, 16)} – ${res.check_out_datetime.slice(11, 16)}`
                    : ""
                const nightCount = isHourly ? 0 : nights(res.check_in_date, res.check_out_date)
                return (
                  <TableRow key={res.id}>
                    <TableCell>
                      <p className="font-semibold text-gray-900 leading-tight">
                        {res.reservation_number || res.id.slice(0, 8)}
                      </p>
                      <p className="inline-flex items-center gap-1 text-xs text-gray-400 leading-tight mt-0.5">
                        {isHourly ? (
                          <>
                            <Clock className="h-3 w-3" /> Soatlik
                          </>
                        ) : (
                          <>
                            <CalendarDays className="h-3 w-3" /> Kunlik
                          </>
                        )}
                      </p>
                    </TableCell>
                    <TableCell>
                      {guest ? (
                        <>
                          <p className="text-gray-900 leading-tight">{guest.name}</p>
                          {guest.phone && (
                            <p className="text-xs text-gray-400 leading-tight mt-0.5">
                              {guest.phone}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                          <BedDouble className="h-3.5 w-3.5" />
                        </span>
                        {roomMap[res.room_id] || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isHourly ? (
                        <>
                          <p className="text-gray-700 leading-tight">{res.check_in_date}</p>
                          <p className="text-xs text-gray-400 leading-tight mt-0.5">
                            {timeRange || "—"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-700 leading-tight">
                            {res.check_in_date} → {res.check_out_date}
                          </p>
                          <p className="text-xs text-gray-400 leading-tight mt-0.5">
                            {nightCount} kecha
                          </p>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-xs font-medium px-2.5 py-1 rounded-full",
                          statusBadge[res.status] || statusBadge.PENDING
                        )}
                      >
                        {STATUS_LABELS[res.status] || res.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-xs font-medium px-2.5 py-1 rounded-full",
                          payBadge[res.payment_status] || payBadge.UNPAID
                        )}
                      >
                        {PAY_LABELS[res.payment_status] || res.payment_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold text-gray-900 leading-tight">
                        {fmt(res.total_amount)}{" "}
                        <span className="text-xs font-normal text-gray-400">So'm</span>
                      </p>
                      {Number(res.paid_amount || 0) > 0 &&
                        Number(res.paid_amount) < Number(res.total_amount || 0) && (
                          <p className="text-xs text-emerald-600 leading-tight mt-0.5">
                            To'landi: {fmt(res.paid_amount)}
                          </p>
                        )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
