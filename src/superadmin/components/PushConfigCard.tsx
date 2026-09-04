import { useState } from "react"
import { BellRing, Loader2, Send, Trash2, UploadCloud } from "lucide-react"

import { cn } from "@/lib/utils"
import { panelError } from "../api/client"
import {
  useDeletePushCredentials,
  usePushStatus,
  useSavePushCredentials,
  useTestPush,
} from "../api/panel"
import { PanelButton, PanelCard, PanelNotice } from "../components/ui"

/**
 * Push (Firebase) kalitini panel orqali boshqarish.
 *
 * Ilgari kalit faqat env-var edi — almashtirish uchun redeploy kerak
 * bo'lardi. Endi egasi service-account JSON'ini shu yerga qo'yadi:
 * kalit bazada shifrlangan holda saqlanadi va yuklangan zahoti push
 * restartsiz qayta ishga tushadi.
 */

const SOURCE_LABELS: Record<string, string> = {
  panel: "Panel orqali yuklangan",
  "env(FIREBASE_CREDENTIALS_JSON)": "Server env-varidan",
  none: "Kalit yo'q",
}

function sourceLabel(source: string): string {
  if (source.startsWith("file(")) return "Serverdagi fayldan"
  return SOURCE_LABELS[source] || source
}

export function PushConfigCard() {
  const { data: status, isLoading } = usePushStatus()
  const save = useSavePushCredentials()
  const remove = useDeletePushCredentials()
  const test = useTestPush()

  const [credentials, setCredentials] = useState("")
  const [testToken, setTestToken] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 5000)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const result = await save.mutateAsync(credentials)
      setCredentials("")
      flash(
        result.configured
          ? `Kalit qabul qilindi — push ishga tushdi (${result.project_id || "loyiha"})`
          : "Kalit saqlandi, lekin Firebase ishga tushmadi — quyidagi xatoga qarang"
      )
    } catch (e) {
      setError(panelError(e))
    }
  }

  const drop = async () => {
    if (
      !confirm(
        "Panel orqali yuklangan kalit o'chiriladi. Serverda env/fayl kaliti " +
          "bo'lsa tizim unga qaytadi, bo'lmasa push o'chadi. Davom etasizmi?"
      )
    )
      return
    setError(null)
    try {
      await remove.mutateAsync()
      flash("Panel kaliti o'chirildi")
    } catch (e) {
      setError(panelError(e))
    }
  }

  const sendTest = async () => {
    setError(null)
    try {
      const result = await test.mutateAsync(testToken)
      flash(
        result.sent > 0
          ? "Sinov push yuborildi — telefonga qarang"
          : "Yuborilmadi: kalit sozlanmagan yoki token yaroqsiz"
      )
    } catch (e) {
      setError(panelError(e))
    }
  }

  return (
    <PanelCard className="mt-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1">
          <BellRing className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-200">
            Push (Firebase)
          </span>
          {status && (
            <span
              className={cn(
                "ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold",
                status.configured
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-red-500/15 text-red-300"
              )}
            >
              {status.configured ? "Ishlayapti" : "Sozlanmagan"}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
          </div>
        ) : (
          status && (
            <div className="space-y-1 rounded-lg border border-white/5 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
              <p>
                Kalit manbai:{" "}
                <span className="text-slate-200">
                  {sourceLabel(status.credential_source)}
                </span>
                {status.project_id && (
                  <span className="text-slate-500"> · {status.project_id}</span>
                )}
              </p>
              {status.panel_key_stored && !status.panel_key_readable && (
                <p className="text-amber-400">
                  Saqlangan kalit ochilmadi (server siri almashgan) — qayta
                  yuklang.
                </p>
              )}
              {status.error && (
                <p className="text-red-400">Xato: {status.error}</p>
              )}
              {status.updated_at && (
                <p className="text-slate-500">
                  Oxirgi yangilanish:{" "}
                  {new Date(status.updated_at).toLocaleString("uz-UZ")}
                </p>
              )}
            </div>
          )
        )}

        {error && <PanelNotice>{error}</PanelNotice>}
        {notice && <PanelNotice tone="success">{notice}</PanelNotice>}

        <form onSubmit={submit} className="space-y-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-400">
              Service-account kaliti (JSON yoki base64)
            </span>
            <textarea
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              rows={4}
              placeholder='{"type": "service_account", "project_id": ...}'
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
            />
          </label>
          <p className="text-[11px] text-slate-500">
            Firebase Console → Project settings → Service accounts → Generate
            new private key. Kalit shifrlangan holda saqlanadi va yuklangan
            zahoti restartsiz kuchga kiradi.
          </p>
          <div className="flex flex-wrap gap-2">
            <PanelButton
              type="submit"
              disabled={save.isPending || credentials.trim().length < 20}
            >
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Kalitni saqlash
            </PanelButton>
            {status?.panel_key_stored && (
              <PanelButton
                type="button"
                variant="danger"
                disabled={remove.isPending}
                onClick={drop}
              >
                <Trash2 className="h-4 w-4" />
                O'chirish
              </PanelButton>
            )}
          </div>
        </form>

        {/* Sinov: telefon konsolidagi FCM token bilan darhol tekshiriladi */}
        <div className="border-t border-white/5 pt-3">
          <div className="flex gap-2">
            <input
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
              placeholder="Sinov uchun FCM token..."
              className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
            />
            <PanelButton
              type="button"
              variant="ghost"
              disabled={test.isPending || testToken.trim().length < 10}
              onClick={sendTest}
            >
              {test.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Sinov
            </PanelButton>
          </div>
        </div>
      </div>
    </PanelCard>
  )
}
