import { ChangeDetectionStrategy, Component } from '@angular/core';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import {
  empty,
  forbidden,
  loading,
  notFound,
  offline,
  ready,
  routeAuthPending,
  stale,
  staleAgeMs,
  unexpectedError,
  validation,
} from '../../../core/view-state/view-state';
import type { M34Code, StaleViewState, ViewState } from '../../../core/view-state/view-state.types';

/** Contenido de mentira para que `ready` y `stale` tengan algo que mostrar. */
interface ResumenDemo {
  readonly titulo: string;
  readonly detalle: string;
}

interface EstadoDemo {
  readonly code: M34Code | null;
  readonly titulo: string;
  /** Nota cuando el estado participa de una de las tres reglas del M34. */
  readonly regla?: string;
  readonly state: ViewState<ResumenDemo>;
}

const RESUMEN: ResumenDemo = {
  titulo: 'Ocupación de camas',
  detalle: '18 de 24 camas ocupadas · 3 altas previstas para hoy',
};

/**
 * Fechas fijas en vez de `new Date()`: la vitrina se prerenderiza en el build y
 * un «ahora» real haría que el servidor y el navegador mostraran cifras
 * distintas al hidratar.
 */
const DATO_DE = new Date('2026-07-31T10:00:00Z');
const AHORA_DEMO = new Date('2026-07-31T10:07:00Z');

/**
 * Los 9 estados de UX obligatorios del M34, renderizados.
 *
 * Es la referencia viva del contrato para las 81 secciones del proyecto: lo que
 * acá se ve es lo que cada pantalla debe saber mostrar.
 */
@Component({
  selector: 'app-view-state-gallery',
  imports: [AppButton, Badge],
  templateUrl: './view-state-gallery.html',
  styleUrl: './view-state-gallery.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewStateGallery {
  readonly estados: readonly EstadoDemo[] = [
    {
      code: 'S1',
      titulo: 'Autorización de ruta pendiente',
      regla: 'S1 ≠ S2 — autorizar ocurre antes de pedir datos sensibles.',
      state: routeAuthPending(),
    },
    {
      code: 'S2',
      titulo: 'Cargando / esqueleto',
      regla: 'Recién acá se piden los datos: la ruta ya está autorizada.',
      state: loading(),
    },
    {
      code: 'S3',
      titulo: 'Vacío con próxima acción',
      state: empty(
        { label: 'Registrar ingreso', route: '/ingresos/nuevo' },
        'Todavía no hay camas registradas en este sector.',
      ),
    },
    {
      code: null,
      titulo: 'Datos frescos (camino feliz)',
      regla: 'No tiene código S: la lista del M34 enumera lo que exige trato aparte.',
      state: ready(RESUMEN),
    },
    {
      code: 'S4',
      titulo: 'Validación o conflicto',
      state: validation(
        [
          { field: 'sector', message: 'Elegí un sector para ver la ocupación.' },
          { message: 'Otra persona actualizó este parte hace instantes.', code: 'CONFLICT' },
        ],
        30,
      ),
    },
    {
      code: 'S5',
      titulo: 'Prohibido / propósito denegado',
      regla: 'S5 ≠ S6 — acá sí se admite que el recurso existe.',
      state: forbidden({
        message: 'Necesitás verificar tu identidad para ver datos clínicos.',
        nextAction: { label: 'Verificar identidad', route: '/identity/me' },
      }),
    },
    {
      code: 'S6',
      titulo: 'No encontrado, sin filtrar existencia',
      regla: 'Mismo mensaje exista o no el recurso: lo contrario lo confirmaría.',
      state: notFound({ label: 'Volver al listado', route: '/' }),
    },
    {
      code: 'S7',
      titulo: 'Dato viejo / actualizar',
      regla: 'Obligatorio exponer la antigüedad: 14 proyecciones son materializadas.',
      state: stale(RESUMEN, DATO_DE),
    },
    {
      code: 'S8',
      titulo: 'Sin conexión / reintentar',
      state: offline(new Date('2026-07-31T10:06:30Z')),
    },
    {
      code: 'S9',
      titulo: 'Error inesperado + identificador',
      state: unexpectedError('req-7f3a91c4', 'No pudimos completar la operación.'),
    },
  ];

  /** Antigüedad en minutos, que es la unidad en la que se lee de un vistazo. */
  antiguedadEnMinutos(state: StaleViewState<ResumenDemo>): number {
    return Math.round(staleAgeMs(state, AHORA_DEMO) / 60_000);
  }
}
