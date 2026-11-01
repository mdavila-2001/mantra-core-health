import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { Subscription } from 'rxjs';

import { UiVisibilityAdminClient } from '../../../../core/data-access/ui-visibility/ui-visibility-admin.client';
import type { UiElement } from '../../../../core/data-access/ui-visibility/ui-visibility.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready, stale } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { pathText } from './visibility-labels';

/** Páginas de 200 como tope: un catálogo de interfaz son cientos de claves, no millones. */
const PAGE = 200;
const MAX_PAGES = 25;

/**
 * El catálogo entero en memoria, para lo que necesita verlo todo: los módulos que se pueden
 * filtrar, la ruta jerárquica de cada elemento y el selector de elemento de una regla.
 *
 * La tabla del catálogo no sale de acá (esa va paginada por el servidor): esto es el índice
 * que la rodea. Se pide al abrir cada pantalla; no se guarda de una visita a otra para que lo
 * que otra persona acaba de dar de alta aparezca.
 */
@Injectable({ providedIn: 'root' })
export class UiElementIndex {
  private readonly client = inject(UiVisibilityAdminClient);
  private pending: Subscription | null = null;

  readonly state = signal<ViewState<readonly UiElement[]>>(loading());
  readonly elements = computed<readonly UiElement[]>(() => {
    const s = this.state();
    return s.status === 'ready' || s.status === 'stale' ? s.data : [];
  });
  readonly byKey = computed<ReadonlyMap<string, UiElement>>(() => new Map(this.elements().map((e) => [e.key, e])));

  /** Los módulos presentes, con cuántos elementos tiene cada uno. El nombre sale del elemento `MODULE`. */
  readonly modules = computed(() => {
    const counts = new Map<string, number>();
    for (const e of this.elements()) counts.set(e.moduleCode, (counts.get(e.moduleCode) ?? 0) + 1);
    const byKey = this.byKey();
    return [...counts.entries()]
      .map(([code, total]) => ({ code, total, label: byKey.get(code)?.kind === 'MODULE' ? byKey.get(code)!.label : code }))
      .sort((a, b) => a.code.localeCompare(b.code));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
  }

  /** La ruta «Farmacia › Pedidos › Exportar» de un elemento; si no se conoce, su clave. */
  path(key: string): string {
    return pathText(key, this.byKey());
  }

  /** Para un selector: sólo los activos (un retirado no admite reglas), cada uno con su ruta. */
  options(): readonly SelectOption<string>[] {
    const byKey = this.byKey();
    return this.elements()
      .filter((e) => e.status === 'ACTIVE')
      .map((e) => ({ value: e.key, label: pathText(e.key, byKey), description: e.key }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Vuelve a leer el catálogo sin vaciar lo que se ve: mientras llega, el índice queda «atrasado»
   * (S7) con los datos anteriores, así las rutas legibles y las cifras no parpadean.
   */
  refresh(): void {
    const s = this.state();
    this.load(s.status === 'ready' || s.status === 'stale' ? stale(s.data, new Date()) : loading());
  }

  load(initial: ViewState<readonly UiElement[]> = loading()): void {
    this.pending?.unsubscribe();
    this.state.set(initial);
    const all: UiElement[] = [];
    const next = (cursor: string | undefined, pages: number): void => {
      this.pending = this.client.listElements({ limit: PAGE, ...(cursor ? { cursor } : {}) }).subscribe({
        next: (page) => {
          all.push(...page.items);
          if (page.nextCursor !== null && pages < MAX_PAGES) next(page.nextCursor, pages + 1);
          else this.state.set(ready(all));
        },
        error: (error: unknown) => this.state.set(errorToViewState<readonly UiElement[]>(error)),
      });
    };
    next(undefined, 1);
  }
}
