// Zmi EDT — image import utilities (client-side)
import {
  SUPPORTED_IMAGE_MIMES,
  SUPPORTED_IMAGE_EXTS,
  type SupportedImageMime,
} from '@/lib/editor-types'

export interface ReadImageResult {
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
}

/** Returns true if the file is a supported image format. */
export function isSupportedImage(file: File): boolean {
  if (file.type) {
    return (SUPPORTED_IMAGE_MIMES as string[]).includes(file.type)
  }
  // Fallback: sniff by extension (some browsers don't set type on drop)
  const name = file.name.toLowerCase()
  return SUPPORTED_IMAGE_EXTS.some((ext) => name.endsWith(ext))
}

/**
 * Load an image File into an object URL + natural dimensions.
 * Throws on decode failure (caller surfaces a toast per spec §32).
 */
export function readImageFile(file: File): Promise<ReadImageResult> {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({
        imageUrl,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error(`Không đọc được ảnh: ${file.name}`))
    }
    img.src = imageUrl
  })
}

/**
 * Compute an initial display size for a window that fits nicely while
 * preserving aspect ratio. Caps the longer edge at MAX_DISPLAY_W.
 */
export function computeDisplaySize(
  naturalWidth: number,
  naturalHeight: number,
  maxEdge = 360,
): { width: number; height: number } {
  if (!naturalWidth || !naturalHeight) {
    return { width: maxEdge, height: Math.round(maxEdge * 0.75) }
  }
  const longest = Math.max(naturalWidth, naturalHeight)
  const scale = longest > maxEdge ? maxEdge / longest : 1
  const width = Math.max(160, Math.round(naturalWidth * scale))
  const height = Math.max(120, Math.round(naturalHeight * scale))
  return { width, height }
}

export type { SupportedImageMime }
