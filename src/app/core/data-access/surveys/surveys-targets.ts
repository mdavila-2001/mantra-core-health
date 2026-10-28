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
 * **PENDIENTE DEL CONTRATO.** La decisión es habilitar `CARE_TYPE` sólo para
 * consulta (hoy el backend responde 412). Lo que todavía no está definido es el
 * `targetId` —el DTO lo valida como UUID—, así que acá va un valor provisional
 * y estable. Cuando el backend fije el concepto de «consulta» se cambia
 * `ID_TIPO_ATENCION_CONSULTA` y nada más: ninguna pantalla lo escribe a mano.
 */
export const TIPO_DESTINO_CONSULTAS: SurveyTargetType = 'CARE_TYPE';

/** UUID provisional del tipo de atención «consulta». Ver {@link TIPO_DESTINO_CONSULTAS}. */
export const ID_TIPO_ATENCION_CONSULTA = '00000000-0000-4000-8000-0000000000c1';

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
