"use client"

import { ImageIcon } from "lucide-react"
import type { RefObject } from "react"

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
import { INPUT_ACCEPT } from "@/lib/formats"
import { cn } from "@/lib/utils"

export function CompressorDropZone({
  inputId,
  inputRef,
  itemCount,
  dragging,
  onFiles,
}: {
  inputId: string
  inputRef: RefObject<HTMLInputElement | null>
  itemCount: number
  dragging: boolean
  onFiles: (list: FileList | File[]) => void
}) {
  return (
    <Card
      className={cn("transition-[box-shadow]", dragging && "ring-2 ring-ring")}
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
              onFiles(event.target.files)
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
              {itemCount > 0 ? "Add more images" : "Drop images"}
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
  )
}
