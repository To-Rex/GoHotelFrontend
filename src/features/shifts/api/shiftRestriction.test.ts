import { describe, expect, it } from "vitest"
import {
  shiftRestriction,
  allowedRoutesFor,
  SHIFT_ALLOWED_ROUTES,
  SHIFT_REDIRECT_ROUTE,
  type ShiftState,
} from "./shifts"
import type { User } from "@/store/auth"

/* Smena cheklovi kimga va qachon qo'llanadi.

   Bu qoida butun ilovaga kirishni boshqaradi: noto'g'ri tomonga og'sa, yo
   qabulxona smenasiz pul qabul qila boshlaydi (tushum hech kimning kassasiga
   tushmaydi), yo administrator o'z ishidan qulflanib qoladi. Shuning uchun
   ikkala yo'nalish ham shu yerda qulflangan. */

const reception = {
  id: "u1",
  user_type: "EMPLOYEE",
  permissions: ["reservation.create", "finance.payment.create"],
} as unknown as User

const manager = {
  id: "u2",
  user_type: "EMPLOYEE",
  permissions: ["reservation.create", "shift.force_close"],
} as unknown as User

const admin = {
  id: "u3",
  user_type: "ADMIN",
  permissions: ["reservation.create"],
} as unknown as User

const housekeeper = {
  id: "u4",
  user_type: "EMPLOYEE",
  permissions: ["task.view"],
} as unknown as User

const cashMode = (over: Partial<ShiftState> = {}): ShiftState =>
  ({
    mode: "cash",
    day_close: "23:59",
    my_session: null,
    blocking_session: null,
    accepted_session: null,
    ...over,
  }) as ShiftState

const activeSession = {
  id: "s1",
  user_id: "u1",
  status: "ACTIVE",
  started_at: new Date().toISOString(),
  opening_cash: 0,
} as ShiftState["my_session"]

describe("smena ochilmagan holat", () => {
  it("qabulxona smena ochmasa cheklanadi", () => {
    // Aynan shu holat e'tibordan chetda qolgan edi: boshqa xodimning ochiq
    // smenasi ham bo'lmaganda hech qanday cheklov qaytmasdi
    expect(shiftRestriction(reception, cashMode())).toBe("no_shift")
  })

  it("smena ochilgach cheklov yo'qoladi", () => {
    expect(
      shiftRestriction(reception, cashMode({ my_session: activeSession }))
    ).toBeNull()
  })

  it("boshqa xodimning ochiq smenasi avvalgidek bloklaydi", () => {
    expect(
      shiftRestriction(
        reception,
        cashMode({ blocking_session: { ...activeSession, user_id: "u9" } as never })
      )
    ).toBe("blocked")
  })
})

describe("cheklov tegmaydigan xodimlar", () => {
  it("menejer smenasiz ham ishlaydi", () => {
    // U smena ochmasdan tuzatish kiritishi kerak bo'ladi
    expect(shiftRestriction(manager, cashMode())).toBeNull()
  })

  it("administrator smena tizimiga kirmaydi", () => {
    expect(shiftRestriction(admin, cashMode())).toBeNull()
  })

  it("farroshning ishi kassaga bog'liq emas", () => {
    expect(shiftRestriction(housekeeper, cashMode())).toBeNull()
  })

  it("oddiy rejimdagi mehmonxonada cheklov yo'q", () => {
    expect(
      shiftRestriction(reception, { ...cashMode(), mode: "simple" } as ShiftState)
    ).toBeNull()
  })

  it("holat hali yuklanmaganda cheklanmaydi", () => {
    // Yuklanish paytida bloklash sahifani sababsiz tashlab yuborardi
    expect(shiftRestriction(reception, undefined)).toBeNull()
  })

  it("tizimga kirmagan foydalanuvchi", () => {
    expect(shiftRestriction(null, cashMode())).toBeNull()
  })
})

describe("cheklov paytidagi yo'naltirish", () => {
  it("yo'naltiriladigan sahifaning o'zi ochiq bo'lishi shart", () => {
    // Aks holda: cheklangan xodim kassa sahifasiga yuboriladi, u yerda yana
    // cheklov ishlaydi va yana o'sha yerga yuboriladi — cheksiz aylanish
    expect(SHIFT_ALLOWED_ROUTES).toContain(SHIFT_REDIRECT_ROUTE)
  })

  it("smenani ochish sahifasi ochiq ro'yxatda", () => {
    // Smenani ochish tugmasi shu sahifada — u yopilsa, xodim cheklovdan
    // chiqishning yo'lini topa olmaydi
    expect(SHIFT_ALLOWED_ROUTES).toContain("/cash-reports")
  })

  it("xarajatlar va shaxsiy hisobot ham ochiq qoladi", () => {
    expect(SHIFT_ALLOWED_ROUTES).toContain("/expenses")
    expect(SHIFT_ALLOWED_ROUTES).toContain("/my-reports")
  })
})

describe("smena tugallangan, qabul kutilmoqda", () => {
  const handedOver = {
    ...activeSession,
    status: "PENDING_HANDOVER",
  } as ShiftState["my_session"]

  it("topshirilgan smenada ish cheklanadi", () => {
    // Sessiya oynasi yopilgan: bu paytdagi tushum hech qaysi smenaga
    // tushmaydi, shuning uchun bron qilish ochiq qolmasligi kerak
    expect(
      shiftRestriction(reception, cashMode({ my_session: handedOver }))
    ).toBe("handover")
  })

  it("faqat kassa va shaxsiy hisobot ochiq qoladi", () => {
    const open = allowedRoutesFor("handover")
    expect(open).toEqual(["/cash-reports", "/my-reports"])
    expect(open).not.toContain("/booking")
    // Xarajat ham kassadan chiqadi — yozadigan sessiya yo'q
    expect(open).not.toContain("/expenses")
  })

  it("smena qayta ochilgach cheklov yo'qoladi", () => {
    expect(
      shiftRestriction(reception, cashMode({ my_session: activeSession }))
    ).toBeNull()
  })
})

describe("faol sessiyasi bor cheklovlar", () => {
  it("kassa kesimi va ish vaqti tugashida xarajat ochiq qoladi", () => {
    // Bu holatlarda xodimning FAOL sessiyasi bor — xarajat o'shanga yoziladi
    for (const reason of ["cut_due", "work_ended"] as const) {
      expect(allowedRoutesFor(reason)).toEqual(SHIFT_ALLOWED_ROUTES)
      expect(allowedRoutesFor(reason)).toContain("/expenses")
    }
  })

  it("har qanday cheklovda yo`naltiriladigan sahifa ochiq", () => {
    for (const reason of [
      "no_shift",
      "blocked",
      "handover",
      "cut_due",
      "work_ended",
    ] as const) {
      expect(allowedRoutesFor(reason)).toContain(SHIFT_REDIRECT_ROUTE)
    }
  })
})
