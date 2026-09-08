"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { FORMAT_META, OUTPUT_FORMATS, type OutputFormat } from "@/lib/formats"

function FormatPicker({
  selected,
  busy,
  allSelected,
  onFormatsChange,
  onSelectAll,
}: {
  selected: OutputFormat[]
  busy: boolean
  allSelected: boolean
  onFormatsChange: (next: string[]) => void
  onSelectAll: () => void
}) {
  return (
    <>
      <ToggleGroup
        multiple
        value={selected}
        onValueChange={onFormatsChange}
        disabled={busy}
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
        disabled={busy || allSelected}
        onClick={onSelectAll}
      >
        Select all
      </Button>
    </>
  )
}

function QueueActions({
  compressEnabled,
  downloadEnabled,
  clearEnabled,
  onCompress,
  onDownloadAll,
  onClearAll,
}: {
  compressEnabled: boolean
  downloadEnabled: boolean
  clearEnabled: boolean
  onCompress: () => void
  onDownloadAll: () => void
  onClearAll: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
      <Button type="button" disabled={!compressEnabled} onClick={onCompress}>
        Compress
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={!downloadEnabled}
        onClick={onDownloadAll}
      >
        Download all
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={!clearEnabled}
        onClick={onClearAll}
      >
        Clear all
      </Button>
    </div>
  )
}

export function CompressorToolbar({
  selected,
  busy,
  allSelected,
  compressEnabled,
  downloadEnabled,
  clearEnabled,
  onFormatsChange,
  onSelectAll,
  onCompress,
  onDownloadAll,
  onClearAll,
}: {
  selected: OutputFormat[]
  busy: boolean
  allSelected: boolean
  compressEnabled: boolean
  downloadEnabled: boolean
  clearEnabled: boolean
  onFormatsChange: (next: string[]) => void
  onSelectAll: () => void
  onCompress: () => void
  onDownloadAll: () => void
  onClearAll: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <FormatPicker
          selected={selected}
          busy={busy}
          allSelected={allSelected}
          onFormatsChange={onFormatsChange}
          onSelectAll={onSelectAll}
        />

        <Separator orientation="vertical" className="hidden h-6 sm:block" />

        <QueueActions
          compressEnabled={compressEnabled}
          downloadEnabled={downloadEnabled}
          clearEnabled={clearEnabled}
          onCompress={onCompress}
          onDownloadAll={onDownloadAll}
          onClearAll={onClearAll}
        />
      </CardContent>
    </Card>
  )
}
