import { inject, Injectable } from '@angular/core';
import { map, of, type Observable } from 'rxjs';

import { TerminologyClient } from '../terminology/terminology.client';

/** Cómo nace un diagnóstico: presuntivo o confirmado. */
export type CreationVerification = 'CONFIRMED' | 'PROVISIONAL';

/** Los códigos con los que el catálogo nombra cómo nace un diagnóstico. */
const CODIGO_DE_VERIFICACION: Readonly<Record<CreationVerification, string>> = {
  CONFIRMED: 'COND_CONFIRMED',
  PROVISIONAL: 'COND_PROVISIONAL',
};

/**
 * El concepto del catálogo con el que **nace** un diagnóstico.
 *
 * `POST /clinical/conditions` recibe `verificationStatusConceptId` (un UUID), no la palabra
 * `PROVISIONAL`: la API rechaza con 400 las propiedades que su DTO no declara. No existe un enum
 * dinámico para esa columna, así que se resuelve por código en la búsqueda de terminología.
 *
 * Esa búsqueda es «contiene» sobre código y denominación, y el catálogo mezcla códigos cortos con
 * otros prefijados por módulo (`clinical:COND_PROVISIONAL`): se acepta el código exacto o ese
 * sufijo, y nada más parecido. El resultado se cachea: el catálogo no cambia en la sesión.
 *
 * Si el catálogo no publica el código **falla**: nunca baja en silencio a «confirmado». Un
 * presuntivo convertido en diagnóstico firme sin que nadie lo decida es peor que no registrarlo.
 */
@Injectable({ providedIn: 'root' })
export class ConditionVerificationConcepts {
  private readonly terminology = inject(TerminologyClient);
  private readonly resueltos = new Map<string, string>();

  /** El id del concepto, o `undefined` si no se declaró (la API lo registra confirmado). */
  idDe(estado: CreationVerification | undefined): Observable<string | undefined> {
    if (estado === undefined) return of(undefined);
    const codigo = CODIGO_DE_VERIFICACION[estado];
    const conocido = this.resueltos.get(codigo);
    if (conocido !== undefined) return of(conocido);
    return this.terminology.searchConcepts({ query: codigo, limit: 50 }).pipe(
      map((pagina) => {
        const concepto = pagina.items.find(
          (item) => item.code === codigo || item.code.endsWith(`:${codigo}`),
        );
        if (concepto === undefined) {
          throw new Error(
            `El catálogo no publica «${codigo}»: no se puede registrar el diagnóstico con esa certeza.`,
          );
        }
        this.resueltos.set(codigo, concepto.conceptId);
        return concepto.conceptId;
      }),
    );
  }
}
