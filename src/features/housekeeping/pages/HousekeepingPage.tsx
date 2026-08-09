import { useState, useEffect, useMemo } from "react"
import {
  ClipboardList,
  Plus,
  Loader2,
  UserPlus,
  Image as ImageIcon,
  Search,
  Play,
  CheckCircle2,
  X,
} from "lucide-react"
import {
  useHousekeepingTasks,
  useCreateHousekeepingTask,
  useUpdateTaskStatus,
  useAssignTask,
  useTaskPhotos,
} from "../api/housekeeping"
import { api } from "@/lib/api"
import { useBranches, useRooms } from "@/features/rooms/api/rooms"
import { useEmployees } from "@/features/employees/api/employees"
import type { HousekeepingTask } from "@/types/api"
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

const TASK_TYPES: Record<string, string> = {
  CLEANING: "Tozalash",
  DEEP_CLEANING: "Chuqur tozalash",
  MAINTENANCE: "Ta'mirlash",
  INSPECTION: "Tekshiruv",
  TURN_DOWN: "Kechki tayyorlash",
}

const PRIORITIES: Record<string, string> = {
  LOW: "Past",
  MEDIUM: "O'rta",
  HIGH: "Yuqori",
  URGENT: "Shoshilinch",
}

const STATUSES: Record<string, string> = {
  OPEN: "Ochiq",
  IN_PROGRESS: "Jarayonda",
  COMPLETED: "Bajarildi",
  CANCELLED: "Bekor qilingan",
}

const statusBadge: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-500",
}

const priorityBadge: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-sky-100 text-sky-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
}

// Qator chap chekkasi holat rangida — ro'yxatni ko'z yugurtirib o'qish oson
const statusRowAccent: Record<string, string> = {
  OPEN: "border-l-amber-400",
  IN_PROGRESS: "border-l-blue-400",
  COMPLETED: "border-l-emerald-400",
  CANCELLED: "border-l-gray-300",
}

// Holat filtri chiplari uchun nuqta ranglari
const statusDot: Record<string, string> = {
  OPEN: "bg-amber-500",
  IN_PROGRESS: "bg-blue-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-gray-400",
}

// Mas'ul avatari uchun bosh harflar
const initials = (name?: string) => {
  const parts = (name || "").trim().split(/\s+/)
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?"
}

