import { ChevronLeft, ChevronRight, ChevronDown, Clock, Plus, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAY_MINUTES = 24 * 60

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

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Kalendarsiz, bitta kunga mo'ljallangan soatlik bron taxtasi.
 * Har bir xona uchun 24 soatlik chiziq: band oraliqlar rangli bloklar,
 * bo'sh joyga bosilsa — o'sha soatdan boshlanadigan yangi soatlik bron.
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
      // Kunlik bron shu kunni qamrab oladimi
      if (r.check_in_date <= date && date <= r.check_out_date) {
        dailyByRoom[r.room_id] = r
      }
    }
  }

  // Bron blokining kun ichidagi joylashuvi (foizda) — tunab qoluvchi bronlar kesiladi
  const blockPosition = (r: any): { left: number; width: number; label: string } => {
    const ciDate = r.check_in_datetime.slice(0, 10)
    const coDate = r.check_out_datetime.slice(0, 10)
    const startMin = ciDate === date ? timeToMin(r.check_in_datetime.slice(11, 16)) : 0
    const endMin = coDate === date ? timeToMin(r.check_out_datetime.slice(11, 16)) : DAY_MINUTES
    const safeEnd = Math.max(endMin, startMin + 15) // juda qisqa bronlar ko'rinishi uchun
    return {
      left: (startMin / DAY_MINUTES) * 100,
      width: ((safeEnd - startMin) / DAY_MINUTES) * 100,
      label: `${minToTime(startMin)} - ${minToTime(endMin)}`,
    }
  }

  // Bosilgan soatdan keyingi birinchi band vaqtgacha bo'sh oraliq (maks. 2 soat)
  const freeSlotAt = (roomId: string, hour: number): [number, number] | null => {
    const start = hour * 60
    const busy = (hourlyByRoom[roomId] || []).map((r) => {
      const ciDate = r.check_in_datetime.slice(0, 10)
      const coDate = r.check_out_datetime.slice(0, 10)
      const s = ciDate === date ? timeToMin(r.check_in_datetime.slice(11, 16)) : 0
      const e = coDate === date ? timeToMin(r.check_out_datetime.slice(11, 16)) : DAY_MINUTES
      return [s, e] as [number, number]
    })
    // Bosilgan nuqta band bo'lsa — slot yo'q
    if (busy.some(([s, e]) => s <= start && start < e)) return null
    const nextBusyStart = busy
      .filter(([s]) => s > start)
      .reduce((min, [s]) => Math.min(min, s), DAY_MINUTES)
    const end = Math.min(start + 120, nextBusyStart)
    if (end <= start) return null
    return [start, end]
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col h-full">
      {/* Kun tanlash paneli */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
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
              date === today ? "bg-primary-50 text-primary-700" : "text-gray-500 hover:bg-gray-50"
            )}
            onClick={() => onDateChange(today)}
          >
            Bugun
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-4 w-4" />
          {canCreate
            ? "Bo'sh soatga bosing — soatlik bron ochiladi"
            : "Soatlik bronlarni ko'rish rejimi"}
        </div>
      </div>

      {/* Soat sarlavhalari + xonalar */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="min-w-[880px]">
          {/* Sarlavha qatori */}
          <div className="sticky top-0 z-20 flex bg-white border-b border-gray-200 shadow-sm">
            <div className="flex-shrink-0 w-44 h-10 flex items-center px-4 bg-gray-50 border-r border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Xonalar
              </span>
            </div>
            <div className="flex flex-1">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="flex-1 h-10 flex items-center justify-center border-r border-gray-100"
                >
                  <span className="text-[11px] font-medium text-gray-400">
                    {String(h).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Xona qatorlari — qavatlar bo'yicha guruhlangan */}
          {roomGroups.map((group) => {
            const collapsed = collapsedFloors.has(group.key)
            return (
            <div key={group.key}>
              {/* Qavat sarlavhasi — bosilsa qavat yig'iladi/ochiladi */}
              <div
                className="flex bg-gray-100 border-y border-gray-200 cursor-pointer hover:bg-gray-200/70 transition-colors"
                onClick={() => onToggleFloor(group.key)}
                title={collapsed ? "Qavatni ochish" : "Qavatni yig'ish"}
              >
                <div className="flex-shrink-0 w-44 flex items-center gap-2 px-4 h-8 border-r border-gray-200">
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

              {!collapsed && group.rooms.map((room: any) => {
            const daily = dailyByRoom[room.id]
            const hourly = hourlyByRoom[room.id] || []
            return (
              <div
                key={room.id}
                className="flex border-b border-gray-100 bg-white hover:bg-gray-50/40 transition-colors"
                style={{ height: 56 }}
              >
                <div className="flex-shrink-0 w-44 flex flex-col justify-center px-4 border-r border-gray-200">
                  <span className="text-sm font-bold text-gray-900">{room.room_number}</span>
                  <span className="text-[11px] text-gray-400 truncate">
                    {room.room_type?.name || "Standard"}
                    {getRoomPrice(room) > 0 &&
                      ` · ${Math.round(getRoomPrice(room) / 24).toLocaleString()} So'm/soat`}
                  </span>
                </div>

                <div className="flex-1 relative">
                  {/* Soat kataklari (bo'sh joy — bosish mumkin) */}
                  <div className="flex h-full">
                    {HOURS.map((h) => {
                      const slot = daily ? null : freeSlotAt(room.id, h)
                      const clickable = canCreate && !!slot
                      return (
                        <div
                          key={h}
                          className={cn(
                            "flex-1 border-r border-gray-50 h-full group",
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
                </div>
              </div>
            )
              })}
            </div>
            )
          })}

          {roomGroups.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-400">Xonalar topilmadi</p>
          )}
        </div>
      </div>
    </div>
  )
}
