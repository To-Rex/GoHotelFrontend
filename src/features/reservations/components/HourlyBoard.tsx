import { useEffect, useState } from "react"
import { format, addDays, parseISO } from "date-fns"
import { ChevronLeft, ChevronRight, ChevronDown, Clock, Plus, Layers, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAY_MINUTES = 24 * 60
// Tez bron uchun tayyor davomiyliklar (soatlarda)
const QUICK_DURATIONS = [1, 2, 3]

export interface HourlyBoardProps {
  /** Ko'rsatilayotgan kun — "yyyy-MM-dd" */
  date: string
  onDateChange: (date: string) => void
  /** Xonalar qavatlar bo'yicha guruhlangan holda */
  roomGroups: Array<{ key: string; label: string; rooms: any[] }>
  /** Yig'ilgan qavatlar (kalendar tabi bilan umumiy holat) */
  collapsedFloors: Set<string>
  onToggleFloor: (key: string) => void
  reservations: any[]
  /** Bo'sh vaqt oralig'i bosilganda (minutlarda) */
  onSlotClick: (room: any, startMin: number, endMin: number) => void
  /** Mavjud bron bosilganda */
  onReservationClick: (res: any) => void
  canCreate: boolean
  getRoomPrice: (room: any) => number
  getGuestName: (res: any) => string
  statusColors: Record<string, string>
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function timeToMin(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number)
  return h * 60 + m
}

// Sana hisobini mahalliy vaqt zonasida bajaramiz (toISOString UTC ga o'tkazib
// yuboradi va +5 zonada kunni noto'g'ri suradi).
function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), "yyyy-MM-dd")
}

/**
 * Kalendarsiz, bitta kunga mo'ljallangan soatlik bron taxtasi.
 * Har bir xona uchun 24 soatlik chiziq: band oraliqlar rangli bloklar,
 * bo'sh joyga bosilsa — o'sha soatdan boshlanadigan yangi soatlik bron.
 *
 * Asosiy stsenariy — eshikdan kirib kelgan mehmonni hoziroq joylashtirish:
 * shuning uchun joriy vaqt chizig'i, "hozir bo'sh" belgisi va bir bosishda
 * hozirgi vaqtdan boshlanadigan tez bron tugmalari mavjud.
 */
