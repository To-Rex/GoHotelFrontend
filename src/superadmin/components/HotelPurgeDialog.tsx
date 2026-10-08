import { useState } from "react"
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Link2Off,
  Loader2,
  PauseCircle,
  ShieldAlert,
  Trash2,
  UserCheck,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import { panelError } from "../api/client"
import {
  useDeactivateHotel,
  useHotelPurgePreview,
  usePanelMe,
  usePurgeHotel,
  type PanelHotel,
  type PurgeResult,
} from "../api/panel"
import { PanelButton, PanelDialog, PanelInput, PanelNotice } from "./ui"

/** Xulosada alohida ko'rsatiladigan asosiy jadvallar. */
const KEY_TABLES: [string, string][] = [
  ["branches", tr("Filiallar")],
  ["rooms", tr("Xonalar")],
  ["users", tr("Xodimlar")],
  ["guests", tr("Mehmonlar")],
  ["reservations", tr("Bronlar")],
  ["payments", tr("To'lovlar")],
]

const num = (value: number) => new Intl.NumberFormat("ru-RU").format(value)

/**
 * Mehmonxonani BUTUNLAY o'chirish.
 *
 * Avval server nima o'chishini hisoblab beradi (hech narsa o'zgarmaydi),
 * keyin tizim egasi mehmonxona kodini va o'z parolini yozib tasdiqlaydi.
 * Boshqa mehmonxonalarga tegishli ma'lumotga tegilmaydi: ikkala
 * mehmonxonada bron qilgan mehmon o'chmaydi — boshqasiga o'tadi.
 */
