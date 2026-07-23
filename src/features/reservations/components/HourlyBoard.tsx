import { useEffect, useState } from "react"
import { format, addDays, parseISO } from "date-fns"
import { ChevronLeft, ChevronRight, ChevronDown, Clock, Plus, Layers, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

const DAY_MINUTES = 24 * 60
// Joriy vaqtga fokuslangan rejimda ko'rsatiladigan soatlar oynasi
const WINDOW_HOURS = 10
// Oyna joriy soatdan boshlanadi. O'tgan soatlarni ko'rish uchun "◀" tugmasi
// bilan oynani orqaga surish mumkin (bron qilish baribir taqiqlanadi).
const WINDOW_SHIFT_STEP = 3
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
  /**
   * Bo'sh vaqt oralig'i bosilganda. `dateStr` — bron qaysi kunga tegishli
   * (yarim tundan keyingi ustunlar ertangi kunga tushadi).
   */
  onSlotClick: (room: any, startMin: number, endMin: number, dateStr: string) => void
  /** Mavjud bron bosilganda */
  onReservationClick: (res: any) => void
  canCreate: boolean
  getRoomPrice: (room: any) => number
  getGuestName: (res: any) => string
  statusColors: Record<string, string>
}

function minToTime(min: number): string {
  const m = ((min % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
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

// Taxtadagi bron/band oraliq — vaqt "mutlaq minut" o'qida:
// 0 = tanlangan kunning 00:00 i, 1440 = ertangi kunning 00:00 i.
interface Interval {
  start: number
  end: number
  res: any
  daily: boolean
}

/**
 * Kalendarsiz, soatlik bron taxtasi.
 *
 * Vaqt o'qi tanlangan kunning 00:00 idan boshlanadi va kerak bo'lsa ertangi
 * kunga o'tadi: kech soatlarda (masalan 23:30) oyna 18:00 dan 04:00 gacha
 * cho'ziladi, shunda tundagi bo'sh soatlarга ham shu yerdan bron qilinadi.
 *
 * Asosiy stsenariy — eshikdan kirib kelgan mehmonni hoziroq joylashtirish:
 * joriy vaqt chizig'i, "hozir bo'sh" belgisi va bir bosishda hozirgi vaqtdan
 * boshlanadigan tez bron tugmalari mavjud.
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
  // Joriy vaqt — har 30 soniyada yangilanadi
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Faqat hozir bo'sh xonalarni ko'rsatish filtri
  const [onlyFree, setOnlyFree] = useState(false)
  // Butun kunni (00:00-24:00) ko'rsatish rejimi
  const [fullDay, setFullDay] = useState(false)
  // Oynani soatlar bo'yicha surish (manfiy — o'tgan soatlarni ko'rish uchun)
  const [hourShift, setHourShift] = useState(0)

  // Kun almashsa ko'rinish boshlang'ich holatga qaytadi
  useEffect(() => {
    setHourShift(0)
    setFullDay(false)
  }, [date])

  const today = format(now, "yyyy-MM-dd")
  const isToday = date === today
  // O'tgan sana — faqat ko'rish uchun, yangi bron qilib bo'lmaydi
  const isPastDate = date < today
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nextDate = shiftDate(date, 1)

  // --- Ko'rinadigan soatlar oynasi (mutlaq minutlarda) ---
  // Boshlanish doim joriy soatdan WINDOW_LOOKBACK soat oldin; oyna WINDOW_HOURS
  // soat davom etadi va kerak bo'lsa yarim tundan o'tib ketadi (h >= 24 —
  // ertangi kun ustunlari).
  const focused = isToday && !fullDay
  // Oyna joriy soatdan boshlanadi; `hourShift` bilan orqaga/oldinga suriladi
  const startHour = focused ? Math.max(0, now.getHours() + hourShift) : 0
  const endHour = focused ? startHour + WINDOW_HOURS : 24
  const visibleHours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const winStart = startHour * 60
  const winEnd = endHour * 60
  const pct = (min: number) => ((min - winStart) / (winEnd - winStart)) * 100

  // Sana qaysi kunga to'g'ri kelishi (mutlaq o'qdagi siljish)
  const dayOffset = (d: string): number | null =>
    d === date ? 0 : d === nextDate ? DAY_MINUTES : null

  // --- Bronlarni mutlaq o'qqa joylash ---
  const intervalsByRoom: Record<string, Interval[]> = {}
  const pushInterval = (roomId: string, iv: Interval) => {
    if (!intervalsByRoom[roomId]) intervalsByRoom[roomId] = []
    intervalsByRoom[roomId].push(iv)
  }

  for (const r of reservations) {
    if (r.status === "CANCELLED") continue

    if (r.booking_type === "HOURLY") {
      if (!r.check_in_datetime || !r.check_out_datetime) continue
      const ciOff = dayOffset(r.check_in_datetime.slice(0, 10))
      const coOff = dayOffset(r.check_out_datetime.slice(0, 10))
      if (ciOff === null && coOff === null) continue
      // Oynadan oldin boshlangan / keyin tugaydigan bronlar chegarada kesiladi
      const start =
        ciOff !== null ? ciOff + timeToMin(r.check_in_datetime.slice(11, 16)) : 0
      const end =
        coOff !== null
          ? coOff + timeToMin(r.check_out_datetime.slice(11, 16))
          : 2 * DAY_MINUTES
      pushInterval(r.room_id, { start, end, res: r, daily: false })
    } else {
      if (!r.check_in_date || !r.check_out_date) continue
      // Kunlik bron ko'rinadigan ikkala kunning qaysi birini qamrasa — o'sha kun
      // to'liq band hisoblanadi
      ;[date, nextDate].forEach((d, idx) => {
        if (r.check_in_date <= d && d <= r.check_out_date) {
          pushInterval(r.room_id, {
            start: idx * DAY_MINUTES,
            end: (idx + 1) * DAY_MINUTES,
            res: r,
            daily: true,
          })
        }
      })
    }
  }

  const busyOf = (roomId: string): Interval[] =>
    (intervalsByRoom[roomId] || []).slice().sort((a, b) => a.start - b.start)

  // Berilgan nuqtadan boshlab qancha daqiqa bo'sh (keyingi band oralig'igacha)
  const freeMinutesFrom = (roomId: string, startMin: number): number => {
    const busy = busyOf(roomId)
    if (busy.some((b) => b.start <= startMin && startMin < b.end)) return 0
    const nextBusy = busy
      .filter((b) => b.start > startMin)
      .reduce((m, b) => Math.min(m, b.start), 2 * DAY_MINUTES)
    return Math.max(0, nextBusy - startMin)
  }

  // Tez bron boshlanishi: joriy vaqtni 15 daqiqagacha pastga yaxlitlaymiz
  const quickStartFor = (roomId: string): number => {
    const rounded = Math.floor(nowMin / 15) * 15
    return freeMinutesFrom(roomId, rounded) > 0 ? rounded : nowMin
  }

  const isFreeNow = (roomId: string): boolean =>
    isToday && freeMinutesFrom(roomId, nowMin) > 0

  // Mutlaq minutni (room, boshlanish, tugash) -> ota-komponent kutgan
  // "kun + kun ichidagi minut" ko'rinishiga o'tkazish
  const emitSlot = (room: any, startAbs: number, endAbs: number) => {
    const dayIdx = Math.floor(startAbs / DAY_MINUTES)
    const dateStr = dayIdx === 0 ? date : shiftDate(date, dayIdx)
    onSlotClick(room, startAbs - dayIdx * DAY_MINUTES, endAbs - dayIdx * DAY_MINUTES, dateStr)
  }

  // Blokning oyna ichidagi joylashuvi; butunlay tashqarida bo'lsa — null
  const blockPosition = (iv: Interval) => {
    const safeEnd = Math.max(iv.end, iv.start + 15)
    if (safeEnd <= winStart || iv.start >= winEnd) return null
    const left = pct(Math.max(iv.start, winStart))
    const right = pct(Math.min(safeEnd, winEnd))
    return {
      left,
      width: right - left,
      label: `${minToTime(iv.start)} - ${minToTime(iv.end)}`,
    }
  }

  // Bosilgan soatdan keyingi bo'sh oraliq (maks. 2 soat).
  // O'tgan vaqtga bron qilinmaydi: to'liq o'tib ketgan soatlar umuman
  // bosilmaydi, joriy soat esa hozirgi vaqtdan boshlanadi.
  const freeSlotAt = (roomId: string, hour: number): [number, number] | null => {
    if (isPastDate) return null // o'tgan sanaga bron qilinmaydi
    const hourStart = hour * 60
    if (isToday && hourStart + 60 <= nowMin) return null // soat allaqachon o'tgan
    const start = isToday ? Math.max(hourStart, Math.floor(nowMin / 15) * 15) : hourStart
    const free = freeMinutesFrom(roomId, start)
    if (free <= 0) return null
    return [start, start + Math.min(120, free)]
  }

  // Tez bron: hozirgi vaqtdan boshlab N soat
  const quickBook = (room: any, hours: number) => {
    const start = quickStartFor(room.id)
    const free = freeMinutesFrom(room.id, start)
    if (free <= 0) return
    emitSlot(room, start, start + Math.min(hours * 60, free))
  }

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
  // Oyna ertangi kunga o'tadimi (sarlavhada ko'rsatish uchun)
  const crossesMidnight = endHour > 24

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
          {crossesMidnight && (
            <span className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1">
              Ertangi kun soatlari ham ko'rsatilgan
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isToday && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100">
                <Clock className="h-4 w-4 text-red-500" />
                <span className="text-sm font-bold text-red-600">{format(now, "HH:mm")}</span>
              </div>
              <div className="text-sm text-gray-600">
                Hozir bo'sh: <span className="font-bold text-emerald-600">{freeNowCount}</span>
                <span className="text-gray-400"> / {totalRooms}</span>
              </div>
              {/* Oynani soatlar bo'yicha surish — o'tgan bronlarni ko'rish uchun */}
              {!fullDay && (
                <div className="flex items-center rounded-md border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setHourShift((v) => v - WINDOW_SHIFT_STEP)}
                    disabled={startHour === 0}
                    className="h-8 px-2 text-gray-500 hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-transparent"
                    title="Oldingi soatlarni ko'rish"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {hourShift !== 0 && (
                    <button
                      type="button"
                      onClick={() => setHourShift(0)}
                      className="h-8 px-2 text-[11px] font-medium text-primary-700 hover:bg-primary-50"
                      title="Hozirgi vaqtga qaytish"
                    >
                      Hozir
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setHourShift((v) => v + WINDOW_SHIFT_STEP)}
                    className="h-8 px-2 text-gray-500 hover:bg-gray-50"
                    title="Keyingi soatlarni ko'rish"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setFullDay((v) => !v)}
                className="h-8 px-3 rounded-md text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                title={
                  fullDay
                    ? "Joriy vaqt atrofidagi soatlarni ko'rsatish"
                    : "Butun kunni (00:00-24:00) ko'rsatish"
                }
              >
                {fullDay ? "Hozirgi vaqt" : "Butun kun"}
              </button>
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
              {isPastDate
                ? "O'tgan sana — bron qilib bo'lmaydi, faqat ko'rish"
                : "Tez bron faqat bugungi kun uchun ishlaydi"}
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
            <div className="flex flex-1">
              {visibleHours.map((h) => {
                const nextDay = h >= 24
                const isNowHour = isToday && Math.floor(nowMin / 60) === h
                return (
                  <div
                    key={h}
                    className={cn(
                      "flex-1 h-10 flex items-center justify-center gap-1 border-r border-gray-100",
                      nextDay && "bg-indigo-50/60",
                      isNowHour && "bg-red-50"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        isNowHour
                          ? "text-red-600 font-bold"
                          : nextDay
                            ? "text-indigo-500"
                            : "text-gray-400"
                      )}
                    >
                      {String(h % 24).padStart(2, "0")}
                    </span>
                    {nextDay && (
                      <span className="text-[9px] font-bold text-indigo-400">+1</span>
                    )}
                  </div>
                )
              })}
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
                    const intervals = busyOf(room.id)
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
                            {visibleHours.map((h) => {
                              const slot = freeSlotAt(room.id, h)
                              const clickable = canCreate && !!slot
                              const isPast = isToday && h < Math.floor(nowMin / 60)
                              const nextDay = h >= 24
                              return (
                                <div
                                  key={h}
                                  className={cn(
                                    "flex-1 border-r border-gray-50 h-full group",
                                    isPast && "bg-gray-50/60",
                                    nextDay && "bg-indigo-50/30",
                                    clickable && "cursor-pointer hover:bg-primary-50"
                                  )}
                                  onClick={() => {
                                    if (clickable && slot) emitSlot(room, slot[0], slot[1])
                                  }}
                                  title={
                                    clickable
                                      ? `${minToTime(h * 60)}${nextDay ? " (ertangi kun)" : ""} dan bron qilish`
                                      : undefined
                                  }
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

                          {/* Bronlar (kunlik va soatlik) */}
                          {intervals.map((iv, i) => {
                            const pos = blockPosition(iv)
                            if (!pos) return null
                            return (
                              <div
                                key={`${iv.res.id}-${i}`}
                                className={cn(
                                  "absolute top-2 bottom-2 rounded-lg flex flex-col justify-center px-2 cursor-pointer overflow-hidden hover:brightness-95 transition-all",
                                  statusColors[iv.res.status] || statusColors.PENDING
                                )}
                                style={{ left: `${pos.left}%`, width: `${pos.width}%` }}
                                onClick={() => onReservationClick(iv.res)}
                                title={`${getGuestName(iv.res)} · ${
                                  iv.daily ? "Kunlik bron" : pos.label
                                }`}
                              >
                                <span className="text-[11px] font-bold leading-tight truncate">
                                  {iv.daily ? "Kunlik bron" : pos.label}
                                </span>
                                <span className="text-[10px] opacity-80 leading-tight truncate">
                                  {getGuestName(iv.res)}
                                </span>
                              </div>
                            )
                          })}

                          {/* Joriy vaqt chizig'i (ko'rinadigan oyna ichida bo'lsa) */}
                          {isToday && nowMin >= winStart && nowMin <= winEnd && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
                              style={{ left: `${pct(nowMin)}%` }}
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
