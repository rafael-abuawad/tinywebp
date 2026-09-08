import { ShaderOrb, type ShaderOrbProps } from "@/components/ui/orbkit-core"

import { shdr02Orb } from "@/components/ui/shdr-02-variant"

export type Shdr02Props = Omit<ShaderOrbProps, "variant">

export function Shdr02({ size = 280, ...rest }: Shdr02Props) {
  return <ShaderOrb variant={shdr02Orb} size={size} {...rest} />
}

export default Shdr02
