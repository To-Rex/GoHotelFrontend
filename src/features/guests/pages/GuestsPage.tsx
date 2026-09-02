import { useState } from "react";
import { Plus, Search, Loader2, Upload, X, Pencil, Users, IdCard, Phone, ScanLine, Video } from "lucide-react";
import {
  useGuests,
  useCreateGuest,
  useUpdateGuest,
  uploadGuestFile,
  GUEST_PHOTO_ACCEPT,
  GUEST_PHOTO_MAX_BYTES,
} from "../api/guests";
import {
  NATIONALITIES,
  DEFAULT_NATIONALITY,
  DOC_TYPES,
  sanitizePassport,
} from "../constants";
import { BirthDateSelect } from "../components/BirthDateSelect";
import { DocumentScanner, type ScannedDoc } from "../components/DocumentScanner";
import { FacePickerDialog } from "@/features/vision/components/FacePickerDialog";
import { GuestFaceRow } from "@/features/vision/components/GuestFaceRow";
import {
  fetchSightingFile,
  useEnrollSighting,
  type SightingGroup,
} from "@/features/vision/api/vision";
import type { Guest } from "@/types/api";
import { usePermissions } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

// Jadvaldagi avatar uchun ism-familiya bosh harflari
function initials(first?: string, last?: string): string {
  return (`${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?");
}

const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOC_TYPES.filter((d) => d.value).map((d) => [d.value, d.label])
);

export const GuestsPage = () => {
  const { data: guests, isLoading, isError } = useGuests();
  const { can } = usePermissions();
  const canCreate = can("guest.create");
  const canEdit = can("guest.update");
  const user = useAuthStore((s) => s.user);

  const createGuest = useCreateGuest();
  const enrollFace = useEnrollSighting();
  const updateGuest = useUpdateGuest();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  // null — yangi mehmon qo'shish; aks holda tanlangan mehmon tahrirlanadi
  const [editing, setEditing] = useState<Guest | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  /* Filial kamerasidan tanlangan yuz. Yaratishda mehmon id'si hali yo'q,
     shuning uchun biriktirish saqlashdan keyinga qoldiriladi; tahrirlashda
     id bor va darhol biriktiriladi. */
  const [facePickerOpen, setFacePickerOpen] = useState(false);
  const [pickedFace, setPickedFace] = useState<SightingGroup | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Hujjat skaneri (passport/ID karta) — /booking dagi bilan bir xil komponent.
  // MRZ'dan o'qilgan maydonlargina to'ldiriladi, qolganlari o'z holicha qoladi
  const [scanOpen, setScanOpen] = useState(false);
  const MRZ_COUNTRY: Record<string, string> = {
    UZB: "O'zbekiston",
    KAZ: "Qozog'iston",
    KGZ: "Qirg'iziston",
    TJK: "Tojikiston",
    TKM: "Turkmaniston",
    RUS: "Rossiya",
    AFG: "Afg'oniston",
    AZE: "Ozarbayjon",
    ARM: "Armaniston",
    BLR: "Belarus",
    GEO: "Gruziya",
    TUR: "Turkiya",
    CHN: "Xitoy",
    IND: "Hindiston",
    PAK: "Pokiston",
    IRN: "Eron",
    KOR: "Janubiy Koreya",
    JPN: "Yaponiya",
    USA: "AQSH",
    GBR: "Buyuk Britaniya",
    DEU: "Germaniya",
    FRA: "Fransiya",
    UKR: "Ukraina",
  };
  const applyScannedDoc = (doc: ScannedDoc) => {
    setForm((f) => {
      const next = { ...f };
      if (doc.firstName) next.first_name = doc.firstName;
      if (doc.lastName) next.last_name = doc.lastName;
      if (doc.birthDate) next.birth_date = doc.birthDate;
      if (doc.documentNumber) next.passport_number = sanitizePassport(doc.documentNumber);
      if (doc.personalNumber && doc.pinflVerified) next.id_document_number = doc.personalNumber;
      if (doc.documentType) next.id_document_type = doc.documentType;
      if (doc.nationality) {
        const mapped = MRZ_COUNTRY[doc.nationality];
        if (mapped && NATIONALITIES.includes(mapped)) next.nationality = mapped;
      }
      return next;
    });
  };

  // --- Skaner orqali mijoz QIDIRISH: hujjat o'qiladi, bazadan passport yoki
  // JSHSHIR bo'yicha izlanadi; topilmasa yangi qo'shish taklif qilinadi ---
  const [searchScanOpen, setSearchScanOpen] = useState(false);
  const [scanBanner, setScanBanner] = useState<
    | { type: "found"; guest: Guest }
    | { type: "notfound"; doc: ScannedDoc }
    | null
  >(null);

  const findGuestByDoc = (doc: ScannedDoc): Guest | null => {
    const norm = (s?: string | null) =>
      (s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const pass = norm(doc.documentNumber);
    const personal = doc.pinflVerified ? norm(doc.personalNumber) : "";
    for (const g of guests || []) {
      if (pass.length >= 5 && norm(g.passport_number) === pass) return g;
      if (personal.length >= 8 && norm(g.id_document_number) === personal) return g;
    }
    return null;
  };

  const handleSearchScan = (doc: ScannedDoc) => {
    const found = findGuestByDoc(doc);
    if (found) {
      // Jadval filtri shu mehmonni ko'rsatadigan qiymatga qo'yiladi
      setSearch(found.passport_number || `${found.first_name} ${found.last_name}`.trim());
      setScanBanner({ type: "found", guest: found });
    } else {
      setScanBanner({ type: "notfound", doc });
    }
  };

  // Topilmagan hujjat ma'lumotlari bilan "Yangi mehmon" dialogini ochish
  const openModalFromScan = (doc: ScannedDoc) => {
    openModal();
    applyScannedDoc(doc);
    setScanBanner(null);
  };

  const handlePhoto = (file: File | null) => {
    // Fayldan yuklangan surat kameradan tanlangan yuzning o'rnini bosadi —
    // biriktirish ham u bilan bekor bo'ladi, aks holda boshqa odamning yuzi
    // biriktirilib qolardi.
    setPickedFace(null);
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

  /* Xodimning filiali — mehmonlar sahifasida xona yo'q, shuning uchun doira
     xodimning o'z filiali bo'ladi. Filialsiz xodim (masalan administrator)
     uchun tanlash oynasi buni ochiq aytadi. */
  const activeBranchId = user?.branch_id || null;

  const handleFacePicked = async (group: SightingGroup) => {
    try {
      const file = await fetchSightingFile(
        group.best_sighting_id,
        `kamera-${Date.now()}.jpg`
      );
      handlePhoto(file);
    } catch {
      // Surat yuklanmasa ham biriktirish ishlaydi: vektor serverda saqlangan,
      // rasm faqat ko'rsatish uchun.
      setErrorMsg("Surat yuklanmadi, lekin yuz baribir biriktiriladi.");
    }
    // handlePhoto tanlovni tozalaydi, shuning uchun undan KEYIN.
    setPickedFace(group);

    /* Tahrirlashda mehmon id'si allaqachon bor — kutishning ma'nosi yo'q va
       xodim "Saqlash" ni bosmasa yuz biriktirilmay qolardi. Yaratishda esa
       id faqat saqlashdan keyin paydo bo'ladi, shuning uchun u yerda tanlov
       eslab qolinadi. */
    if (editing) {
      const ok = await attachFace(editing.id, group);
      setErrorMsg(
        ok
          ? null
          : "Yuzni biriktirib bo'lmadi. Qayta urinib ko'ring."
      );
      if (ok) setPickedFace(null);
    }
  };

  const openModal = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    handlePhoto(null);
    setErrorMsg(null);
    setModalOpen(true);
  };

  // Mavjud mehmon ma'lumotlarini formaga yuklab, tahrirlash rejimida ochamiz
  const openEdit = (g: Guest) => {
    setEditing(g);
    setForm({
      first_name: g.first_name || "",
      last_name: g.last_name || "",
      phone: g.phone || "",
      birth_date: (g.birth_date || "").slice(0, 10),
      passport_number: g.passport_number || "",
      id_document_type: g.id_document_type || "",
      id_document_number: g.id_document_number || "",
      nationality: g.nationality || DEFAULT_NATIONALITY,
      address: g.address || "",
    });
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

  /* Yuzni mehmonga biriktiradi. Muvaffaqiyatni qaytaradi va HECH QACHON
     xato tashlamaydi: biriktirish qo'shimcha qadam, u tufayli mehmonni
     saqlash yo'qolmasligi kerak. */
  /* `group` ataylab argument: tahrirlashda bu `setPickedFace` dan darhol
     keyin chaqiriladi va o'shanda state hali eski qiymatni tutadi. */
  const attachFace = async (
    guestId: string,
    group: SightingGroup | null = pickedFace
  ): Promise<boolean> => {
    if (!group) return true;
    try {
      await enrollFace.mutateAsync({
        sightingId: group.best_sighting_id,
        // Guruhning hamma ko'rinishlari — shablon aniqroq bo'ladi va
        // qolganlari ro'yxatda qolib ketmaydi.
        sightingIds: group.sighting_ids,
        guestId,
        // Xodim suratni ataylab tanladi va mehmon kamera oldida turibdi.
        consent: true,
      });
      return true;
    } catch (e) {
      console.error("Yuzni biriktirishda xatolik", e);
      return false;
    }
  };

  const onSubmit = async () => {
    if (!form.first_name.trim()) {
      setErrorMsg("Ism kiritilishi shart");
      return;
    }
    setErrorMsg(null);
    let faceFailed = false;
    try {
      if (editing) {
        // Tahrirlash: bo'shatilgan ixtiyoriy maydonlar "" bilan tozalanadi.
        // last_name backendda min_length=1 — bo'sh bo'lsa yuborilmaydi
        // (avvalgi qiymati saqlanadi).
        await updateGuest.mutateAsync({
          id: editing.id,
          hotelId: editing.hotel_id || user?.hotel_id,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || undefined,
          phone: form.phone.trim(),
          // email frontenddan olib tashlangan — mavjud qiymat backendda
          // o'zgarishsiz saqlanadi (yuborilmagan maydonga tegilmaydi)
          birth_date: form.birth_date || undefined,
          passport_number: form.passport_number
            ? sanitizePassport(form.passport_number)
            : "",
          id_document_type: form.id_document_type,
          id_document_number: form.id_document_number.trim(),
          nationality:
            form.nationality === "Boshqa" ? undefined : form.nationality || undefined,
          address: form.address.trim(),
        } as any);

        // Yangi surat tanlangan bo'lsa — mavjud mehmonga yuklaymiz
        if (photo) {
          try {
            setUploading(true);
            await uploadGuestFile(
              editing.id,
              photo,
              "photo",
              editing.hotel_id || user?.hotel_id
            );
          } catch {
            // surat yuklanmasa ham o'zgarishlar saqlanadi
          } finally {
            setUploading(false);
          }
        }
      } else {
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
        if (pickedFace && guest?.id) {
          faceFailed = !(await attachFace(guest.id));
        }
      }
      handlePhoto(null);
      setModalOpen(false);
      if (faceFailed) {
        // Mehmon saqlandi — buni yo'qotmaymiz. Faqat yuz biriktirilmagani
        // aytiladi, chunki xodim keyingi tashrifda tanilishini kutadi.
        setErrorMsg(
          "Mehmon saqlandi, lekin yuz biriktirilmadi — keyingi tashrifda avtomatik tanilmaydi."
        );
      }
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

  const saving = createGuest.isPending || updateGuest.isPending || uploading;

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mehmonlar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mehmonlar bazasi · jami {(guests || []).length} ta
          </p>
        </div>
        {canCreate && (
          <Button onClick={openModal}>
            <Plus className="h-4 w-4 mr-2" />
            Mehmon qo'shish
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Ism, telefon yoki hujjat bo'yicha qidirish..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setScanBanner(null);
            }}
          />
        </div>
        {/* Hujjatni skanerlab mijozni topish */}
        <Button
          variant="outline"
          onClick={() => {
            setScanBanner(null);
            setSearchScanOpen(true);
          }}
          className="gap-2"
          title="Passport yoki ID kartani skanerlab mijozni topish"
        >
          <ScanLine className="h-4 w-4" />
          Skaner bilan qidirish
        </Button>
      </div>

      {/* Skaner qidiruvi natijasi */}
      {scanBanner?.type === "found" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5">
          <p className="text-sm font-medium text-emerald-800">
            Mijoz topildi: {scanBanner.guest.first_name} {scanBanner.guest.last_name}
            {scanBanner.guest.phone ? ` · ${scanBanner.guest.phone}` : ""}
          </p>
          <div className="flex shrink-0 gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  openEdit(scanBanner.guest);
                  setScanBanner(null);
                }}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Ochish
              </button>
            )}
            <button
              type="button"
              onClick={() => setScanBanner(null)}
              className="rounded-md px-2 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100"
            >
              Yopish
            </button>
          </div>
        </div>
      )}
      {scanBanner?.type === "notfound" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
          <p className="text-sm font-medium text-amber-800">
            Bu hujjat bo'yicha mijoz topilmadi
            {scanBanner.doc.firstName
              ? ` (${scanBanner.doc.firstName} ${scanBanner.doc.lastName || ""})`
              : ""}{" "}
            — yangi mehmon sifatida qo'shilsinmi?
          </p>
          <div className="flex shrink-0 gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={() => openModalFromScan(scanBanner.doc)}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                + Yangi mehmon qo'shish
              </button>
            )}
            <button
              type="button"
              onClick={() => setScanBanner(null)}
              className="rounded-md px-2 py-1.5 text-xs text-amber-700 hover:bg-amber-100"
            >
              Yopish
            </button>
          </div>
        </div>
      )}

      {/* Qidiruv uchun skaner (dialog ichidagidan alohida) */}
      <DocumentScanner
        open={searchScanOpen}
        onOpenChange={setSearchScanOpen}
        onResult={handleSearchScan}
      />

      {/* MOBIL: mehmonlar karta ko'rinishida (jadval planshet/desktopda) */}
      <div className="space-y-2.5 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
            <div className="flex flex-col items-center gap-2">
              <Users className="h-8 w-8" />
              <p className="text-sm">
                {search.trim()
                  ? "Qidiruv bo'yicha mehmon topilmadi"
                  : "Hozircha mehmonlar yo'q"}
              </p>
            </div>
          </div>
        ) : (
          filtered.map((guest) => (
            <div key={guest.id} className="rounded-2xl border bg-white p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-xs font-semibold text-white shadow-sm">
                    {initials(guest.first_name, guest.last_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 leading-tight truncate">
                      {guest.first_name} {guest.last_name}
                    </p>
                    {guest.nationality && (
                      <p className="text-xs text-gray-400 leading-tight truncate">
                        {guest.nationality}
                      </p>
                    )}
                  </div>
                </div>
                {/* Tug'ilgan sana — jadvaldagi ustun qiymati */}
                <span className="flex-shrink-0 text-xs text-gray-600">
                  {guest.birth_date ? (
                    String(guest.birth_date).slice(0, 10)
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </span>
              </div>

              <div className="mt-2.5 space-y-1.5 text-sm">
                {/* Telefon */}
                {guest.phone ? (
                  <span className="inline-flex items-center gap-1.5 text-gray-700">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    {guest.phone}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-gray-300">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />—
                  </span>
                )}
                {/* Hujjat */}
                <div>
                  {guest.passport_number || guest.id_document_number ? (
                    <div className="inline-flex items-center gap-1.5">
                      <IdCard className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-mono text-xs font-medium bg-gray-100 text-gray-700 rounded px-2 py-0.5">
                        {guest.passport_number || guest.id_document_number}
                      </span>
                      {guest.id_document_type && (
                        <span className="text-[11px] text-gray-400">
                          {DOC_TYPE_LABELS[guest.id_document_type] || guest.id_document_type}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-gray-300">
                      <IdCard className="h-3.5 w-3.5 text-gray-400" />—
                    </span>
                  )}
                </div>
              </div>

              {canEdit && (
                <div className="mt-3 flex justify-end border-t border-gray-100 pt-2.5">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(guest)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Tahrirlash
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
      <div className="hidden rounded-lg border bg-white overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead>Mehmon</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Hujjat</TableHead>
              <TableHead>Tug'ilgan sana</TableHead>
              {canEdit && <TableHead className="text-right">Amallar</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 5 : 4} className="py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Users className="h-8 w-8" />
                    <p className="text-sm">
                      {search.trim()
                        ? "Qidiruv bo'yicha mehmon topilmadi"
                        : "Hozircha mehmonlar yo'q"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-xs font-semibold text-white shadow-sm">
                        {initials(guest.first_name, guest.last_name)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 leading-tight truncate">
                          {guest.first_name} {guest.last_name}
                        </p>
                        {guest.nationality && (
                          <p className="text-xs text-gray-400 leading-tight truncate">
                            {guest.nationality}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {guest.phone ? (
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        {guest.phone}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {guest.passport_number || guest.id_document_number ? (
                      <div className="inline-flex items-center gap-1.5">
                        <IdCard className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-mono text-xs font-medium bg-gray-100 text-gray-700 rounded px-2 py-0.5">
                          {guest.passport_number || guest.id_document_number}
                        </span>
                        {guest.id_document_type && (
                          <span className="text-[11px] text-gray-400">
                            {DOC_TYPE_LABELS[guest.id_document_type] || guest.id_document_type}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {guest.birth_date ? String(guest.birth_date).slice(0, 10) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(guest)}>
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

      {/* Mehmon qo'shish/tahrirlash modali */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              {editing ? "Mehmonni tahrirlash" : "Yangi mehmon"}
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                title="Passport yoki ID kartani kamera bilan skanerlash"
              >
                <ScanLine className="h-3.5 w-3.5" />
                Skanerlash
              </button>
            </DialogTitle>
          </DialogHeader>

          {/* Hujjat skaneri — MRZ o'qib formani avtomatik to'ldiradi */}
          <DocumentScanner open={scanOpen} onOpenChange={setScanOpen} onResult={applyScannedDoc} />

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
                    {/* Tahrirlashda ro'yxatda bo'lmagan fuqarolik qiymati ham
                        yo'qolmasligi uchun uni ro'yxat boshiga qo'shamiz */}
                    {form.nationality && !NATIONALITIES.includes(form.nationality) && (
                      <option value={form.nationality}>{form.nationality}</option>
                    )}
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

            {/* Mavjud mehmon: yuz holati, biriktirish va o'chirish.
                Yangi mehmonda id hali yo'q — u yerda quyidagi surat
                bo'limidagi tugma ishlatiladi va biriktirish saqlashdan
                keyin bajariladi. */}
            {editing && (
              <div className="pt-2 border-t border-gray-200 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Yuz (Face ID)
                </p>
                {/* branchId berilmasa (masalan administratorda filial yo'q)
                    oyna filialni o'zi so'raydi — imkoniyat yopilib qolmaydi. */}
                <GuestFaceRow
                  guestId={editing.id}
                  branchId={activeBranchId}
                  allowRemove
                  // Biriktirish quyidagi surat bo'limidagi tugma orqali —
                  // u yaratishdagi bilan bir xil va tanish.
                  attachable={false}
                />
              </div>
            )}

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
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center gap-1 h-24 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-primary-400 hover:bg-white transition-colors">
                    <Upload className="h-5 w-5 text-gray-400" />
                    <span className="text-xs text-gray-600 font-medium">Passport surati / mehmon fotosi</span>
                    <span className="text-[11px] text-gray-400">JPG, PNG, WEBP · 5 MB</span>
                    <input type="file" accept={GUEST_PHOTO_ACCEPT} className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0] || null)} />
                  </label>
                  {/* Filial IP kamerasidan tanlash — mehmon qabulxonaga
                      kelganda kamera uni allaqachon suratga olgan bo'ladi.
                      Yaratishda ham, tahrirlashda ham bir xil ko'rinadi:
                      farq faqat qachon biriktirilishida, va uni xodim
                      bilishi shart emas. */}
                  <button
                    type="button"
                    onClick={() => setFacePickerOpen(true)}
                    className="w-full flex flex-col items-center justify-center gap-1 h-20 rounded-lg border-2 border-dashed border-primary-300 bg-primary-50/40 hover:border-primary-500 hover:bg-primary-50 transition-colors"
                  >
                    <Video className="h-5 w-5 text-primary-500" />
                    <span className="text-xs text-primary-700 font-medium">Filial kamerasidan tanlash (Face ID)</span>
                    <span className="text-[11px] text-primary-500/80">
                      {editing
                        ? "Tanlangan zahoti biriktiriladi"
                        : "Keyingi tashrifda avtomatik tanaladi"}
                    </span>
                  </button>
                </div>
              )}
              {pickedFace && (
                <p className="flex items-center gap-1.5 text-[11px] text-primary-700">
                  <Video className="h-3.5 w-3.5" />
                  {pickedFace.camera_name || pickedFace.camera_id} kamerasidan
                  {pickedFace.count > 1 && ` · ${pickedFace.count} ta surat`} — saqlangach yuzi biriktiriladi
                </p>
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

      {/* Xodimning filiali kameralaridan yuz tanlash. Boshqa filial
          suratlari bu yerga tushmaydi. */}
      <FacePickerDialog
        open={facePickerOpen}
        onOpenChange={setFacePickerOpen}
        branchId={activeBranchId}
        onSelect={handleFacePicked}
      />
    </div>
  );
};
