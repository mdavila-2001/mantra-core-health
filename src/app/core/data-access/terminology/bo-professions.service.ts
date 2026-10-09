import { Injectable } from '@angular/core';

import { CatalogoDeConjunto } from './value-set-catalog';

/**
 * El código interno del catálogo de profesiones: la Clasificación de
 * Ocupaciones de Bolivia (COB-2023) del INE, grandes grupos 2 y 3. Lo siembra
 * `BoProfessionsSeedService` en la API.
 */
export const CODIGO_CATALOGO_PROFESIONES = 'VS_BO_PROFESSION';

/**
 * Las profesiones que un título puede acreditar: la lista de «Otra profesión»
 * en el alta del médico, que dejó de ser texto escrito a mano (propietario,
 * 04/10/2026).
 */
@Injectable({ providedIn: 'root' })
export class BoProfessionsCatalog extends CatalogoDeConjunto {
  protected readonly codigo = CODIGO_CATALOGO_PROFESIONES;
}
