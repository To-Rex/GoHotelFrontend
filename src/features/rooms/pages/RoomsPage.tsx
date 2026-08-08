import { useState, useMemo } from "react"
import { DoorOpen, Plus, Pencil, Trash2, Loader2, RefreshCw, Search, Users, Layers, LayoutGrid, List, Clock, ChevronDown } from "lucide-react"
import { useReservations } from "@/features/reservations/api/reservations"
import {
  useRooms,
  useBranches,
  useFloors,
  useRoomTypes,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  useUpdateRoomStatus,
} from "../api/rooms"
import type { Room } from "@/types/api"
import { usePermissions } from "@/lib/permissions"
import { useAuthStore } from "@/store/auth"
import { apiErrorMessage } from "@/lib/apiError"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const selectClass =
  "w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Bo'sh",
  RESERVED: "Band qilingan",
  OCCUPIED: "Band",
  CLEANING: "Tozalanmoqda",
  MAINTENANCE: "Ta'mirda",
  INSPECTION: "Tekshiruvda",
  OUT_OF_SERVICE: "Xizmatdan tashqari",
}

const statusBadge: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700",
  RESERVED: "bg-blue-100 text-blue-700",
  OCCUPIED: "bg-red-100 text-red-600",
  CLEANING: "bg-amber-100 text-amber-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  INSPECTION: "bg-purple-100 text-purple-700",
  OUT_OF_SERVICE: "bg-gray-200 text-gray-600",
}

// Holati bir qarashda ko'rinishi uchun: jadval qatorining chap chekkasi.
// Bo'sh xona ODDIY (rangsiz) — faqat band/boshqa holatlar ajralib turadi
const statusRowAccent: Record<string, string> = {
  AVAILABLE: "border-l-transparent",
  RESERVED: "border-l-blue-400",
  OCCUPIED: "border-l-red-400",
  CLEANING: "border-l-amber-400",
  MAINTENANCE: "border-l-orange-400",
  INSPECTION: "border-l-purple-400",
  OUT_OF_SERVICE: "border-l-gray-300",
}

// Grid kartasining fon/ramka rangi — bo'sh yashil, band qizil va h.k.
const statusCardAccent: Record<string, string> = {
  AVAILABLE: "border-gray-200 bg-white",
  RESERVED: "border-blue-200 bg-blue-50/60",
  OCCUPIED: "border-red-200 bg-red-50/60",
  CLEANING: "border-amber-200 bg-amber-50/60",
  MAINTENANCE: "border-orange-200 bg-orange-50/60",
  INSPECTION: "border-purple-200 bg-purple-50/60",
  OUT_OF_SERVICE: "border-gray-200 bg-gray-50",
}

// Xona ikonkasi ham holat rangida
const statusIconAccent: Record<string, string> = {
  AVAILABLE: "bg-primary-50 text-primary-600",
  RESERVED: "bg-blue-100 text-blue-600",
  OCCUPIED: "bg-red-100 text-red-600",
  CLEANING: "bg-amber-100 text-amber-600",
  MAINTENANCE: "bg-orange-100 text-orange-600",
  INSPECTION: "bg-purple-100 text-purple-600",
  OUT_OF_SERVICE: "bg-gray-100 text-gray-500",
}

// Filtr chiplaridagi rang nuqtasi uchun
const statusDot: Record<string, string> = {
  AVAILABLE: "bg-emerald-500",
  RESERVED: "bg-blue-500",
  OCCUPIED: "bg-red-500",
  CLEANING: "bg-amber-500",
  MAINTENANCE: "bg-orange-500",
  INSPECTION: "bg-purple-500",
  OUT_OF_SERVICE: "bg-gray-400",
}

