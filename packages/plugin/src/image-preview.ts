import type { Plugin } from "./index"

// Bun globals - available at runtime when loaded by opencode
declare const Bun: {
  env: { TMPDIR?: string }
  write(path: string, data: ArrayBuffer): Promise<number>
  spawn(options: { cmd: string[]; stdout: "ignore"; stderr: "ignore" }): void
}

/**
 * Plugin that handles image preview when user cmd+clicks or double-clicks
 * on an image annotation in the prompt input.
 *
 * When triggered, this plugin:
 * 1. Extracts the base64 image data from the data URL
 * 2. Writes it to a temporary file
 * 3. Opens it with the system's default image viewer
 */
export const ImagePreviewPlugin: Plugin = async () => {
  return {
    event: async ({ event }) => {
      // Handle tui.image.click event (type not in SDK yet, so cast)
      const evt = event as { type: string; properties?: Record<string, unknown> }
      if (evt.type !== "tui.image.click") return

      const props = evt.properties as {
        url: string
        mime: string
        filename?: string
      }
      if (!props?.url || !props?.mime) return

      const match = props.url.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) return

      const ext = props.mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png"
      const name = props.filename?.replace(/\.[^.]+$/, "") ?? "preview"
      const tmpPath = `${Bun.env.TMPDIR ?? "/tmp"}/${name}-${Date.now()}.${ext}`

      let data: Uint8Array
      try {
        data = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0))
      } catch {
        return
      }
      await Bun.write(tmpPath, data.buffer)

      const platform = globalThis.process?.platform ?? "linux"
      const cmd =
        platform === "darwin"
          ? ["open", tmpPath]
          : platform === "win32"
            ? ["start", "", tmpPath]
            : ["xdg-open", tmpPath]

      Bun.spawn({ cmd, stdout: "ignore", stderr: "ignore" })
    },
  }
}
