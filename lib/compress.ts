import sharp from "sharp"

import type { OutputFormat } from "@/lib/formats"

export async function compressImage(buffer: Buffer, format: OutputFormat) {
  const pipeline = sharp(buffer, { failOn: "none", animated: false }).rotate()

  switch (format) {
    case "webp":
      return pipeline.webp({ quality: 80 }).toBuffer()
    case "jpeg":
      return pipeline
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer()
    case "png":
      return pipeline
        .png({ quality: 80, compressionLevel: 9, palette: true })
        .toBuffer()
    case "avif":
      return pipeline.avif({ quality: 50 }).toBuffer()
  }
}
