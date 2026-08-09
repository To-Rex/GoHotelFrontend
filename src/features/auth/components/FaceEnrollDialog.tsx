import { useEffect, useState } from "react"
import { ScanFace, Plus, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import {
  getFaceStatus,
  enrollFace,
  deleteFaceProfiles,
  faceErrorMessage,
} from "../api/face"
import { FaceCameraDialog } from "./FaceCameraDialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Xodimning o'z yuzini biriktirish/boshqarish dialogi (navbar'dan ochiladi).
 * Bir nechta namuna (turli burchak/yorug'lik) aniqlikni oshiradi.
 */

interface FaceEnrollDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function FaceEnrollDialog({ open, onOpenChange }: FaceEnrollDialogProps) {
  const [status, setStatus] = useState<{
    engine_available: boolean
    enrolled: boolean
    count: number
  } | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setStatus(await getFaceStatus())
    } catch {
      setStatus(null)
    }
  }

  useEffect(() => {
    if (open) {
      setNotice(null)
      refresh()
    }
  }, [open])

  const handleCapture = async (photo: Blob): Promise<string | null> => {
    try {
      await enrollFace(photo)
      await refresh()
      setNotice("Yuz namunasi muvaffaqiyatli biriktirildi")
      return null
    } catch (e) {
      return faceErrorMessage(e)
    }
  }

  const removeAll = async () => {
    if (!confirm("Barcha yuz namunalaringiz o'chirilsinmi? Yuz bilan kirish o'chadi.")) return
    setBusy(true)
    try {
      await deleteFaceProfiles()
      await refresh()
      setNotice("Yuz namunalari o'chirildi")
    } catch (e) {
      setNotice(faceErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanFace size={18} /> Yuz bilan kirish sozlamalari
            </DialogTitle>
          </DialogHeader>

          {status && !status.engine_available ? (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              Serverda yuz bilan kirish hozircha yoqilmagan.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                {status?.enrolled ? (
                  <p className="flex items-center gap-2 font-medium text-emerald-700">
                    <CheckCircle2 size={16} />
                    Yuzingiz biriktirilgan ({status.count} ta namuna)
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Yuzingiz hali biriktirilmagan. Biriktirsangiz, login sahifasida
                    "Yuz bilan kirish" orqali parolsiz kira olasiz.
                  </p>
                )}
              </div>

              {notice && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {notice}
                </p>
              )}

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Rasm saqlanmaydi — faqat yuzning raqamli belgisi (embedding).
                Turli burchak/yorug'likda 2-3 ta namuna qo'shsangiz aniqlik oshadi
                (ko'pi bilan 3 ta saqlanadi).
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setCameraOpen(true)} className="gap-2">
                  <Plus size={15} /> Yuz qo'shish
                </Button>
                <Button
                  variant="outline"
                  onClick={removeAll}
                  disabled={busy || !status?.enrolled}
                  className="gap-2 text-red-600 hover:text-red-700"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  O'chirish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FaceCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title="Yuzni biriktirish"
        actionLabel="Suratga olish va biriktirish"
        hint="Yuzingizni oval ramkaga joylab, yorug' joyda tugmani bosing"
        onCapture={handleCapture}
      />
    </>
  )
}
