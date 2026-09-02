import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Clock,
  DoorOpen,
  Loader2,
  ShieldAlert,
  Users,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { apiErrorMessage } from "@/lib/apiError"
import { buildDatePresets } from "@/lib/datePresets"
import { cn } from "@/lib/utils"

/**
 * Chiqishlar va tozalashlarni solishtirish.
 *
 * Savol oddiy: davrda necha marta mehmon chiqib ketdi va shundan nechtasi
 * haqiqatan tozalandi. Vazifalar ro'yxati bunga javob bermasdi — u faqat
 * ochiq ishlarni ko'rsatadi, chiqishlar bilan taqqoslamaydi.
 *
 * Eng muhim raqam — AVTOMATIK YOPILGANLAR. Vazifani odam emas, fon
 * vazifasi yopgan bo'lsa (belgilangan vaqt o'tgani uchun), xona
 * "tozalandi" deb belgilangan-u, buni hech kim tasdiqlamagan.
 */

interface CleanerRow {
  user_id: string | null
  name: string | null
  total: number
  by_person: number
  auto: number
  avg_minutes: number | null
}

interface RoomRow {
  room_number: string
  checkouts: number
  auto: number
  no_task: number
  avg_minutes: number | null
}

interface CleaningReport {
  date_from: string
  date_to: string
  summary: {
    checkouts: number
    with_task: number
    cleaned_by_person: number
    auto_closed: number
    still_open: number
    cancelled: number
    no_task: number
    avg_wait_minutes: number | null
    avg_work_minutes: number | null
    verified_percent: number | null
  }
  cleaners: CleanerRow[]
  rooms: RoomRow[]
}

