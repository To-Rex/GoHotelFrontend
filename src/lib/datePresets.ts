import { format, subDays, startOfMonth } from "date-fns"

/**
 * Hisobot sahifalaridagi "tez davr" tugmalari.
 *
 * Nega alohida modul: bu yerda ko'zga tashlanmaydigan xato bor edi. Qaysi
 * tugma tanlanganini sahifa sanalarga qarab TOPARDI:
 *
 *     presets.find((p) => p.from === dateFrom && p.to === dateTo)
 *
 * Bu esa ikki davr bir xil sanalarga tushganda buziladi, chunki `find`
 * birinchi mosini qaytaradi. Oyning 1-kunida "Shu oy" aynan "Bugun" bilan
 * bir xil oraliq beradi, 7-kunida esa "Oxirgi 7 kun" bilan. O'sha ikki kuni
 * "Shu oy" ni bosganda yorug' ramka "Bugun" da qolib ketardi — foydalanuvchi
 * uchun tugma umuman ishlamayotgandek ko'rinadi. Ma'lumot aslida to'g'ri
 * yuklanardi, faqat tanlov ko'rinmasdi.
 *
 * Yechim: tanlov endi taxmin qilinmaydi, kalit sifatida saqlanadi. Sanalar
 * esa aksincha — kalitdan hisoblanadi, shuning uchun sahifa yarim tundan
 * o'tib ketsa "Bugun" o'z-o'zidan yangi kunga suriladi.
 */

export interface DatePreset {
  key: string
  label: string
  /** "yyyy-MM-dd", "Barcha davr" uchun bo'sh satr. */
  from: string
  to: string
}

const iso = (d: Date) => format(d, "yyyy-MM-dd")

export interface DatePresetOptions {
  /** Moliya sahifasida "Kecha" ham bor, xarajatlarda yo'q. */
  withYesterday?: boolean
}

export function buildDatePresets(
  today: Date,
  options: DatePresetOptions = {}
): DatePreset[] {
  const todayStr = iso(today)
  const yesterdayStr = iso(subDays(today, 1))

  return [
    { key: "today", label: "Bugun", from: todayStr, to: todayStr },
    ...(options.withYesterday
      ? [
          {
            key: "yesterday",
            label: "Kecha",
            from: yesterdayStr,
            to: yesterdayStr,
          },
        ]
      : []),
    {
      key: "week",
      label: "Oxirgi 7 kun",
      from: iso(subDays(today, 6)),
      to: todayStr,
    },
    {
      key: "month",
      label: "Shu oy",
      from: iso(startOfMonth(today)),
      to: todayStr,
    },
    // Bo'sh sanalar = serverga date_from/date_to yuborilmaydi
    { key: "all", label: "Barcha davr", from: "", to: "" },
  ]
}

/**
 * Amaldagi oraliq: tugma tanlangan bo'lsa o'shanikini, aks holda qo'lda
 * kiritilganini.
 *
 * Noma'lum kalit qo'lda kiritilgan oraliqqa tushadi — bu holat kalit
 * saqlanib, tugmalar ro'yxati o'zgarsa yuz berishi mumkin; oraliqni yo'qotib
 * bo'sh ro'yxat ko'rsatgandan ko'ra shunisi xavfsiz.
 */
export function resolveDateRange(
  presets: readonly DatePreset[],
  presetKey: string | null,
  custom: { from: string; to: string }
): { from: string; to: string } {
  const preset = presetKey ? presets.find((p) => p.key === presetKey) : undefined
  return preset ? { from: preset.from, to: preset.to } : custom
}

/**
 * Oraliq teskari kiritilganmi.
 *
 * Bunda ro'yxat doim bo'sh chiqadi va "Tanlangan davrda xarajatlar yo'q"
 * degan yozuv chiqadi — go'yo xarajat yozilmagandek. Sabab aslida sanalar
 * o'rni almashganida, shuni aytib qo'ygan ma'qul.
 */
export function isRangeInverted(from: string, to: string): boolean {
  return Boolean(from) && Boolean(to) && from > to
}
