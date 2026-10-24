import { DestroyRef, computed, inject, signal, type Signal } from '@angular/core';
import { EMPTY, expand, reduce, type Observable } from 'rxjs';

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type {
  PortalPage,
  ProcesoResumen,
} from '../../../../core/data-access/admin-portal/portal.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';

/** El techo de página del inventario (`MAX_PAGE_SIZE` de la API). */
const FULL_PAGE = 200;

/** Los procesos del inventario como opciones de los filtros «Módulo» y «Proceso». */
export interface ProcessOptions {
  /** Un módulo por carpeta de la API, con el nombre de su proceso de módulo. */
  readonly modules: Signal<readonly SelectOption<string>[]>;
  /** Todos los procesos (de módulo y críticos), por su código. */
  readonly flows: Signal<readonly SelectOption<string>[]>;
}

function allPages(client: PortalClient): Observable<readonly ProcesoResumen[]> {
  const page = (cursor?: string): Observable<PortalPage<ProcesoResumen>> =>
    client.listProcesses({ limit: FULL_PAGE, ...(cursor ? { cursor } : {}) });
  return page().pipe(
    expand((p) => (p.nextCursor ? page(p.nextCursor) : EMPTY)),
    reduce<PortalPage<ProcesoResumen>, readonly ProcesoResumen[]>((all, p) => [...all, ...p.items], []),
  );
}

const byLabel = (a: SelectOption<string>, b: SelectOption<string>): number =>
  a.label.localeCompare(b.label, 'es');

/**
 * Las opciones salen de lo que la API lista en `/admin/portal/flujos`, no de una
 * lista escrita a mano. Se piden al abrir la pantalla y viven lo que ella: el
 * frontend no guarda caché de datos (`docs/data-and-state/caching.md`). Si la
 * lectura falla, las opciones quedan vacías y `app-filter-bar` deshabilita el
 * filtro con su motivo; el listado sigue funcionando sin él.
 *
 * Se llama en el contexto de inyección del componente (un campo).
 */
export function processOptions(): ProcessOptions {
  const processes = signal<readonly ProcesoResumen[]>([]);
  const subscription = allPages(inject(PortalClient)).subscribe({
    next: (items) => processes.set(items),
    error: () => processes.set([]),
  });
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());

  return {
    modules: computed(() =>
      processes()
        .filter((p) => p.tipo === 'MODULO' && p.modulo)
        .map((p) => ({ value: p.modulo!, label: p.nombre }))
        .sort(byLabel),
    ),
    flows: computed(() =>
      processes()
        .map((p) => ({ value: p.codigo, label: p.nombre }))
        .sort(byLabel),
    ),
  };
}
