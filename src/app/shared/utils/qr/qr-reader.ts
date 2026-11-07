import { Injectable } from '@angular/core';

import { readQrFromSource } from './read-qr';

/** A camera that is looking for a QR. `stop` turns it off and is idempotent. */
export interface QrCameraSession {
  stop(): void;
}

/** How often a camera frame is checked for a QR. */
const SCAN_INTERVAL_MS = 300;

/**
 * Injectable facade over {@link readQrFromSource} (image or frame decoding) plus the camera loop,
 * so a screen asks for it by injection and a test replaces it through `TestBed` (jsdom has no
 * camera and no canvas).
 */
@Injectable({ providedIn: 'root' })
export class QrReader {
  /** The text of the first QR in the image, or `null` when there is none. */
  readImage(image: Blob): Promise<string | null> {
    return readQrFromSource(image);
  }

  /**
   * Opens the rear camera in `video` and calls `onCode` with the first QR it sees. It does not turn
   * itself off on a hit: the caller decides, because a code that is not the expected one should not
   * force reopening the camera.
   *
   * @throws the `DOMException` of `getUserMedia` when permission is denied or there is no camera.
   */
  async startCamera(video: HTMLVideoElement, onCode: (text: string) => void): Promise<QrCameraSession> {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    let active = true;
    let reading = false;
    const timer = setInterval(async () => {
      if (!active || reading || video.readyState < 2) return;
      reading = true;
      const text = await readQrFromSource(video);
      reading = false;
      if (active && text !== null) onCode(text);
    }, SCAN_INTERVAL_MS);
    return {
      stop() {
        if (!active) return;
        active = false;
        clearInterval(timer);
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      },
    };
  }
}
