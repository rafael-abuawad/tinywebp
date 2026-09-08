import { NextResponse } from "next/server"

import { compressImage } from "@/lib/compress"
import { FORMAT_META, MAX_FILE_BYTES, isOutputFormat } from "@/lib/formats"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get("file")
  const formatValue = form.get("format")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  if (typeof formatValue !== "string" || !isOutputFormat(formatValue)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    console.warn("compress.reject_size", {
      name: file.name,
      bytes: file.size,
      format: formatValue,
    })
    return NextResponse.json({ error: "File too large" }, { status: 413 })
  }

  const originalSize = file.size
  const input = Buffer.from(await file.arrayBuffer())

  console.info("compress.start", {
    name: file.name,
    bytes: originalSize,
    format: formatValue,
  })

  try {
    const output = await compressImage(input, formatValue)
    const compressedSize = output.byteLength

    console.info("compress.done", {
      name: file.name,
      format: formatValue,
      originalSize,
      compressedSize,
      ratio:
        originalSize > 0
          ? Number((compressedSize / originalSize).toFixed(3))
          : null,
    })

    const body = Uint8Array.from(output)

    return new NextResponse(body, {
      headers: {
        "Content-Type": FORMAT_META[formatValue].mime,
        "Content-Length": String(compressedSize),
        "X-Original-Size": String(originalSize),
        "X-Compressed-Size": String(compressedSize),
      },
    })
  } catch (error) {
    console.error("compress.fail", {
      name: file.name,
      format: formatValue,
      message: error instanceof Error ? error.message : "Unknown error",
    })

    return NextResponse.json(
      { error: "Unable to compress this image" },
      { status: 422 }
    )
  }
}
