export type OrbState = "idle" | "thinking" | "speaking"

export const ORB_STATES = ["idle", "thinking", "speaking"] as const

export interface OrbParamDef {
  key: string
  label: string
  min: number
  max: number
  step: number
  default: number
  /**
   * Rate params. The engine integrates them into a clock
   * (`clock += dt * value * volumeSpeed`) and uploads the clock instead of the
   * raw value, so changing the rate never jumps the phase — the motion speeds
   * up or slows down rather than snapping to a new position.
   */
  integrate?: boolean
}

export interface OrbColorDef {
  key: string
  label: string
  /** hex, e.g. `#ff8b73` */
  default: string
}

export interface OrbVariant {
  key: string
  label: string
  note: string
  /** GLSL fragment shader body. Uniform declarations are generated for you. */
  frag: string
  params: OrbParamDef[]
  colors: OrbColorDef[]
  /**
   * Per-state parameter targets. The engine glides each param toward the
   * active state's preset. Params passed explicitly via the `params` prop
   * always win over the preset.
   */
  statePresets?: Partial<Record<OrbState, Record<string, number>>>
  /**
   * Per-state colour targets, the colour counterpart of `statePresets`.
   * Kept a separate map because presets are numeric and colours are hex
   * strings — a union would lose type safety on both. Colours glide in RGB
   * on the same easing as params, so a state change cross-fades rather
   * than cutting. Colours passed explicitly via the `colors` prop always
   * win, exactly as with params.
   */
  stateColors?: Partial<Record<OrbState, Record<string, string>>>
}

export type OrbParamValues = Partial<Record<string, number>>
export type OrbColorValues = Partial<Record<string, string>>

/** Every param and color at its schema default. */
export function defaultValuesFor(variant: OrbVariant): {
  params: Record<string, number>
  colors: Record<string, string>
} {
  return {
    params: Object.fromEntries(variant.params.map((p) => [p.key, p.default])),
    colors: Object.fromEntries(variant.colors.map((c) => [c.key, c.default])),
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim()
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  if (h.length !== 6 || Number.isNaN(n)) return [1, 1, 1]
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export const ORB_WRAPPERS = [
  "none",
  "glass",
  "ring",
  "dotted",
  "ticks",
  "reticle",
  "grid",
  "halftone",
  "scanlines",
] as const

export type OrbWrapper = (typeof ORB_WRAPPERS)[number]
