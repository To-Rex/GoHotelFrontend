import { tr } from "@/i18n"
// Mehmon fuqaroligi uchun ro'yxat. Birinchi bo'lib O'zbekiston va qo'shni/eng
// ko'p uchraydigan davlatlar, so'ng qolganlari alifbo tartibida.
// i18n:keys — qiymat bazaga O'ZBEKCHA yoziladi (mehmon.nationality) va
// solishtiriladi; ekranga chiqarishda tr(qiymat) bilan tarjima qilinadi.
export const DEFAULT_NATIONALITY = "O'zbekiston";

// i18n:keys
export const NATIONALITIES: string[] = [
  "O'zbekiston",
  "Qozog'iston",
  "Qirg'iziston",
  "Tojikiston",
  "Turkmaniston",
  "Rossiya",
  "Afg'oniston",
  "Ozarbayjon",
  "Armaniston",
  "Belarus",
  "Gruziya",
  "Turkiya",
  "Xitoy",
  "Hindiston",
  "Pokiston",
  "Eron",
  "Janubiy Koreya",
  "Yaponiya",
  "Malayziya",
  "Indoneziya",
  "BAA",
  "Saudiya Arabistoni",
  "Misr",
  "Isroil",
  "AQSH",
  "Kanada",
  "Buyuk Britaniya",
  "Germaniya",
  "Fransiya",
  "Italiya",
  "Ispaniya",
  "Niderlandiya",
  "Belgiya",
  "Shveytsariya",
  "Avstriya",
  "Polsha",
  "Chexiya",
  "Ukraina",
  "Moldova",
  "Litva",
  "Latviya",
  "Estoniya",
  "Shvetsiya",
  "Norvegiya",
  "Finlyandiya",
  "Daniya",
  "Avstraliya",
  "Braziliya",
  "Boshqa",
];

/* Hujjat turlari. Mehmonlar sahifasi va tez tahrirlash oynasi bir xil
   ro'yxatdan foydalanadi — aks holda bir joyda bor tur ikkinchisida yo'q
   bo'lib qolardi. */
// MRZ'dagi 3 harfli davlat kodini fuqarolik ro'yxatidagi nomga o'girish
// i18n:keys
export const MRZ_COUNTRY: Record<string, string> = {
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

export const DOC_TYPES = [
  { value: "", label: tr("Tanlang") },
  { value: "PASSPORT", label: tr("Passport") },
  { value: "ID_CARD", label: tr("ID karta") },
  { value: "DRIVER_LICENSE", label: tr("Haydovchilik guvohnomasi") },
  { value: "BIRTH_CERTIFICATE", label: tr("Tug'ilganlik guvohnomasi") },
  { value: "OTHER", label: tr("Boshqa") },
];

/** Passport raqami: faqat lotin harflari va raqamlar, katta harfda. */
export function sanitizePassport(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