export function HotelPurgeDialog({
  hotel,
  onClose,
}: {
  hotel: PanelHotel | null
  onClose: () => void
}) {
  const preview = useHotelPurgePreview(hotel?.id)
  const { data: me } = usePanelMe()
  const deactivate = useDeactivateHotel()
  const purge = usePurgeHotel()

  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PurgeResult | null>(null)

  const close = () => {
    if (purge.isPending) return
    setCode("")
    setPassword("")
    setError(null)
    setResult(null)
    purge.reset()
    onClose()
  }

  const data = preview.data
  const counts = new Map((data?.tables ?? []).map((t) => [t.table, t.rows]))
  const blocking = (data?.conflicts ?? []).filter((c) => c.blocking)
  const nulling = (data?.conflicts ?? []).filter((c) => !c.blocking)
  const isActive = data?.blocked_by.includes("HOTEL_ACTIVE")
  const isRoot = !!me?.is_root
  const codeMatches = !!data && code.trim() === data.hotel.code

  const stopNow = async () => {
    if (!hotel) return
    setError(null)
    try {
      await deactivate.mutateAsync(hotel.id)
      await preview.refetch()
    } catch (e) {
      setError(panelError(e))
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!hotel || !data?.can_purge || !codeMatches || !password) return
    setError(null)
    try {
      setResult(
        await purge.mutateAsync({
          id: hotel.id,
          confirm_code: code.trim(),
          password,
        })
      )
      setPassword("")
    } catch (e) {
      setError(panelError(e))
    }
  }

  return (
    <PanelDialog
      open={!!hotel}
      wide
      title={tr("Mehmonxonani butunlay o'chirish")}
      onClose={close}
    >
      {result ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
            <div className="text-sm text-emerald-200">
              <p className="font-semibold">
                {tr("\"{{name}}\" butunlay o'chirildi", { name: result.hotel.name })}
              </p>
              <p className="mt-1 text-xs text-emerald-300/80">
                {tr("{{rows}} ta yozuv va {{files}} ta fayl o'chirildi ({{seconds}} s).", {
                  rows: num(result.total_rows),
                  files: num(result.files_removed),
                  seconds: result.seconds,
                })}
              </p>
            </div>
          </div>
          {result.guests_moved > 0 && (
            <PanelNotice tone="success">
              {tr("{{count}} ta mehmon boshqa mehmonxonada ham bo'lgani uchun o'chirilmadi — o'sha mehmonxonaga o'tkazildi.", {
                count: result.guests_moved,
              })}
            </PanelNotice>
          )}
          {result.files_failed > 0 && (
            <PanelNotice>
              {tr("{{count}} ta faylni omborxonadan o'chirib bo'lmadi — ma'lumotlar bazasi to'liq tozalandi.", {
                count: result.files_failed,
              })}
            </PanelNotice>
          )}
          <div className="flex justify-end pt-1">
            <PanelButton onClick={close}>{tr("Yopish")}</PanelButton>
          </div>
        </div>
      ) : preview.isLoading ? (
        <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          {tr("Nima o'chishi hisoblanmoqda...")}
        </div>
      ) : preview.isError || !data ? (
        <div className="space-y-3">
          <PanelNotice>{panelError(preview.error)}</PanelNotice>
          <div className="flex justify-end">
            <PanelButton variant="ghost" onClick={close}>
              {tr("Yopish")}
            </PanelButton>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />
            <div className="text-sm text-red-200">
              <p className="font-semibold">
                {data.hotel.name}{" "}
                <span className="font-mono text-xs text-red-300/80">({data.hotel.code})</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-red-200/80">
                {tr("Mehmonxona va unga tegishli HAMMA ma'lumot o'chadi: filiallar, xonalar, xodimlar, mehmonlar, bronlar, to'lovlar, do'kon, hisobotlar, fayllar. Bu amalni qaytarib bo'lmaydi. Boshqa mehmonxonalar ma'lumotiga tegilmaydi.")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {KEY_TABLES.map(([table, label]) => (
              <div
                key={table}
                className="rounded-xl border border-white/5 bg-white/[0.03] px-2 py-2 text-center"
              >
                <p className="text-sm font-bold tabular-nums text-slate-100">
                  {num(counts.get(table) ?? 0)}
                </p>
                <p className="text-[10px] text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          <details className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
            <summary className="cursor-pointer select-none text-slate-300">
              {tr("Jami {{rows}} ta yozuv, {{tables}} ta jadval, {{files}} ta fayl", {
                rows: num(data.total_rows),
                tables: data.tables.length,
                files: num(data.files),
              })}
            </summary>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px]">
              {data.tables.map((t) => (
                <li key={t.table} className="flex justify-between gap-2">
                  <span className="truncate">{t.table}</span>
                  <span className="tabular-nums text-slate-300">{num(t.rows)}</span>
                </li>
              ))}
            </ul>
          </details>

          {data.shared_guests.count > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-200">
              <ArrowRightLeft className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p>
                  {tr("{{count}} ta mehmon boshqa mehmonxonada ham bron qilgan — ular o'chmaydi, o'sha mehmonxonaga o'tkaziladi:", {
                    count: data.shared_guests.count,
                  })}
                </p>
                <ul className="mt-1 space-y-0.5 text-sky-300/90">
                  {data.shared_guests.hotels.map((h) => (
                    <li key={h.hotel_id}>
                      {h.hotel_name} — {tr("{{count}} ta mehmon", { count: h.guests })}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {(data.system_users ?? []).length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              <UserCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p>
                  {tr("Tizim akkauntlari o'chirilmaydi — faqat mehmonxonadan ajratiladi:")}
                </p>
                <ul className="mt-1 font-mono text-[11px] text-emerald-300/90">
                  {data.system_users.map((u) => (
                    <li key={u.id}>
                      {u.username || u.id} ({u.user_type})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {nulling.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
              <Link2Off className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p>{tr("Boshqa yozuvlardagi havolalar bo'shatiladi (yozuvlarning o'zi qoladi):")}</p>
                <ul className="mt-1 font-mono text-[11px]">
                  {nulling.map((c) => (
                    <li key={`${c.table}.${c.column}`}>
                      {c.table}.{c.column} ({num(c.rows)})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {blocking.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">
                  {tr("Boshqa mehmonxona ma'lumotlari bu mehmonxonaga bog'langan — o'chirsak ular buziladi, shuning uchun o'chirilmaydi:")}
                </p>
                <ul className="mt-1 font-mono text-[11px]">
                  {blocking.map((c) => (
                    <li key={`${c.table}.${c.column}`}>
                      {c.table}.{c.column} → {c.references} ({num(c.rows)})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {isActive && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">
              <span>{tr("Faol mehmonxona o'chirilmaydi — avval uni to'xtating.")}</span>
              <PanelButton
                type="button"
                variant="ghost"
                className="h-8 text-xs"
                disabled={deactivate.isPending || preview.isFetching}
                onClick={stopNow}
              >
                {deactivate.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PauseCircle className="h-3.5 w-3.5" />
                )}
                {tr("Hozir to'xtatish")}
              </PanelButton>
            </div>
          )}

          {me && !isRoot && (
            <PanelNotice>{tr("Mehmonxonani butunlay o'chirishni faqat tizim egasi bajaradi.")}</PanelNotice>
          )}

          {data.can_purge && isRoot && (
            <div className="space-y-3 border-t border-white/5 pt-4">
              <PanelInput
                label={tr("Tasdiqlash uchun mehmonxona kodini yozing: {{code}}", {
                  code: data.hotel.code,
                })}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  "font-mono",
                  code && !codeMatches && "border-red-500/40"
                )}
              />
              <PanelInput
                label={tr("Panel parolingiz")}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          )}

          {error && <PanelNotice>{error}</PanelNotice>}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <PanelButton type="button" variant="ghost" onClick={close} disabled={purge.isPending}>
              {tr("Bekor qilish")}
            </PanelButton>
            {data.can_purge && isRoot && (
              <PanelButton
                type="submit"
                variant="danger"
                className="border-red-500 bg-red-600 text-white hover:bg-red-500"
                disabled={!codeMatches || !password || purge.isPending}
              >
                {purge.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {purge.isPending ? tr("O'chirilmoqda...") : tr("Butunlay o'chirish")}
              </PanelButton>
            )}
          </div>
        </form>
      )}
    </PanelDialog>
  )
}
