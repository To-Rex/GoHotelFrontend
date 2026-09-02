import { describe, it, expect } from "vitest"
import { describeDevice } from "./deviceId"

/* Qurilma nomi taklifi.

   Nozik joy — brauzerlarning bir-birini "taqlid qilishi": Edge o'zini
   Chrome deb, Chrome esa Safari deb ham ataydi. Shuning uchun tekshirish
   tartibi muhim va aynan shu yerda xato qilish oson. */

describe("describeDevice", () => {
  it("Windows'dagi Chrome", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
      )
    ).toBe("Windows · Chrome")
  })

  it("Edge Chrome deb sanalmaydi", () => {
    // Edge ham "Chrome/120" yozadi — faqat Edg/ belgisi ajratadi
    expect(
      describeDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0"
      )
    ).toBe("Windows · Edge")
  })

  it("Safari Chrome deb sanalmaydi", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"
      )
    ).toBe("macOS · Safari")
  })

  it("Android telefondagi Chrome", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36"
      )
    ).toBe("Android · Chrome")
  })

  it("iPhone", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe("iOS · Safari")
  })

  it("Firefox", () => {
    expect(
      describeDevice("Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0")
    ).toBe("Linux · Firefox")
  })

  it("Opera va Yandex ajratiladi", () => {
    expect(
      describeDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 OPR/106.0")
    ).toBe("Windows · Opera")
    expect(
      describeDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 YaBrowser/24.1 Safari/537.36")
    ).toBe("Windows · Yandex")
  })

  it("tanib bo'lmasa ham matn qaytadi", () => {
    expect(describeDevice("")).toBe("Noma'lum qurilma")
    expect(describeDevice("qandaydir-robot/1.0")).toBe("Noma'lum qurilma")
  })

  it("faqat bittasi tanilsa o'shanisi qaytadi", () => {
    expect(describeDevice("Windows NT 10.0")).toBe("Windows")
  })
})
