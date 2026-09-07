"use client"

import dynamic from "next/dynamic"
import { ImageIcon } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
  loading: () => <div className="size-[180px] lg:size-[270px]" aria-hidden />,
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

type QueueRow = {
  key: string
  item: ImageItem
  format: OutputFormat | null
  output?: OutputJob
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

function queueRows(items: ImageItem[], selected: OutputFormat[]): QueueRow[] {
  return items.flatMap((item): QueueRow[] => {
    const formats = OUTPUT_FORMATS.filter(
      (format) =>
        selected.includes(format) ||
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

export function Compressor() {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef(new Set<string>())
  const itemsRef = useRef<ImageItem[]>([])
  const [items, setItems] = useState<ImageItem[]>([])
  const [selected, setSelected] = useState<OutputFormat[]>(["webp"])
  const [dragging, setDragging] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [notice, setNotice] = useState<string | null>(null)

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

  const completedDownloads = items.flatMap((item) =>
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

  const canDownloadAll = completedDownloads.length > 0 && !isCompressing
  const canClearAll = items.length > 0 && !isCompressing
  const allSelected = OUTPUT_FORMATS.every((format) => selected.includes(format))
  const orbState = isCompressing
    ? "speaking"
    : items.length > 0
      ? "thinking"
      : "idle"
  const statusCaption = isCompressing
    ? "Compressing"
    : items.length === 0
      ? "Ready"
      : statusMessage.startsWith("Finished")
        ? statusMessage
        : `${items.length} ready`

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
        setNotice("Skipped files over 25 MB")
        setStatusMessage("Skipped files over 25 MB")
      } else if (skippedType > 0) {
        setNotice("Skipped files that are not images")
        setStatusMessage("Skipped files that are not images")
      } else if (accepted.length < images.length) {
        setNotice(`Only ${MAX_FILES} images can be queued`)
        setStatusMessage(`Only ${MAX_FILES} images can be queued`)
      }
    },
    [trackUrl]
  )

  function handleFormatsChange(next: string[]) {
    setSelected(OUTPUT_FORMATS.filter((format) => next.includes(format)))
  }

  function clearAll() {
    if (!canClearAll) {
      return
    }

    for (const url of urlsRef.current) {
      URL.revokeObjectURL(url)
    }
    urlsRef.current.clear()
    setItems([])
    setNotice(null)
    setStatusMessage("Queue cleared")
  }

  function downloadAll() {
    if (!canDownloadAll) {
      return
    }

    completedDownloads.forEach((download, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a")
        link.href = download.url
        link.download = download.name
        link.click()
      }, index * 80)
    })

    setStatusMessage("Downloading")
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

    setNotice(null)
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

    if (failed > 0) {
      const message = `Finished with ${failed} failed`
      setNotice(message)
      setStatusMessage(message)
    } else {
      setStatusMessage("Finished")
    }
  }

  return (
    <div
      className="min-h-svh bg-background"
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
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-8 lg:px-6">
        <header className="space-y-1">
          <h1 className="text-lg font-medium tracking-tight">tinywebp</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Images stay on this machine.
          </p>
        </header>

        <div className="mt-8 grid flex-1 gap-8 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,1fr)] lg:items-start">
          <aside className="flex flex-col items-center gap-3 lg:sticky lg:top-8">
            <div className="relative flex items-center justify-center">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-6 rounded-full bg-foreground/8 blur-3xl"
              />
              <Shdr02
                size={250}
                state={orbState}
                wrapper="grid"
                className="text-foreground"
                ariaLabel={statusCaption}
                statePresets={{
                  idle: {
                    bulge: 0,
                  },
                  thinking: {
                    bulge: 0,
                  },
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">{statusCaption}</p>
          </aside>

          <div className="flex min-w-0 flex-col gap-4">
            {notice ? (
              <Alert
                variant={notice.includes("failed") ? "destructive" : "default"}
              >
                <AlertTitle>
                  {notice.includes("failed") ? "Compression failed" : "Notice"}
                </AlertTitle>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}

            <Card
              className={cn(
                "transition-[box-shadow]",
                dragging && "ring-2 ring-ring"
              )}
            >
              <CardContent>
                <input
                  ref={inputRef}
                  id={inputId}
                  type="file"
                  accept={INPUT_ACCEPT}
                  multiple
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                  onChange={(event) => {
                    if (event.target.files) {
                      addFiles(event.target.files)
                      event.target.value = ""
                    }
                  }}
                />
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ImageIcon />
                    </EmptyMedia>
                    <EmptyTitle>
                      {items.length > 0 ? "Add more images" : "Drop images"}
                    </EmptyTitle>
                    <EmptyDescription>
                      PNG, JPEG, WebP, AVIF, and GIF up to 25 MB.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => inputRef.current?.click()}
                    >
                      Choose files
                    </Button>
                  </EmptyContent>
                </Empty>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <ToggleGroup
                  multiple
                  value={selected}
                  onValueChange={handleFormatsChange}
                  disabled={isCompressing}
                  variant="outline"
                  spacing={0}
                  className="flex-wrap"
                >
                  {OUTPUT_FORMATS.map((format) => (
                    <ToggleGroupItem key={format} value={format}>
                      {FORMAT_META[format].label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={isCompressing || allSelected}
                  onClick={() => setSelected([...OUTPUT_FORMATS])}
                >
                  Select all
                </Button>

                <Separator
                  orientation="vertical"
                  className="hidden h-6 sm:block"
                />

                <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
                  <Button
                    type="button"
                    disabled={!canCompress}
                    onClick={() => {
                      void handleCompress()
                    }}
                  >
                    Compress
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canDownloadAll}
                    onClick={downloadAll}
                  >
                    Download all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!canClearAll}
                    onClick={clearAll}
                  >
                    Clear all
                  </Button>
                </div>
              </CardContent>
            </Card>

            {items.length > 0 ? (
              <Card className="py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Preview</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Original</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead className="text-end">Download</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueRows(items, selected).map((row) => {
                      const output = row.output
                      const status = output?.status ?? "waiting"

                      return (
                        <TableRow key={row.key}>
                          <TableCell>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={row.item.previewUrl}
                              alt=""
                              className="size-10 rounded-md object-cover outline outline-1 outline-black/10 dark:outline-white/10"
                            />
                          </TableCell>
                          <TableCell className="max-w-48 truncate font-medium">
                            {row.item.file.name}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {formatBytes(row.item.file.size)}
                          </TableCell>
                          <TableCell>
                            {row.format ? (
                              <Badge variant="outline">
                                {FORMAT_META[row.format].label}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {status === "compressing" ? (
                              <Progress
                                value={null}
                                className="w-24 gap-1.5"
                              >
                                <span className="text-xs text-muted-foreground">
                                  Compressing
                                </span>
                              </Progress>
                            ) : status === "error" ? (
                              <Badge variant="destructive">
                                {output?.error ?? "Unable to compress"}
                              </Badge>
                            ) : status === "done" ? (
                              <Badge variant="secondary">Done</Badge>
                            ) : status === "queued" ? (
                              <Badge variant="outline">Queued</Badge>
                            ) : (
                              <Badge variant="outline">Waiting</Badge>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {status === "done" &&
                            output?.compressedSize != null ? (
                              <span>
                                {formatBytes(output.compressedSize)}{" "}
                                <span className="text-foreground">
                                  {savingsLabel(
                                    output.originalSize,
                                    output.compressedSize
                                  )}
                                </span>
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-end">
                            {status === "done" &&
                            output?.blobUrl &&
                            row.format ? (
                              <Button
                                variant="outline"
                                size="sm"
                                nativeButton={false}
                                render={
                                  <a
                                    href={output.blobUrl}
                                    download={outputFileName(
                                      row.item.file.name,
                                      row.format
                                    )}
                                  />
                                }
                              >
                                Download
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            ) : null}
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {statusMessage}
        </p>
      </div>
    </div>
  )
}
