"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { queueRows, type ImageItem, type OutputJob, type QueueRow } from "@/lib/compressor-model"
import {
  FORMAT_META,
  formatBytes,
  outputFileName,
  savingsLabel,
  type OutputFormat,
} from "@/lib/formats"

function QueueStatus({ output }: { output?: OutputJob }) {
  const status = output?.status ?? "waiting"

  if (status === "compressing") {
    return (
      <Progress value={null} className="w-24 gap-1.5">
        <span className="text-xs text-muted-foreground">Compressing</span>
      </Progress>
    )
  }

  if (status === "error") {
    return (
      <Badge variant="destructive">{output?.error ?? "Unable to compress"}</Badge>
    )
  }

  if (status === "done") {
    return <Badge variant="secondary">Done</Badge>
  }

  if (status === "queued") {
    return <Badge variant="outline">Queued</Badge>
  }

  return <Badge variant="outline">Waiting</Badge>
}

function QueueResult({ output }: { output?: OutputJob }) {
  if (output?.status !== "done" || output.compressedSize == null) {
    return "—"
  }

  return (
    <span>
      {formatBytes(output.compressedSize)}{" "}
      <span className="text-foreground">
        {savingsLabel(output.originalSize, output.compressedSize)}
      </span>
    </span>
  )
}

function QueueDownload({ row }: { row: QueueRow }) {
  const output = row.output

  if (output?.status !== "done" || !output.blobUrl || !row.format) {
    return <span className="text-muted-foreground">—</span>
  }

  const name = outputFileName(row.item.file.name, row.format)

  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      render={
        <a href={output.blobUrl} download={name}>
          Download
        </a>
      }
    />
  )
}

function QueueRowView({ row }: { row: QueueRow }) {
  return (
    <TableRow>
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
          <Badge variant="outline">{FORMAT_META[row.format].label}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <QueueStatus output={row.output} />
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        <QueueResult output={row.output} />
      </TableCell>
      <TableCell className="text-end">
        <QueueDownload row={row} />
      </TableCell>
    </TableRow>
  )
}

export function CompressorQueue({
  items,
  selected,
}: {
  items: ImageItem[]
  selected: OutputFormat[]
}) {
  if (items.length === 0) {
    return null
  }

  return (
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
          {queueRows(items, selected).map((row) => (
            <QueueRowView key={row.key} row={row} />
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
