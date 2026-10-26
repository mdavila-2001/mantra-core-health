import type { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';

/** Lo mínimo de una señal escribible: el buscador sólo deja resultados y bandera. */
interface Writable<T> {
  set(value: T): void;
}

/**
 * Busca conceptos para los buscadores de país y jurisdicción del alta de
 * organización y de sub-organización, y los traduce a opciones con el
 * **código como pista**.
 *
 * La búsqueda es sobre el catálogo entero —estas dos columnas no tienen
 * binding en `dynamic-enums`, comprobado—, así que «Bolivia» también trae la
 * moneda: el código (`JUR_BO` contra `BOB`) es lo que permite elegir el
 * correcto. Un error deja la lista vacía: el combobox dice «sin resultados» y
 * el error general de la pantalla queda para el envío.
 */
export function searchConceptOptions(
  terminology: TerminologyClient,
  text: string,
  limit: number,
  results: Writable<readonly ReferenceOption[]>,
  loading: Writable<boolean>,
): void {
  if (text === '') {
    results.set([]);
    return;
  }

  loading.set(true);
  terminology.searchConcepts({ query: text, limit }).subscribe({
    next: (page) => {
      results.set(
        page.items.map((concept) => ({
          value: concept.conceptId,
          label: concept.display,
          hint: concept.code,
        })),
      );
      loading.set(false);
    },
    error: () => {
      results.set([]);
      loading.set(false);
    },
  });
}
