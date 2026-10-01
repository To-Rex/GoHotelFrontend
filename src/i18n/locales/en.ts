import type { Dictionary } from "../index"

// Inglizcha lug'at — bo'limlar bo'yicha fayllar (en/*.json) bitta obyektga
// yig'iladi. Bu modul faqat ingliz tili tanlanganda yuklanadi (alohida chunk).
const parts = import.meta.glob<Dictionary>("./en/*.json", {
  eager: true,
  import: "default",
})

const dictionary: Dictionary = Object.assign({}, ...Object.values(parts))

export default dictionary
