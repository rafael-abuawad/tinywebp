"use client"

import { CompressorDropZone } from "@/components/compressor-drop-zone"
import { CompressorOrb } from "@/components/compressor-orb"
import { CompressorQueue } from "@/components/compressor-queue"
import { CompressorToolbar } from "@/components/compressor-toolbar"
import { useCompressor } from "@/components/use-compressor"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { OUTPUT_FORMATS } from "@/lib/formats"

export function Compressor() {
  const compressor = useCompressor()
  const noticeFailed = compressor.notice?.includes("failed") ?? false

  return (
    <div
      className="min-h-svh bg-background"
      onDragEnter={(event) => {
        event.preventDefault()
        compressor.setDragging(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          compressor.setDragging(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        compressor.setDragging(false)
        compressor.addFiles(event.dataTransfer.files)
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
          <CompressorOrb
            state={compressor.orbState}
            caption={compressor.statusCaption}
          />

          <div className="flex min-w-0 flex-col gap-4">
            {compressor.notice ? (
              <Alert variant={noticeFailed ? "destructive" : "default"}>
                <AlertTitle>
                  {noticeFailed ? "Compression failed" : "Notice"}
                </AlertTitle>
                <AlertDescription>{compressor.notice}</AlertDescription>
              </Alert>
            ) : null}

            <CompressorDropZone
              inputId={compressor.inputId}
              inputRef={compressor.inputRef}
              itemCount={compressor.items.length}
              dragging={compressor.dragging}
              onFiles={compressor.addFiles}
            />

            <CompressorToolbar
              selected={compressor.selected}
              busy={compressor.isCompressing}
              allSelected={compressor.allSelected}
              compressEnabled={compressor.canCompress}
              downloadEnabled={compressor.canDownloadAll}
              clearEnabled={compressor.canClearAll}
              onFormatsChange={compressor.handleFormatsChange}
              onSelectAll={() => compressor.setSelected([...OUTPUT_FORMATS])}
              onCompress={() => {
                void compressor.handleCompress()
              }}
              onDownloadAll={compressor.downloadAll}
              onClearAll={compressor.clearAll}
            />

            <CompressorQueue
              items={compressor.items}
              selected={compressor.selected}
            />
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {compressor.statusMessage}
        </p>
      </div>
    </div>
  )
}
