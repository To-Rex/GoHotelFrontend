/* "Yangi bandlov" — kechikib keladigan hamroh qatori (sof yordamchilar).

   Hamroh hozir yo'q, keyin keladi: bron yaratilganda uning joyi band
   qilinadi (`expected_companions`), kelganda bron oynasida "Keldi" bilan
   haqiqiy hamroh sifatida biriktiriladi. Ism/telefon/izoh ixtiyoriy —
   qabulxona kimni kutayotganini bilsin. */

export interface LateCompanion {
  /** Faqat ro'yxat kaliti (serverga ketmaydi) */
  key: string
  name: string
  phone: string
  note: string
}

let seq = 0

export const newLateCompanion = (): LateCompanion => ({
  key: `late-${Date.now().toString(36)}-${++seq}`,
  name: "",
  phone: "",
  note: "",
})

/** Serverga yuboriladigan shakl: bo'sh maydonlar `null` */
export const lateCompanionPayload = (list: LateCompanion[]) =>
  list.map((l) => ({
    name: l.name.trim() || null,
    phone: l.phone.trim() || null,
    note: l.note.trim() || null,
  }))
