import { Injectable } from '@angular/core';

/**
 * Lee un QR de una imagen o de la cámara (06/11/2026).
 *
 * Hermano de {@link drawQr}: aquél dibuja, éste lee. Usa el `BarcodeDetector`
 * del navegador, así que **no suma ninguna dependencia**; el costo es que
 * Firefox y Safari de escritorio no lo traen. Ahí `canReadQr()` da `false` y
 * quien llama ofrece la entrada manual del código: nunca se queda sin camino.
 */

interface DetectorLike {
  detect(source: ImageBitmapSource): Promise<readonly { readonly rawValue: string }[]>;
}
type DetectorCtor = new (opciones?: { formats?: string[] }) => DetectorLike;

/** El navegador no sabe leer QR. */
export class QrReaderUnavailableError extends Error {
  constructor() {
    super('Este navegador no puede leer códigos QR.');
    this.name = 'QrReaderUnavailableError';
  }
}

function detectorCtor(): DetectorCtor | null {
  return (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector ?? null;
}

/** Si este navegador puede leer un QR de una imagen o de la cámara. */
export function canReadQr(): boolean {
  return detectorCtor() !== null;
}

function newDetector(): DetectorLike {
  const Ctor = detectorCtor();
  if (Ctor === null) throw new QrReaderUnavailableError();
  return new Ctor({ formats: ['qr_code'] });
}

/**
 * El texto del primer QR de la imagen, o `null` si no hay ninguno.
 *
 * @throws QrReaderUnavailableError si el navegador no sabe leer QR.
 */
export async function readQrFromImage(imagen: Blob): Promise<string | null> {
  const detector = newDetector();
  const mapa = await createImageBitmap(imagen);
  try {
    const hallados = await detector.detect(mapa);
    return hallados[0]?.rawValue ?? null;
  } finally {
    mapa.close();
  }
}

/** Una cámara abierta que busca QR. `stop` la apaga y es idempotente. */
export interface QrCameraSession {
  stop(): void;
}

/**
 * Abre la cámara trasera en `video` y llama a `onCode` con el primer QR que
 * vea. No se apaga sola al encontrarlo: quien llama decide, porque un código
 * que no es el esperado no debería obligar a reabrir la cámara.
 *
 * @throws QrReaderUnavailableError sin soporte; el `DOMException` de
 *   `getUserMedia` si se niega el permiso o no hay cámara.
 */
export async function startQrCamera(
  video: HTMLVideoElement,
  onCode: (texto: string) => void,
): Promise<QrCameraSession> {
  const detector = newDetector();
  const flujo = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  video.srcObject = flujo;
  await video.play().catch(() => undefined);

  let activa = true;
  let leyendo = false;
  const cada = setInterval(() => {
    if (!activa || leyendo || video.readyState < 2) return;
    leyendo = true;
    detector
      .detect(video)
      .then((hallados) => {
        const primero = hallados[0]?.rawValue;
        if (activa && primero !== undefined) onCode(primero);
      })
      .catch(() => undefined)
      .finally(() => {
        leyendo = false;
      });
  }, 250);

  return {
    stop() {
      if (!activa) return;
      activa = false;
      clearInterval(cada);
      flujo.getTracks().forEach((pista) => pista.stop());
      video.srcObject = null;
    },
  };
}

/**
 * Lo mismo, como servicio: así una pantalla lo pide por inyección y una prueba
 * lo reemplaza por `TestBed` sin tocar el navegador (que en `jsdom` no tiene
 * `BarcodeDetector` ni cámara).
 */
@Injectable({ providedIn: 'root' })
export class QrReader {
  canRead(): boolean {
    return canReadQr();
  }

  readImage(imagen: Blob): Promise<string | null> {
    return readQrFromImage(imagen);
  }

  startCamera(video: HTMLVideoElement, onCode: (texto: string) => void): Promise<QrCameraSession> {
    return startQrCamera(video, onCode);
  }
}