export function HourlyBoard({
  date,
  onDateChange,
  roomGroups,
  collapsedFloors,
  onToggleFloor,
  reservations,
  onSlotClick,
  onReservationClick,
  canCreate,
  getRoomPrice,
  getGuestName,
  statusColors,
}: HourlyBoardProps) {
  // Joriy vaqt — har 30 soniyada yangilanadi (chiziq va "hozir" hisob-kitobi uchun)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Faqat hozir bo'sh xonalarni ko'rsatish filtri
  const [onlyFree, setOnlyFree] = useState(false)

  const today = format(now, "yyyy-MM-dd")
  const isToday = date === today
  const nowMin = now.getHours() * 60 + now.getMinutes()

  // Shu kundagi soatlik bronlar (xona bo'yicha)
  const hourlyByRoom: Record<string, any[]> = {}
  // Shu kunni to'liq egallagan kunlik bronlar (xona bo'yicha)
  const dailyByRoom: Record<string, any> = {}

  for (const r of reservations) {
    if (r.status === "CANCELLED") continue
    if (r.booking_type === "HOURLY") {
      if (!r.check_in_datetime || !r.check_out_datetime) continue
      const ciDate = r.check_in_datetime.slice(0, 10)
      const coDate = r.check_out_datetime.slice(0, 10)
      if (ciDate !== date && coDate !== date) continue
      if (!hourlyByRoom[r.room_id]) hourlyByRoom[r.room_id] = []
      hourlyByRoom[r.room_id].push(r)
    } else {
      if (!r.check_in_date || !r.check_out_date) continue
      if (r.check_in_date <= date && date <= r.check_out_date) {
        dailyByRoom[r.room_id] = r
      }
    }
  }

  // Xonaning shu kundagi band oraliqlari (minutlarda)
  const busyOf = (roomId: string): Array<[number, number]> =>
    (hourlyByRoom[roomId] || [])
      .map((r) => {
        const ciDate = r.check_in_datetime.slice(0, 10)
        const coDate = r.check_out_datetime.slice(0, 10)
        const s = ciDate === date ? timeToMin(r.check_in_datetime.slice(11, 16)) : 0
        const e = coDate === date ? timeToMin(r.check_out_datetime.slice(11, 16)) : DAY_MINUTES
        return [s, e] as [number, number]
      })
      .sort((a, b) => a[0] - b[0])

  // Berilgan vaqtdan boshlab qancha daqiqa bo'sh (keyingi band oralig'igacha)
  const freeMinutesFrom = (roomId: string, startMin: number): number => {
    if (dailyByRoom[roomId]) return 0
    const busy = busyOf(roomId)
    if (busy.some(([s, e]) => s <= startMin && startMin < e)) return 0
    const nextBusy = busy.filter(([s]) => s > startMin).reduce((m, [s]) => Math.min(m, s), DAY_MINUTES)
    return Math.max(0, nextBusy - startMin)
  }

  // Tez bron boshlanish vaqti: joriy vaqtni 15 daqiqagacha pastga yaxlitlaymiz,
  // agar u band oraliqqa tushib qolsa — aniq joriy vaqtni olamiz.
  const quickStartFor = (roomId: string): number => {
    const rounded = Math.floor(nowMin / 15) * 15
    return freeMinutesFrom(roomId, rounded) > 0 ? rounded : nowMin
  }

  const isFreeNow = (roomId: string): boolean =>
    isToday && !dailyByRoom[roomId] && freeMinutesFrom(roomId, nowMin) > 0

  // Bron blokining kun ichidagi joylashuvi (foizda) — tunab qoluvchi bronlar kesiladi
  const blockPosition = (r: any): { left: number; width: number; label: string } => {
    const ciDate = r.check_in_datetime.slice(0, 10)
    const coDate = r.check_out_datetime.slice(0, 10)
    const startMin = ciDate === date ? timeToMin(r.check_in_datetime.slice(11, 16)) : 0
    const endMin = coDate === date ? timeToMin(r.check_out_datetime.slice(11, 16)) : DAY_MINUTES
    const safeEnd = Math.max(endMin, startMin + 15)
    return {
      left: (startMin / DAY_MINUTES) * 100,
      width: ((safeEnd - startMin) / DAY_MINUTES) * 100,
      label: `${minToTime(startMin)} - ${minToTime(endMin)}`,
    }
  }

  // Bosilgan soatdan keyingi birinchi band vaqtgacha bo'sh oraliq (maks. 2 soat)
  const freeSlotAt = (roomId: string, hour: number): [number, number] | null => {
    const start = hour * 60
    const free = freeMinutesFrom(roomId, start)
    if (free <= 0) return null
    return [start, start + Math.min(120, free)]
  }

  // Tez bron: hozirgi vaqtdan boshlab N soat
  const quickBook = (room: any, hours: number) => {
    const start = quickStartFor(room.id)
    const free = freeMinutesFrom(room.id, start)
    if (free <= 0) return
    onSlotClick(room, start, start + Math.min(hours * 60, free))
  }

  // Filtrlangan guruhlar (faqat bo'sh xonalar rejimi uchun)
  const visibleGroups = onlyFree
    ? roomGroups
        .map((g) => ({ ...g, rooms: g.rooms.filter((r: any) => isFreeNow(r.id)) }))
        .filter((g) => g.rooms.length > 0)
    : roomGroups

  const totalRooms = roomGroups.reduce((n, g) => n + g.rooms.length, 0)
  const freeNowCount = roomGroups.reduce(
    (n, g) => n + g.rooms.filter((r: any) => isFreeNow(r.id)).length,
    0
  )

  return (
    <div className="flex flex-col h-full">
      {/* Kun tanlash va tezkor holat paneli */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            className="h-8 w-8 flex items-center justify-center rounded-md border border-gray-200 hover:bg-gray-50"
            onClick={() => onDateChange(shiftDate(date, -1))}
            title="Oldingi kun"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className="h-9 rounded-md border border-gray-200 px-3 text-sm font-semibold text-gray-900"
          />
          <button
            className="h-8 w-8 flex items-center justify-center rounded-md border border-gray-200 hover:bg-gray-50"
            onClick={() => onDateChange(shiftDate(date, 1))}
            title="Keyingi kun"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            className={cn(
              "h-8 px-3 rounded-md text-sm font-medium",
              isToday ? "bg-primary-50 text-primary-700" : "text-gray-500 hover:bg-gray-50"
            )}
            onClick={() => onDateChange(today)}
          >
            Bugun
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isToday && (
            <>
              {/* Joriy vaqt */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100">
                <Clock className="h-4 w-4 text-red-500" />
                <span className="text-sm font-bold text-red-600">{format(now, "HH:mm")}</span>
              </div>
              {/* Hozir bo'sh xonalar soni */}
              <div className="text-sm text-gray-600">
                Hozir bo'sh:{" "}
                <span className="font-bold text-emerald-600">{freeNowCount}</span>
                <span className="text-gray-400"> / {totalRooms}</span>
              </div>
              <button
                type="button"
                onClick={() => setOnlyFree((v) => !v)}
                className={cn(
                  "h-8 px-3 rounded-md text-xs font-medium border transition-colors",
                  onlyFree
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                )}
              >
                {onlyFree ? "Barcha xonalar" : "Faqat bo'sh xonalar"}
              </button>
            </>
          )}
          {!isToday && (
            <span className="text-xs text-gray-400">
              Tez bron faqat bugungi kun uchun ishlaydi
            </span>
          )}
        </div>
      </div>

      {/* Soat sarlavhalari + xonalar */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="min-w-[1000px]">
          {/* Sarlavha qatori */}
          <div className="sticky top-0 z-20 flex bg-white border-b border-gray-200 shadow-sm">
            <div className="flex-shrink-0 w-56 h-10 flex items-center px-4 bg-gray-50 border-r border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Xonalar
              </span>
            </div>
            <div className="flex flex-1 relative">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className={cn(
                    "flex-1 h-10 flex items-center justify-center border-r border-gray-100",
                    isToday && Math.floor(nowMin / 60) === h && "bg-red-50"
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      isToday && Math.floor(nowMin / 60) === h
                        ? "text-red-600 font-bold"
                        : "text-gray-400"
                    )}
                  >
                    {String(h).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Xona qatorlari — qavatlar bo'yicha guruhlangan */}
          {visibleGroups.map((group) => {
            const collapsed = collapsedFloors.has(group.key)
            return (
              <div key={group.key}>
                {/* Qavat sarlavhasi — bosilsa qavat yig'iladi/ochiladi */}
                <div
                  className="flex bg-gray-100 border-y border-gray-200 cursor-pointer hover:bg-gray-200/70 transition-colors"
                  onClick={() => onToggleFloor(group.key)}
                  title={collapsed ? "Qavatni ochish" : "Qavatni yig'ish"}
                >
                  <div className="flex-shrink-0 w-56 flex items-center gap-2 px-4 h-8 border-r border-gray-200">
                    {collapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                    )}
                    <Layers className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider truncate">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-gray-400">({group.rooms.length})</span>
                  </div>
                  <div className="flex-1 h-8" />
                </div>

                {!collapsed &&
                  group.rooms.map((room: any) => {
                    const daily = dailyByRoom[room.id]
                    const hourly = hourlyByRoom[room.id] || []
                    const freeNow = isFreeNow(room.id)
                    const freeMin = freeNow ? freeMinutesFrom(room.id, quickStartFor(room.id)) : 0
                    return (
                      <div
                        key={room.id}
                        className="flex border-b border-gray-100 bg-white hover:bg-gray-50/40 transition-colors"
                        style={{ height: 64 }}
                      >
                        <div className="flex-shrink-0 w-56 flex flex-col justify-center px-4 border-r border-gray-200 gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">
                              {room.room_number}
                            </span>
                            {isToday &&
                              (freeNow ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  Bo'sh
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                  Band
                                </span>
                              ))}
                          </div>

                          {/* Tez bron: hozirgi vaqtdan boshlab */}
                          {isToday && freeNow && canCreate ? (
                            <div className="flex items-center gap-1">
                              <Zap className="h-3 w-3 text-primary-500 flex-shrink-0" />
                              {QUICK_DURATIONS.map((h) => {
                                const fits = freeMin >= h * 60
                                return (
                                  <button
                                    key={h}
                                    type="button"
                                    disabled={!fits}
                                    onClick={() => quickBook(room, h)}
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-[11px] font-semibold border transition-colors",
                                      fits
                                        ? "border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100"
                                        : "border-gray-100 text-gray-300 cursor-not-allowed"
                                    )}
                                    title={
                                      fits
                                        ? `${minToTime(quickStartFor(room.id))} dan ${h} soat`
                                        : "Bu davomiylik uchun bo'sh vaqt yetarli emas"
                                    }
                                  >
                                    {h} soat
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400 truncate">
                              {room.room_type?.name || "Standard"}
                              {getRoomPrice(room) > 0 &&
                                ` · ${Math.round(getRoomPrice(room) / 24).toLocaleString()} So'm/soat`}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 relative">
                          {/* Soat kataklari (bo'sh joy — bosish mumkin) */}
                          <div className="flex h-full">
                            {HOURS.map((h) => {
                              const slot = daily ? null : freeSlotAt(room.id, h)
                              const clickable = canCreate && !!slot
                              const isPast = isToday && h < Math.floor(nowMin / 60)
                              return (
                                <div
                                  key={h}
                                  className={cn(
                                    "flex-1 border-r border-gray-50 h-full group",
                                    isPast && "bg-gray-50/60",
                                    clickable && "cursor-pointer hover:bg-primary-50"
                                  )}
                                  onClick={() => {
                                    if (clickable && slot) onSlotClick(room, slot[0], slot[1])
                                  }}
                                  title={clickable ? `${minToTime(h * 60)} dan bron qilish` : undefined}
                                >
                                  {clickable && (
                                    <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Plus className="h-3.5 w-3.5 text-primary-500" />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Kunlik bron — kun to'liq band */}
                          {daily && (
                            <div
                              className={cn(
                                "absolute top-2 bottom-2 left-1 right-1 rounded-lg flex items-center px-3 gap-2 cursor-pointer",
                                statusColors[daily.status] || statusColors.PENDING
                              )}
                              onClick={() => onReservationClick(daily)}
                              title="Kunlik bron — batafsil"
                            >
                              <span className="text-xs font-semibold truncate">
                                Kunlik bron · {getGuestName(daily)}
                              </span>
                            </div>
                          )}

                          {/* Soatlik bronlar */}
                          {!daily &&
                            hourly.map((r) => {
                              const pos = blockPosition(r)
                              return (
                                <div
                                  key={r.id}
                                  className={cn(
                                    "absolute top-2 bottom-2 rounded-lg flex flex-col justify-center px-2 cursor-pointer overflow-hidden hover:brightness-95 transition-all",
                                    statusColors[r.status] || statusColors.PENDING
                                  )}
                                  style={{ left: `${pos.left}%`, width: `${pos.width}%` }}
                                  onClick={() => onReservationClick(r)}
                                  title={`${getGuestName(r)} · ${pos.label}`}
                                >
                                  <span className="text-[11px] font-bold leading-tight truncate">
                                    {pos.label}
                                  </span>
                                  <span className="text-[10px] opacity-80 leading-tight truncate">
                                    {getGuestName(r)}
                                  </span>
                                </div>
                              )
                            })}

                          {/* Joriy vaqt chizig'i */}
                          {isToday && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
                              style={{ left: `${(nowMin / DAY_MINUTES) * 100}%` }}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )
          })}

          {visibleGroups.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-400">
              {onlyFree ? "Hozir bo'sh xona yo'q" : "Xonalar topilmadi"}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
