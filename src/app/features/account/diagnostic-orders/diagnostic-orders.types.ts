import type { PerformerSelectionCode } from '../../../core/data-access/diagnostics/service-request-performer.types';
import type { PatientSettlementFields } from '../../../core/data-access/insurance/patient-insurance-settlement.types';

/**
 * El tipo de estudio, para las pestañas de «Mis órdenes» (C9).
 *
 * Cerrado a cuatro valores porque son los que el value set `VS_SERVICE_REQUEST_CATEGORY`
 * distingue hoy (`SRQ-LAB`, `SRQ-IMAGING`, y la categoría procedimiento de los centros
 * médicos); todo lo demás —incluido «sin categoría»— cae en `OTHER` y se ve en la pestaña
 * «Otros». Desde P40 la API sirve `category` y la pestaña sale de ahí ({@link tipoDeOrden}).
 */
export const ANALYSIS_CATEGORIES = ['LAB', 'IMAGING', 'PROCEDURE', 'OTHER'] as const;
export type AnalysisCategory = (typeof ANALYSIS_CATEGORIES)[number];

/** El código del `categoryConceptId` que corresponde a laboratorio, en el catálogo. */
const CODIGOS_LABORATORIO: readonly string[] = [
  'SRQ-LAB',
  // Los que siembra la API real (módulos `clinical` y `diagnostics`).
  'clinical:SERVICE_REQUEST_CATEGORY_LAB',
];
/** Los códigos que corresponden a imagenología. */
const CODIGOS_IMAGENOLOGIA: readonly string[] = [
  'SRQ-IMAGING',
  'diagnostics:SERVICE_REQUEST_CATEGORY_IMAGING',
  'clinical:SERVICE_REQUEST_CATEGORY_IMAGING',
];

/**
 * Los códigos con que puede llegar la categoría procedimiento (CONTRATO A-8).
 *
 * Terminología devuelve el código simple o con el prefijo del módulo, y hasta que
 * la API confirme cuál usa se reconocen los tres. Lo leen CM-08 y CM-09.
 */
export const PROCEDURE_CATEGORY_CODES: readonly string[] = [
  'SRQ-PROCEDURE',
  'SR_PROCEDURE',
  'clinical:SERVICE_REQUEST_CATEGORY_PROCEDURE',
];

/**
 * Deriva el tipo desde el **código** del concepto de categoría, no desde su
 * texto: el texto cambia de idioma, el código no. Sin `categoryConceptId`
 * (todavía no lo llena C2) o con un código que no es de los dos conocidos,
 * cae en «Otros» — nunca se inventa una tercera categoría a partir de una
 * suposición sobre el nombre del estudio.
 */
export function categoriaDeAnalisis(codigoDeCategoria: string | undefined): AnalysisCategory {
  if (codigoDeCategoria !== undefined && CODIGOS_LABORATORIO.includes(codigoDeCategoria)) {
    return 'LAB';
  }
  if (codigoDeCategoria !== undefined && CODIGOS_IMAGENOLOGIA.includes(codigoDeCategoria)) {
    return 'IMAGING';
  }
  if (codigoDeCategoria !== undefined && PROCEDURE_CATEGORY_CODES.includes(codigoDeCategoria)) {
    return 'PROCEDURE';
  }
  return 'OTHER';
}

/**
 * El tipo de una orden del portal (P40): la categoría que **sirve la API**
 * (`category`, derivada de `categoryConceptId` en el servidor), con una sola
 * precisión local — un procedimiento es `OTHER` para C2 pero tiene pestaña
 * propia, y eso sale del código del concepto. Sin `category`, la orden no
 * declara categoría y va a «Otros»: acá ya no se deduce laboratorio ni imagen
 * a partir de códigos.
 *
 * @param category - `category` de la orden, tal como la mandó la API.
 * @param codigoDeCategoria - Código del concepto de categoría, si se resolvió.
 */
export function tipoDeOrden(
  category: 'LAB' | 'IMAGING' | 'OTHER' | undefined,
  codigoDeCategoria: string | undefined,
): AnalysisCategory {
  if (codigoDeCategoria !== undefined && PROCEDURE_CATEGORY_CODES.includes(codigoDeCategoria)) {
    return 'PROCEDURE';
  }
  return category ?? 'OTHER';
}

/** La etiqueta en castellano de una categoría, para la pestaña y el badge de la fila. */
export function etiquetaDeCategoria(categoria: AnalysisCategory): string {
  switch (categoria) {
    case 'LAB':
      return 'Laboratorio';
    case 'IMAGING':
      return 'Imagenología';
    case 'PROCEDURE':
      return 'Procedimientos';
    case 'OTHER':
      return 'Otros';
  }
}

/**
 * Una orden, ya en palabras para la tabla — ni un uuid llega a la fila (regla
 * de C0/C9): `id` es el único identificador, y sólo viaja para `trackBy` y
 * para armar rutas/fragmentos, nunca se pinta.
 */
export interface PatientOrderRow extends PatientSettlementFields {
  readonly id: string;
  readonly type: AnalysisCategory;
  readonly typeLabel: string;
  readonly studyLabel: string;
  /** El código del estado (`statusConceptId` resuelto): clave estable para filtrar. */
  readonly stateCode: string;
  readonly stateLabel: string;
  readonly hasResult: boolean;
  readonly reportId: string | null;
  /** «Consulta del dd/mm» o «Sin consulta» — la consulta es una columna, no un agrupador (C9 §8). */
  readonly consultationLabel: string;
  readonly requestedAt: Date;
  /** Ayunas, horarios, qué llevar. `null` = ningún centro publicó preparación. */
  readonly preparation: string | null;
  /**
   * El modo de ejecutor que eligió el médico, ya resuelto desde el código del concepto,
   * o `null` si la orden no lo trae (orden vieja o API sin extender): no se inventa nada.
   */
  readonly performerMode: PerformerSelectionCode | null;
  /** El nombre de la sede que sugirió el médico; nunca su uuid. `null` = sin sede. */
  readonly suggestedSiteName: string | null;
}
