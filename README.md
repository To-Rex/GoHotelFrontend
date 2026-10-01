# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Ko'p tillilik (i18n): o'zbekcha, ruscha, inglizcha

Asosiy til — o'zbekcha. Til navbar, kirish sahifasi, landing va boshqaruv
panelidagi globus tugmasidan tanlanadi; tanlov brauzerda saqlanadi
(`localStorage.lang`) va sahifa qayta yuklanadi. `?lang=ru` yoki `?lang=en`
havolasi tilni to'g'ridan-to'g'ri ochadi.

**Qanday ishlaydi.** Matnlar kodda O'ZBEKCHA yoziladi va `tr("…")` ga
o'raladi — o'zbekcha matnning o'zi kalit:

```tsx
import { tr } from "@/i18n"

<button>{tr("Saqlash")}</button>
tr("{{count}} ta xona", { count })
```

- O'zbek tilida `tr` kalitni o'zini qaytaradi — lug'at kerak emas.
- Rus/ingliz tilida `src/i18n/locales/{ru,en}/<bo'lim>.json` dan qidiriladi;
  tarjimasi yo'q matn o'zbekcha chiqadi (ekran hech qachon bo'sh qolmaydi).
- Lug'at faqat tanlangan til uchun yuklanadi (alohida chunk).
- Ko'plik: tarjima obyekt bo'lishi mumkin —
  `{ "one": "{{count}} номер", "few": "{{count}} номера", "many": "{{count}} номеров", "other": "…" }`.

**Yangi matn qo'shganda**

```bash
npm run i18n:wrap     # o'zbekcha matnlarni avtomatik tr() ga o'raydi
npm run i18n:check    # lug'atni tekshiradi; tarjimasi yo'q kalitlarni ko'rsatadi
npm run i18n:verify   # o'rash o'zbekcha natijani o'zgartirmaganini isbotlaydi
```

`i18n:wrap` JSX matni, `title`/`placeholder` kabi atributlar va `${x} ta`
shablonlarini o'raydi; `className`, kalitlar, yo'llar va solishtirishlarga
(`=== "…"`) tegmaydi. So'ng yangi kalitlarning tarjimasini tegishli
`locales/ru/*.json` va `locales/en/*.json` fayliga qo'shing.

**Bazaga yoziladigan qiymatlar** (fuqarolik, xarajat va do'kon
kategoriyalari) o'zbekcha saqlanadi — aks holda bitta mehmonxonada "Boshqa"
va "Другое" ikki xil kategoriya bo'lib qolardi. Bunday ro'yxat ustiga
`// i18n:keys` izohi qo'yiladi (o'ralmaydi, lekin lug'atga kiradi), ekranda
esa `tr(qiymat)` bilan ko'rsatiladi:

```tsx
// i18n:keys
const CATEGORIES = ["Ichimliklar", "Shirinliklar"]
…
<option value={c}>{tr(c)}</option>
```

Texnik qiymatni o'rashdan saqlash: `/* i18n:skip */ "matn"`.

**Chegaralar.** Server qaytargan xato matnlari va foydalanuvchi kiritgan
ma'lumotlar (xona turi nomi, izohlar) tarjima qilinmaydi. Sonlar barcha
tillarda bir xil formatda (`1 234 567`).
