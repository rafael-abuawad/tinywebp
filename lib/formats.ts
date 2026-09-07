export const OUTPUT_FORMATS = ["avif", "webp", "jpeg", "png"] as const

export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export const FORMAT_META: Record<
  OutputFormat,
  { label: string; mime: string; ext: string }
> = {
  avif: { label: "AVIF", mime: "image/avif", ext: "avif" },
  webp: { label: "WEBP", mime: "image/webp", ext: "webp" },
  jpeg: { label: "JPEG", mime: "image/jpeg", ext: "jpg" },
  png: { label: "PNG", mime: "image/png", ext: "png" },
}

export const MAX_FILES = 20
export const MAX_FILE_BYTES = 25 * 1024 * 1024

export const INPUT_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/tiff",
  "image/heic",
  "image/heif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
].join(",")

const INPUT_EXT = /\.(jpe?g|png|webp|gif|avif|tiff?|heic|heif)$/i

export function isOutputFormat(value: string): value is OutputFormat {
  return (OUTPUT_FORMATS as readonly string[]).includes(value)
}

export function isImageFile(file: File) {
  if (file.type.startsWith("image/")) {
    return true
  }

  return INPUT_EXT.test(file.name)
}

export function outputFileName(originalName: string, format: OutputFormat) {
  const base = originalName.replace(/\.[^.]+$/, "").trim() || "image"
  return `${base}.${FORMAT_META[format].ext}`
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function savingsLabel(original: number, compressed: number) {
  if (original <= 0) {
    return "—"
  }

  const ratio = 1 - compressed / original
  const percent = Math.round(Math.abs(ratio) * 100)

  if (ratio >= 0) {
    return `−${percent}%`
  }

  return `+${percent}%`
}
