import type { Dictionary } from "../index"

// Ruscha lug'at — bo'limlar bo'yicha fayllar (ru/*.json) bitta obyektga
// yig'iladi. Bu modul faqat rus tili tanlanganda yuklanadi (alohida chunk).
const parts = import.meta.glob<Dictionary>("./ru/*.json", {
  eager: true,
  import: "default",
})

const dictionary: Dictionary = Object.assign({}, ...Object.values(parts))

export default dictionary
