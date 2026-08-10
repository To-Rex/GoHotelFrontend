import { useState } from "react"
import { ConciergeBell, Plus, Pencil, Loader2, Power, PowerOff } from "lucide-react"
import {
  useServices,
  useCreateService,
  useUpdateService,
  useHotelServices,
  useCreateHotelService,
  useUpdateHotelService,
  useDeleteHotelService,
} from "../api/services"
import type { ServiceCatalogItem, HotelServiceItem } from "@/types/api"
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

export const ServicesPage = () => {
  const { isAdmin, can } = usePermissions()
  // Katalog mutatsiyalari backendda ADMIN/SUPER_ADMIN uchun; mehmonxona
  // narxlari esa hotel_service.manage ruxsatiga ega xodimlarga ham ochiq
  const canManageHotelServices = can("hotel_service.manage")
  const user = useAuthStore((s) => s.user)

  const { data: services = [], isLoading: servicesLoading } = useServices()
  const { data: hotelServices = [], isLoading: hotelServicesLoading } = useHotelServices()

  const createService = useCreateService()
  const updateService = useUpdateService()
  const createHotelService = useCreateHotelService()
  const updateHotelService = useUpdateHotelService()
  const deleteHotelService = useDeleteHotelService()

  // --- Katalog dialogi ---
  const [svcModalOpen, setSvcModalOpen] = useState(false)
  const [editingSvc, setEditingSvc] = useState<ServiceCatalogItem | null>(null)
  const [svcName, setSvcName] = useState("")
  const [svcCode, setSvcCode] = useState("")
  const [svcDescription, setSvcDescription] = useState("")
  const [svcCategory, setSvcCategory] = useState("")
  const [svcError, setSvcError] = useState<string | null>(null)

  // --- Mehmonxona xizmati dialogi ---
  const [hsModalOpen, setHsModalOpen] = useState(false)
  const [editingHs, setEditingHs] = useState<HotelServiceItem | null>(null)
  const [hsServiceId, setHsServiceId] = useState("")
  const [hsPrice, setHsPrice] = useState("")
  const [hsError, setHsError] = useState<string | null>(null)

  // Hali mehmonxonaga ulanmagan xizmatlar (qo'shish dialogida taklif qilinadi)
  const linkedServiceIds = new Set(hotelServices.map((hs) => hs.service_id))
  const unlinkedServices = services.filter((s) => !linkedServiceIds.has(s.id))

  const openSvcCreate = () => {
    setEditingSvc(null)
    setSvcName("")
    setSvcCode("")
    setSvcDescription("")
    setSvcCategory("")
    setSvcError(null)
    setSvcModalOpen(true)
  }

  const openSvcEdit = (s: ServiceCatalogItem) => {
    setEditingSvc(s)
    setSvcName(s.name)
    setSvcCode(s.code)
    setSvcDescription(s.description || "")
    setSvcCategory(s.category || "")
    setSvcError(null)
    setSvcModalOpen(true)
  }

  const onSvcSubmit = async () => {
    if (!svcName.trim()) {
      setSvcError("Nomini kiriting")
      return
    }
    if (!editingSvc && !svcCode.trim()) {
      setSvcError("Kodni kiriting (masalan: LAUNDRY)")
      return
    }
    try {
      if (editingSvc) {
        await updateService.mutateAsync({
          id: editingSvc.id,
          name: svcName.trim(),
          description: svcDescription.trim() || undefined,
          category: svcCategory.trim() || undefined,
        })
      } else {
        await createService.mutateAsync({
          name: svcName.trim(),
          code: svcCode.trim().toUpperCase(),
          description: svcDescription.trim() || undefined,
          category: svcCategory.trim() || "OTHER",
        })
      }
      setSvcModalOpen(false)
    } catch (e) {
      setSvcError(apiErrorMessage(e))
    }
  }

  const openHsCreate = () => {
    setEditingHs(null)
    setHsServiceId(unlinkedServices[0]?.id || "")
    setHsPrice("")
    setHsError(null)
    setHsModalOpen(true)
  }

  const openHsEdit = (hs: HotelServiceItem) => {
    setEditingHs(hs)
    setHsServiceId(hs.service_id)
    setHsPrice(String(hs.price ?? ""))
    setHsError(null)
    setHsModalOpen(true)
  }

  const onHsSubmit = async () => {
    const price = Number(hsPrice)
    if (Number.isNaN(price) || price < 0) {
      setHsError("Narxni to'g'ri kiriting")
      return
    }
    try {
      if (editingHs) {
        await updateHotelService.mutateAsync({
          id: editingHs.id,
          price,
          hotelId: user?.hotel_id,
        })
      } else {
        if (!hsServiceId) {
          setHsError("Xizmatni tanlang")
          return
        }
        await createHotelService.mutateAsync({
          service_id: hsServiceId,
          price,
          hotelId: user?.hotel_id,
        })
      }
      setHsModalOpen(false)
    } catch (e) {
      setHsError(apiErrorMessage(e))
    }
  }

  const onHsToggle = async (hs: HotelServiceItem) => {
    try {
      if (hs.is_active) {
        // O'chirish — backend soft-disable qiladi (is_active=false)
        await deleteHotelService.mutateAsync({ id: hs.id, hotelId: user?.hotel_id })
      } else {
        await updateHotelService.mutateAsync({
          id: hs.id,
          is_active: true,
          hotelId: user?.hotel_id,
        })
      }
    } catch (e) {
      alert(apiErrorMessage(e))
    }
  }

  if (servicesLoading || hotelServicesLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Xizmatlar</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Mehmonxona xizmatlari (narxlar) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Xizmatlar</h1>
            <p className="text-sm text-gray-500 mt-1">
              Mehmonxonangizda ko'rsatiladigan xizmatlar va ularning narxlari
            </p>
          </div>
          {canManageHotelServices && (
            <Button onClick={openHsCreate} disabled={unlinkedServices.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Xizmat ulash
            </Button>
          )}
        </div>

        {/* MOBIL: mehmonxona xizmatlari karta ko'rinishida (jadval planshet/desktopda) */}
        <div className="space-y-2.5 md:hidden">
          {hotelServices.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
              Mehmonxonaga hali xizmatlar ulanmagan
            </div>
          ) : (
            hotelServices.map((hs) => (
              <div key={hs.id} className="rounded-2xl border bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                      <ConciergeBell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{hs.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-gray-600">
                        {hs.code}
                        <span className="font-sans"> · {hs.category || "—"}</span>
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
                      hs.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {hs.is_active ? "Faol" : "O'chirilgan"}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
                  <span className="font-medium">
                    {Number(hs.price || 0).toLocaleString()} So'm
                  </span>
                  {canManageHotelServices && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openHsEdit(hs)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Narx
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={
                          hs.is_active
                            ? "text-red-600 hover:text-red-700"
                            : "text-emerald-600 hover:text-emerald-700"
                        }
                        onClick={() => onHsToggle(hs)}
                      >
                        {hs.is_active ? (
                          <>
                            <PowerOff className="h-3.5 w-3.5 mr-1" />
                            O'chirish
                          </>
                        ) : (
                          <>
                            <Power className="h-3.5 w-3.5 mr-1" />
                            Yoqish
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
        <div className="hidden rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Xizmat</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Kategoriya</TableHead>
                <TableHead>Narx</TableHead>
                <TableHead>Holat</TableHead>
                {canManageHotelServices && (
                  <TableHead className="text-right">Amallar</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {hotelServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-gray-400">
                    Mehmonxonaga hali xizmatlar ulanmagan
                  </TableCell>
                </TableRow>
              ) : (
                hotelServices.map((hs) => (
                  <TableRow key={hs.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                          <ConciergeBell className="h-4 w-4" />
                        </span>
                        {hs.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-600 font-mono text-xs">
                      {hs.code}
                    </TableCell>
                    <TableCell className="text-gray-600">{hs.category || "—"}</TableCell>
                    <TableCell className="font-medium">
                      {Number(hs.price || 0).toLocaleString()} So'm
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          hs.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {hs.is_active ? "Faol" : "O'chirilgan"}
                      </span>
                    </TableCell>
                    {canManageHotelServices && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openHsEdit(hs)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Narx
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={
                              hs.is_active
                                ? "text-red-600 hover:text-red-700"
                                : "text-emerald-600 hover:text-emerald-700"
                            }
                            onClick={() => onHsToggle(hs)}
                          >
                            {hs.is_active ? (
                              <>
                                <PowerOff className="h-3.5 w-3.5 mr-1" />
                                O'chirish
                              </>
                            ) : (
                              <>
                                <Power className="h-3.5 w-3.5 mr-1" />
                                Yoqish
                              </>
                            )}
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
      </div>

      {/* Xizmatlar katalogi */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Xizmatlar katalogi</h2>
            <p className="text-sm text-gray-500 mt-1">
              Umumiy xizmatlar ro'yxati — mehmonxonaga ulash uchun asos
            </p>
          </div>
          {isAdmin && (
            <Button variant="outline" onClick={openSvcCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Katalogga qo'shish
            </Button>
          )}
        </div>

        {/* MOBIL: katalog karta ko'rinishida (jadval planshet/desktopda) */}
        <div className="space-y-2.5 md:hidden">
          {services.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
              Katalog bo'sh
            </div>
          ) : (
            services.map((s) => (
              <div key={s.id} className="rounded-2xl border bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-gray-600">
                      {s.code}
                      <span className="font-sans"> · {s.category || "—"}</span>
                    </p>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => openSvcEdit(s)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Tahrirlash
                    </Button>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-gray-600">{s.description || "—"}</p>
              </div>
            ))
          )}
        </div>

        {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
        <div className="hidden rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomi</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Kategoriya</TableHead>
                <TableHead>Tavsif</TableHead>
                {isAdmin && <TableHead className="text-right">Amallar</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-gray-400">
                    Katalog bo'sh
                  </TableCell>
                </TableRow>
              ) : (
                services.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-gray-600 font-mono text-xs">
                      {s.code}
                    </TableCell>
                    <TableCell className="text-gray-600">{s.category || "—"}</TableCell>
                    <TableCell className="text-gray-600 max-w-[280px] truncate">
                      {s.description || "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openSvcEdit(s)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Tahrirlash
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Katalog dialogi */}
      <Dialog open={svcModalOpen} onOpenChange={setSvcModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {editingSvc ? "Xizmatni tahrirlash" : "Katalogga yangi xizmat"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nomi *</label>
              <Input
                value={svcName}
                onChange={(e) => setSvcName(e.target.value)}
                placeholder="Masalan: Kir yuvish"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Kod *</label>
                <Input
                  value={svcCode}
                  onChange={(e) => setSvcCode(e.target.value)}
                  placeholder="LAUNDRY"
                  disabled={!!editingSvc}
                  title={editingSvc ? "Kodni o'zgartirib bo'lmaydi" : undefined}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Kategoriya</label>
                <Input
                  value={svcCategory}
                  onChange={(e) => setSvcCategory(e.target.value)}
                  placeholder="OTHER"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Tavsif</label>
              <Input
                value={svcDescription}
                onChange={(e) => setSvcDescription(e.target.value)}
                placeholder="Qisqacha tavsif"
              />
            </div>
            {svcError && (
              <p className="text-sm text-red-500 whitespace-pre-line">{svcError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSvcModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              onClick={onSvcSubmit}
              disabled={createService.isPending || updateService.isPending}
            >
              {(createService.isPending || updateService.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingSvc ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mehmonxona xizmati dialogi */}
      <Dialog open={hsModalOpen} onOpenChange={setHsModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {editingHs ? `Narxni tahrirlash — ${editingHs.name}` : "Xizmatni ulash"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingHs && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Xizmat *</label>
                <select
                  className={selectClass}
                  value={hsServiceId}
                  onChange={(e) => setHsServiceId(e.target.value)}
                >
                  <option value="">Xizmatni tanlang</option>
                  {unlinkedServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Narx (So'm) *</label>
              <Input
                type="number"
                min={0}
                value={hsPrice}
                onChange={(e) => setHsPrice(e.target.value)}
                placeholder="Masalan: 50000"
              />
            </div>
            {hsError && (
              <p className="text-sm text-red-500 whitespace-pre-line">{hsError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHsModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              onClick={onHsSubmit}
              disabled={createHotelService.isPending || updateHotelService.isPending}
            >
              {(createHotelService.isPending || updateHotelService.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingHs ? "Saqlash" : "Ulash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
