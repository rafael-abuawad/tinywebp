import {
  MAX_FILE_BYTES,
  MAX_FILES,
  OUTPUT_FORMATS,
  isImageFile,
  outputFileName,
  type OutputFormat,
} from "@/lib/formats"

export type OutputJob = {
  format: OutputFormat
  status: "queued" | "compressing" | "done" | "error"
  originalSize: number
  compressedSize?: number
  blobUrl?: string
  error?: string
}

export type ImageItem = {
  id: string
  file: File
  previewUrl: string
  outputs: OutputJob[]
}

export type CompressJob = {
  fileId: string
  file: File
  format: OutputFormat
}

export type QueueRow = {
  key: string
  item: ImageItem
  format: OutputFormat | null
  output?: OutputJob
}

export type CompletedDownload = {
  url: string
  name: string
}

export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  let index = 0

  async function run() {
    while (index < items.length) {
      const current = index
      index += 1
      const item = items[current]
      if (item) {
        await worker(item)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run())
  )
}

export function patchOutput(
  items: ImageItem[],
  fileId: string,
  format: OutputFormat,
  patch: Partial<OutputJob>
) {
  return items.map((item) => {
    if (item.id !== fileId) {
      return item
    }

    return {
      ...item,
      outputs: item.outputs.map((output) =>
        output.format === format ? { ...output, ...patch } : output
      ),
    }
  })
}

export function queueRows(
  items: ImageItem[],
  selected: OutputFormat[]
): QueueRow[] {
  const selectedFormats = new Set(selected)

  return items.flatMap((item): QueueRow[] => {
    const formats = OUTPUT_FORMATS.filter(
      (format) =>
        selectedFormats.has(format) ||
        item.outputs.some((output) => output.format === format)
    )

    if (formats.length === 0) {
      return [{ key: item.id, item, format: null, output: undefined }]
    }

    return formats.map((format) => ({
      key: `${item.id}-${format}`,
      item,
      format,
      output: item.outputs.find((entry) => entry.format === format),
    }))
  })
}

export function isCompressingItems(items: ImageItem[]) {
  return items.some((item) =>
    item.outputs.some((output) => output.status === "compressing")
  )
}

export function hasUnfinishedWork(
  items: ImageItem[],
  selected: OutputFormat[]
) {
  return items.some((item) =>
    selected.some((format) => {
      const output = item.outputs.find((entry) => entry.format === format)
      return !output || output.status === "error"
    })
  )
}

export function completedDownloads(items: ImageItem[]): CompletedDownload[] {
  return items.flatMap((item) =>
    item.outputs.flatMap((output) =>
      output.status === "done" && output.blobUrl
        ? [
            {
              url: output.blobUrl,
              name: outputFileName(item.file.name, output.format),
            },
          ]
        : []
    )
  )
}

export function orbPlaybackState(isCompressing: boolean, itemCount: number) {
  if (isCompressing) {
    return "speaking" as const
  }

  if (itemCount > 0) {
    return "thinking" as const
  }

  return "idle" as const
}

export function queueStatusCaption(
  isCompressing: boolean,
  itemCount: number,
  statusMessage: string
) {
  if (isCompressing) {
    return "Compressing"
  }

  if (itemCount === 0) {
    return "Ready"
  }

  if (statusMessage.startsWith("Finished")) {
    return statusMessage
  }

  return `${itemCount} ready`
}

export function partitionIncomingFiles(list: FileList | File[]) {
  const images: File[] = []
  let skippedLarge = 0
  let skippedType = 0

  for (const file of Array.from(list)) {
    if (!isImageFile(file)) {
      skippedType += 1
      continue
    }
    if (file.size > MAX_FILE_BYTES) {
      skippedLarge += 1
      continue
    }
    images.push(file)
  }

  return { images, skippedLarge, skippedType }
}

export function intakeNotice(
  skippedLarge: number,
  skippedType: number,
  acceptedCount: number,
  imageCount: number
) {
  if (skippedLarge > 0) {
    return "Skipped files over 25 MB"
  }

  if (skippedType > 0) {
    return "Skipped files that are not images"
  }

  if (acceptedCount < imageCount) {
    return `Only ${MAX_FILES} images can be queued`
  }

  return null
}

export function acceptQueuedFiles(images: File[], currentCount: number) {
  const room = Math.max(0, MAX_FILES - currentCount)
  const accepted = images.slice(0, room)
  return { accepted, acceptedCount: accepted.length }
}

export function toQueuedItems(
  accepted: File[],
  createPreviewUrl: (file: File, id: string) => string
) {
  return accepted.map((file) => {
    const id = crypto.randomUUID()
    return {
      id,
      file,
      previewUrl: createPreviewUrl(file, id),
      outputs: [],
    } satisfies ImageItem
  })
}

export function buildCompressJobs(
  items: ImageItem[],
  selected: OutputFormat[]
): CompressJob[] {
  const jobs: CompressJob[] = []

  for (const item of items) {
    for (const format of selected) {
      const output = item.outputs.find((entry) => entry.format === format)
      if (!output || output.status === "error") {
        jobs.push({
          fileId: item.id,
          file: item.file,
          format,
        })
      }
    }
  }

  return jobs
}

export function queueFormatsForItem(jobs: CompressJob[], fileId: string) {
  const formats: OutputFormat[] = []

  for (const job of jobs) {
    if (job.fileId === fileId) {
      formats.push(job.format)
    }
  }

  return formats
}

export function markJobsQueued(items: ImageItem[], jobs: CompressJob[]) {
  return items.map((item) => {
    const formatsForItem = queueFormatsForItem(jobs, item.id)

    if (formatsForItem.length === 0) {
      return item
    }

    const outputs = [...item.outputs]

    for (const format of formatsForItem) {
      const index = outputs.findIndex((output) => output.format === format)
      const queued: OutputJob = {
        format,
        status: "queued",
        originalSize: item.file.size,
      }

      if (index === -1) {
        outputs.push(queued)
      } else {
        outputs[index] = queued
      }
    }

    return { ...item, outputs }
  })
}

export async function compressJob(job: CompressJob) {
  const body = new FormData()
  body.append("file", job.file)
  body.append("format", job.format)

  const response = await fetch("/api/compress", {
    method: "POST",
    body,
  })

  if (!response.ok) {
    let message = "Unable to compress this image"
    const contentType = response.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) {
        message = payload.error
      }
    }
    throw new Error(message)
  }

  const blob = await response.blob()

  return {
    blob,
    originalSize: Number(
      response.headers.get("X-Original-Size") ?? job.file.size
    ),
    compressedSize: Number(
      response.headers.get("X-Compressed-Size") ?? blob.size
    ),
  }
}
