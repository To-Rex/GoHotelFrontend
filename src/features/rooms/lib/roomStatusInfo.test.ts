import { describe, it, expect } from "vitest"
import type { HousekeepingTask } from "@/types/api"
import {
  activeTaskFor,
  clockLabel,
  formatElapsed,
  roomStatusDetail,
} from "./roomStatusInfo"

/* Xona holati tafsiloti.

   Xavf vaqt hisobida: chegaralar (60 daqiqa, 24 soat), ikkinchi birlikning
   nolga tushishi va vaqt manbasini tanlash — boshlangan vazifada
   `started_at`, boshlanmaganda `created_at`, vazifasiz holatda esa xona
   tarixidagi vaqt. */

const task = (p: Partial<HousekeepingTask>): HousekeepingTask =>
  ({
    id: p.id || "t1",
    hotel_id: "h",
    branch_id: "b",
    room_id: p.room_id || "r1",
    task_type: p.task_type || "CLEANING",
    status: p.status || "OPEN",
    priority: "HIGH",
    assigned_to: p.assigned_to ?? null,
    notes: null,
    scheduled_date: null,
    started_at: p.started_at ?? null,
    completed_at: null,
    created_by: "u",
    created_at: p.created_at || "2026-09-01T10:00:00Z",
    photo_count: 0,
    assigned_user: p.assigned_user ?? null,
  }) as HousekeepingTask

const room = (status: string, changedAt?: string | null) => ({
  id: "r1",
  current_status: status,
  status_changed_at: changedAt ?? null,
})

describe("formatElapsed", () => {
  it("bir daqiqadan kamini 'hozir' deydi", () => {
    // "0 daqiqa" mantiqsiz ko'rinardi
    expect(formatElapsed(0)).toBe("hozir")
    expect(formatElapsed(59_000)).toBe("hozir")
  })

  it("daqiqalar", () => {
    expect(formatElapsed(60_000)).toBe("1 daqiqa")
    expect(formatElapsed(35 * 60_000)).toBe("35 daqiqa")
    expect(formatElapsed(59 * 60_000)).toBe("59 daqiqa")
  })

  it("soat chegarasi", () => {
    expect(formatElapsed(60 * 60_000)).toBe("1 soat")
    expect(formatElapsed(80 * 60_000)).toBe("1 soat 20 daqiqa")
  })

  it("kun chegarasi — nol soat tushirib qoldiriladi", () => {
    expect(formatElapsed(24 * 60 * 60_000)).toBe("1 kun")
    expect(formatElapsed(27 * 60 * 60_000)).toBe("1 kun 3 soat")
    expect(formatElapsed(48 * 60 * 60_000)).toBe("2 kun")
  })
})

describe("clockLabel", () => {
  it("ikki xonali soat va daqiqa", () => {
    expect(clockLabel(new Date(2026, 8, 1, 9, 5).getTime())).toBe("09:05")
    expect(clockLabel(new Date(2026, 8, 1, 23, 59).getTime())).toBe("23:59")
  })
})

describe("activeTaskFor", () => {
  it("faqat shu xonaning ochiq vazifalarini oladi", () => {
    const tasks = [
      task({ id: "boshqa-xona", room_id: "r2" }),
      task({ id: "yopilgan", status: "COMPLETED" }),
      task({ id: "kerakli" }),
    ]
    expect(activeTaskFor(tasks, "r1")?.id).toBe("kerakli")
  })

  it("boshlangani ustun turadi", () => {
    // Ochig'i yangiroq bo'lsa ham — xodimni bajarilayotgani qiziqtiradi
    const tasks = [
      task({ id: "ochiq", status: "OPEN", created_at: "2026-09-01T12:00:00Z" }),
      task({
        id: "boshlangan",
        status: "IN_PROGRESS",
        created_at: "2026-09-01T09:00:00Z",
      }),
    ]
    expect(activeTaskFor(tasks, "r1")?.id).toBe("boshlangan")
  })

  it("teng holatda eng yangisi", () => {
    const tasks = [
      task({ id: "eski", created_at: "2026-09-01T09:00:00Z" }),
      task({ id: "yangi", created_at: "2026-09-01T12:00:00Z" }),
    ]
    expect(activeTaskFor(tasks, "r1")?.id).toBe("yangi")
  })

  it("hech nima topilmasa null", () => {
    expect(activeTaskFor([], "r1")).toBeNull()
  })
})

