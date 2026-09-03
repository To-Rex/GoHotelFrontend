import { useCallback, useEffect, useState } from "react"
import { LogOut, ScanFace, ShieldAlert } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth"
import {
  enrollFace,
  faceErrorMessage,
  getFaceStatus,
  hasCamera,
} from "@/features/auth/api/face"
import { FaceCameraDialog } from "./FaceCameraDialog"

/**
 * Yuzi yo'q xodimdan uni biriktirishni talab qiladi.
 *
 * Kirish ikki bosqichli: parol, so'ng yuz. Ammo yuzi biriktirilmagan xodim
 * uchun ikkinchi bosqich o'tkazib yuboriladi — ya'ni parolning o'zi yetarli
 * bo'lib qoladi. Menejer kimningdir yuzini o'chirgach ham xuddi shu holat
 * yuzaga keladi. Shuning uchun tizimga kirgan, lekin yuzi yo'q xodimdan uni
 * darhol biriktirish so'raladi.
 *
 * ADMINISTRATOR majburlanmaydi. Sabab amaliy: yuz dvigateli yoki kamera
 * ishlamay qolsa, majburlash tizimni boshqaradigan odamni ham ichkariga
 * qamab qo'yardi — va o'shanda muammoni hal qiladigan hech kim qolmasdi.
 *
 * Kamera topilmasa oyna yopilishi mumkin: kamerasiz biriktirib bo'lmaydi va
 * xodimni bo'sh ekran oldida qoldirish ishni to'xtatib qo'yardi. Bunday
 * holatda nima qilish kerakligi aytiladi.
 */

export function FaceRequiredGate() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [required, setRequired] = useState(false)
  const [cameraMissing, setCameraMissing] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)

  const check = useCallback(async () => {
    // Administrator va super administrator majburlanmaydi
    if (!user || user.user_type !== "EMPLOYEE") {
      setRequired(false)
      return
    }
    try {
      const status = await getFaceStatus()
      // Dvigatel ishlamasa yuz umuman so'ralmaydi — talab ham qilinmaydi
      if (!status.engine_available || status.enrolled) {
        setRequired(false)
        return
      }
      setRequired(true)
      setCameraMissing(!(await hasCamera()))
    } catch {
      /* Holatni bilib bo'lmasa majburlamaymiz: tarmoq uzilishi tufayli
         xodimni ishlashdan to'xtatib qo'yish xavfliroq */
      setRequired(false)
    }
  }, [user])

  useEffect(() => {
    void check()
  }, [check])

  const handleCapture = async (photo: Blob): Promise<string | null> => {
    try {
      await enrollFace(photo)
      setCameraOpen(false)
      await check()
      return null
    } catch (e) {
      return faceErrorMessage(e)
    }
  }

  if (!required || dismissed) return null

  return (
    <>
      <Dialog open={!cameraOpen} onOpenChange={() => {}}>
        {/* Yopish tugmasi yo'q: bu talab, taklif emas */}
        <DialogContent className="sm:max-w-[460px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Yuzingizni biriktiring
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm leading-relaxed text-gray-700">
            Tizimga kirish ikki bosqichli: parol va yuz. Sizda hali yuz
            biriktirilmagan, shuning uchun hisobingizni faqat parol himoya
            qilyapti. Davom etish uchun yuzingizni biriktiring.
          </p>

          {cameraMissing ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Bu qurilmada kamera topilmadi. Yuzni biriktirish uchun kamerasi
                bor qurilmadan kiring — masalan telefon yoki noutbukdan.
              </p>
              {/* Kamerasiz biriktirib bo'lmaydi; xodimni bo'sh ekran oldida
                  qoldirish ishni to'xtatib qo'yardi */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setDismissed(true)}
              >
                Hozircha davom etish
              </Button>
            </div>
          ) : (
            <Button className="w-full" onClick={() => setCameraOpen(true)}>
              <ScanFace className="mr-2 h-4 w-4" />
              Yuzni biriktirish
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full text-gray-500"
            onClick={() => logout()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Chiqish
          </Button>
        </DialogContent>
      </Dialog>

      <FaceCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title="Yuzni biriktirish"
        actionLabel="Suratga olish"
        hint="Yuzingizni oval ramkaga joylang va yorug'likka qarab turing"
        onCapture={handleCapture}
      />
    </>
  )
}
