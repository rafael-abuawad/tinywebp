"use client"

import dynamic from "next/dynamic"
import { Check } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  FORMAT_META,
  INPUT_ACCEPT,
  MAX_FILE_BYTES,
  MAX_FILES,
  OUTPUT_FORMATS,
  formatBytes,
  isImageFile,
  outputFileName,
  savingsLabel,
  type OutputFormat,
} from "@/lib/formats"
import { cn } from "@/lib/utils"

const Shdr02 = dynamic(() => import("@/components/ui/shdr-02"), {
  ssr: false,
  loading: () => <div className="size-[270px]" aria-hidden />,
})

type OutputJob = {
  format: OutputFormat
  status: "queued" | "compressing" | "done" | "error"
  originalSize: number
  compressedSize?: number
  blobUrl?: string
  error?: string
}

type ImageItem = {
  id: string
  file: File
  previewUrl: string
  outputs: OutputJob[]
}

type CompressJob = {
  fileId: string
  file: File
  format: OutputFormat
}

async function runPool<T>(
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

function patchOutput(
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

export function Compressor() {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef(new Set<string>())
  const itemsRef = useRef<ImageItem[]>([])
  const [items, setItems] = useState<ImageItem[]>([])
  const [selected, setSelected] = useState<OutputFormat[]>(["webp"])
  const [dragging, setDragging] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  itemsRef.current = items

  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  const trackUrl = useCallback((url: string) => {
    urlsRef.current.add(url)
  }, [])

  const isCompressing = items.some((item) =>
    item.outputs.some((output) => output.status === "compressing")
  )

  const hasWork = items.some((item) =>
    selected.some((format) => {
      const output = item.outputs.find((entry) => entry.format === format)
      return !output || output.status === "error"
    })
  )

  const canCompress =
    items.length > 0 && selected.length > 0 && hasWork && !isCompressing

  const allSelected = OUTPUT_FORMATS.every((format) => selected.includes(format))

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list)
      const images: File[] = []
      let skippedLarge = 0
      let skippedType = 0

      for (const file of incoming) {
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

      const room = Math.max(0, MAX_FILES - itemsRef.current.length)
      const accepted = images.slice(0, room)
      const additions = accepted.map((file) => {
        const previewUrl = URL.createObjectURL(file)
        trackUrl(previewUrl)
        return {
          id: crypto.randomUUID(),
          file,
          previewUrl,
          outputs: [],
        }
      })

      if (additions.length > 0) {
        setItems((current) => [...current, ...additions])
      }

      if (skippedLarge > 0) {
        setStatusMessage("Skipped files over 25 MB")
      } else if (skippedType > 0) {
        setStatusMessage("Skipped files that are not images")
      }
    },
    [trackUrl]
  )

  function toggleFormat(format: OutputFormat) {
    setSelected((current) => {
      if (current.includes(format)) {
        return current.filter((entry) => entry !== format)
      }

      return OUTPUT_FORMATS.filter(
        (entry) => current.includes(entry) || entry === format
      )
    })
  }

  async function handleCompress() {
    if (!canCompress) {
      return
    }

    const jobs: CompressJob[] = items.flatMap((item) =>
      selected
        .filter((format) => {
          const output = item.outputs.find((entry) => entry.format === format)
          return !output || output.status === "error"
        })
        .map((format) => ({
          fileId: item.id,
          file: item.file,
          format,
        }))
    )

    if (jobs.length === 0) {
      return
    }

    setStatusMessage("Compressing")
    setItems((current) =>
      current.map((item) => {
        const formatsForItem = jobs
          .filter((job) => job.fileId === item.id)
          .map((job) => job.format)

        if (formatsForItem.length === 0) {
          return item
        }

        const outputs = [...item.outputs]

        for (const format of formatsForItem) {
          const index = outputs.findIndex((output) => output.format === format)
          const next: OutputJob = {
            format,
            status: "queued",
            originalSize: item.file.size,
          }

          if (index === -1) {
            outputs.push(next)
          } else {
            const previous = outputs[index]
            if (previous?.blobUrl) {
              URL.revokeObjectURL(previous.blobUrl)
              urlsRef.current.delete(previous.blobUrl)
            }
            outputs[index] = next
          }
        }

        return { ...item, outputs }
      })
    )

    let failed = 0

    await runPool(jobs, 2, async (job) => {
      setItems((current) =>
        patchOutput(current, job.fileId, job.format, { status: "compressing" })
      )

      const body = new FormData()
      body.append("file", job.file)
      body.append("format", job.format)

      try {
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
        const blobUrl = URL.createObjectURL(blob)
        trackUrl(blobUrl)

        const originalSize = Number(
          response.headers.get("X-Original-Size") ?? job.file.size
        )
        const compressedSize = Number(
          response.headers.get("X-Compressed-Size") ?? blob.size
        )

        setItems((current) =>
          patchOutput(current, job.fileId, job.format, {
            status: "done",
            blobUrl,
            originalSize,
            compressedSize,
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

    setStatusMessage(
      failed > 0 ? `Finished with ${failed} failed` : "Finished"
    )
  }

  return (
    <div className="relative min-h-svh overflow-x-hidden text-neutral-800">
      <div className="scene pointer-events-none absolute inset-0" />
      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[44rem] flex-col items-center px-4 pt-[max(3rem,10vh)] pb-16">
        <div className="w-full overflow-hidden rounded-[1.75rem] shadow-[0_24px_60px_oklch(0.2_0.03_140/0.35)]">
          <div
            className={cn(
              "bg-black/30 p-3 backdrop-blur-[2px] transition-colors",
              dragging && "bg-black/45"
            )}
          >
            <div
              className={cn(
                "relative min-h-[22rem] rounded-2xl border-2 border-dashed border-white/85 text-white transition-[border-color,background-color]",
                dragging && "border-white bg-white/5"
              )}
              onDragEnter={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDragging(false)
                }
              }}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                addFiles(event.dataTransfer.files)
              }}
            >
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept={INPUT_ACCEPT}
                multiple
                aria-label="Drop images"
                className="absolute inset-0 z-10 cursor-pointer opacity-0"
                onChange={(event) => {
                  if (event.target.files) {
                    addFiles(event.target.files)
                    event.target.value = ""
                  }
                }}
              />
              <div className="pointer-events-none flex min-h-[22rem] flex-col items-center justify-center px-6 py-10 text-center">
                <Shdr02
                  size={270}
                  state={isCompressing ? "speaking" : "idle"}
                  wrapper="glass"
                  className="text-white"
                  ariaLabel={isCompressing ? "Compressing" : "Ready"}
                />
                <p className="mt-5 text-xl font-semibold tracking-tight">
                  Drop images
                </p>
                {items.length > 0 ? (
                  <p className="mt-1 text-sm text-white/80">
                    {items.length} ready
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center bg-white px-5 py-3.5">
            <Button
              type="button"
              className="h-9 rounded-full bg-[oklch(0.72_0.17_135)] px-5 text-white hover:bg-[oklch(0.66_0.17_135)]"
              disabled={!canCompress}
              onClick={() => {
                void handleCompress()
              }}
            >
              Compress
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-[oklch(0.96_0.02_145)] px-5 py-3.5">
            {OUTPUT_FORMATS.map((format) => {
              const active = selected.includes(format)

              return (
                <button
                  key={format}
                  type="button"
                  aria-pressed={active}
                  disabled={isCompressing}
                  onClick={() => toggleFormat(format)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3.5 text-sm font-medium tracking-wide transition-[color,border-color,background-color,transform] outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.72_0.17_135)] focus-visible:ring-offset-2 active:scale-[0.96] disabled:opacity-50",
                    active
                      ? "border-[oklch(0.72_0.17_135)] text-[oklch(0.48_0.13_135)]"
                      : "border-neutral-300 text-neutral-600 hover:border-neutral-400"
                  )}
                >
                  {active ? (
                    <Check className="size-3.5" strokeWidth={2.25} />
                  ) : null}
                  {FORMAT_META[format].label}
                </button>
              )
            })}

            <div
              aria-hidden
              className="mx-1 hidden h-6 w-px bg-neutral-300 sm:block"
            />

            <button
              type="button"
              disabled={isCompressing || allSelected}
              onClick={() => setSelected([...OUTPUT_FORMATS])}
              className={cn(
                "inline-flex h-9 items-center rounded-full border bg-white px-3.5 text-sm font-medium tracking-wide transition-[color,border-color,transform] outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.72_0.17_135)] focus-visible:ring-offset-2 active:scale-[0.96] disabled:opacity-50",
                allSelected
                  ? "border-[oklch(0.72_0.17_135)] text-[oklch(0.48_0.13_135)]"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-400"
              )}
            >
              Select all
            </button>
          </div>
        </div>

        {items.length > 0 ? (
          <ul className="mt-6 w-full overflow-hidden rounded-[1.5rem] bg-white/92 shadow-[0_18px_40px_oklch(0.2_0.03_140/0.22)] backdrop-blur-md">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={cn(
                  "px-5 py-4",
                  index > 0 && "border-t border-neutral-200/80"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="size-12 shrink-0 rounded-lg object-cover outline outline-1 outline-black/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-800">
                      {item.file.name}
                    </p>
                    <p className="text-sm text-neutral-500 tabular-nums">
                      {formatBytes(item.file.size)}
                    </p>

                    {item.outputs.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {item.outputs.map((output) => (
                          <li
                            key={output.format}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                          >
                            <span className="w-12 font-medium tracking-wide text-neutral-600">
                              {FORMAT_META[output.format].label}
                            </span>
                            {output.status === "done" &&
                            output.compressedSize != null ? (
                              <>
                                <span className="text-neutral-500 tabular-nums">
                                  {formatBytes(output.originalSize)}
                                  {" → "}
                                  {formatBytes(output.compressedSize)}
                                </span>
                                <span className="font-medium text-[oklch(0.48_0.13_135)] tabular-nums">
                                  {savingsLabel(
                                    output.originalSize,
                                    output.compressedSize
                                  )}
                                </span>
                                {output.blobUrl ? (
                                  <a
                                    href={output.blobUrl}
                                    download={outputFileName(
                                      item.file.name,
                                      output.format
                                    )}
                                    className={cn(
                                      buttonVariants({
                                        variant: "outline",
                                        size: "xs",
                                      }),
                                      "ms-auto rounded-full"
                                    )}
                                  >
                                    Download
                                  </a>
                                ) : null}
                              </>
                            ) : output.status === "error" ? (
                              <span className="text-red-600">
                                {output.error ?? "Unable to compress"}
                              </span>
                            ) : (
                              <span className="text-neutral-400">
                                {output.status === "compressing"
                                  ? "Compressing"
                                  : "Waiting"}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-neutral-400">Waiting</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {statusMessage}
        </p>
      </div>
    </div>
  )
}
