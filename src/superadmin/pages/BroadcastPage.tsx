import { useState } from "react"
import { Loader2, Megaphone, Send } from "lucide-react"

import { cn } from "@/lib/utils"
import { panelError } from "../api/client"
import { useBranches, useBroadcast, useHotels } from "../api/panel"
import {
  PanelButton,
  PanelCard,
  PanelHeading,
  PanelInput,
  PanelNotice,
  PanelSelect,
} from "../components/ui"
import { tr } from "@/i18n"

/**
 * E'lonlar — egasi barcha mehmonxonalarga yoki tanlangan mehmonxona/filialga
 * xabar yuboradi (texnik ishlar, yangi versiya, muhim ogohlantirish).
 * Oluvchilarga ilovadagi bildirishnoma yoziladi va xohlasa push ketadi.
 */

type Scope = "all" | "hotel" | "branch"
type Audience = "admins" | "staff"

export function BroadcastPage() {
  const { data: hotels = [] } = useHotels()
  const [scope, setScope] = useState<Scope>("all")
  const [hotelId, setHotelId] = useState("")
  const [branchId, setBranchId] = useState("")
  const { data: branches = [] } = useBranches(scope === "branch" ? hotelId : undefined)
  const [audience, setAudience] = useState<Audience>("admins")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [push, setPush] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ hotels: number; recipients: number } | null>(null)
  const send = useBroadcast()

  const needsHotel = scope !== "all"
  const canSend =
    title.trim().length > 0 && (!needsHotel || !!hotelId) && (scope !== "branch" || !!branchId)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSend) return
    const where =
      scope === "all"
        ? tr("BARCHA mehmonxonalarga")
        : scope === "hotel"
          ? tr("\"{{name}}\" mehmonxonasiga", { name: hotels.find((h) => h.id === hotelId)?.name || "" })
          : tr("\"{{name}}\" filialiga", { name: branches.find((b) => b.id === branchId)?.name || "" })
    const who = audience === "admins" ? tr("administratorlarga") : tr("barcha xodimlarga")
    if (!confirm(tr("E'lon {{where}} — {{who}} yuboriladi. Davom etasizmi?", { where, who }))) return
    setError(null)
    setResult(null)
    try {
      const r = await send.mutateAsync({
        title: title.trim(),
        body: body.trim() || null,
        audience,
        hotel_id: needsHotel ? hotelId : null,
        branch_id: scope === "branch" ? branchId : null,
        send_push: push,
      })
      setResult(r)
      setTitle("")
      setBody("")
    } catch (e) {
      setError(panelError(e))
    }
  }

  return (
    <div>
      <PanelHeading
        title={tr("E'lonlar")}
        subtitle={tr("Mehmonxonalarga bir joydan xabar: texnik ishlar, yangi versiya, ogohlantirish")}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <PanelCard>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <span className="text-xs font-medium text-slate-400">{tr("Kimga")}</span>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(
                  [
                    ["all", tr("Barcha mehmonxonalar")],
                    ["hotel", tr("Bitta mehmonxona")],
                    ["branch", tr("Bitta filial")],
                  ] as [Scope, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setScope(value)
                      setBranchId("")
                    }}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      scope === value
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                        : "border-white/10 text-slate-300 hover:bg-white/5"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {needsHotel && (
              <div className="grid gap-3 sm:grid-cols-2">
                <PanelSelect
                  label={tr("Mehmonxona")}
                  value={hotelId}
                  onChange={(e) => {
                    setHotelId(e.target.value)
                    setBranchId("")
                  }}
                >
                  <option value="">{tr("— tanlang —")}</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </PanelSelect>
                {scope === "branch" && (
                  <PanelSelect
                    label={tr("Filial")}
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    disabled={!hotelId}
                  >
                    <option value="">{tr("— tanlang —")}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </PanelSelect>
                )}
              </div>
            )}

            <PanelSelect
              label={tr("Auditoriya")}
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
            >
              <option value="admins">{tr("Faqat administratorlar")}</option>
              <option value="staff">{tr("Barcha faol xodimlar (va administratorlar)")}</option>
            </PanelSelect>

            <PanelInput
              label={tr("Sarlavha")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder={tr("Masalan: Texnik ishlar 23:00–23:30")}
              required
            />
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-400">{tr("Matn (ixtiyoriy)")}</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
                placeholder={tr("Nima bo'ladi, qachon, nima qilish kerak")}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
              {tr("Telefonlarga push ham yuborilsin")}
            </label>

            {error && <PanelNotice>{error}</PanelNotice>}
            {result && (
              <PanelNotice tone="success">
                {tr("E'lon yuborildi: {{hotels}} ta mehmonxona, {{recipients}} ta oluvchi", result)}
              </PanelNotice>
            )}

            <div className="flex justify-end">
              <PanelButton type="submit" disabled={!canSend || send.isPending}>
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {tr("Yuborish")}
              </PanelButton>
            </div>
          </form>
        </PanelCard>

        <PanelCard className="h-fit">
          <p className="flex items-center gap-2 font-semibold text-slate-100">
            <Megaphone className="h-4 w-4 text-slate-500" />
            {tr("Qanday ishlaydi")}
          </p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-400">
            <li>{tr("Har oluvchiga ilovadagi bildirishnomalar ro'yxatiga yoziladi — o'qimaguncha turadi.")}</li>
            <li>{tr("Push yoqilgan bo'lsa, telefonga ham boradi (Firebase sozlangan bo'lsa).")}</li>
            <li>{tr("Filiallar alohida: xodimlar faqat o'z filiali e'lonini oladi; administratorlar — hammasini, bir marta.")}</li>
            <li>{tr("Yuborilgan e'lonni qaytarib bo'lmaydi — matnni tekshirib yuboring.")}</li>
          </ul>
        </PanelCard>
      </div>
    </div>
  )
}