describe("roomStatusDetail", () => {
  const now = new Date(2026, 8, 1, 12, 0).getTime()
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString()

  it("bo'sh xonada hech narsa ko'rsatilmaydi", () => {
    expect(roomStatusDetail(room("AVAILABLE"), null, now)).toBeNull()
  })

  it("band xonaga tegilmaydi — u yerda 'Bo'shaydi' yozuvi bor", () => {
    expect(roomStatusDetail(room("OCCUPIED"), null, now)).toBeNull()
    expect(roomStatusDetail(room("RESERVED"), null, now)).toBeNull()
  })

  it("boshlangan tozalashda started_at olinadi, created_at emas", () => {
    const d = roomStatusDetail(
      room("CLEANING"),
      task({
        status: "IN_PROGRESS",
        created_at: minutesAgo(90),
        started_at: minutesAgo(35),
      }),
      now
    )
    expect(d?.headline).toBe("Tozalash boshlandi")
    expect(d?.elapsedLabel).toBe("35 daqiqa")
    expect(d?.started).toBe(true)
  })

  it("boshlanmagan vazifada yaratilgan payt olinadi", () => {
    const d = roomStatusDetail(
      room("CLEANING"),
      task({ status: "OPEN", created_at: minutesAgo(20) }),
      now
    )
    // Farrosh hali boshlamagani — xodim uchun muhim farq
    expect(d?.headline).toBe("Tozalash kutilmoqda")
    expect(d?.elapsedLabel).toBe("20 daqiqa")
    expect(d?.started).toBe(false)
  })

  it("vazifa yo'q bo'lsa xona tarixidagi vaqtga tayanadi", () => {
    // Qo'lda qo'yilgan ta'mirlash holatida yagona ma'lumot manbai
    const d = roomStatusDetail(
      room("MAINTENANCE", minutesAgo(150)),
      null,
      now
    )
    expect(d?.headline).toBe("Ta'mirlash")
    expect(d?.elapsedLabel).toBe("2 soat 30 daqiqa")
  })

  it("vaqt umuman noma'lum bo'lsa yozuv yo'qolmaydi", () => {
    const d = roomStatusDetail(room("CLEANING"), null, now)
    expect(d).not.toBeNull()
    expect(d?.atLabel).toBeNull()
    expect(d?.elapsedLabel).toBeNull()
    expect(d?.stale).toBe(false)
  })

  it("farrosh ismi ko'rsatiladi", () => {
    const d = roomStatusDetail(
      room("CLEANING"),
      task({
        assigned_user: { id: "u1", first_name: "Aziz", last_name: "Karimov" },
      }),
      now
    )
    expect(d?.assignee).toBe("Aziz Karimov")
  })

  it("biriktirilmagan vazifada ism null", () => {
    expect(roomStatusDetail(room("CLEANING"), task({}), now)?.assignee).toBeNull()
  })

  it("bir soatdan oshgan tozalash ajratib ko'rsatiladi", () => {
    const ok = roomStatusDetail(
      room("CLEANING"),
      task({ created_at: minutesAgo(45) }),
      now
    )
    const late = roomStatusDetail(
      room("CLEANING"),
      task({ created_at: minutesAgo(61) }),
      now
    )
    expect(ok?.stale).toBe(false)
    expect(late?.stale).toBe(true)
  })

  it("ta'mirlash uchun chegara uzoqroq — bir soat hali ko'p emas", () => {
    const d = roomStatusDetail(room("MAINTENANCE", minutesAgo(120)), null, now)
    expect(d?.stale).toBe(false)
  })

  it("kelajakdagi vaqtda manfiy davomiylik chiqmaydi", () => {
    const d = roomStatusDetail(
      room("CLEANING"),
      task({ created_at: new Date(now + 60_000).toISOString() }),
      now
    )
    expect(d?.elapsedLabel).toBe("hozir")
  })

  it("buzuq sana yozuvni yo'qotmaydi", () => {
    const d = roomStatusDetail(
      room("CLEANING"),
      task({ created_at: "not-a-date" }),
      now
    )
    expect(d).not.toBeNull()
    expect(d?.elapsedLabel).toBeNull()
  })

  it("chuqur tozalash o'z nomi bilan chiqadi", () => {
    const d = roomStatusDetail(
      room("CLEANING"),
      task({ task_type: "DEEP_CLEANING", status: "IN_PROGRESS", started_at: minutesAgo(5) }),
      now
    )
    expect(d?.headline).toBe("Chuqur tozalash boshlandi")
  })
})
