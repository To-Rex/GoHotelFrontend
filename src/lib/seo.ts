// "Gibrit" SEO'ning dinamik qatlami: index.html'dagi statik teglar botlarga
// JS'siz ham to'liq ma'lumot beradi, bu hook esa JS ishlagach har sahifaga
// mos qiymatlarni o'sha teglar USTIGA yozadi (dublikat teg yaratilmaydi).
// Har sahifa o'z qiymatini o'rnatgani uchun tozalash (cleanup) shart emas.
import { useEffect } from "react"

const ORIGIN = "https://gohotels.uz"

const setMeta = (attr: "name" | "property", key: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

export function useSeo(opts: {
  title: string
  description?: string
  /** Kanonik yo'l ("/" yoki "/login") — to'liq URL avtomatik yasaladi */
  canonicalPath?: string
  /** Ichki (autentifikatsiyali) sahifalar indekslanmasligi uchun */
  noindex?: boolean
}) {
  const { title, description, canonicalPath, noindex } = opts
  useEffect(() => {
    document.title = title
    setMeta(
      "name",
      "robots",
      noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1"
    )
    setMeta("property", "og:title", title)
    if (description) {
      setMeta("name", "description", description)
      setMeta("property", "og:description", description)
    }
    const url = canonicalPath ? ORIGIN + canonicalPath : null
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (url) {
      if (!link) {
        link = document.createElement("link")
        link.rel = "canonical"
        document.head.appendChild(link)
      }
      link.href = url
      setMeta("property", "og:url", url)
    } else if (link) {
      link.remove()
    }
  }, [title, description, canonicalPath, noindex])
}
