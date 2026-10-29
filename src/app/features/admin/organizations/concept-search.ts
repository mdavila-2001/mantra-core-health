import type { Subscription } from 'rxjs';

import { errorToViewState } from '../../../core/http/error-to-view-state';
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
 * correcto. Un error deja la lista vacía **y se dice**: antes se tragaba, y el
 * combobox mostraba «Ningún concepto coincide» cuando lo que había fallado era
 * la búsqueda. `error` recibe el motivo (con el código de la petición en S9) y
 * se limpia con la siguiente búsqueda.
 */
/**
 * La búsqueda en vuelo de cada buscador, por su señal de resultados: una nueva
 * cancela la anterior, así que una respuesta vieja que llega tarde no pisa la
 * de lo que se escribió después (la misma carrera que `people-search.ts`
 * resuelve con `switchMap`). `WeakMap`: el buscador y su entrada se van juntos.
 */
const enVuelo = new WeakMap<object, Subscription>();

export function searchConceptOptions(
  terminology: TerminologyClient,
  text: string,
  limit: number,
  results: Writable<readonly ReferenceOption[]>,
  loading: Writable<boolean>,
  error?: Writable<string | null>,
): void {
  enVuelo.get(results)?.unsubscribe();
  enVuelo.delete(results);
  error?.set(null);

  if (text === '') {
    results.set([]);
    loading.set(false);
    return;
  }

  loading.set(true);
  const suscripcion = terminology.searchConcepts({ query: text, limit }).subscribe({
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
    error: (fallo: unknown) => {
      results.set([]);
      loading.set(false);
      error?.set(mensajeDeFallo(fallo));
    },
  });
  // Una respuesta síncrona ya terminó: no queda nada que cancelar.
  if (!suscripcion.closed) enVuelo.set(results, suscripcion);
}

/** El fallo de la búsqueda, dicho para la persona, con el código de la petición si lo hay. */
function mensajeDeFallo(fallo: unknown): string {
  const estado = errorToViewState<never>(fallo);
  switch (estado.status) {
    case 'offline':
      return 'No pudimos buscar en el catálogo: revise su conexión e intente de nuevo.';
    case 'forbidden':
      return `No pudimos buscar en el catálogo: ${estado.message ?? 'su cuenta no tiene permiso para hacerlo.'}`;
    case 'error':
      return `No pudimos buscar en el catálogo. Intente de nuevo; si sigue, repórtelo con el código ${estado.requestId}.`;
    default:
      return 'No pudimos buscar en el catálogo. Intente de nuevo.';
  }
}
