import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../../../../core/navigation/navigation.types';

/**
 * La pantalla «Piezas en ejecución», relativa a `superadmin/portal`
 * (`superadmin/portal/systems/runtime-pieces`). Los roles los hereda el marco
 * del portal y la API decide cada petición: ocultar un botón no autoriza nada.
 *
 * Se suma al portal esparciendo esta lista en `PORTAL_RUTAS`, como las demás.
 */
export const PORTAL_RUNTIME_PIECES_ROUTES: Routes = [
  {
    path: 'systems/runtime-pieces',
    title: `${APP_TITLE} - Piezas en ejecución`,
    loadComponent: () => import('./runtime-pieces-page').then((m) => m.RuntimePiecesPage),
  },
];
