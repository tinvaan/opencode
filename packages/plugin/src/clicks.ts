import type { Event } from "@opencode-ai/sdk"
import type { Plugin } from "./index"

type ClickEvent = {
  type: "tui.part.click"
  properties: { part: Record<string, unknown> }
}

function open(path: string) {
  const platform = globalThis.process?.platform ?? "linux"
  const cmd = platform === "darwin" ? ["open", path] : platform === "win32" ? ["start", "", path] : ["xdg-open", path]
  Bun.spawn({ cmd, stdout: "ignore", stderr: "ignore" })
}

/**
 * Plugin that opens file attachments when clicked in the prompt input.
 *
 * Handles two cases:
 * 1. @-mentioned files: Opens the file directly from its path
 * 2. Pasted/attached files: Extracts base64 data, writes to temp file, opens it
 */
export const ClickPreview: Plugin = async () => {
  return {
    event: async ({ event }) => {
      const evt = event as Event | ClickEvent
      if (evt.type !== "tui.part.click") return

      const part = evt.properties.part
      if (!part || part.type !== "file") return

      const url = part.url as string | undefined
      if (!url) return

      // Handle file:// URLs (@-mentioned files)
      if (url.startsWith("file://")) {
        const path = decodeURIComponent(url.slice(7))
        open(path)
        return
      }

      // Handle data URLs (pasted/attached files)
      const match = url.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) return

      const filename = part.filename as string | undefined
      const mime = part.mime as string | undefined
      const ext =
        filename?.match(/\.([^.]+)$/)?.[1] ?? mime?.split("/")[1]?.replace("+xml", "").replace("jpeg", "jpg") ?? "bin"
      const name = filename?.replace(/\.[^.]+$/, "") ?? "preview"
      const tmpPath = `${Bun.env.TMPDIR ?? "/tmp"}/${name}-${Date.now()}.${ext}`

      let data: Uint8Array
      try {
        data = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0))
      } catch (err) {
        console.error("Failed to decode base64 data:", err)
        return
      }
      await Bun.write(tmpPath, data.buffer)
      open(tmpPath)
    },
  }
}
