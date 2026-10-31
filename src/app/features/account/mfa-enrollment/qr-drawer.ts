import { InjectionToken } from '@angular/core';

import { drawQr } from '../../../shared/utils/qr/draw-qr';

/** Cómo se dibuja el QR del alta. Es el único dibujante del front (`drawQr`); se inyecta para que las pruebas pongan el suyo. */
export type QrDrawer = (lienzo: HTMLCanvasElement, contenido: string, lado: number) => Promise<void>;

export const QR_DRAWER = new InjectionToken<QrDrawer>('QR_DRAWER', { providedIn: 'root', factory: () => drawQr });
