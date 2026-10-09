import { Injectable } from '@angular/core';

import { CatalogoDeConjunto } from './value-set-catalog';

/**
 * El código interno del catálogo de ocupaciones de Bolivia.
 *
 * Es el que fija la nota de entidad de `profiles.persons` en el modelo (v4.1.8)
 * y el que siembra `BoOccupationsSeedService` en la API. **No es
 * `VS_SEGIP_OCCUPATION`**, que es lo que `RegisterPatientDto` decía un día antes
 * y que no llegó a sembrarse nunca: un catálogo tiene un solo dueño, y pedirlo
 * por el otro código devuelve `count: 0` — el mismo cuento de
 * `VS_ADMINISTRATIVE_AREA` con los departamentos.
 */
export const CODIGO_CATALOGO_OCUPACIONES = 'VS_BO_OCCUPATION';

/**
 * El concepto «Otra ocupación», la salida del catálogo.
 *
 * El registro del cliente pide (módulo Paciente §1.4.1) «dejar uno al final
 * libre para que él pueda detallar la ocupación que no encontró». Elegido este
 * concepto —y sólo éste—, el alta pide el oficio escrito a mano y lo manda en
 * `occupationFreeText`. Va acá, con el catálogo, por lo mismo que
 * `CODIGO_EMPRESA_OTRA`: es un dato del catálogo, no de una pantalla.
 */
export const CODIGO_OCUPACION_OTRA = 'occupation:bo:OTRA';

/**
 * Las ocupaciones de Bolivia, para el desplegable de «¿en qué trabajás?» del
 * alta de paciente.
 *
 * Mismo criterio que `BoDepartmentsCatalog`: `profiles.persons.
 * occupation_concept_id` no tiene enumeración dinámica declarada, así que el
 * catálogo se lee **por código de conjunto de valores** y no por campo destino
 * —pedirlo con `?target=` responde `404`—.
 */
@Injectable({ providedIn: 'root' })
export class BoOccupationsCatalog extends CatalogoDeConjunto {
  protected readonly codigo = CODIGO_CATALOGO_OCUPACIONES;
}
