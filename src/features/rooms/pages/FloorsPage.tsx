import { useState, useEffect, useMemo } from "react"
import { Layers, Plus, Pencil, Trash2, Loader2, DoorOpen, Building2 } from "lucide-react"
import {
  useBranches,
  useFloorsByBranch,
  useCreateFloor,
  useUpdateFloor,
  useDeleteFloor,
  useRooms,
} from "../api/rooms"
import type { Floor } from "@/types/api"
import { usePermissions } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

export const FloorsPage = () => {
  const { can } = usePermissions()
  const canCreate = can("floor.create")
  const canEdit = can("floor.update")
  const canDelete = can("floor.delete")

  const { data: branches = [], isLoading: branchesLoading } = useBranches()
  const [branchId, setBranchId] = useState("")

  // Birinchi filialni avtomatik tanlaymiz
  useEffect(() => {
    if (!branchId && branches.length > 0) setBranchId(branches[0].id)
  }, [branches, branchId])

  const selectedBranch = branches.find((b) => b.id === branchId) || null
  const { data: floors = [], isLoading: floorsLoading } = useFloorsByBranch(branchId)

  // Har bir qavatdagi xonalar soni (kartada ko'rsatish uchun)
  const { data: rooms = [] } = useRooms()
  const roomCountByFloor = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rooms) {
      if (r.floor_id) m[r.floor_id] = (m[r.floor_id] || 0) + 1
    }
    return m
  }, [rooms])

  const createMutation = useCreateFloor()
  const updateMutation = useUpdateFloor()
  const deleteMutation = useDeleteFloor()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Floor | null>(null)
  const [floorNumber, setFloorNumber] = useState("")
  const [floorName, setFloorName] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    const next =
      floors.length > 0 ? Math.max(...floors.map((f) => f.floor_number)) + 1 : 1
    setFloorNumber(String(next))
    setFloorName("")
    setErrorMsg(null)
    setModalOpen(true)
  }

  const openEdit = (f: Floor) => {
    setEditing(f)
    setFloorNumber(String(f.floor_number))
    setFloorName(f.name || "")
    setErrorMsg(null)
    setModalOpen(true)
  }

  const apiError = (e: any) =>
    e?.response?.data?.detail
      ? typeof e.response.data.detail === "string"
        ? e.response.data.detail
        : "Xatolik yuz berdi"
      : "Xatolik yuz berdi"

  const onSubmit = async () => {
    const num = parseInt(floorNumber, 10)
    if (Number.isNaN(num)) {
      setErrorMsg("Qavat raqamini kiriting")
      return
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          floor_number: num,
          name: floorName || undefined,
        })
      } else {
        if (!selectedBranch) return
        await createMutation.mutateAsync({
          branch_id: selectedBranch.id,
          hotel_id: selectedBranch.hotel_id,
          floor_number: num,
          name: floorName || undefined,
        })
      }
      setModalOpen(false)
    } catch (e) {
      setErrorMsg(apiError(e))
    }
  }

  const onDelete = async (f: Floor) => {
    if (!confirm(`${f.floor_number}-qavatni o'chirasizmi?`)) return
    try {
      await deleteMutation.mutateAsync(f.id)
    } catch (e) {
      alert(apiError(e))
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  if (branchesLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Qavatlar</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Qavatlar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Filial qavatlarini boshqarish · {floors.length} ta qavat
          </p>
        </div>
        {canCreate && branchId && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Qavat qo'shish
          </Button>
        )}
      </div>

      {branches.length === 0 ? (
        <div className="rounded-lg border bg-white py-14">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Building2 className="h-8 w-8" />
            <p className="text-sm">Filiallar topilmadi</p>
          </div>
        </div>
      ) : (
        <>
          {/* Filial tanlash (bir nechta bo'lsa) */}
          {branches.length > 1 && (
            <div className="max-w-xs space-y-1">
              <label className="text-sm font-medium">Filial</label>
              <select
                className="w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code ? `${b.name} (${b.code})` : b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {floorsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <Skeleton className="h-36 w-full rounded-lg" />
              <Skeleton className="h-36 w-full rounded-lg" />
              <Skeleton className="h-36 w-full rounded-lg" />
            </div>
          ) : floors.length === 0 ? (
            <div className="rounded-lg border bg-white py-14">
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Layers className="h-8 w-8" />
                <p className="text-sm">Bu filialda hali qavatlar yo'q</p>
                {canCreate && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Birinchi qavatni qo'shish
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {floors.map((f) => {
                const roomCount = roomCountByFloor[f.id] || 0
                return (
                  <div
                    key={f.id}
                    className="group rounded-lg border bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                        <Layers className="h-5 w-5" />
                      </span>
                      {/* Tahrirlash/o'chirish — doim ko'rinadi (hover shart emas,
                          sensorli ekranlarda ham ishlashi uchun) */}
                      {(canEdit || canDelete) && (
                        <div className="flex gap-0.5">
                          {canEdit && (
                            <button
                              type="button"
                              title="Tahrirlash"
                              onClick={() => openEdit(f)}
                              className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              title="O'chirish"
                              onClick={() => onDelete(f)}
                              className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="mt-3 text-lg font-bold text-gray-900 leading-tight truncate">
                      {f.name || `${f.floor_number}-qavat`}
                    </p>
                    <p className="text-xs text-gray-400">Qavat raqami: {f.floor_number}</p>

                    <div className="mt-3 flex items-center gap-1.5 border-t pt-3 text-sm text-gray-600">
                      <DoorOpen className="h-4 w-4 text-gray-400" />
                      {roomCount > 0 ? (
                        <span>
                          <span className="font-semibold text-gray-900">{roomCount}</span> ta xona
                        </span>
                      ) : (
                        <span className="text-gray-400">Xonalar yo'q</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Qavatni tahrirlash" : "Yangi qavat"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Qavat raqami *</label>
              <Input
                type="number"
                value={floorNumber}
                onChange={(e) => setFloorNumber(e.target.value)}
                placeholder="Masalan: 1"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Qavat nomi</label>
              <Input
                value={floorName}
                onChange={(e) => setFloorName(e.target.value)}
                placeholder="Masalan: Yerto'la, Lobbi"
              />
            </div>
            {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
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
    </div>
  )
}
