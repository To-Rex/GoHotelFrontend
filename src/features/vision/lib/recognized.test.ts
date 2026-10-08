import { describe, expect, it } from "vitest"

import type { Sighting } from "../api/vision"
import {
  TOAST_COOLDOWN_MS,
  TOAST_FRESH_MS,
  groupSightingsByGuest,
  imageIdOf,
  selectArrivals,
} from "./recognized"

/* "Kamera tanidi": bir mehmon — bir qator, yangi kelgan — bitta toast. */

const NOW = Date.parse("2026-10-08T09:00:00Z")
const ago = (ms: number) => new Date(NOW - ms).toISOString()

const s = (id: string, guest: string | null, over: Partial<Sighting> = {}): Sighting => ({
  id,
  status: guest ? "recognized" : "unknown",
  camera_id: "cam-1",
  seen_at: ago(60_000),
  similarity: 0.8,
  margin: 0.2,
  quality_score: 0.5,
  guest_id: guest,
  guest_name: guest ? `Mehmon ${guest}` : null,
  visits: 1,
  has_active_reservation: false,
  has_thumbnail: true,
  can_enroll: false,
  acknowledged: false,
  ...over,
})

describe("groupSightingsByGuest", () => {
  it("bir mehmonning ko'rinishlari bitta qatorga yig'iladi", () => {
    const rows = groupSightingsByGuest([s("a1", "ali"), s("v1", "vali"), s("a2", "ali"), s("a3", "ali")])
    expect(rows.map((r) => r.guest_id)).toEqual(["ali", "vali"])
    expect(rows[0].id).toBe("a1") // eng so'nggisi
    expect(rows[0].sighting_ids).toEqual(["a1", "a2", "a3"])
    expect(rows[0].sighting_count).toBe(3)
  })

  it("server yig'ib bergan son saqlanadi, tanilmaganlar tashlanadi", () => {
    const rows = groupSightingsByGuest([s("a1", "ali", { sighting_count: 4 }), s("x", null)])
    expect(rows).toHaveLength(1)
    expect(rows[0].sighting_count).toBe(4)
  })

  it("so'nggi kadrda surat bo'lmasa — guruhdagi suratli kadr", () => {
    const rows = groupSightingsByGuest([s("a1", "ali", { has_thumbnail: false }), s("a2", "ali")])
    expect(rows[0].has_thumbnail).toBe(true)
    expect(imageIdOf(rows[0])).toBe("a2")
    expect(imageIdOf(s("b1", "bob", { image_sighting_id: "b9" }))).toBe("b9")
  })
})

describe("selectArrivals", () => {
  it("birinchi so'rovda faqat yaqinda tanilganlar", () => {
    const rows = groupSightingsByGuest([
      s("a1", "ali", { seen_at: ago(60_000) }),
      s("v1", "vali", { seen_at: ago(TOAST_FRESH_MS + 60_000) }),
    ])
    expect(selectArrivals(rows, null, {}, NOW).map((r) => r.guest_id)).toEqual(["ali"])
  })

  it("keyingi so'rovlarda — yangi ko'rinish kelgan mehmon", () => {
    const known = new Set(["a1", "v1"])
    const same = groupSightingsByGuest([s("a1", "ali"), s("v1", "vali")])
    expect(selectArrivals(same, known, {}, NOW)).toEqual([])
    const next = groupSightingsByGuest([s("v2", "vali"), s("a1", "ali"), s("v1", "vali")])
    expect(selectArrivals(next, known, {}, NOW).map((r) => r.guest_id)).toEqual(["vali"])
  })

  it("kamera oldida turgan odam haqida qayta-qayta xabar berilmaydi", () => {
    const rows = groupSightingsByGuest([s("a5", "ali")])
    const known = new Set(["a4"])
    expect(selectArrivals(rows, known, { ali: NOW - 60_000 }, NOW)).toEqual([])
    expect(selectArrivals(rows, known, { ali: NOW - TOAST_COOLDOWN_MS }, NOW)).toHaveLength(1)
  })
})
