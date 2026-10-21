/**
 * Raw upload ceiling. The phone compresses to a ~1440px WebP first (a few hundred
 * KB); this only bites when the browser can't decode the photo (e.g. HEIC outside
 * Safari) and sends it as is. Vercel refuses request bodies over 4.5 MB, so the
 * limit stays under that with room for the form fields.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const MAX_UPLOAD_LABEL = "4 MB"
