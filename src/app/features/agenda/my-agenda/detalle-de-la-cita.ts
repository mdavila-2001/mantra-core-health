import { formatDate } from '@angular/common';

import {
  esReconsulta,
  type Booking,
} from '../../../core/data-access/scheduling/scheduling.types';

/**
 * El detalle de una cita, en pares rótulo/valor.
 *
 * ## Por qué es una función suelta y no vive en una de las dos vistas
 *
 * C-08 (2026-09-20) pide que en la semana cada cita **se despliegue con el
 * mismo globo que el día**. «El mismo» es literal: si la semana armara su
 * propia lista de campos, el día que se agregue uno —o que cambie cómo se dice
 * «Paciente sin nombre registrado»— una de las dos quedaría vieja y nadie se
 * enteraría hasta que alguien mirara las dos juntas.
 *
 * Vive acá y no en `day-view` ni en `my-agenda` porque las dos la consumen y
 * ninguna es dueña: el día la usa para su diálogo de detalle y la semana para
 * el globo que se abre al pasar el puntero o al llegar con el teclado.
 *
 * Es una función pura sobre el contrato (`Booking`) y no un componente: lo que
 * se comparte es **qué se dice**, no cómo se dibuja. El día lo muestra en un
 * diálogo con sus botones y la semana en un globo; forzar el mismo dibujo en
 * los dos lugares sería el error contrario.
 */
export interface ParDelDetalle {
  readonly label: string;
  readonly value: string;
}

/** Lo que se muestra cuando la API no mandó el nombre. */
export const SIN_NOMBRE_DE_PACIENTE = 'Paciente sin nombre registrado';

/** Lo que se muestra cuando un dato del detalle no vino. */
export const SIN_DATO_DEL_DETALLE = 'No informado';

/**
 * Cómo se nombra al paciente de una cita.
 *
 * Sin nombre no se inventa un relleno ni se muestra el uuid: se dice que no
 * está. Que falte es una condición del servidor —la API manda `patientName`
 * sólo al titular y al profesional de esa agenda—, no un error de la pantalla.
 */
export function pacienteDeLaCita(cita: Booking): string {
  return cita.patientName ?? SIN_NOMBRE_DE_PACIENTE;
}

/**
 * Los pares del detalle de una cita, en el orden en que se leen.
 *
 * `estado` entra ya resuelto: traducir el `statusConceptId` es del catálogo de
 * terminología, y quien tiene el mapa es la pantalla, no esta función.
 */
export function detalleDeLaCita(
  cita: Booking,
  estado: string,
  idioma: string,
  franja?: { readonly desde: Date; readonly hasta: Date },
): readonly ParDelDetalle[] {
  const hora = (valor: Date | undefined): string =>
    valor === undefined ? SIN_DATO_DEL_DETALLE : formatDate(valor, 'HH:mm', idioma);
  // La franja del bloque manda sobre la de la reserva: el día arma sus bloques
  // desde el CUPO, y la reserva puede traer otra hora si el servidor la movió.
  const desde = franja?.desde ?? cita.startAt;
  const hasta = franja?.hasta ?? cita.endAt;
  // C4 · «Qué es» dice Reconsulta cuando la cita salió de otra consulta. Es lo
  // primero que hay que saber al abrir el globo: una reconsulta se atiende
  // sabiendo que ya hubo una consulta antes.
  const reconsulta = esReconsulta(cita);
  const pares: ParDelDetalle[] = [
    { label: 'Cuándo', value: `${hora(desde)} – ${hora(hasta)}` },
    { label: 'Qué es', value: reconsulta ? 'Reconsulta' : 'Cita' },
    { label: 'Estado', value: estado },
    { label: 'Paciente', value: pacienteDeLaCita(cita) },
  ];
  // De cuándo era la consulta de la que salió. Se omite cuando aquélla quedó
  // sin horario: un par con un guión no dice nada que valga la línea.
  const origen = cita.followUpOf?.startAt;
  if (reconsulta && origen !== undefined && origen !== null) {
    pares.push({ label: 'De la cita del', value: formatDate(origen, "d 'de' MMMM", idioma) });
  }
  if (cita.reasonText !== undefined) {
    pares.push({ label: 'Motivo', value: cita.reasonText });
  }
  return pares;
}
