import { signal } from '@angular/core';
import type { Subscription } from 'rxjs';

import type { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { ReferenceOption } from '../../shared/components/molecules/reference-combobox/reference-combobox.types';

/** Cuántos términos ofrece el buscador por consulta. */
const SEARCH_LIMIT = 10;

/**
 * El estado de un buscador de términos del glosario para un
 * `app-reference-combobox`: opciones, carga y la petición en curso.
 *
 * El mapa tiene dos (término central y «Comparar con…») y el comparador otros
 * dos; sin esta pieza serían cuatro copias del mismo `subscribe`. Quien lo crea
 * llama a `dispose()` al destruirse.
 */
export class GlossaryTermSearch {
  readonly options = signal<readonly ReferenceOption[]>([]);
  readonly searching = signal(false);
  private request: Subscription | null = null;

  constructor(private readonly terminology: TerminologyClient) {}

  search(text: string): void {
    this.request?.unsubscribe();
    if (text.trim() === '') {
      this.options.set([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.request = this.terminology.searchGlossary({ query: text, limit: SEARCH_LIMIT }).subscribe({
      next: (page) => {
        this.options.set(
          page.items.map((term) => ({
            value: term.conceptId,
            label: term.display,
            ...(term.category ? { hint: term.category.name } : {}),
          })),
        );
        this.searching.set(false);
      },
      error: () => {
        this.options.set([]);
        this.searching.set(false);
      },
    });
  }

  dispose(): void {
    this.request?.unsubscribe();
  }
}
