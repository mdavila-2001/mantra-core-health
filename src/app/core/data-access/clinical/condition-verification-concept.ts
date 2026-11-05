import { inject, Injectable } from '@angular/core';
import { map, of, switchMap, type Observable } from 'rxjs';

import type { ValueSetOption } from '../terminology/terminology.types';
import { TerminologyClient } from '../terminology/terminology.client';

/** Cómo nace un diagnóstico: presuntivo o confirmado. */
export type CreationVerification = 'CONFIRMED' | 'PROVISIONAL';

/** Los códigos con los que el catálogo nombra cómo nace un diagnóstico. */
const CODIGO_DE_VERIFICACION: Readonly<Record<CreationVerification, string>> = {
  CONFIRMED: 'COND_CONFIRMED',
  PROVISIONAL: 'COND_PROVISIONAL',
};

/**
 * Cómo lo guarda de verdad el catálogo de la API: la **clave** del módulo
 * (`clinical:CONDITION_PROVISIONAL`, ver `catalogConceptDefinitions` en
 * mantra-core-health-api), no el código corto. Buscar sólo `COND_PROVISIONAL`
 * contra la API real no encontraba nada y el presuntivo no se podía registrar.
 */
const CLAVE_DE_VERIFICACION: Readonly<Record<CreationVerification, string>> = {
  CONFIRMED: 'CONDITION_CONFIRMED',
  PROVISIONAL: 'CONDITION_PROVISIONAL',
};

/**
 * El concepto del catálogo con el que **nace** un diagnóstico.
 *
 * `POST /clinical/conditions` recibe `verificationStatusConceptId` (un UUID), no la palabra
 * `PROVISIONAL`: la API rechaza con 400 las propiedades que su DTO no declara. No existe un enum
 * dinámico para esa columna, así que se resuelve por código en la búsqueda de terminología.
 *
 * Esa búsqueda es «contiene» sobre código y denominación, y el catálogo mezcla códigos cortos
 * (`COND_PROVISIONAL`, el simulador) con claves prefijadas por módulo
 * (`clinical:CONDITION_PROVISIONAL`, la API real): se busca primero la forma corta y, si no
 * aparece, la clave; se acepta el código exacto, el sufijo `:<código>` o la clave normalizada,
 * y nada más parecido. El resultado se cachea: el catálogo no cambia en la sesión.
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
    return this.buscar(codigo, codigo).pipe(
      switchMap((encontrado) =>
        encontrado !== undefined ? of(encontrado) : this.buscar(CLAVE_DE_VERIFICACION[estado], codigo),
      ),
      map((concepto) => {
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

  private buscar(consulta: string, codigo: string): Observable<ValueSetOption | undefined> {
    return this.terminology
      .searchConcepts({ query: consulta, limit: 50 })
      .pipe(
        map((pagina) =>
          pagina.items.find(
            (item) =>
              item.code === codigo ||
              item.code.endsWith(`:${codigo}`) ||
              item.code.replace(/^clinical:CONDITION_/, 'COND_') === codigo,
          ),
        ),
      );
  }
}
