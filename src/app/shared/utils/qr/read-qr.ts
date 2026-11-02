/**
 * Intenta leer un código QR desde una imagen o fotograma (M29).
 * Usa la API estándar BarcodeDetector del navegador si está disponible.
 */
export async function readQrFromSource(
  source: ImageBitmapSource | Blob,
): Promise<string | null> {
  const globalWithBarcode = globalThis as unknown as {
    BarcodeDetector?: new (options?: { formats: readonly string[] }) => {
      detect: (src: ImageBitmapSource) => Promise<readonly { rawValue: string }[]>;
    };
  };

  if (!globalWithBarcode.BarcodeDetector) {
    return null;
  }

  try {
    const detector = new globalWithBarcode.BarcodeDetector({ formats: ['qr_code'] });
    let bitmapSource: ImageBitmapSource;
    if (typeof Blob !== 'undefined' && source instanceof Blob) {
      bitmapSource = await createImageBitmap(source);
    } else {
      bitmapSource = source as ImageBitmapSource;
    }
    const detected = await detector.detect(bitmapSource);
    if (detected.length > 0 && detected[0].rawValue) {
      return detected[0].rawValue.trim();
    }
  } catch {
    // Fallo de decodificación o imagen no reconocida
  }
  return null;
}
