"use client"

import dynamic from "next/dynamic"

import type { OrbState } from "@/components/ui/orbkit-core"

const Shdr02 = dynamic(() => import("@/components/ui/shdr-02"), {
  ssr: false,
  loading: () => <div className="size-[180px] lg:size-[270px]" aria-hidden />,
})

export function CompressorOrb({
  state,
  caption,
}: {
  state: OrbState
  caption: string
}) {
  return (
    <aside className="flex flex-col items-center gap-3 lg:sticky lg:top-8">
      <div className="relative flex items-center justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-6 rounded-full bg-foreground/8 blur-3xl"
        />
        <Shdr02
          size={250}
          state={state}
          wrapper="grid"
          className="text-foreground"
          ariaLabel={caption}
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
      <p className="text-sm text-muted-foreground">{caption}</p>
    </aside>
  )
}
