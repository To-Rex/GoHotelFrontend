import { describe, expect, it } from "vitest"

import { chunkRanges, uploadAppInChunks } from "./appUpload"

/* Dasturlar do'koniga bo'laklab yuklash: fayl bo'laklarga bo'linadi, har
   bo'lak alohida so'rov, xato bo'lsa qayta uriniladi, oxirida yig'iladi. */

interface Call {
  method: string
  url: string
  size?: number
}

function fakeClient(opts: { failPutOnce?: string; failPutAlways?: string } = {}) {
  const calls: Call[] = []
  const failed = new Set<string>()
  return {
    calls,
    post: async (url: string, body?: unknown) => {
      calls.push({ method: "post", url })
      if (url === "/apps/uploads") {
        const { size } = body as { size: number }
        return { data: { upload_id: "u1", chunk_size: 4096, total_chunks: Math.ceil(size / 4096) } }
      }
      return { data: { id: "r1", file_size: 10000 } }
    },
    put: async (url: string, body: Blob) => {
      calls.push({ method: "put", url, size: body.size })
      if (opts.failPutAlways === url) throw new Error("tarmoq uzildi")
      if (opts.failPutOnce === url && !failed.has(url)) {
        failed.add(url)
        throw new Error("tarmoq uzildi")
      }
      return { data: {} }
    },
    delete: async (url: string) => {
      calls.push({ method: "delete", url })
      return { data: {} }
    },
  }
}

const file = new File([new Uint8Array(10_000)], "staff.apk")
const payload = { platform: "ANDROID", name: "Staff", version: " 1.0.3 ", notes: "", file }
const noSleep = async () => {}

describe("chunkRanges", () => {
  it("fayl bo'laklarga teng bo'linadi, oxirgisi qisqa", () => {
    expect(chunkRanges(10_000, 4096)).toEqual([
      [0, 4096],
      [4096, 8192],
      [8192, 10_000],
    ])
    expect(chunkRanges(4096, 4096)).toEqual([[0, 4096]])
    expect(chunkRanges(0, 4096)).toEqual([])
  })
})

describe("uploadAppInChunks", () => {
  it("sessiya → bo'laklar → yakun; jarayon foizda", async () => {
    const client = fakeClient()
    const progress: number[] = []
    const result = await uploadAppInChunks(client as never, payload, {
      onProgress: (p) => progress.push(p),
      sleep: noSleep,
    })
    expect(result).toEqual({ id: "r1", file_size: 10000 })
    expect(client.calls.map((c) => `${c.method} ${c.url}${c.size ? " " + c.size : ""}`)).toEqual([
      "post /apps/uploads",
      "put /apps/uploads/u1/chunks/0 4096",
      "put /apps/uploads/u1/chunks/1 4096",
      "put /apps/uploads/u1/chunks/2 1808",
      "post /apps/uploads/u1/complete",
    ])
    expect(progress).toEqual([0, 33, 67, 100])
  })

  it("xato bergan bo'lak qayta yuboriladi", async () => {
    const client = fakeClient({ failPutOnce: "/apps/uploads/u1/chunks/1" })
    await uploadAppInChunks(client as never, payload, { sleep: noSleep })
    const puts = client.calls.filter((c) => c.method === "put").map((c) => c.url)
    expect(puts).toEqual([
      "/apps/uploads/u1/chunks/0",
      "/apps/uploads/u1/chunks/1",
      "/apps/uploads/u1/chunks/1",
      "/apps/uploads/u1/chunks/2",
    ])
    expect(client.calls.some((c) => c.method === "delete")).toBe(false)
  })

  it("urinishlar tugasa — xato, chala yuklash serverdan o'chiriladi", async () => {
    const client = fakeClient({ failPutAlways: "/apps/uploads/u1/chunks/1" })
    await expect(
      uploadAppInChunks(client as never, payload, { sleep: noSleep, retries: 2 })
    ).rejects.toThrow("tarmoq uzildi")
    const puts = client.calls.filter((c) => c.url.endsWith("/chunks/1"))
    expect(puts).toHaveLength(2)
    expect(client.calls.at(-1)).toEqual({ method: "delete", url: "/apps/uploads/u1" })
    expect(client.calls.some((c) => c.url.endsWith("/complete"))).toBe(false)
  })
})