// Fotohisobot suratini avtorizatsiya bilan yuklab ko'rsatish. Endpoint bearer
// token talab qiladi, shuning uchun <img src> to'g'ridan-to'g'ri ishlamaydi —
// blob qilib olamiz va vaqtinchalik object URL yaratamiz.
function PhotoImage({
  taskId,
  photoId,
  fileName,
}: {
  taskId: string
  photoId: string
  fileName: string
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    api
      .get(`/tasks/${taskId}/photos/${photoId}/view`, { responseType: "blob" })
      .then((res) => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(res.data)
          setSrc(objectUrl)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [taskId, photoId])

  if (error)
    return (
      <div className="flex h-40 w-full items-center justify-center bg-gray-100 px-2 text-center text-sm text-gray-400">
        {fileName}
      </div>
    )
  if (!src) return <div className="h-40 w-full animate-pulse bg-gray-50" />
  return <img src={src} alt={fileName} className="h-40 w-full object-cover" />
}

export const HousekeepingPage = () => {
  const { can } = usePermissions()
  const canCreate = can("housekeeping.task.create")
  const canUpdate = can("housekeeping.task.update")
  const canAssign = can("housekeeping.task.assign")
  const user = useAuthStore((s) => s.user)

  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")

  const { data: tasks = [], isLoading } = useHousekeepingTasks(statusFilter || undefined)
  const { data: branches = [] } = useBranches()
  const { data: rooms = [] } = useRooms()
  const { data: employees = [] } = useEmployees()

  const createMutation = useCreateHousekeepingTask()
  const statusMutation = useUpdateTaskStatus()
  const assignMutation = useAssignTask()

  // Xona raqamlari xaritasi — javobda room kelmasa ham raqam ko'rsatish uchun
  const roomMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const r of rooms) m[r.id] = r.room_number
    return m
  }, [rooms])

  const employeeMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of employees) m[e.id] = `${e.first_name} ${e.last_name}`
    return m
  }, [employees])

  const filtered = tasks.filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const roomNumber = t.room?.room_number || roomMap[t.room_id] || ""
    const assignee =
      (t.assigned_user
        ? `${t.assigned_user.first_name} ${t.assigned_user.last_name}`
        : t.assigned_to
          ? employeeMap[t.assigned_to] || ""
          : "") || ""
    return (
      roomNumber.toLowerCase().includes(q) ||
      (TASK_TYPES[t.task_type] || t.task_type).toLowerCase().includes(q) ||
      assignee.toLowerCase().includes(q)
    )
  })

  // --- Yaratish dialogi ---
  const [modalOpen, setModalOpen] = useState(false)
  const [branchId, setBranchId] = useState("")
  const [roomId, setRoomId] = useState("")
  const [taskType, setTaskType] = useState("CLEANING")
  const [priority, setPriority] = useState("MEDIUM")
  const [assignedTo, setAssignedTo] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [notes, setNotes] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!branchId && branches.length > 0) setBranchId(branches[0].id)
  }, [branches, branchId])

  const branchRooms = rooms.filter((r) => r.branch_id === branchId)

  const openCreate = () => {
    setRoomId("")
    setTaskType("CLEANING")
    setPriority("MEDIUM")
    setAssignedTo("")
    setScheduledDate(new Date().toISOString().slice(0, 10))
    setNotes("")
    setErrorMsg(null)
    setModalOpen(true)
  }

  const onSubmit = async () => {
    if (!branchId) {
      setErrorMsg("Filialni tanlang")
      return
    }
    if (!roomId) {
      setErrorMsg("Xonani tanlang")
      return
    }
    try {
      await createMutation.mutateAsync({
        branch_id: branchId,
        room_id: roomId,
        task_type: taskType,
        priority,
        assigned_to: assignedTo || undefined,
        notes: notes.trim() || undefined,
        scheduled_date: scheduledDate || undefined,
        hotelId: user?.hotel_id,
      })
      setModalOpen(false)
    } catch (e) {
      setErrorMsg(apiErrorMessage(e))
    }
  }

  // --- Fotohisobot dialogi ---
  const [photoTask, setPhotoTask] = useState<HousekeepingTask | null>(null)
  const { data: taskPhotos = [], isLoading: photosLoading } = useTaskPhotos(
    photoTask?.id,
    photoTask?.hotel_id
  )

  // --- Mas'ul biriktirish dialogi ---
  const [assignTask, setAssignTask] = useState<HousekeepingTask | null>(null)
  const [assignUserId, setAssignUserId] = useState("")
  const [assignError, setAssignError] = useState<string | null>(null)

  const openAssign = (t: HousekeepingTask) => {
    setAssignTask(t)
    setAssignUserId(t.assigned_to || "")
    setAssignError(null)
  }

  const onAssign = async () => {
    if (!assignTask || !assignUserId) {
      setAssignError("Xodimni tanlang")
      return
    }
    try {
      await assignMutation.mutateAsync({ id: assignTask.id, assigned_to: assignUserId })
      setAssignTask(null)
    } catch (e) {
      setAssignError(apiErrorMessage(e))
    }
  }

  const onStatusChange = async (t: HousekeepingTask, status: string) => {
    if (!status || status === t.status) return
    if (status === "CANCELLED" && !confirm("Vazifani bekor qilasizmi?")) return
    try {
      await statusMutation.mutateAsync({ id: t.id, status })
    } catch (e) {
      alert(apiErrorMessage(e))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Xo'jalik ishlari</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-500/25">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Xo'jalik ishlari
            </h1>
            <p className="text-sm text-gray-500">
              Tozalash, ta'mirlash va boshqa vazifalar · ko'rsatilmoqda:{" "}
              {filtered.length} ta
            </p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Vazifa qo'shish
          </Button>
        )}
      </div>

      {/* Qidiruv + holat chiplari */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Xona, tur yoki mas'ul bo'yicha qidirish..."
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
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            Barchasi
          </button>
          {Object.entries(STATUSES).map(([value, label]) => (
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
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Xona</TableHead>
              <TableHead>Turi</TableHead>
              <TableHead>Muhimlik</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>Mas'ul</TableHead>
              <TableHead>Sana</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-gray-400">
                  Vazifalar topilmadi
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => {
                const roomNumber = t.room?.room_number || roomMap[t.room_id] || "—"
                const assignee = t.assigned_user
                  ? `${t.assigned_user.first_name} ${t.assigned_user.last_name}`
                  : t.assigned_to
                    ? employeeMap[t.assigned_to] || "—"
                    : ""
                const active = t.status === "OPEN" || t.status === "IN_PROGRESS"
                return (
                  <TableRow
                    key={t.id}
                    className={cn(
                      "border-l-4 transition-colors",
                      statusRowAccent[t.status] || "border-l-transparent"
                    )}
                  >
                    <TableCell>
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-gray-100 px-2 text-xs font-bold text-gray-700">
                        {roomNumber}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-gray-700">
                      {TASK_TYPES[t.task_type] || t.task_type}
                      {t.notes && (
                        <p className="mt-0.5 max-w-[220px] truncate text-xs font-normal text-gray-400">
                          {t.notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          priorityBadge[t.priority] || priorityBadge.MEDIUM
                        )}
                      >
                        {PRIORITIES[t.priority] || t.priority}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            statusBadge[t.status] || statusBadge.OPEN
                          )}
                        >
                          {STATUSES[t.status] || t.status}
                        </span>
                        {/* Scheduler avtomatik yopgan vazifa alohida belgilanadi */}
                        {t.auto_completed && (
                          <span
                            title="Belgilangan vaqt ichida qo'lda yakunlanmagani uchun tizim avtomatik yopdi"
                            className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600"
                          >
                            avto
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {assignee ? (
                        <span className="flex items-center gap-2">
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                            {initials(assignee)}
                          </span>
                          <span className="truncate text-gray-700">{assignee}</span>
                        </span>
                      ) : (
                        <span className="text-xs italic text-gray-400">Biriktirilmagan</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {t.scheduled_date || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        {/* Fotohisobot — suratlar soni badge bilan, doim ko'rinadi */}
                        <button
                          type="button"
                          title="Fotohisobotni ko'rish"
                          onClick={() => setPhotoTask(t)}
                          className={cn(
                            "relative p-1.5 rounded-lg transition-colors",
                            t.photo_count > 0
                              ? "text-blue-600 hover:bg-blue-50"
                              : "text-gray-300 hover:text-gray-500 hover:bg-gray-50"
                          )}
                        >
                          <ImageIcon className="h-4 w-4" />
                          {t.photo_count > 0 && (
                            <span className="absolute -top-1 -right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-blue-500 rounded-full">
                              {t.photo_count}
                            </span>
                          )}
                        </button>
                        {/* Holat amallari — tushunarli alohida tugmalar */}
                        {canUpdate && t.status === "OPEN" && (
                          <button
                            type="button"
                            onClick={() => onStatusChange(t, "IN_PROGRESS")}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            <Play className="h-3 w-3" /> Boshlash
                          </button>
                        )}
                        {canUpdate && t.status === "IN_PROGRESS" && (
                          <button
                            type="button"
                            onClick={() => onStatusChange(t, "COMPLETED")}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Yakunlash
                          </button>
                        )}
                        {canUpdate && active && (
                          <button
                            type="button"
                            title="Bekor qilish"
                            onClick={() => onStatusChange(t, "CANCELLED")}
                            className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        {canAssign && active && (
                          <Button variant="ghost" size="sm" onClick={() => openAssign(t)}>
                            <UserPlus className="h-3.5 w-3.5 mr-1" />
                            Mas'ul
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Yaratish dialogi */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Yangi vazifa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {branches.length > 1 && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Filial *</label>
                <select
                  className={selectClass}
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value)
                    setRoomId("")
                  }}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Xona *</label>
              <select
                className={selectClass}
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              >
                <option value="">Xonani tanlang</option>
                {branchRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Vazifa turi *</label>
                <select
                  className={selectClass}
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                >
                  {Object.entries(TASK_TYPES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Muhimlik</label>
                <select
                  className={selectClass}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {Object.entries(PRIORITIES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Mas'ul xodim</label>
              <select
                className={selectClass}
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Biriktirilmagan</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} (@{e.username})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Rejalashtirilgan sana</label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Izoh</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Izoh..."
                />
              </div>
            </div>
            {errorMsg && (
              <p className="text-sm text-red-500 whitespace-pre-line">{errorMsg}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={onSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Qo'shish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mas'ul biriktirish dialogi */}
      <Dialog open={!!assignTask} onOpenChange={(o) => !o && setAssignTask(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Mas'ul biriktirish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Xodim *</label>
              <select
                className={selectClass}
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
              >
                <option value="">Xodimni tanlang</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} (@{e.username})
                  </option>
                ))}
              </select>
            </div>
            {assignError && (
              <p className="text-sm text-red-500 whitespace-pre-line">{assignError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTask(null)}>
              Bekor qilish
            </Button>
            <Button onClick={onAssign} disabled={assignMutation.isPending}>
              {assignMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Biriktirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fotohisobot dialogi — farrosh yuklagan suratlar */}
      <Dialog open={!!photoTask} onOpenChange={(o) => !o && setPhotoTask(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              Fotohisobot — Xona{" "}
              {photoTask
                ? photoTask.room?.room_number || roomMap[photoTask.room_id] || "—"
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {photosLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : taskPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
                <ImageIcon className="h-8 w-8" />
                <p className="text-sm">Bu vazifa uchun fotohisobotlar yo'q</p>
              </div>
            ) : (
              <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
                {taskPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="block overflow-hidden rounded-lg border border-gray-200 transition-shadow hover:shadow-md"
                  >
                    <PhotoImage
                      taskId={photoTask!.id}
                      photoId={photo.id}
                      fileName={photo.file_name}
                    />
                    <div className="truncate p-2 text-xs text-gray-500">
                      {photo.file_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
