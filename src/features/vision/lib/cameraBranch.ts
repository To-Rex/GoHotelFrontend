/* Kamerani filialga biriktirish — sof mantiq (UI'siz, testlanadi).

   Sozlovchi odatda O'ZI TURGAN filial kameralarini sozlaydi, shuning uchun
   asosiy harakat "shu filialga biriktirish" — bitta tugma, ro'yxatdan
   tanlab xato qilish yo'q. Boshqa filialga biriktirish ham qoladi
   (tanlov), lekin biriktirilgan kamerani KO'CHIRISH tasdiq so'raydi:
   adashib bosilsa boshqa filialning kamerasi jimgina yo'qolib qolmasin. */

export interface CameraLike {
  id: string
  branch_id?: string | null
}

/** Kamera sozlovchi filialiga nisbatan qayerda. */
export type CameraPlace = "here" | "elsewhere" | "unassigned"

export const cameraPlace = (
  camera: CameraLike,
  currentBranchId: string | null | undefined
): CameraPlace => {
  if (!camera.branch_id) return "unassigned"
  return currentBranchId && camera.branch_id === currentBranchId ? "here" : "elsewhere"
}

const ORDER: Record<CameraPlace, number> = { unassigned: 0, here: 1, elsewhere: 2 }

/** Avval e'tibor talab qiladiganlar (biriktirilmagan), keyin shu filial,
    keyin boshqalar; guruh ichida server tartibi (oxirgi surat bo'yicha). */
export const sortCamerasForBranch = <T extends CameraLike>(
  cameras: T[],
  currentBranchId: string | null | undefined
): T[] =>
  cameras
    .map((camera, index) => ({ camera, index }))
    .sort(
      (a, b) =>
        ORDER[cameraPlace(a.camera, currentBranchId)] - ORDER[cameraPlace(b.camera, currentBranchId)] ||
        a.index - b.index
    )
    .map(({ camera }) => camera)

/** Biriktirilgan kamerani BOSHQA filialga ko'chirish — tasdiq kerak.
    Biriktirilmagan kamerani biriktirish yoki o'sha filialni qayta tanlash
    tasdiqsiz. */
export const needsMoveConfirm = (camera: CameraLike, targetBranchId: string | null): boolean =>
  !!camera.branch_id && camera.branch_id !== targetBranchId

/** Yangi qurilma uchun sukut filial — sozlovchi turgan filial (ro'yxatda
    bo'lsa); aks holda tanlanmagan. */
export const defaultDeviceBranchId = (
  currentBranchId: string | null | undefined,
  branches: Array<{ id: string }>
): string =>
  currentBranchId && branches.some((b) => b.id === currentBranchId) ? currentBranchId : ""

/** Shu filialga bir bosishda biriktirish mumkin bo'lgan (biriktirilmagan)
    kameralar. Boshqa filialnikilar ataylab kirmaydi — ularni ommaviy
    ko'chirish xato ehtimolini oshiradi. */
export const assignableHere = <T extends CameraLike>(
  cameras: T[],
  currentBranchId: string | null | undefined
): T[] => (currentBranchId ? cameras.filter((c) => cameraPlace(c, currentBranchId) === "unassigned") : [])
