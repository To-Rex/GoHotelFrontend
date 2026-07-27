import { useState, useMemo } from "react"
import { DoorOpen, Plus, Pencil, Trash2, Loader2, RefreshCw, Search, Users } from "lucide-react"
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
    setRoomNumber("")
    setBranchId(user?.branch_id || branches[0]?.id || "")
    setFloorId("")
    setRoomTypeId("")
    setBasePrice("")
    setCapacity("")
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
      <div className="flex items-center justify-between">
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
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead>Xona</TableHead>
              <TableHead>Turi</TableHead>
              <TableHead>Qavat</TableHead>
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
                <TableCell colSpan={7} className="py-12">
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
              sortedRooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                        <DoorOpen className="h-4 w-4" />
                      </span>
                      <span className="font-semibold text-gray-900">{room.room_number}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {typeMap[room.room_type_id] || <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {floorMap[room.floor_id] || <span className="text-gray-300">—</span>}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
                    // Tur tanlanganda narxni avtomatik to'ldiramiz (bo'sh bo'lsa)
                    const rt = roomTypes.find((x: any) => x.id === e.target.value)
                    if (rt && !basePrice) setBasePrice(String(rt.base_price ?? ""))
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
