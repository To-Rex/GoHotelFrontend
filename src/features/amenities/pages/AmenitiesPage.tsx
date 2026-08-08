import { useState } from "react"
import { Sparkles, Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import {
  useAmenities,
  useCreateAmenity,
  useUpdateAmenity,
  useDeleteAmenity,
} from "../api/amenities"
import type { Amenity } from "@/types/api"
import { usePermissions } from "@/lib/permissions"
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

// Belgi (ikonka) tanlovlari — GoHotelAdmin bilan bir xil ro'yxat
const ICON_OPTIONS = [
  { value: "", label: "Belgisiz" },
  { value: "wifi", label: "Wi-Fi" },
  { value: "tv", label: "Televizor" },
  { value: "wind", label: "Konditsioner" },
  { value: "bath", label: "Vanna" },
  { value: "coffee", label: "Qahva" },
  { value: "parking", label: "Avtoturargoh" },
  { value: "pool", label: "Basseyn" },
  { value: "gym", label: "Sport zali" },
  { value: "spa", label: "Spa" },
  { value: "restaurant", label: "Restoran" },
  { value: "bar", label: "Bar" },
  { value: "laundry", label: "Kir yuvish" },
  { value: "safe", label: "Seyf" },
  { value: "fridge", label: "Muzlatgich" },
]

const iconLabel = (icon?: string | null) =>
  ICON_OPTIONS.find((o) => o.value === (icon || ""))?.label || icon || "—"

const selectClass =
  "w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

export const AmenitiesPage = () => {
  // Qulayliklar katalogi mutatsiyalari backendda ADMIN/SUPER_ADMIN uchun ochiq
  const { isAdmin } = usePermissions()

  const { data: amenities = [], isLoading } = useAmenities()

  const createMutation = useCreateAmenity()
  const updateMutation = useUpdateAmenity()
  const deleteMutation = useDeleteAmenity()

  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Amenity | null>(null)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const filtered = amenities.filter(
    (a) => !search.trim() || a.name?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditing(null)
    setName("")
    setIcon("")
    setErrorMsg(null)
    setModalOpen(true)
  }

  const openEdit = (a: Amenity) => {
    setEditing(a)
    setName(a.name)
    setIcon(a.icon || "")
    setErrorMsg(null)
    setModalOpen(true)
  }

  const onSubmit = async () => {
    if (!name.trim()) {
      setErrorMsg("Nomini kiriting")
      return
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          name: name.trim(),
          icon: icon || undefined,
        })
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          icon: icon || undefined,
        })
      }
      setModalOpen(false)
    } catch (e) {
      setErrorMsg(apiErrorMessage(e))
    }
  }

  const onDelete = async (a: Amenity) => {
    if (!confirm(`"${a.name}" qulayligini o'chirasizmi?`)) return
    try {
      await deleteMutation.mutateAsync(a.id)
    } catch (e) {
      alert(apiErrorMessage(e))
    }
  }

  const onToggleStatus = async (a: Amenity) => {
    try {
      await updateMutation.mutateAsync({ id: a.id, is_active: !a.is_active })
    } catch (e) {
      alert(apiErrorMessage(e))
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Qulayliklar</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Qulayliklar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Xona va mehmonxona qulayliklari katalogi
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Qulaylik qo'shish
          </Button>
        )}
      </div>

      <div className="max-w-xs">
        <Input
          placeholder="Qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomi</TableHead>
              <TableHead>Belgi</TableHead>
              <TableHead>Holat</TableHead>
              {isAdmin && <TableHead className="text-right">Amallar</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-gray-400">
                  Qulayliklar topilmadi
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      {a.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-600">{iconLabel(a.icon)}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      disabled={!isAdmin || updateMutation.isPending}
                      onClick={() => isAdmin && onToggleStatus(a)}
                      title={isAdmin ? "Holatni o'zgartirish" : undefined}
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        a.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500",
                        isAdmin && "cursor-pointer hover:opacity-80"
                      )}
                    >
                      {a.is_active ? "Faol" : "Nofaol"}
                    </button>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Tahrirlash
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => onDelete(a)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          O'chirish
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Qulaylikni tahrirlash" : "Yangi qulaylik"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nomi *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: Wi-Fi, Konditsioner"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Belgi</label>
              <select
                className={selectClass}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
              >
                {ICON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
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
    </div>
  )
}
