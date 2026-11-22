import { useLayoutEffect, useState } from "react"

/** Elementning joriy kengligi (px). `ref` — callback: element keyinroq paydo
 *  bo'lsa ham (masalan, yuklanish holatidan keyin) kuzatuv o'shanda boshlanadi.
 *  Birinchi o'lchov chizishdan OLDIN — sahifa noto'g'ri joylashuvda "sakramaydi". */
export function useElementWidth<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    if (!node) return
    setWidth(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w !== undefined) setWidth(w)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [node])

  return [setNode, width] as const
}
