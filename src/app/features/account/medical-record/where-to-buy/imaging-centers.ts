/**
 * Los centros de imagenología de «Dónde conseguir lo de mi receta»: qué
 * estudios pedidos siguen sin resultado y cómo se pinta cada centro de la
 * búsqueda por cobertura. Funciones puras; el componente las orquesta.
 */

import type { DiagnosticUnitCoverageItem } from '../../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { modalidadDeEstudio } from '../../../../core/data-access/diagnostic-units/modalidades';
import type { PatientOrder } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { categoriaDeAnalisis } from '../../diagnostic-orders/diagnostic-orders.types';
import { directionsUrl, formatKm } from './where-to-buy.route';

/** Un estudio pedido que todavía no tiene resultado, listo para la búsqueda. */
export interface PendingStudy {
  /** El concepto del estudio: el `codeConceptId` de la orden, que es el `study_concept_id` de la oferta. */
  readonly conceptId: string;
  readonly name: string;
}

/** Un centro de imagenología, evaluado contra los estudios pendientes. */
interface ImagingCenter {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  /** «1,2 km», o `null` sin origen o sin coordenadas del centro. */
  readonly distance: string | null;
  readonly complete: boolean;
  /** Los estudios que este centro no ofrece, por su nombre. */
  readonly missing: readonly string[];
  readonly directions: string | null;
}

/** Lo que pinta la pestaña de imagenología. */
export interface ImagingResult {
  readonly studies: readonly PendingStudy[];
  readonly centers: readonly ImagingCenter[];
}

/**
 * Los estudios de imagenología sin resultado, uno por concepto. Cuenta como
 * imagenología la orden cuya categoría lo dice, o la que no trae categoría y
 * cuyo estudio tiene una modalidad de imagen; una orden de laboratorio nunca.
 *
 * La búsqueda va por concepto y no por el `studyCode` de la oferta: ese es el
 * código propio de cada centro; el concepto es lo que la orden y la oferta
 * comparten. El `code` del concepto sólo sirve para reconocer la modalidad.
 */
export function pendingImagingStudies(
  orders: readonly PatientOrder[],
  labels: ConceptLabels,
): readonly PendingStudy[] {
  const byConcept = new Map<string, PendingStudy>();
  for (const order of orders) {
    const study = labels.get(order.codeConceptId);
    if (study === undefined || order.hasReleasedResult) {
      continue;
    }
    const category = categoriaDeAnalisis(
      order.categoryConceptId === undefined ? undefined : labels.get(order.categoryConceptId)?.code,
    );
    // `LAB` también es una modalidad (la toma de muestras): sin categoría, un
    // análisis no es imagen.
    const modality = modalidadDeEstudio(study.code);
    const imaging =
      category === 'IMAGING' || (category === 'OTHER' && modality !== null && modality !== 'LAB');
    if (imaging) {
      byConcept.set(order.codeConceptId, { conceptId: order.codeConceptId, name: study.display });
    }
  }
  return [...byConcept.values()];
}

/** Un centro de la búsqueda, con sus faltantes dichos por su nombre. */
export function imagingCenterOf(
  item: DiagnosticUnitCoverageItem,
  studies: readonly PendingStudy[],
): ImagingCenter {
  const nameOf = new Map(studies.map((study) => [study.conceptId, study.name]));
  return {
    id: item.id,
    name: item.name,
    address: item.addressText,
    distance: item.distanceKm === null ? null : formatKm(item.distanceKm),
    complete: item.complete,
    missing: item.missingStudyConceptIds.map((id) => nameOf.get(id) ?? 'Un estudio pedido'),
    directions: directionsUrl(item.latitude, item.longitude),
  };
}
