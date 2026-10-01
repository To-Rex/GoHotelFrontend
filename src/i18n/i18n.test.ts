import { afterEach, describe, expect, it } from "vitest"

import { dateLocale, getLang, loadDictionary, monthYear, tr, trc } from "./index"

// Har testdan keyin asosiy holat: o'zbekcha, lug'atsiz
afterEach(() => loadDictionary("uz", {}))

describe("tr — o'zbek tili (lug'atsiz)", () => {
  it("kalitning o'zini qaytaradi", () => {
    expect(tr("Saqlash")).toBe("Saqlash")
    expect(tr("Xona *")).toBe("Xona *")
  })

  it("o'zgaruvchilarni shablon satri kabi qo'yadi", () => {
    const count = 3
    expect(tr("{{count}} ta xona", { count })).toBe(`${count} ta xona`)
    expect(tr("{{a}} → {{b}}", { a: "101", b: "102" })).toBe("101 → 102")
    // bir xil o'zgaruvchi ikki marta
    expect(tr("{{n}} / {{n}}", { n: 7 })).toBe("7 / 7")
    // nol — haqiqiy qiymat
    expect(tr("Qoldiq: {{sum}}", { sum: 0 })).toBe("Qoldiq: 0")
  })

  it("null, undefined va boolean JSX'dagi kabi ko'rinmaydi", () => {
    expect(tr("Tel: {{phone}}", { phone: null })).toBe("Tel: ")
    expect(tr("Tel: {{phone}}", { phone: undefined })).toBe("Tel: ")
    expect(tr("{{flag}}!", { flag: false })).toBe("!")
  })

  it("parametri berilmagan o'rin o'z holicha qoladi", () => {
    expect(tr("{{a}} va {{b}}", { a: 1 })).toBe("1 va {{b}}")
    expect(tr("{{a}} va {{b}}")).toBe("{{a}} va {{b}}")
  })

  it("qiymat ichidagi {{…}} qayta ishlanmaydi", () => {
    expect(tr("Izoh: {{text}}", { text: "{{count}}", count: 5 })).toBe("Izoh: {{count}}")
  })
})

describe("tr — lug'at bilan", () => {
  it("tarjimani topadi, topilmasa o'zbekchasini qaytaradi", () => {
    loadDictionary("ru", { Saqlash: "Сохранить" })
    expect(tr("Saqlash")).toBe("Сохранить")
    expect(tr("Hali tarjima qilinmagan matn")).toBe("Hali tarjima qilinmagan matn")
    expect(getLang()).toBe("ru")
  })

  it("tarjimada o'zgaruvchi o'rni boshqa joyda bo'lishi mumkin", () => {
    loadDictionary("en", { "{{room}}-xona band": "Room {{room}} is occupied" })
    expect(tr("{{room}}-xona band", { room: "204" })).toBe("Room 204 is occupied")
  })

  it("bo'sh tarjima — haqiqiy tarjima (gap bo'lagi keraksiz bo'lganda)", () => {
    loadDictionary("en", { Ish: "Starts at", "da boshlanadi": "" })
    expect(`${tr("Ish")} 09:00 ${tr("da boshlanadi")}`).toBe("Starts at 09:00 ")
  })

  it("ruscha ko'plik shakllari", () => {
    loadDictionary("ru", {
      "{{count}} ta xona": {
        one: "{{count}} номер",
        few: "{{count}} номера",
        many: "{{count}} номеров",
        other: "{{count}} номера",
      },
    })
    const say = (count: number) => tr("{{count}} ta xona", { count })
    expect(say(1)).toBe("1 номер")
    expect(say(3)).toBe("3 номера")
    expect(say(5)).toBe("5 номеров")
    expect(say(11)).toBe("11 номеров")
    expect(say(21)).toBe("21 номер")
    expect(say(22)).toBe("22 номера")
  })

  it("inglizcha ko'plik va `count` bo'lmaganda birinchi son", () => {
    loadDictionary("en", {
      "{{nights}} kecha": { one: "{{nights}} night", other: "{{nights}} nights" },
    })
    expect(tr("{{nights}} kecha", { nights: 1 })).toBe("1 night")
    expect(tr("{{nights}} kecha", { nights: 4 })).toBe("4 nights")
  })

  it("son satr bo'lib kelsa `other` shakli olinadi", () => {
    loadDictionary("ru", {
      "{{count}} ta": { one: "{{count}} штука", other: "{{count}} шт." },
    })
    expect(tr("{{count}} ta", { count: "1 250" })).toBe("1 250 шт.")
  })

  it("shakl yo'q bo'lsa `other` ga tushadi", () => {
    loadDictionary("ru", { "{{count}} kun": { other: "{{count}} дн." } })
    expect(tr("{{count}} kun", { count: 1 })).toBe("1 дн.")
  })
})

describe("trc — kontekstli tarjima", () => {
  it("o'zbek tilida matnning o'zi", () => {
    expect(trc("login", "Kirish")).toBe("Kirish")
    expect(trc("stay", "{{n}} kecha", { n: 2 })).toBe("2 kecha")
  })

  it("kontekst kaliti bo'lsa o'sha, bo'lmasa oddiy kalit", () => {
    loadDictionary("ru", {
      Kirish: "Вход",
      "login::Kirish": "Войти",
      "stay::Kirish": "Заезд",
    })
    expect(trc("login", "Kirish")).toBe("Войти")
    expect(trc("stay", "Kirish")).toBe("Заезд")
    expect(trc("boshqa", "Kirish")).toBe("Вход")
    expect(tr("Kirish")).toBe("Вход")
  })

  it("ko'plik shakllari kontekstda ham ishlaydi", () => {
    loadDictionary("en", {
      "stay::{{n}} kecha": { one: "{{n}} night", other: "{{n}} nights" },
    })
    expect(trc("stay", "{{n}} kecha", { n: 1 })).toBe("1 night")
    expect(trc("stay", "{{n}} kecha", { n: 3 })).toBe("3 nights")
  })
})

describe("sana", () => {
  const september = new Date(2026, 8, 15)

  it("o'zbek va ingliz tilida kalendar sarlavhasi avvalgidek", () => {
    expect(monthYear(september)).toBe("September 2026")
    expect(dateLocale()).toBe("uz-UZ")
    loadDictionary("en", {})
    expect(monthYear(september)).toBe("September 2026")
    expect(dateLocale()).toBe("en-GB")
  })

  it("rus tilida ruscha oy nomi", () => {
    loadDictionary("ru", {})
    expect(monthYear(september)).toBe("Сентябрь 2026")
    expect(dateLocale()).toBe("ru-RU")
  })
})
