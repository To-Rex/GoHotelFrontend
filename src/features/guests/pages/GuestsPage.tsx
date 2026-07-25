import { useState } from "react";
import { Plus, Search, Loader2, Upload, X } from "lucide-react";
import {
  useGuests,
  useCreateGuest,
  uploadGuestFile,
  GUEST_PHOTO_ACCEPT,
  GUEST_PHOTO_MAX_BYTES,
} from "../api/guests";
import { NATIONALITIES, DEFAULT_NATIONALITY } from "../constants";
import { BirthDateSelect } from "../components/BirthDateSelect";
import { usePermissions } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const DOC_TYPES = [
  { value: "", label: "Tanlang" },
  { value: "PASSPORT", label: "Passport" },
  { value: "ID_CARD", label: "ID karta" },
  { value: "DRIVER_LICENSE", label: "Haydovchilik guvohnomasi" },
  { value: "BIRTH_CERTIFICATE", label: "Tug'ilganlik guvohnomasi" },
  { value: "OTHER", label: "Boshqa" },
];

const emptyForm = {
  first_name: "",
  last_name: "",
  phone: "",
  birth_date: "",
  passport_number: "",
  id_document_type: "",
  id_document_number: "",
  nationality: DEFAULT_NATIONALITY,
  address: "",
};

function sanitizePassport(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const GuestsPage = () => {
  const { data: guests, isLoading, isError } = useGuests();
  const { can } = usePermissions();
  const canCreate = can("guest.create");
  const user = useAuthStore((s) => s.user);

  const createGuest = useCreateGuest();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhoto = (file: File | null) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (!file) {
      setPhoto(null);
      setPhotoPreview(null);
      return;
    }
    if (!GUEST_PHOTO_ACCEPT.split(",").includes(file.type)) {
      setErrorMsg("Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.");
      return;
    }
    if (file.size > GUEST_PHOTO_MAX_BYTES) {
      setErrorMsg("Rasm hajmi 5 MB dan oshmasligi kerak.");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const openModal = () => {
    setForm({ ...emptyForm });
    handlePhoto(null);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const apiError = (e: any) => {
    const d = e?.response?.data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x: any) => x.msg).join(", ");
    return "Xatolik yuz berdi. Qayta urinib ko'ring.";
  };

  const onSubmit = async () => {
    if (!form.first_name.trim()) {
      setErrorMsg("Ism kiritilishi shart");
      return;
    }
    setErrorMsg(null);
    try {
      const guest = await createGuest.mutateAsync({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || "",
        phone: form.phone || undefined,
        birth_date: form.birth_date || undefined,
        passport_number: form.passport_number ? sanitizePassport(form.passport_number) : undefined,
        id_document_type: form.id_document_type || undefined,
        id_document_number: form.id_document_number || undefined,
        nationality: form.nationality === "Boshqa" ? undefined : form.nationality || undefined,
        address: form.address || undefined,
        hotelId: user?.hotel_id,
      } as any);

      if (photo && guest?.id) {
        try {
          setUploading(true);
          await uploadGuestFile(guest.id, photo, "photo", user?.hotel_id);
        } catch {
          // surat yuklanmasa ham mehmon saqlanadi
        } finally {
          setUploading(false);
        }
      }
      handlePhoto(null);
      setModalOpen(false);
    } catch (e) {
      setErrorMsg(apiError(e));
    }
  };

  const filtered = (guests || []).filter((g) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      g.first_name?.toLowerCase().includes(q) ||
      g.last_name?.toLowerCase().includes(q) ||
      g.phone?.includes(q) ||
      (g.passport_number || g.id_document_number || "").toLowerCase().includes(q)
    );
  });

  const saving = createGuest.isPending || uploading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Mehmonlar</h1>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return <div>Xatolik yuz berdi. Iltimos qayta urining.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Mehmonlar</h1>
        {canCreate && (
          <Button onClick={openModal}>
            <Plus className="h-4 w-4 mr-2" />
            Mehmon qo'shish
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Ism, telefon yoki hujjat bo'yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ism Familiya</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Hujjat raqami</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-gray-400">
                  Ma'lumot topilmadi
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell className="font-medium">
                    {guest.first_name} {guest.last_name}
                  </TableCell>
                  <TableCell>{guest.phone || "-"}</TableCell>
                  <TableCell>{guest.email || "-"}</TableCell>
                  <TableCell>{guest.passport_number || guest.id_document_number || "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Yangi mehmon modali */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yangi mehmon</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Ism *</label>
                <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="Ism" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Familiya</label>
                <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Familiya" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Telefon</label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+998..." />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Tug'ilgan sana</label>
              <BirthDateSelect value={form.birth_date} onChange={(v) => set("birth_date", v)} />
            </div>

            {/* Hujjat ma'lumotlari */}
            <div className="pt-2 border-t border-gray-200 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hujjat ma'lumotlari</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Passport raqami</label>
                  <Input
                    value={form.passport_number}
                    onChange={(e) => set("passport_number", sanitizePassport(e.target.value))}
                    placeholder="AA1234567"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Fuqaroligi</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={form.nationality}
                    onChange={(e) => set("nationality", e.target.value)}
                  >
                    {NATIONALITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Hujjat turi</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={form.id_document_type}
                    onChange={(e) => set("id_document_type", e.target.value)}
                  >
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Hujjat raqami</label>
                  <Input value={form.id_document_number} onChange={(e) => set("id_document_number", e.target.value)} placeholder="Hujjat raqami" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Manzil</label>
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Yashash manzili" />
              </div>
            </div>

            {/* Surat */}
            <div className="pt-2 border-t border-gray-200 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Surat (ixtiyoriy)</p>
              {photoPreview ? (
                <div className="flex items-center gap-3">
                  <img src={photoPreview} alt="" className="h-20 w-20 rounded-lg object-cover border border-gray-200" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-600 truncate">{photo?.name}</p>
                    <button type="button" className="mt-1 text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1" onClick={() => handlePhoto(null)}>
                      <X className="h-3 w-3" /> O'chirish
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-1 h-24 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-primary-400 hover:bg-white transition-colors">
                  <Upload className="h-5 w-5 text-gray-400" />
                  <span className="text-xs text-gray-600 font-medium">Passport surati / mehmon fotosi</span>
                  <span className="text-[11px] text-gray-400">JPG, PNG, WEBP · 5 MB</span>
                  <input type="file" accept={GUEST_PHOTO_ACCEPT} className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0] || null)} />
                </label>
              )}
            </div>

            {errorMsg && <p className="text-sm text-red-500 whitespace-pre-line">{errorMsg}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button onClick={onSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
