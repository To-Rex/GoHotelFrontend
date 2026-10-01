import { initI18n } from './i18n'

// Tun mavzusi: saqlangan tanlov render'dan OLDIN qo'llanadi — sahifa ochilishida
// "oq miltillash" bo'lmasligi uchun. Standart — kun (hozirgi dizayn).
try {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark')
  }
} catch {
  /* localStorage yopiq bo'lsa — kun mavzusi */
}

// Avval til (rus/ingliz bo'lsa lug'ati) — keyin ilovaning o'zi. Ilova
// modullari ichidagi tr("...") lar import paytida hisoblanadi, shuning
// uchun ular til aniq bo'lgandan keyin yuklanishi shart. O'zbek tilida
// initI18n hech narsa yuklamaydi — ilova avvalgidek darhol ochiladi.
void initI18n().finally(() => import('./bootstrap'))