export const RoomsPage = () => {
  const { can } = usePermissions()
  const canCreate = can("room.create", "room.manage")
  const canEdit = can("room.update", "room.manage")
  const canDelete = can("room.delete", "room.manage")
  const canStatus = can("room.update", "room.status.update", "room.manage")
  const user = useAuthStore((s) => s.user)

  const { data: rooms = [], isLoading, isError } = useRooms()
  const { data: branches = [] } = useBranches()
  const { data: floors = [] } = useFloors()
  const { data: roomTypes = [] } = useRoomTypes()
  // Band xonaning qachon bo'shashini ko'rsatish uchun faol bronlar kerak
  const { data: reservations = [] } = useReservations()

  const createMutation = useCreateRoom()
  const updateMutation = useUpdateRoom()
  const deleteMutation = useDeleteRoom()
  const statusMutation = useUpdateRoomStatus()

  const floorMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const f of floors) m[f.id] = f.name || `${f.floor_number}-qavat`
    return m
  }, [floors])

  const typeMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const rt of roomTypes) m[rt.id] = rt.name
    return m
  }, [roomTypes])

  const [search, setSearch] = useState("")
  // Holat bo'yicha filtr ("" — barcha holatlar)
  const [statusFilter, setStatusFilter] = useState("")

  // Ko'rinish: grid (standart) yoki jadval. Tanlov brauzerda eslab qolinadi
  const [viewMode, setViewModeState] = useState<"table" | "grid">(() => {
    try {
      return localStorage.getItem("rooms_view_mode") === "table" ? "table" : "grid"
    } catch {
      return "grid"
    }
  })
  const setViewMode = (m: "table" | "grid") => {
    setViewModeState(m)
    try {
      localStorage.setItem("rooms_view_mode", m)
    } catch {}
  }

  const sortedRooms = useMemo(
    () =>
      [...rooms]
        .filter(
          (r) =>
            !search.trim() ||
            r.room_number?.toLowerCase().includes(search.toLowerCase())
        )
        .filter((r) => !statusFilter || r.current_status === statusFilter)
        .sort((a, b) =>
          String(a.room_number).localeCompare(String(b.room_number), undefined, {
            numeric: true,
            sensitivity: "base",
          })
        ),
    [rooms, search, statusFilter]
  )

  // Qavat bo'limlarini yopish/ochish (tile). Tanlov brauzerda saqlanadi
  const [collapsedFloors, setCollapsedFloors] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("rooms_collapsed_floors")
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  const toggleFloor = (key: string) => {
    setCollapsedFloors((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        localStorage.setItem("rooms_collapsed_floors", JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  // Qavat sarlavhasida ko'rsatiladigan qisqa statistika
  const floorStats = (list: Room[]) => {
    const available = list.filter((r) => r.current_status === "AVAILABLE").length
    const busy = list.filter(
      (r) => r.current_status === "OCCUPIED" || r.current_status === "RESERVED"
    ).length
    return { available, busy, other: list.length - available - busy }
  }

  // Har bir band xona uchun "qachon bo'shaydi" — hozir davom etayotgan
  // brondan (CHECKED_IN ustuvor, so'ng boshlanib bo'lgan CONFIRMED) olinadi.
  // Soatlik bronda aniq chiqish vaqti, kunlikda chiqish kuni soat 12:00.
  // Datetime'lar mahalliy devor soati sifatida talqin qilinadi.
  const freeAtByRoom = useMemo(() => {
    const now = new Date()
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const result: Record<string, { rank: number; at: Date; label: string }> = {}
    for (const res of reservations as any[]) {
      if (res.status !== "CHECKED_IN" && res.status !== "CONFIRMED") continue

      let at: Date
      let dayPart = ""
      let timePart = ""
      if (res.booking_type === "HOURLY" && res.check_out_datetime) {
        const raw = String(res.check_out_datetime).slice(0, 16) // YYYY-MM-DDTHH:mm
        at = new Date(raw)
        dayPart = raw.slice(0, 10)
        timePart = raw.slice(11, 16)
      } else if (res.check_out_date) {
        dayPart = String(res.check_out_date).slice(0, 10)
        timePart = "12:00"
        at = new Date(`${dayPart}T12:00:00`)
      } else {
        continue
      }
      if (isNaN(at.getTime()) || at <= now) continue

      // Yarim tunda tugaydigan bron: sana keyingi kunga o'tib ketib
      // chalg'itmasligi uchun bron kunining o'zi bilan "00:00" deb
      // ko'rsatiladi (masalan, "bugun 00:00"). Hisob-kitob o'zgarmaydi
      if (timePart === "00:00") {
        const prevDay = new Date(at.getTime() - 86400000)
        dayPart = `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, "0")}-${String(prevDay.getDate()).padStart(2, "0")}`
      }

      // CONFIRMED bron faqat boshlanib bo'lgan bo'lsa xonani "band" qiladi
      if (res.status === "CONFIRMED") {
        const startRaw =
          res.booking_type === "HOURLY" && res.check_in_datetime
            ? String(res.check_in_datetime).slice(0, 16)
            : `${String(res.check_in_date).slice(0, 10)}T00:00`
        const start = new Date(startRaw)
        if (isNaN(start.getTime()) || start > now) continue
      }

      const label =
        dayPart === todayIso
          ? `bugun ${timePart}`
          : `${dayPart.slice(8, 10)}.${dayPart.slice(5, 7)} ${timePart}`
      const rank = res.status === "CHECKED_IN" ? 0 : 1
      const prev = result[res.room_id]
      if (!prev || rank < prev.rank || (rank === prev.rank && at < prev.at)) {
        result[res.room_id] = { rank, at, label }
      }
    }
    return result
  }, [reservations])

  // Xonalar qavatlar bo'yicha guruhlanadi: qavat raqami o'sish tartibida,
  // qavati belgilanmaganlar ro'yxat oxirida alohida guruhda
  const groupedRooms = useMemo(() => {
    const groups = new Map<string, typeof sortedRooms>()
    for (const r of sortedRooms) {
      const key = r.floor_id || ""
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    const floorOrder = new Map<string, number>()
    for (const f of floors) floorOrder.set(f.id, Number(f.floor_number ?? 0))
    return [...groups.entries()].sort((a, b) => {
      if (!a[0]) return 1
      if (!b[0]) return -1
      const fa = floorOrder.get(a[0])
      const fb = floorOrder.get(b[0])
      if (fa === undefined && fb === undefined) return 0
      if (fa === undefined) return 1
      if (fb === undefined) return -1
      return fa - fb
    })
  }, [sortedRooms, floors])

  // Holatlar bo'yicha sonlar (filtr chiplarida ko'rsatiladi)
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rooms) {
      m[r.current_status] = (m[r.current_status] || 0) + 1
    }
    return m
  }, [rooms])

  // --- Yaratish/tahrirlash dialogi ---
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [roomNumber, setRoomNumber] = useState("")
  const [branchId, setBranchId] = useState("")
  const [floorId, setFloorId] = useState("")
  const [roomTypeId, setRoomTypeId] = useState("")
  const [basePrice, setBasePrice] = useState("")
  const [capacity, setCapacity] = useState("")
  const [notes, setNotes] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const branchFloors = floors.filter((f) => !branchId || f.branch_id === branchId)

  const openCreate = () => {
    setEditing(null)
    const defaultBranch = user?.branch_id || branches[0]?.id || ""
    setBranchId(defaultBranch)

    // Hamma maydonlar aqlli standart qiymatlar bilan to'ldiriladi —
    // xohlasa istalganini o'zgartiradi, xohlamasa darrov "Qo'shish" bosadi.
    const pool = rooms.filter((r) => !defaultBranch || r.branch_id === defaultBranch)
    const source = pool.length ? pool : rooms

    // Xona raqami: eng katta raqamli xonadan +1 (band raqamlar o'tkazib yuboriladi)
    let maxNum = 0
    let maxRoom: (typeof rooms)[number] | null = null
    const taken = new Set<string>()
    for (const r of source) {
      taken.add(String(r.room_number))
      const n = parseInt(String(r.room_number), 10)
      if (!isNaN(n) && n >= maxNum) {
        maxNum = n
        maxRoom = r
      }
    }
    let nextNum = maxNum > 0 ? maxNum + 1 : 101
    while (taken.has(String(nextNum))) nextNum += 1
    setRoomNumber(String(nextNum))

    // Qavat: eng katta raqamli xonaning qavati (odatda yangi xona shu yerda
    // davom etadi), bo'lmasa filialning birinchi qavati
    const branchFloorsList = floors.filter(
      (f) => !defaultBranch || f.branch_id === defaultBranch
    )
    setFloorId(maxRoom?.floor_id || branchFloorsList[0]?.id || "")

    // Xona turi: mehmonxonada eng ko'p ishlatilgan tur, bo'lmasa birinchisi
    const typeCounts = new Map<string, number>()
    for (const r of source) {
      if (r.room_type_id) {
        typeCounts.set(r.room_type_id, (typeCounts.get(r.room_type_id) || 0) + 1)
      }
    }
    let commonType = ""
    let bestCount = 0
    for (const [t, c] of typeCounts) {
      if (c > bestCount) {
        bestCount = c
        commonType = t
      }
    }
    const typeId = commonType || (roomTypes[0] as any)?.id || ""
    setRoomTypeId(typeId)

    // Narx va sig'im: tanlangan tur qiymatlaridan (zaxira: oxirgi xonadan)
    const rt: any = roomTypes.find((x: any) => x.id === typeId)
    setBasePrice(
      rt?.base_price
        ? String(rt.base_price)
        : maxRoom?.base_price
          ? String(maxRoom.base_price)
          : ""
    )
    setCapacity(
      rt?.capacity ? String(rt.capacity) : maxRoom?.capacity ? String(maxRoom.capacity) : ""
    )
    setNotes("")
    setErrorMsg(null)
    setModalOpen(true)
  }

  const openEdit = (r: Room) => {
    setEditing(r)
    setRoomNumber(r.room_number)
    setBranchId(r.branch_id)
    setFloorId(r.floor_id || "")
    setRoomTypeId(r.room_type_id || "")
    setBasePrice(String(r.base_price ?? ""))
    setCapacity(r.capacity ? String(r.capacity) : "")
    setNotes(r.notes || "")
    setErrorMsg(null)
    setModalOpen(true)
  }

  const onSubmit = async () => {
    if (!editing && !roomNumber.trim()) {
      setErrorMsg("Xona raqamini kiriting")
      return
    }
    if (!floorId) {
      setErrorMsg("Qavatni tanlang")
      return
    }
    if (!roomTypeId) {
      setErrorMsg("Xona turini tanlang")
      return
    }
    const price = Number(basePrice) || 0
    const cap = capacity ? parseInt(capacity, 10) : undefined
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          floor_id: floorId,
          room_type_id: roomTypeId,
          base_price: price,
          capacity: cap && cap >= 1 ? cap : undefined,
          notes: notes.trim() || undefined,
          hotelId: editing.hotel_id || user?.hotel_id,
        })
      } else {
        if (!branchId) {
          setErrorMsg("Filialni tanlang")
          return
        }
        const branch = branches.find((b) => b.id === branchId)
        await createMutation.mutateAsync({
          branch_id: branchId,
          floor_id: floorId,
          room_type_id: roomTypeId,
          room_number: roomNumber.trim(),
          base_price: price,
          capacity: cap && cap >= 1 ? cap : undefined,
          notes: notes.trim() || undefined,
          hotelId: user?.hotel_id || branch?.hotel_id,
        })
      }
      setModalOpen(false)
    } catch (e) {
      setErrorMsg(apiErrorMessage(e))
    }
  }

  const onDelete = async (r: Room) => {
    if (!confirm(`${r.room_number}-xonani o'chirasizmi?`)) return
    try {
      await deleteMutation.mutateAsync({
        id: r.id,
        hotelId: r.hotel_id || user?.hotel_id,
      })
    } catch (e) {
      alert(apiErrorMessage(e))
    }
  }

  // --- Holatni o'zgartirish dialogi ---
  const [statusRoom, setStatusRoom] = useState<Room | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const onStatusPick = async (status: string) => {
    if (!statusRoom) return
    setStatusError(null)
    try {
      await statusMutation.mutateAsync({
        id: statusRoom.id,
        status,
        hotelId: statusRoom.hotel_id || user?.hotel_id,
      })
      setStatusRoom(null)
    } catch (e) {
      setStatusError(apiErrorMessage(e))
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Xonalar</h1>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Xonalar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mehmonxona xonalarini boshqarish · jami {rooms.length} ta xona
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Xona qo'shish
          </Button>
        )}
      </div>

      {/* Qidiruv + holat bo'yicha filtr chiplari */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Xona raqami bo'yicha qidirish..."
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
            Barchasi ({rooms.length})
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
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    statusDot[value] || "bg-gray-400"
                  )}
                />
                {label} ({statusCounts[value]})
              </button>
            ))}
        </div>

        {/* Ko'rinish almashtirgich: jadval / grid */}
        <div className="ml-auto flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            title="Jadval ko'rinishi"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewMode === "table"
                ? "bg-primary-50 text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <List className="h-4 w-4" />
            Jadval
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            title="Grid ko'rinishi"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewMode === "grid"
                ? "bg-primary-50 text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Grid
          </button>
        </div>
      </div>

      {/* Rang ko'rsatkichi — qaysi rang qaysi holatni bildirishi */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2 text-[11px] text-gray-600">
        <span className="font-semibold text-gray-400">Ranglar:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-gray-300 bg-white" />
          Bo'sh
        </span>
        {Object.entries(STATUS_LABELS)
          .filter(([value]) => value !== "AVAILABLE")
          .map(([value, label]) => (
            <span key={value} className="inline-flex items-center gap-1.5">
              <span
                className={cn("h-2.5 w-2.5 rounded-sm", statusDot[value] || "bg-gray-400")}
              />
              {label}
            </span>
          ))}
      </div>

      {viewMode === "table" && (
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead>Xona</TableHead>
              <TableHead>Turi</TableHead>
              <TableHead>Narxi</TableHead>
              <TableHead>Sig'imi</TableHead>
              <TableHead>Holati</TableHead>
              {(canEdit || canDelete) && (
                <TableHead className="text-right">Amallar</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRooms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(canEdit || canDelete) ? 6 : 5} className="py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <DoorOpen className="h-8 w-8" />
                    <p className="text-sm">
                      {search.trim() || statusFilter
                        ? "Filtr bo'yicha xona topilmadi"
                        : "Hozircha xonalar yo'q"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              groupedRooms.flatMap(([floorId, floorRooms]) => {
                const key = floorId || "none"
                const collapsed = collapsedFloors.has(key)
                const stats = floorStats(floorRooms)
                return [
                /* Qavat sarlavhasi — bosilsa yopiladi/ochiladi */
                <TableRow
                  key={`floor-${key}`}
                  onClick={() => toggleFloor(key)}
                  className="cursor-pointer select-none bg-primary-50/60 hover:bg-primary-100/60 border-y border-primary-100"
                >
                  <TableCell colSpan={(canEdit || canDelete) ? 6 : 5} className="py-2.5">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary-700">
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-primary-400 transition-transform",
                          collapsed && "-rotate-90"
                        )}
                      />
                      <Layers className="h-3.5 w-3.5" />
                      {floorId
                        ? floorMap[floorId] || "Noma'lum qavat"
                        : "Qavat belgilanmagan"}
                      <span className="font-medium normal-case tracking-normal text-primary-400">
                        · {floorRooms.length} ta xona
                      </span>
                      <span className="ml-auto flex items-center gap-2.5 font-medium normal-case tracking-normal">
                        <span className="text-emerald-600">{stats.available} bo'sh</span>
                        {stats.busy > 0 && <span className="text-red-500">{stats.busy} band</span>}
                        {stats.other > 0 && <span className="text-gray-400">{stats.other} boshqa</span>}
                      </span>
                    </span>
                  </TableCell>
                </TableRow>,
                ...(collapsed ? [] : floorRooms).map((room) => (
                <TableRow
                  key={room.id}
                  className={cn(
                    "border-l-4",
                    statusRowAccent[room.current_status] || "border-l-gray-200"
                  )}
                >
                  <TableCell>
                    <span className="inline-flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          statusIconAccent[room.current_status] ||
                            "bg-primary-50 text-primary-600"
                        )}
                      >
                        <DoorOpen className="h-4 w-4" />
                      </span>
                      <span className="font-semibold text-gray-900">{room.room_number}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {typeMap[room.room_type_id] || <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    {Number(room.base_price || 0).toLocaleString()}{" "}
                    <span className="text-xs font-normal text-gray-400">So'm</span>
                  </TableCell>
                  <TableCell>
                    {room.capacity ? (
                      <span className="inline-flex items-center gap-1.5 text-gray-600">
                        <Users className="h-3.5 w-3.5 text-gray-400" />
                        {room.capacity} kishi
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      disabled={!canStatus}
                      onClick={() => {
                        setStatusError(null)
                        setStatusRoom(room)
                      }}
                      title={canStatus ? "Holatni o'zgartirish" : undefined}
                      className={cn(
                        "text-xs font-medium px-2.5 py-1 rounded-full",
                        statusBadge[room.current_status] || "bg-gray-100 text-gray-500",
                        canStatus && "cursor-pointer hover:opacity-80"
                      )}
                    >
                      {STATUS_LABELS[room.current_status] || room.current_status}
                    </button>
                    {(room.current_status === "OCCUPIED" ||
                      room.current_status === "RESERVED") &&
                      freeAtByRoom[room.id] && (
                        <p className="mt-1 flex items-center gap-1 whitespace-nowrap text-[11px] text-amber-600">
                          <Clock className="h-3 w-3" />
                          Bo'shaydi: {freeAtByRoom[room.id].label}
                        </p>
                      )}
                  </TableCell>
                  {(canEdit || canDelete) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        {canEdit && (
                          <button
                            type="button"
                            title="Tahrirlash"
                            onClick={() => openEdit(room)}
                            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            title="O'chirish"
                            onClick={() => onDelete(room)}
                            className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                )),
              ]
              })
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {/* GRID ko'rinishi — qavatlar bo'yicha kartalar */}
      {viewMode === "grid" &&
        (sortedRooms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-14 text-gray-400">
            <DoorOpen className="h-8 w-8" />
            <p className="text-sm">
              {search.trim() || statusFilter
                ? "Filtr bo'yicha xona topilmadi"
                : "Hozircha xonalar yo'q"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedRooms.map(([floorId, floorRooms]) => {
              const key = floorId || "none"
              const collapsed = collapsedFloors.has(key)
              const stats = floorStats(floorRooms)
              return (
              <div key={key}>
                {/* Qavat tile'i — bosilsa yopiladi/ochiladi */}
                <button
                  type="button"
                  onClick={() => toggleFloor(key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border bg-gradient-to-r from-primary-50/80 to-white px-4 py-3 text-left transition-all hover:shadow-sm",
                    collapsed ? "border-gray-200" : "border-primary-100"
                  )}
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                    <Layers className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-gray-900">
                      {floorId
                        ? floorMap[floorId] || "Noma'lum qavat"
                        : "Qavat belgilanmagan"}
                    </span>
                    <span className="block text-[11px] text-gray-500">
                      {floorRooms.length} ta xona
                    </span>
                  </span>
                  <span className="hidden items-center gap-3 text-[11px] font-medium sm:flex">
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <span className="h-2 w-2 rounded-full border border-emerald-300 bg-white" />
                      {stats.available} bo'sh
                    </span>
                    {stats.busy > 0 && (
                      <span className="inline-flex items-center gap-1 text-red-500">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        {stats.busy} band
                      </span>
                    )}
                    {stats.other > 0 && (
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        <span className="h-2 w-2 rounded-full bg-gray-400" />
                        {stats.other} boshqa
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 flex-shrink-0 text-gray-400 transition-transform",
                      collapsed && "-rotate-90"
                    )}
                  />
                </button>
                {!collapsed && (
                /* auto-fill: ustunlar soni displayga qarab o'zi moslashadi —
                   har karta kamida 170px, keng ekranda qancha sig'sa shuncha */
                <div className="mt-3 grid gap-3 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
                  {floorRooms.map((room) => (
                    <div
                      key={room.id}
                      className={cn(
                        "group relative rounded-xl border p-3.5 transition-all hover:shadow-md",
                        statusCardAccent[room.current_status] || "border-gray-200 bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg",
                            statusIconAccent[room.current_status] ||
                              "bg-primary-50 text-primary-600"
                          )}
                        >
                          <DoorOpen className="h-4 w-4" />
                        </span>
                        <button
                          type="button"
                          disabled={!canStatus}
                          onClick={() => {
                            setStatusError(null)
                            setStatusRoom(room)
                          }}
                          title={canStatus ? "Holatni o'zgartirish" : undefined}
                          className={cn(
                            "text-[11px] font-medium px-2 py-0.5 rounded-full",
                            statusBadge[room.current_status] || "bg-gray-100 text-gray-500",
                            canStatus && "cursor-pointer hover:opacity-80"
                          )}
                        >
                          {STATUS_LABELS[room.current_status] || room.current_status}
                        </button>
                      </div>
                      <p className="mt-2 text-lg font-bold text-gray-900">{room.room_number}</p>
                      <p className="truncate text-xs text-gray-500">
                        {typeMap[room.room_type_id] || "Turi belgilanmagan"}
                        {room.capacity ? ` · ${room.capacity} kishi` : ""}
                      </p>
                      {(room.current_status === "OCCUPIED" ||
                        room.current_status === "RESERVED") &&
                        freeAtByRoom[room.id] && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                            <Clock className="h-3 w-3" />
                            Bo'shaydi: {freeAtByRoom[room.id].label}
                          </p>
                        )}
                      <div className="mt-2 flex items-end justify-between">
                        <p className="text-sm font-semibold text-gray-900">
                          {Number(room.base_price || 0).toLocaleString()}{" "}
                          <span className="text-xs font-normal text-gray-400">So'm</span>
                        </p>
                        {(canEdit || canDelete) && (
                          <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            {canEdit && (
                              <button
                                type="button"
                                title="Tahrirlash"
                                onClick={() => openEdit(room)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                title="O'chirish"
                                onClick={() => onDelete(room)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
              )
            })}
          </div>
        ))}

      {/* Yaratish/tahrirlash dialogi */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Xonani tahrirlash" : "Yangi xona"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Xona raqami *</label>
                <Input
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="Masalan: 101"
                  disabled={!!editing}
                  title={editing ? "Xona raqamini o'zgartirib bo'lmaydi" : undefined}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Filial *</label>
                <select
                  className={selectClass}
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value)
                    setFloorId("")
                  }}
                  disabled={!!editing}
                >
                  <option value="">Filialni tanlang</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Qavat *</label>
                <select
                  className={selectClass}
                  value={floorId}
                  onChange={(e) => setFloorId(e.target.value)}
                >
                  <option value="">Qavatni tanlang</option>
                  {branchFloors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name || `${f.floor_number}-qavat`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Xona turi *</label>
                <select
                  className={selectClass}
                  value={roomTypeId}
                  onChange={(e) => {
                    setRoomTypeId(e.target.value)
                    // Yangi xona yaratishda tur almashtirilsa narx va sig'im
                    // o'sha turnikiga yangilanadi (tahrirlashda faqat bo'sh bo'lsa)
                    const rt: any = roomTypes.find((x: any) => x.id === e.target.value)
                    if (rt) {
                      if (!editing || !basePrice) {
                        setBasePrice(rt.base_price ? String(rt.base_price) : "")
                      }
                      if (!editing || !capacity) {
                        setCapacity(rt.capacity ? String(rt.capacity) : "")
                      }
                    }
                  }}
                >
                  <option value="">Turni tanlang</option>
                  {roomTypes.map((rt: any) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name} ({Number(rt.base_price || 0).toLocaleString()} So'm)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Narx (So'm)</label>
                <Input
                  type="number"
                  min={0}
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="Tur narxi ishlatiladi"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Sig'im (kishi)</label>
                <Input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Izoh</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Izoh..."
              />
            </div>
            {errorMsg && (
              <p className="text-sm text-red-500 whitespace-pre-line">{errorMsg}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Holatni o'zgartirish dialogi */}
      <Dialog open={!!statusRoom} onOpenChange={(o) => !o && setStatusRoom(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              Xona holati — {statusRoom?.room_number}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => onStatusPick(value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                    statusRoom?.current_status === value
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {statusMutation.isPending ? (
                    <RefreshCw className="h-3 w-3 animate-spin inline mr-1" />
                  ) : null}
                  {label}
                </button>
              ))}
            </div>
            {statusError && (
              <p className="text-sm text-red-500 whitespace-pre-line">{statusError}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
