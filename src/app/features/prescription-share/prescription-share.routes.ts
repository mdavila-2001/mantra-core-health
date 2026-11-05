import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../core/navigation/navigation.types';
import { PRESCRIPTION_VERIFY_PATH, SHARED_PRESCRIPTION_PATH } from './prescription-share.paths';

/**
 * Las dos páginas públicas de la receta (FAR-01).
 *
 * Van fuera del armazón y sin guard, igual que `verify/portability`: quien
 * abre el enlace del paciente o escanea el QR del PDF puede no tener sesión, y
 * no se llega por el menú. La autoridad es la API: la vista pública no recibe
 * nada del paciente ni de los fármacos. El `noindex` lo pone cada página
 * (`markPageAsNoIndex`), porque `Route` no tiene dónde declararlo.
 *
 * @param chunkFailed - El componente de recuperación cuando falla la descarga
 *   de un fragmento (`chunkFallido` de `app.routes.ts`, que no se importa de
 *   vuelta para no armar un ciclo).
 */
export function publicPrescriptionShareRoutes(chunkFailed: () => Type<unknown>): Routes {
  return [
    {
      path: SHARED_PRESCRIPTION_PATH,
      title: `${APP_TITLE} - Receta compartida`,
      loadComponent: () =>
        import('./public-share/public-share').then((m) => m.PublicShare).catch(() => chunkFailed()),
    },
    {
      path: PRESCRIPTION_VERIFY_PATH,
      title: `${APP_TITLE} - Verificar receta`,
      loadComponent: () =>
        import('./prescription-verify/prescription-verify')
          .then((m) => m.PrescriptionVerify)
          .catch(() => chunkFailed()),
    },
  ];
}
