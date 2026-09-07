# tinywebp

Images stay on this machine.

![tinywebp](docs/hero.png)

Local image compressor. Drop files, pick output formats, hit Compress. Encoding runs through [sharp](https://sharp.pixelplumbing.com/) on this computer.

## Run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Use

1. Drop or choose images (PNG, JPEG, WebP, AVIF, GIF, TIFF, or HEIC). Up to 20 files, 25 MB each.
2. Select one or more output formats.
3. Compress. Download a file from the table, or Download all.

Clear all empties the queue.

## Formats

Output: AVIF, WebP, JPEG (MozJPEG), and PNG (palette). JPEG XL is not available in sharp’s default binaries.

## Credits

The loading orb is from [Orbkit](https://orbkit.zzzzshawn.cloud/) (SHDR-02), a shader by [XorDev](https://x.com/XorDev) ported with permission. Non-commercial use only, with attribution to XorDev.
