# tinywebp

Local TinyPNG-style image compressor. Images stay on this machine and are encoded with [sharp](https://sharp.pixelplumbing.com/).

## Run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Drop images, pick formats, hit Compress.

## Formats

AVIF, WebP, JPEG (MozJPEG), and PNG (palette). JPEG XL is not available in sharp’s default binaries.
