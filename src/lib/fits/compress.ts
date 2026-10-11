"use client"

/** Client-side pass before upload: upright, ≤1440px, WebP. The server re-encodes anyway. */
const MAX_EDGE = 1440
const QUALITY = 0.82

export async function compressPhoto(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    // The browser can't decode it (e.g. HEIC outside Safari): let the server try.
    return { blob: file, width: 0, height: 0 }
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  // Re-drawing on a canvas drops EXIF (including GPS) before the photo ever leaves the phone.
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  )
  return { blob: blob ?? file, width, height }
}
