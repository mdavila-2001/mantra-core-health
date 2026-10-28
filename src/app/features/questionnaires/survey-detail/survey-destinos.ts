import {
  DESTINO_TODAS_MIS_CONSULTAS,
  destinoDeServicio,
  ID_TIPO_ATENCION_CONSULTA,
  TIPO_DESTINO_CONSULTAS,
  type DestinoDeEncuesta,
} from '../../../core/data-access/surveys/surveys-targets';
import type { SurveyAssignmentInfo } from '../../../core/data-access/surveys/surveys.types';
import type { ServiceOffering } from '../../../core/data-access/scheduling/scheduling.types';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';

/* ============================================================================
    El selector «Asociar a un servicio» de la ficha de una encuesta.

    Reemplaza el campo donde se pegaba un UUID. Lo que viaja sigue siendo un id
    —el de `billing.service_catalog.id`—, pero la persona elige por nombre y ve,
    por nombre, a qué está asociada hoy.
    ========================================================================== */

/** El valor de la opción «Todas mis consultas» en el selector. */
export const VALOR_TODAS_MIS_CONSULTAS = 'TODAS_MIS_CONSULTAS';

/** Un servicio del médico, deduplicado por su identidad de catálogo. */
export interface ServicioAsociable {
  /** `billing.service_catalog.id`: lo que viaja como `targetId`. */
  readonly id: string;
  readonly nombre: string;
  readonly activo: boolean;
}

/**
 * Los servicios que el médico ofrece, uno por servicio de catálogo.
 *
 * Se deduplica por `serviceCatalogId` y no por `ServiceOffering.id`: la oferta
 * es la fila de «cómo lo ofrece este profesional» (`scheduling.
 * practitioner_service_offerings.id`); la encuesta evalúa el servicio, que es lo
 * que la reserva lleva. Si hay dos ofertas del mismo servicio, queda la primera,
 * y se considera activo si lo está alguna.
 */
export function serviciosAsociables(ofertas: readonly ServiceOffering[]): readonly ServicioAsociable[] {
  const porId = new Map<string, ServicioAsociable>();
  for (const oferta of ofertas) {
    const previo = porId.get(oferta.serviceCatalogId);
    porId.set(oferta.serviceCatalogId, {
      id: oferta.serviceCatalogId,
      nombre: previo?.nombre ?? oferta.serviceName,
      activo: (previo?.activo ?? false) || oferta.isActive,
    });
  }
  return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Las opciones del selector: «Todas mis consultas» primero, después cada servicio. */
export function opcionesDeDestino(servicios: readonly ServicioAsociable[]): readonly SelectOption<string>[] {
  return [
    {
      value: VALOR_TODAS_MIS_CONSULTAS,
      label: 'Todas mis consultas',
      description: 'Se ofrece al terminar cualquier consulta, sin importar el servicio.',
    },
    ...servicios.map((s) => ({
      value: s.id,
      label: s.nombre,
      ...(s.activo ? {} : { description: 'Servicio desactivado' }),
    })),
  ];
}

/** Del valor del selector al destino que se manda a la API. */
export function destinoDeOpcion(valor: string): DestinoDeEncuesta {
  return valor === VALOR_TODAS_MIS_CONSULTAS ? DESTINO_TODAS_MIS_CONSULTAS : destinoDeServicio(valor);
}

/** Lo que se muestra de una asociación vigente: nombre, nunca el identificador. */
export interface AsociacionVisible {
  readonly id: string;
  readonly nombre: string;
  /** El tipo de destino dicho en palabras. */
  readonly tipo: string;
  /** El valor del selector con el que se la reconoce (para no asociar dos veces lo mismo). */
  readonly valor: string;
}

/**
 * Traduce las asociaciones del servidor a texto legible.
 *
 * Un servicio que el médico ya no ofrece se dice así, sin mostrar el UUID: el
 * identificador no le sirve a nadie para decidir qué hacer.
 */
export function asociacionesVisibles(
  asociaciones: readonly SurveyAssignmentInfo[],
  servicios: readonly ServicioAsociable[],
): readonly AsociacionVisible[] {
  const nombres = new Map(servicios.map((s) => [s.id, s.nombre]));
  return asociaciones.map((a) => {
    if (a.targetType === TIPO_DESTINO_CONSULTAS && a.targetId === ID_TIPO_ATENCION_CONSULTA) {
      return { id: a.id, nombre: 'Todas mis consultas', tipo: 'Tipo de atención', valor: VALOR_TODAS_MIS_CONSULTAS };
    }
    if (a.targetType === 'SERVICE') {
      return {
        id: a.id,
        nombre: nombres.get(a.targetId) ?? 'Un servicio que ya no figura entre los suyos',
        tipo: 'Servicio',
        valor: a.targetId,
      };
    }
    if (a.targetType === 'CARE_TYPE') {
      return { id: a.id, nombre: 'Un tipo de atención', tipo: 'Tipo de atención', valor: a.targetId };
    }
    return { id: a.id, nombre: 'Una cita puntual', tipo: 'Cita', valor: a.targetId };
  });
}
