/**
 * La reconsulta: los campos del contrato de agenda que el carril C4 estrena.
 *
 * ## Por qué viven acá y no en `scheduling.types.ts`
 *
 * `scheduling.types.ts` son los **tipos congelados** del paquete «Encuentro
 * clínico» y los publica C0. Este archivo es el propio de C4: declara lo que
 * `POST /scheduling/appointments/direct` acepta de más y lo que
 * `GET /scheduling/bookings` devuelve de más, sin tocar el archivo compartido y
 * sin esperar a que nadie entregue.
 *
 * Cada declaración lleva su `// TODO C8` con el destino exacto.
 *
 * ## Qué es una reconsulta, en una línea
 *
 * «Volvé el jueves por esto mismo»: una cita nueva y real —con su cupo, su
 * estado y su lugar en las dos agendas— que **recuerda de qué consulta salió**.
 * No es un estado de la cita anterior ni una nota: es una cita.
 */

import type { Booking, BookingPage } from './scheduling.types';

/**
 * De qué consulta salió una reconsulta.
 *
 * `encounterId` es `null` cuando la cita de origen no tiene encuentro clínico
 * detrás. No es un fallo: la reserva nace en la agenda y el encuentro es un
 * registro posterior, así que se puede citar de nuevo a alguien desde una cita
 * que todavía no abrió su consulta.
 *
 * // TODO C8: subir a `scheduling.types.ts` cuando C0 publique los tipos congelados.
 */
export interface FollowUpOrigin {
  /** La reserva de la que nace esta reconsulta. */
  readonly bookingId: string;
  /** El encuentro clínico de esa reserva, si lo tenía. */
  readonly encounterId: string | null;
}

/**
 * El origen tal como **se lee**: el mismo vínculo, con cuándo fue esa consulta
 * ya resuelto por el servidor.
 *
 * `startAt` no viaja en la escritura —se manda un identificador, no una
 * fecha—, pero sí en la lectura, y no es un adorno: lo que la fila de la
 * agenda y la tarjeta del paciente tienen que decir es «de la cita del 12 de
 * septiembre». Con sólo el identificador, cada pantalla tendría que pedir la
 * cita de origen de cada reconsulta —una petición por fila— o quedarse sin
 * poder nombrarla.
 *
 * Ausente o `null` es un estado corriente: la cita de origen puede haber
 * quedado sin cupo. Ahí el sello va solo, sin la frase.
 *
 * // TODO C8: subir a `scheduling.types.ts`. Pendiente de backend **P42**: la
 * lectura tiene que resolverlo en `BookingItemDto`.
 */
export interface FollowUpOriginRef extends FollowUpOrigin {
  readonly startAt?: Date | null;
}

/**
 * Lo que una cita lee de su reconsulta, en los dos sentidos.
 *
 * Se declara como mezcla estructural y no como extensión de `Booking` a
 * propósito: así lo pueden cumplir tanto el contrato de la API como la fila del
 * simulador, que no comparten tipo.
 *
 * // TODO C8: subir los dos campos a `Booking` en `scheduling.types.ts`.
 */
export interface ConReconsulta {
  /** De qué cita salió ésta, si es una reconsulta. */
  readonly followUpOf?: FollowUpOriginRef | null;
  /** La reconsulta que salió de ésta, si ya se agendó una. */
  readonly followUpBookingId?: string | null;
}

/**
 * El vínculo tal como viaja por la red: el instante todavía en texto.
 *
 * // TODO C8: idem, acompaña a `FollowUpOriginRef`.
 */
export interface WireConReconsulta {
  readonly followUpOf?: (FollowUpOrigin & { readonly startAt?: string | null }) | null;
  readonly followUpBookingId?: string | null;
}

/**
 * El origen con su instante convertido, o nada si no vino.
 *
 * Se omite en vez de normalizarse a `null`: la clave declarada pisaría, y
 * «no es una reconsulta» tiene que poder distinguirse mirando un solo campo.
 */
export function aOrigenDeReconsulta(
  origen: WireConReconsulta['followUpOf'],
): Pick<ConReconsulta, 'followUpOf'> {
  if (origen === undefined || origen === null) {
    return origen === null ? { followUpOf: null } : {};
  }
  const { startAt, ...resto } = origen;
  return {
    followUpOf: {
      ...resto,
      ...(startAt === undefined || startAt === null ? {} : { startAt: new Date(startAt) }),
    },
  };
}

/**
 * Una cita con el vínculo de reconsulta ya resuelto, en los dos sentidos.
 *
 * Es asignable a `Booking`, así que las pantallas que no saben de reconsultas
 * siguen compilando sin tocarlas.
 *
 * // TODO C8: desaparece cuando los dos campos vivan en `Booking`.
 */
export type BookingConReconsulta = Booking & ConReconsulta;

/** Una ventana de citas con el vínculo resuelto. // TODO C8: idem. */
export type BookingPageConReconsulta = Omit<BookingPage, 'items'> & {
  readonly items: readonly BookingConReconsulta[];
};

/**
 * Lo que `POST /scheduling/appointments/direct` acepta de más para una
 * reconsulta.
 *
 * // TODO C8: el campo sube a `NewDirectAppointment` en `scheduling.types.ts`.
 */
export interface ConOrigenDeReconsulta {
  /**
   * De qué consulta sale esta cita.
   *
   * **Ausente es una cita puntual corriente**, que es lo que agendan
   * `appointment-new` y el mostrador: los rechazos propios de la reconsulta
   * —403, 404, 422 y 409— sólo corren cuando este campo viaja.
   */
  readonly followUpOf?: FollowUpOrigin;
}

/**
 * Si una cita es una reconsulta.
 *
 * Se pregunta por `followUpOf` y **no** por el `typeConceptId`: el origen es el
 * dato que el servidor garantiza y el que la pantalla necesita para poder
 * decir «de la cita del …». El tipo de cita es una clasificación del catálogo
 * que puede llegar más tarde —o no llegar—, y una cita sin origen no es una
 * reconsulta por más que la clasifiquen así.
 */
export function esReconsulta(cita: ConReconsulta): boolean {
  return cita.followUpOf !== undefined && cita.followUpOf !== null;
}

/**
 * El motivo que se propone para una reconsulta, a partir del de la cita origen.
 *
 * Se antepone «Reconsulta: » una sola vez: quien cita de nuevo a alguien que ya
 * venía de una reconsulta no debería terminar con «Reconsulta: Reconsulta: …».
 * Sin motivo de origen queda la palabra sola, que sigue diciendo algo.
 */
export function motivoDeReconsulta(motivoDeOrigen: string | null | undefined): string {
  const origen = (motivoDeOrigen ?? '').trim();
  if (origen === '') {
    return 'Reconsulta';
  }
  return origen.startsWith('Reconsulta:') ? origen : `Reconsulta: ${origen}`;
}
