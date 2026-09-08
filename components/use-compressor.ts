"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"

import {
  acceptQueuedFiles,
  buildCompressJobs,
  completedDownloads,
  compressJob,
  hasUnfinishedWork,
  intakeNotice,
  isCompressingItems,
  markJobsQueued,
  orbPlaybackState,
  partitionIncomingFiles,
  patchOutput,
  queueStatusCaption,
  runPool,
  toQueuedItems,
  type ImageItem,
} from "@/lib/compressor-model"
import { OUTPUT_FORMATS, type OutputFormat } from "@/lib/formats"

const objectUrlCache = new Map<string, string>()

function previewCacheKey(itemId: string) {
  return `preview:${itemId}`
}

function outputCacheKey(fileId: string, format: OutputFormat) {
  return `output:${fileId}:${format}`
}

function cacheObjectUrl(id: string, source: Blob) {
  const previousUrl = objectUrlCache.get(id)
  if (previousUrl) URL.revokeObjectURL(previousUrl)
  objectUrlCache.set(id, URL.createObjectURL(source))
  return objectUrlCache.get(id) ?? ""
}

function evictCachedObjectUrl(id: string) {
  const url = objectUrlCache.get(id)
  if (url) URL.revokeObjectURL(url)
  objectUrlCache.delete(id)
}

function evictAllCachedObjectUrls() {
  objectUrlCache.forEach((url) => URL.revokeObjectURL(url))
  objectUrlCache.clear()
}

export function useCompressor() {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<ImageItem[]>([])
  const [selected, setSelected] = useState<OutputFormat[]>(["webp"])
  const [dragging, setDragging] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      evictAllCachedObjectUrls()
    }
  }, [])

  const isCompressing = isCompressingItems(items)
  const canCompress =
    items.length > 0 &&
    selected.length > 0 &&
    hasUnfinishedWork(items, selected) &&
    !isCompressing
  const downloads = completedDownloads(items)
  const canDownloadAll = downloads.length > 0 && !isCompressing
  const canClearAll = items.length > 0 && !isCompressing
  const allSelected = OUTPUT_FORMATS.every((format) =>
    selected.includes(format)
  )
  const orbState = orbPlaybackState(isCompressing, items.length)
  const statusCaption = queueStatusCaption(
    isCompressing,
    items.length,
    statusMessage
  )

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const { images, skippedLarge, skippedType } = partitionIncomingFiles(list)
      const { accepted, acceptedCount } = acceptQueuedFiles(
        images,
        items.length
      )
      const additions = toQueuedItems(accepted, (file, id) =>
        cacheObjectUrl(previewCacheKey(id), file)
      )

      if (additions.length > 0) {
        setItems((current) => [...current, ...additions])
      }

      const message = intakeNotice(
        skippedLarge,
        skippedType,
        acceptedCount,
        images.length
      )
      if (message) {
        setNotice(message)
        setStatusMessage(message)
      }
    },
    [items.length]
  )

  const handleFormatsChange = useCallback((next: string[]) => {
    setSelected(OUTPUT_FORMATS.filter((format) => next.includes(format)))
  }, [])

  const clearAll = useCallback(() => {
    if (!canClearAll) {
      return
    }

    evictAllCachedObjectUrls()
    setItems([])
    setNotice(null)
    setStatusMessage("Queue cleared")
  }, [canClearAll])

  const downloadAll = useCallback(() => {
    if (!canDownloadAll) {
      return
    }

    downloads.forEach((download, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a")
        link.href = download.url
        link.download = download.name
        link.click()
      }, index * 80)
    })

    setStatusMessage("Downloading")
  }, [canDownloadAll, downloads])

  const handleCompress = useCallback(async () => {
    if (!canCompress) {
      return
    }

    const jobs = buildCompressJobs(items, selected)
    if (jobs.length === 0) {
      return
    }

    for (const job of jobs) {
      evictCachedObjectUrl(outputCacheKey(job.fileId, job.format))
    }

    setNotice(null)
    setStatusMessage("Compressing")
    setItems(markJobsQueued(items, jobs))

    let failed = 0

    await runPool(jobs, 2, async (job) => {
      setItems((current) =>
        patchOutput(current, job.fileId, job.format, { status: "compressing" })
      )

      try {
        const result = await compressJob(job)
        const blobUrl = cacheObjectUrl(
          outputCacheKey(job.fileId, job.format),
          result.blob
        )
        setItems((current) =>
          patchOutput(current, job.fileId, job.format, {
            status: "done",
            blobUrl,
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            error: undefined,
          })
        )
      } catch (error) {
        failed += 1
        setItems((current) =>
          patchOutput(current, job.fileId, job.format, {
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Unable to compress this image",
          })
        )
      }
    })

    if (failed > 0) {
      const message = `Finished with ${failed} failed`
      setNotice(message)
      setStatusMessage(message)
      return
    }

    setStatusMessage("Finished")
  }, [canCompress, items, selected])

  return {
    inputId,
    inputRef,
    items,
    selected,
    dragging,
    setDragging,
    notice,
    statusMessage,
    statusCaption,
    orbState,
    isCompressing,
    canCompress,
    canDownloadAll,
    canClearAll,
    allSelected,
    addFiles,
    handleFormatsChange,
    clearAll,
    downloadAll,
    handleCompress,
    setSelected,
  }
}
