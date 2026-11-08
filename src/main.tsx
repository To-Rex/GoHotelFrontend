import { initI18n } from './i18n'
import { coverNow, uncover } from './lib/langReveal'

// Tun mavzusi: saqlangan tanlov render'dan OLDIN qo'llanadi — sahifa ochilishida
// "oq miltillash" bo'lmasligi uchun. Standart — kun (hozirgi dizayn).
try {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark')
  }
} catch {
  /* localStorage yopiq bo'lsa — kun mavzusi */
}

// Til hozirgina almashtirilgan bo'lsa (sahifa shu sababdan qayta yuklandi)
// ilovadan OLDIN parda qo'yiladi: yangi tildagi sahifa parda ortida
// chiziladi, so'ng bosilgan nuqtadan doira bo'lib ochiladi (lib/langReveal.ts).
// Oddiy ochilishda `cover` null — hech narsa o'zgarmaydi.
const cover = coverNow()

// Avval til (rus/ingliz bo'lsa lug'ati) — keyin ilovaning o'zi. Ilova
// modullari ichidagi tr("...") lar import paytida hisoblanadi, shuning
// uchun ular til aniq bo'lgandan keyin yuklanishi shart. O'zbek tilida
// initI18n hech narsa yuklamaydi — ilova avvalgidek darhol ochiladi.
void initI18n()
  .finally(() => import('./bootstrap'))
  .finally(() => {
    if (cover) void uncover(cover)
  })
