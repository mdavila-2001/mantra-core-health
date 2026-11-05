type QrSource = ImageBitmapSource;

type BarcodeDetectorCtor = new (options?: { formats: readonly string[] }) => {
  detect: (src: QrSource) => Promise<readonly { rawValue: string }[]>;
};

/** Largest side the fallback decoder works on: bigger photos are scaled down (same result, much faster). */
const MAX_SIDE = 1024;

/**
 * Reads a QR from an image or a video frame (M29). Uses the browser's `BarcodeDetector` when it
 * exists (Chrome, Edge, Android) and falls back to `jsqr` everywhere else (Firefox, Safari), so
 * reading a QR does not depend on the browser.
 */
export async function readQrFromSource(source: QrSource | Blob): Promise<string | null> {
  try {
    const image = typeof Blob !== 'undefined' && source instanceof Blob ? await createImageBitmap(source) : source;
    return (await withBarcodeDetector(image)) ?? (await withJsQr(image));
  } catch {
    // Unreadable image or decoder failure: same as "no QR found".
    return null;
  }
}

async function withBarcodeDetector(image: QrSource): Promise<string | null> {
  const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Detector) return null;
  try {
    const found = await new Detector({ formats: ['qr_code'] }).detect(image);
    return found[0]?.rawValue?.trim() || null;
  } catch {
    return null;
  }
}

async function withJsQr(image: QrSource): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const { width, height } = sizeOf(image);
  if (width === 0 || height === 0) return null;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  // Lazy: only whoever reads a QR without BarcodeDetector downloads the decoder.
  const module = (await import('jsqr')) as unknown as { default?: JsQr } & JsQr;
  const decode = module.default ?? (module as unknown as JsQr);
  const found = decode(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  return found?.data.trim() || null;
}

type JsQr = (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;

function sizeOf(image: QrSource): { width: number; height: number } {
  if (typeof HTMLVideoElement !== 'undefined' && image instanceof HTMLVideoElement) {
    return { width: image.videoWidth, height: image.videoHeight };
  }
  const sized = image as { width?: number; height?: number };
  return { width: Number(sized.width ?? 0), height: Number(sized.height ?? 0) };
}
