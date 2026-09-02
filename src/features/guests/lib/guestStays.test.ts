import { describe, it, expect } from "vitest"
import type { GuestStay } from "../api/guestHistory"
import {
  EMPTY_STAY_FILTER,
  filterStays,
  hasStayFilter,
  isRealStay,
  isSingleDay,
  presenceVerdict,
  stayCoversDate,
  stayOverlapsRange,
} from "./guestStays"

/* "Bu mehmon falon kuni kelganmi?" degan savolga javob.

   Nozik joylar: chiqish kunida mehmon endi xonada emas; soatlik bronda
   chiqish sanasi kirish sanasi bilan bir xil bo'lishi mumkin; bekor
   qilingan bron "turgan" deb sanalmasligi kerak. */

const stay = (p: Partial<GuestStay>): GuestStay =>
  ({
    id: p.id || "s1",
    reservation_number: "RES-1",
    role: p.role || "MAIN",
    booking_type: p.booking_type || "DAILY",
    check_in_date: p.check_in_date ?? "2026-09-01",
    check_out_date: p.check_out_date ?? "2026-09-03",
    status: p.status || "CHECKED_OUT",
    adults: 1,
    children: 0,
    total_amount: 0,
    paid_amount: 0,
    people: [],
    created_at: "2026-09-01T10:00:00Z",
    ...p,
  }) as GuestStay

describe("isRealStay", () => {
  it("bekor qilingan va kelmagan turishlar sanalmaydi", () => {
    expect(isRealStay(stay({ status: "CANCELLED" }))).toBe(false)
    expect(isRealStay(stay({ status: "NO_SHOW" }))).toBe(false)
  })

  it("qolgan holatlar sanaladi", () => {
    for (const s of ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"]) {
      expect(isRealStay(stay({ status: s }))).toBe(true)
    }
  })
})

describe("stayCoversDate", () => {
  // 1-dan 3-gacha: mehmon 1 va 2 kunlari xonada, 3-kuni ketgan
  const s = stay({ check_in_date: "2026-09-01", check_out_date: "2026-09-03" })

  it("kirish kuni xonada", () => {
    expect(stayCoversDate(s, "2026-09-01")).toBe(true)
  })

  it("oradagi kun xonada", () => {
    expect(stayCoversDate(s, "2026-09-02")).toBe(true)
  })

  it("CHIQISH kuni xonada EMAS", () => {
    // Aynan shu joyda adashish oson
    expect(stayCoversDate(s, "2026-09-03")).toBe(false)
  })

  it("davrdan tashqari kunlar", () => {
    expect(stayCoversDate(s, "2026-08-31")).toBe(false)
    expect(stayCoversDate(s, "2026-09-04")).toBe(false)
  })

  it("soatlik bronda faqat kirish kuni", () => {
    const hourly = stay({
      booking_type: "HOURLY",
      check_in_date: "2026-09-05",
      check_out_date: "2026-09-05",
    })
    expect(stayCoversDate(hourly, "2026-09-05")).toBe(true)
    expect(stayCoversDate(hourly, "2026-09-06")).toBe(false)
  })

  it("kunlik bronda chiqish sanasi teng bo'lsa ham kirish kuni sanaladi", () => {
    const odd = stay({ check_in_date: "2026-09-07", check_out_date: "2026-09-07" })
    expect(stayCoversDate(odd, "2026-09-07")).toBe(true)
  })

  it("bekor qilingan turish javobga kirmaydi", () => {
    expect(stayCoversDate(stay({ status: "CANCELLED" }), "2026-09-01")).toBe(false)
  })

  it("bo'sh sana false beradi", () => {
    expect(stayCoversDate(s, "")).toBe(false)
  })
})

