import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';

import type { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { searchConceptOptions } from './concept-search';

const PAGINA = (display: string) => ({
  items: [{ conceptId: `id-${display}`, display, code: display.toUpperCase() }],
});

describe('searchConceptOptions', () => {
  it('traduce los conceptos a opciones con el código como pista', () => {
    const resultados = signal<readonly ReferenceOption[]>([]);
    const cargando = signal(false);
    const terminology = { searchConcepts: () => of(PAGINA('Bolivia')) } as unknown as TerminologyClient;

    searchConceptOptions(terminology, 'boli', 10, resultados, cargando);

    expect(resultados()).toEqual([{ value: 'id-Bolivia', label: 'Bolivia', hint: 'BOLIVIA' }]);
    expect(cargando()).toBe(false);
  });

  it('la última tecla manda: una respuesta vieja que llega tarde no pisa la nueva', () => {
    const resultados = signal<readonly ReferenceOption[]>([]);
    const cargando = signal(false);
    const vieja = new Subject<ReturnType<typeof PAGINA>>();
    const nueva = new Subject<ReturnType<typeof PAGINA>>();
    const respuestas = [vieja, nueva];
    const terminology = {
      searchConcepts: () => respuestas.shift()!.asObservable(),
    } as unknown as TerminologyClient;

    searchConceptOptions(terminology, 'bo', 10, resultados, cargando);
    searchConceptOptions(terminology, 'boli', 10, resultados, cargando);
    expect(vieja.observed).toBe(false);

    nueva.next(PAGINA('Bolivia'));
    vieja.next(PAGINA('Bolsa'));

    expect(resultados().map((o) => o.label)).toEqual(['Bolivia']);
    expect(cargando()).toBe(false);
  });

  it('borrar el texto cancela la búsqueda en vuelo y limpia', () => {
    const resultados = signal<readonly ReferenceOption[]>([]);
    const cargando = signal(false);
    const enVuelo = new Subject<ReturnType<typeof PAGINA>>();
    const terminology = { searchConcepts: () => enVuelo.asObservable() } as unknown as TerminologyClient;

    searchConceptOptions(terminology, 'bo', 10, resultados, cargando);
    expect(cargando()).toBe(true);
    searchConceptOptions(terminology, '', 10, resultados, cargando);

    expect(enVuelo.observed).toBe(false);
    expect(cargando()).toBe(false);
    expect(resultados()).toEqual([]);
  });

  it('dos buscadores no se cancelan entre sí', () => {
    const pais = signal<readonly ReferenceOption[]>([]);
    const jurisdiccion = signal<readonly ReferenceOption[]>([]);
    const cargando = signal(false);
    const a = new Subject<ReturnType<typeof PAGINA>>();
    const b = new Subject<ReturnType<typeof PAGINA>>();
    const respuestas = [a, b];
    const terminology = { searchConcepts: () => respuestas.shift()!.asObservable() } as unknown as TerminologyClient;

    searchConceptOptions(terminology, 'bo', 10, pais, cargando);
    searchConceptOptions(terminology, 'jur', 10, jurisdiccion, cargando);

    expect(a.observed).toBe(true);
    a.next(PAGINA('Bolivia'));
    expect(pais().map((o) => o.label)).toEqual(['Bolivia']);
  });
});
