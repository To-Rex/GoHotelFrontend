import { useState, useEffect } from "react"
import { Layers, Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import {
  useBranches,
  useFloorsByBranch,
  useCreateFloor,
  useUpdateFloor,
  useDeleteFloor,
} from "../api/rooms"
import type { Floor } from "@/types/api"
import { usePermissions } from "@/lib/permissions"
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
          <p className="text-sm text-gray-500 mt-1">Filial qavatlarini boshqarish</p>
        </div>
        {canCreate && branchId && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Qavat qo'shish
          </Button>
        )}
      </div>

      {branches.length === 0 ? (
        <div className="rounded-md border py-12 text-center text-sm text-gray-400">
          Filiallar topilmadi
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Qavat raqami</TableHead>
                  <TableHead>Nomi</TableHead>
                  {(canEdit || canDelete) && <TableHead className="text-right">Amallar</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {floorsLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-gray-400">
                      Yuklanmoqda…
                    </TableCell>
                  </TableRow>
                ) : floors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-gray-400">
                      Bu filialda qavatlar yo'q
                    </TableCell>
                  </TableRow>
                ) : (
                  floors.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                            <Layers className="h-4 w-4" />
                          </span>
                          {f.floor_number}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600">{f.name || "—"}</TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <Button variant="ghost" size="sm" onClick={() => openEdit(f)}>
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Tahrirlash
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => onDelete(f)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                O'chirish
                              </Button>
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
