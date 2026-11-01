import { InjectionToken } from '@angular/core';

import type { UiElementDraft } from '../../../../core/data-access/ui-visibility/ui-visibility.types';

/**
 * Los elementos de interfaz que el registro del front declara (`declareUiElements`).
 *
 * Es el puerto por el que el catálogo de visibilidad consume el registro sin depender de
 * `core/visibility`: quien lo implementa provee el valor real
 * (`{ provide: UI_ELEMENT_DRAFTS, useFactory: () => registro.drafts() }`) y el botón
 * «Sincronizar con el código» lo envía a `POST /admin/ui-visibility/elements/sync`.
 *
 * Por omisión es una lista vacía: sin proveedor, la pantalla dice que el registro no
 * declara nada en vez de fallar o, peor, mandar un sync vacío que retiraría todo lo `CODE`.
 */
export const UI_ELEMENT_DRAFTS = new InjectionToken<readonly UiElementDraft[]>('UI_ELEMENT_DRAFTS', {
  providedIn: 'root',
  factory: () => [],
});
