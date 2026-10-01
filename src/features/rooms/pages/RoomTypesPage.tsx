import { useState } from "react"
import { BedDouble, Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import {
  useRoomTypes,
  useCreateRoomType,
  useUpdateRoomType,
  useDeleteRoomType,
  useUpdateRoomTypeStatus,
} from "../api/rooms"
import type { RoomType } from "@/types/api"
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
import { tr } from "@/i18n"

export const RoomTypesPage = () => {
  // Xona turlari katalogi mutatsiyalari backendda ADMIN/SUPER_ADMIN uchun ochiq
  const { isAdmin } = usePermissions()
  const user = useAuthStore((s) => s.user)

  const { data: roomTypes = [], isLoading } = useRoomTypes()

  const createMutation = useCreateRoomType()
  const updateMutation = useUpdateRoomType()
  const deleteMutation = useDeleteRoomType()
  const statusMutation = useUpdateRoomTypeStatus()

  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RoomType | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [capacity, setCapacity] = useState("1")
  const [basePrice, setBasePrice] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const filtered = (roomTypes as RoomType[]).filter((rt) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      rt.name?.toLowerCase().includes(q) ||
      (rt.description || "").toLowerCase().includes(q)
    )
  })

  const openCreate = () => {
    setEditing(null)
    setName("")
    setDescription("")
    setCapacity("1")
    setBasePrice("")
    setErrorMsg(null)
    setModalOpen(true)
  }

  const openEdit = (rt: RoomType) => {
    setEditing(rt)
    setName(rt.name)
    setDescription(rt.description || "")
    setCapacity(String(rt.capacity ?? 1))
    setBasePrice(String(rt.base_price ?? ""))
    setErrorMsg(null)
    setModalOpen(true)
  }

  const onSubmit = async () => {
    if (!name.trim()) {
      setErrorMsg(tr("Nomini kiriting"))
      return
    }
    const price = Number(basePrice)
    if (!price || price <= 0) {
      setErrorMsg(tr("Asosiy narx 0 dan katta bo'lishi kerak"))
      return
    }
    const cap = parseInt(capacity, 10)
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          name: name.trim(),
          description: description.trim() || undefined,
          capacity: cap >= 1 ? cap : 1,
          base_price: price,
        })
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          capacity: cap >= 1 ? cap : 1,
          base_price: price,
          // SUPER_ADMIN konteksti uchun: tur qaysi mehmonxonaga tegishli
          hotelId: user?.hotel_id,
        })
      }
      setModalOpen(false)
    } catch (e) {
      setErrorMsg(apiErrorMessage(e))
    }
  }

  const onDelete = async (rt: RoomType) => {
    if (!confirm(tr("\"{{name}}\" xona turini o'chirasizmi?", { name: rt.name }))) return
    try {
      await deleteMutation.mutateAsync(rt.id)
    } catch (e) {
      alert(apiErrorMessage(e))
    }
  }

  const onToggleStatus = async (rt: RoomType) => {
    try {
      await statusMutation.mutateAsync({ id: rt.id, is_active: !rt.is_active })
    } catch (e) {
      alert(apiErrorMessage(e))
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{tr("Xona turlari")}</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr("Xona turlari")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tr("Xona turlari katalogi va asosiy narxlarni boshqarish")}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {tr("Tur qo'shish")}
          </Button>
        )}
      </div>

      <div className="max-w-xs">
        <Input
          placeholder={tr("Qidirish...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* MOBIL: xona turlari karta ko'rinishida (jadval planshet/desktopda) */}
      <div className="space-y-2.5 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
            {tr("Xona turlari topilmadi")}
          </div>
        ) : (
          filtered.map((rt) => (
            <div key={rt.id} className="rounded-2xl border bg-white p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                    <BedDouble className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium leading-tight text-gray-900 truncate">
                      {rt.name}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-gray-600">
                      {tr("{{capacity}} kishi", { capacity: rt.capacity })}
                    </p>
                  </div>
                </div>
                {/* Holat badge'i — jadvaldagi kabi bosilsa faol/nofaol almashadi */}
                <button
                  type="button"
                  disabled={!isAdmin || statusMutation.isPending}
                  onClick={() => isAdmin && onToggleStatus(rt)}
                  title={isAdmin ? tr("Holatni o'zgartirish") : undefined}
                  className={cn(
                    "flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
                    rt.is_active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-500",
                    isAdmin && "cursor-pointer hover:opacity-80"
                  )}
                >
                  {rt.is_active ? tr("Faol") : tr("Nofaol")}
                </button>
              </div>

              {rt.description && (
                <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600">
                  {rt.description}
                </p>
              )}

              <p className="mt-2 text-sm font-medium">
                {tr("{{Number}} So'm", { Number: Number(rt.base_price || 0).toLocaleString() })}
              </p>

              {isAdmin && (
                <div className="mt-3 flex items-center gap-1 border-t border-gray-100 pt-2.5">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(rt)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {tr("Tahrirlash")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => onDelete(rt)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {tr("O'chirish")}
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tr("Nomi")}</TableHead>
              <TableHead>{tr("Tavsif")}</TableHead>
              <TableHead>{tr("Sig'im")}</TableHead>
              <TableHead>{tr("Asosiy narx")}</TableHead>
              <TableHead>{tr("Holat")}</TableHead>
              {isAdmin && <TableHead className="text-right">{tr("Amallar")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-gray-400">
                  {tr("Xona turlari topilmadi")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((rt) => (
                <TableRow key={rt.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                        <BedDouble className="h-4 w-4" />
                      </span>
                      {rt.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-600 max-w-[280px] truncate">
                    {rt.description || "—"}
                  </TableCell>
                  <TableCell className="text-gray-600">{tr("{{capacity}} kishi", { capacity: rt.capacity })}</TableCell>
                  <TableCell className="font-medium">
                    {tr("{{Number}} So'm", { Number: Number(rt.base_price || 0).toLocaleString() })}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      disabled={!isAdmin || statusMutation.isPending}
                      onClick={() => isAdmin && onToggleStatus(rt)}
                      title={isAdmin ? tr("Holatni o'zgartirish") : undefined}
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        rt.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500",
                        isAdmin && "cursor-pointer hover:opacity-80"
                      )}
                    >
                      {rt.is_active ? tr("Faol") : tr("Nofaol")}
                    </button>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(rt)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          {tr("Tahrirlash")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => onDelete(rt)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {tr("O'chirish")}
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
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? tr("Xona turini tahrirlash") : tr("Yangi xona turi")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">{tr("Nomi *")}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr("Masalan: Standart, Lyuks")}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{tr("Tavsif")}</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tr("Qisqacha tavsif")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">{tr("Sig'im (kishi) *")}</label>
                <Input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{tr("Asosiy narx (So'm) *")}</label>
                <Input
                  type="number"
                  min={0}
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder={tr("Masalan: 500000")}
                />
              </div>
            </div>
            {errorMsg && (
              <p className="text-sm text-red-500 whitespace-pre-line">{errorMsg}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {tr("Bekor qilish")}
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? tr("Saqlash") : tr("Qo'shish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