const minutes = (v: number | null): string => {
  if (v === null || v === undefined) return "—"
  if (v < 60) return `${v} daq`
  const h = Math.floor(v / 60)
  const m = Math.round(v % 60)
  return m ? `${h} soat ${m} daq` : `${h} soat`
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function CleaningReportDialog({ open, onOpenChange }: Props) {
  const presets = useMemo(() => buildDatePresets(new Date()), [])
  // Standart — shu oy: bir kunlik ma'lumot xulosa chiqarish uchun kam
  const monthPreset = presets.find((p) => p.key === "month")
  const [from, setFrom] = useState(monthPreset?.from || "")
  const [to, setTo] = useState(monthPreset?.to || "")

  const { data, isLoading, error } = useQuery({
    queryKey: ["cleaningReport", from, to],
    enabled: open && !!from && !!to,
    queryFn: async () => {
      const { data } = await api.get<CleaningReport>(
        "/housekeeping/cleaning-report",
        { params: { date_from: from, date_to: to } }
      )
      return data
    },
  })

  const s = data?.summary

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <BedDouble className="h-4 w-4" />
            </span>
            Chiqishlar va tozalash
          </DialogTitle>
        </DialogHeader>

        {/* Davr tanlash — moliya va xarajatlar sahifalaridagi bilan bir xil */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Sanadan</label>
            <Input
              type="date"
              className="h-8 w-[140px] text-xs"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Sanagacha</label>
            <Input
              type="date"
              className="h-8 w-[140px] text-xs"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets
              // "Barcha davr" bu yerda yo'q: hisobot sana oralig'isiz
              // ma'nosiz va butun tarixni o'qishga majbur qilardi
              .filter((p) => p.from && p.to)
              .map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setFrom(p.from)
                    setTo(p.to)
                  }}
                  className={cn(
                    "h-8 rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                    from === p.from && to === p.to
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {p.label}
                </button>
              ))}
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Hisoblanmoqda...
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {apiErrorMessage(error)}
          </p>
        )}

        {!isLoading && !error && s && (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-0.5">
            {s.checkouts === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
                <DoorOpen className="h-8 w-8" />
                <p className="text-sm">Bu davrda chiqish bo'lmagan</p>
              </div>
            ) : (
              <>
                {/* Asosiy taqqoslash */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    {
                      label: "Chiqishlar",
                      value: String(s.checkouts),
                      tone: "text-gray-900",
                    },
                    {
                      label: "Farrosh tozalagan",
                      value: String(s.cleaned_by_person),
                      tone: "text-emerald-600",
                    },
                    {
                      label: "Avtomatik yopilgan",
                      value: String(s.auto_closed),
                      tone: s.auto_closed ? "text-amber-600" : "text-gray-900",
                    },
                    {
                      label: "Vazifasiz qolgan",
                      value: String(s.no_task),
                      tone: s.no_task ? "text-red-600" : "text-gray-900",
                    },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2"
                    >
                      <p className="text-[11px] text-gray-500">{c.label}</p>
                      <p className={cn("text-lg font-bold tabular-nums", c.tone)}>
                        {c.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Xulosa qatori — raqamlar nimani anglatishini aytadi */}
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-xl border p-3 text-sm",
                    s.verified_percent !== null && s.verified_percent >= 80
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  )}
                >
                  {s.verified_percent !== null && s.verified_percent >= 80 ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  )}
                  <span>
                    <b>{s.checkouts}</b> ta chiqishdan{" "}
                    <b>{s.cleaned_by_person}</b> tasini farrosh o'zi tozalab
                    yakunlagan
                    {s.verified_percent !== null && ` (${s.verified_percent}%)`}.
                    {s.auto_closed > 0 && (
                      <>
                        {" "}
                        <b>{s.auto_closed}</b> tasi vaqt o'tgani uchun avtomatik
                        yopilgan — ya'ni tozalanganini hech kim tasdiqlamagan.
                      </>
                    )}
                    {s.no_task > 0 && (
                      <>
                        {" "}
                        <b>{s.no_task}</b> ta chiqishda tozalash vazifasi umuman
                        ochilmagan.
                      </>
                    )}
                    {s.still_open > 0 && (
                      <> Hozircha <b>{s.still_open}</b> tasi ochiq turibdi.</>
                    )}
                  </span>
                </div>

                {/* Vaqt ko'rsatkichlari */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-gray-200 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      O'rtacha kutish
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {minutes(s.avg_wait_minutes)}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      vazifa ochilgandan farrosh boshlagunicha
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      O'rtacha tozalash
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {minutes(s.avg_work_minutes)}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      boshlangandan yakunlangunicha
                    </p>
                  </div>
                </div>

                {/* Farroshlar kesimi */}
                {data.cleaners.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      <Users className="h-3.5 w-3.5" />
                      Farroshlar bo'yicha
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50/80 text-[11px] uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Farrosh</th>
                            <th className="px-3 py-2 text-right font-medium">Jami</th>
                            <th className="px-3 py-2 text-right font-medium">O'zi</th>
                            <th className="px-3 py-2 text-right font-medium">Avto</th>
                            <th className="px-3 py-2 text-right font-medium">O'rtacha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.cleaners.map((c) => (
                            <tr key={c.user_id || "none"} className="border-t">
                              <td className="px-3 py-2">
                                {c.name || (
                                  <span className="text-gray-400">
                                    Biriktirilmagan
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {c.total}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                                {c.by_person}
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-2 text-right tabular-nums",
                                  c.auto ? "font-semibold text-amber-600" : "text-gray-400"
                                )}
                              >
                                {c.auto}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                                {minutes(c.avg_minutes)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Xonalar kesimi — e'tibor talab qiladiganlari yuqorida */}
                {data.rooms.some((r) => r.auto || r.no_task) && (
                  <div>
                    <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      E'tibor talab qiladigan xonalar
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50/80 text-[11px] uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Xona</th>
                            <th className="px-3 py-2 text-right font-medium">Chiqish</th>
                            <th className="px-3 py-2 text-right font-medium">Avto</th>
                            <th className="px-3 py-2 text-right font-medium">Vazifasiz</th>
                            <th className="px-3 py-2 text-right font-medium">O'rtacha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.rooms
                            .filter((r) => r.auto || r.no_task)
                            .map((r) => (
                              <tr key={r.room_number} className="border-t">
                                <td className="px-3 py-2 font-medium">
                                  {r.room_number}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {r.checkouts}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-amber-600">
                                  {r.auto || "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-red-600">
                                  {r.no_task || "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                                  {minutes(r.avg_minutes)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Ko'rsatkich bo'sh chiqishi mumkin — sababini aytamiz */}
                {s.avg_wait_minutes === null && (
                  <p className="text-[11px] text-gray-400">
                    Kutish vaqti faqat farrosh vazifani "boshladim" deb
                    belgilaganda hisoblanadi. Farroshlar buni bosmasdan
                    to'g'ridan-to'g'ri yakunlasa, bu ustun bo'sh qoladi.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Yopish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