describe("stayOverlapsRange", () => {
  const long = stay({ check_in_date: "2026-08-25", check_out_date: "2026-09-05" })

  it("davrdan oldin kelgan mehmon ham topiladi", () => {
    expect(stayOverlapsRange(long, "2026-09-01", "2026-09-15")).toBe(true)
  })

  it("davrdan keyin va oldin bo'lganlar topilmaydi", () => {
    expect(stayOverlapsRange(long, "2026-09-10", "2026-09-15")).toBe(false)
    expect(stayOverlapsRange(long, "2026-08-01", "2026-08-20")).toBe(false)
  })

  it("bo'sh chegara — cheklov yo'q", () => {
    expect(stayOverlapsRange(long, "", "")).toBe(true)
    expect(stayOverlapsRange(long, "", "2026-08-01")).toBe(false)
  })

  it("bekor qilingan turish kirmaydi", () => {
    expect(
      stayOverlapsRange(stay({ status: "CANCELLED" }), "2026-09-01", "2026-09-05")
    ).toBe(false)
  })
})

describe("isSingleDay / hasStayFilter", () => {
  it("bo'sh filtr", () => {
    expect(hasStayFilter(EMPTY_STAY_FILTER)).toBe(false)
    expect(isSingleDay(EMPTY_STAY_FILTER)).toBeNull()
  })

  it("bitta kun — turli yo'llar bilan", () => {
    expect(isSingleDay({ from: "2026-09-01", to: "2026-09-01" })).toBe("2026-09-01")
    expect(isSingleDay({ from: "2026-09-01", to: "" })).toBe("2026-09-01")
    expect(isSingleDay({ from: "", to: "2026-09-01" })).toBe("2026-09-01")
  })

  it("oraliq bitta kun emas", () => {
    expect(isSingleDay({ from: "2026-09-01", to: "2026-09-05" })).toBeNull()
  })
})

describe("filterStays", () => {
  const stays = [
    stay({ id: "sentabr", check_in_date: "2026-09-01", check_out_date: "2026-09-03" }),
    stay({ id: "oktabr", check_in_date: "2026-10-10", check_out_date: "2026-10-12" }),
    stay({
      id: "bekor",
      check_in_date: "2026-09-02",
      check_out_date: "2026-09-04",
      status: "CANCELLED",
    }),
  ]

  it("filtrsiz hammasi ko'rinadi, jumladan bekor qilinganlar", () => {
    // Tarix to'liq bo'lishi kerak
    expect(filterStays(stays, EMPTY_STAY_FILTER).map((s) => s.id)).toEqual([
      "sentabr",
      "oktabr",
      "bekor",
    ])
  })

  it("bitta kun bo'yicha", () => {
    expect(
      filterStays(stays, { from: "2026-09-02", to: "2026-09-02" }).map((s) => s.id)
    ).toEqual(["sentabr"])
  })

  it("oraliq bo'yicha", () => {
    expect(
      filterStays(stays, { from: "2026-10-01", to: "2026-10-31" }).map((s) => s.id)
    ).toEqual(["oktabr"])
  })

  it("hech nima topilmasa bo'sh ro'yxat", () => {
    expect(filterStays(stays, { from: "2026-12-01", to: "2026-12-31" })).toEqual([])
  })
})

describe("presenceVerdict", () => {
  const stays = [
    stay({
      check_in_date: "2026-09-01",
      check_out_date: "2026-09-03",
      room_number: "205",
    }),
  ]

  it("shu kuni turgan — xona raqami bilan", () => {
    const v = presenceVerdict(stays, { from: "2026-09-02", to: "2026-09-02" })
    expect(v.present).toBe(true)
    expect(v.room).toBe("205")
    expect(v.day).toBe("2026-09-02")
  })

  it("chiqish kuni turmagan", () => {
    expect(presenceVerdict(stays, { from: "2026-09-03", to: "" }).present).toBe(false)
  })

  it("kelmagan kun", () => {
    const v = presenceVerdict(stays, { from: "2026-12-25", to: "2026-12-25" })
    expect(v.present).toBe(false)
    expect(v.count).toBe(0)
    expect(v.room).toBeNull()
  })

  it("oraliqda nechta turish borligini sanaydi", () => {
    const many = [
      stay({ id: "a", check_in_date: "2026-09-01", check_out_date: "2026-09-03" }),
      stay({ id: "b", check_in_date: "2026-09-20", check_out_date: "2026-09-22" }),
    ]
    const v = presenceVerdict(many, { from: "2026-09-01", to: "2026-09-30" })
    expect(v.count).toBe(2)
    expect(v.day).toBeNull()
  })
})
