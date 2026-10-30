import type { SurveyTargetType } from './surveys.types';

/* ============================================================================
    A qué se puede asociar una encuesta, y con qué identificador.

    Todo lo que depende del contrato de `POST /surveys/assignments` vive acá, en
    un solo lugar, para cambiarlo sin buscar por las pantallas.
    ========================================================================== */

/**
 * Identidad canónica del destino `SERVICE`: **`billing.service_catalog.id`**
 * (decisión de diseño 28/10/2026), que en el front es `ServiceOffering.
 * serviceCatalogId`.
 *
 * NO es `ServiceOffering.id`: ése es `scheduling.practitioner_service_offerings.
 * id`, la fila de «cómo este profesional ofrece el servicio». Dos médicos que
 * hacen el mismo estudio tienen ofertas distintas y el mismo servicio de
 * catálogo; la encuesta evalúa el servicio, y la reserva ya lleva ese id (vía
 * `service_catalog_id` de la oferta).
 */
export const DESTINO_SERVICIO: SurveyTargetType = 'SERVICE';

/**
 * El destino «Todas mis consultas»: el tipo de atención «consulta».
 *
 * El backend habilita `CARE_TYPE` sólo para consulta (`SURVEYS.CARE_TYPE_CONSULTATION`)
 * y rechaza cualquier otro id con 422 `SURVEY_ASSIGNMENT_CARE_TYPE_UNSUPPORTED`.
 * Es un concepto con id determinista (el mismo en todos los entornos). Se cambia
 * `ID_TIPO_ATENCION_CONSULTA` y nada más: ninguna pantalla lo escribe a mano.
 */
export const TIPO_DESTINO_CONSULTAS: SurveyTargetType = 'CARE_TYPE';

/** Id del concepto «consulta» (`SURVEYS.CARE_TYPE_CONSULTATION` en la API). Ver {@link TIPO_DESTINO_CONSULTAS}. */
export const ID_TIPO_ATENCION_CONSULTA = 'a0038828-6e68-55c5-aa59-d4c747035db6';

/** Un destino listo para mandar en `POST /surveys/assignments`. */
export interface DestinoDeEncuesta {
  readonly targetType: SurveyTargetType;
  readonly targetId: string;
}

/** «Todas mis consultas». */
export const DESTINO_TODAS_MIS_CONSULTAS: DestinoDeEncuesta = {
  targetType: TIPO_DESTINO_CONSULTAS,
  targetId: ID_TIPO_ATENCION_CONSULTA,
};

/** El destino de un servicio concreto, por su `billing.service_catalog.id`. */
export function destinoDeServicio(serviceCatalogId: string): DestinoDeEncuesta {
  return { targetType: DESTINO_SERVICIO, targetId: serviceCatalogId };
}
