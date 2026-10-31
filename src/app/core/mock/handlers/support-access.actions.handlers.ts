import { BOOKING_STATUS } from '../fixtures/concepts';
import { ajustesDeAgenda, esperasDeApoyo } from '../fixtures/support-hospital';
import { agendaDePartida, filaDeAgenda, recursoDeAgenda, type FilaAgendaBase } from '../fixtures/support-hospital-agenda';
import { forbidden, notFound, preconditionFailed, type MockRouter } from '../mock-router';
import { ahora, cuerpo, nuevoId } from '../mock-store';
import { desafioDeCancelacion } from './support-access.challenges';
import { anotar, doctorPorId, etiquetaDePaciente, negarSiNoPuede } from './support-access.core';
import { conMotivo, juzgarMotivo } from './support-access.errors';

/* ============================================================================
    Las acciones de la agenda combinada que no son crear ni registrar la llegada:
    **cancelar**, **reprogramar**, **confirmar**, **atender sin cita** y la
    **lista de espera**. Cada una envuelve la ruta que ya tiene dueño (la de
    agenda de siempre) y atiende solo los identificadores del hospital piloto.

    La decisión de «puede o no puede» es la misma que en el resto: sale de lo que
    cubre cada permiso (`negarSiNoPuede`). En el hospital piloto el identificador
    de la cita **es** el del horario donde está, así que reprogramar mueve el
    contenido de un horario a otro.
   ========================================================================== */

function estadoDe(fila: FilaAgendaBase): FilaAgendaBase['status'] | 'CANCELLED' {
  return ajustesDeAgenda.get(fila.id)?.status ?? fila.status;
}

function contenidoDe(fila: FilaAgendaBase): { patientLabel?: string; reasonLabel?: string } {
  const ajuste = ajustesDeAgenda.get(fila.id);
  const patientLabel = ajuste?.patientLabel ?? fila.patientLabel;
  const reasonLabel = ajuste?.reasonLabel ?? fila.reasonLabel;
  return {
    ...(patientLabel === undefined ? {} : { patientLabel }),
    ...(reasonLabel === undefined ? {} : { reasonLabel }),
  };
}

function nombreDeDoctor(fila: FilaAgendaBase): string {
  return doctorPorId(fila.doctorId)?.name ?? 'el doctor';
}

/** El horario donde cae una agenda (recurso) a una hora, o `undefined` si no es del hospital piloto. */
let porRecurso: ReadonlyMap<string, FilaAgendaBase> | null = null;
function filaPorRecurso(resourceId: string, startAt: string): FilaAgendaBase | undefined {
  if (porRecurso === null) {
    const mapa = new Map<string, FilaAgendaBase>();
    for (const fila of agendaDePartida()) mapa.set(`${recursoDe(fila)}|${new Date(fila.start).getTime()}`, fila);
    porRecurso = mapa;
  }
  return porRecurso.get(`${resourceId}|${new Date(startAt).getTime()}`);
}
function recursoDe(fila: FilaAgendaBase): string {
  return recursoDeAgenda(fila.doctorId, fila.careSpaceId);
}

export function registrarApoyoAcciones(router: MockRouter): void {
  router.wrap('POST', '/scheduling/bookings/:id/cancel', (request, siguiente) => {
    const fila = filaDeAgenda(request.params['id']!);
    if (fila === undefined) return siguiente(request);
    const negado = negarSiNoPuede(request.user, fila, 'schedule.cancel');
    if (negado !== null) return negado;
    const estado = estadoDe(fila);
    if (estado === 'FREE' || estado === 'CANCELLED') return preconditionFailed('Ese horario no tiene una cita vigente.');
    const juicio = juzgarMotivo(cuerpo<{ reasonText: unknown }>(request).reasonText, 'cancelar la cita');
    if (!juicio.ok) return juicio.respuesta;
    const motivo = juicio.motivo;
    // Cancelar con menos antelación de la que fija el permiso pide la aprobación del doctor (403 `APPROVAL_REQUIRED`).
    const desafio = desafioDeCancelacion(request, fila);
    if (desafio !== null) return desafio;
    const { patientLabel } = contenidoDe(fila);
    ajustesDeAgenda.agregar({ id: fila.id, status: 'FREE' });
    anotar(fila.tenantId, request.user!.displayName, 'schedule.cancel', `${request.user!.displayName} canceló una cita de ${nombreDeDoctor(fila)}: ${motivo}`, {
      doctorId: fila.doctorId,
      ...(patientLabel === undefined ? {} : { patientLabel: patientLabel.split(' · ')[0]!.split(' ').map((p) => p[0]).join('. ') }),
    });
    return { bookingId: fila.id, capacityReleased: true };
  });

  router.wrap('POST', '/scheduling/bookings/:id/reschedule', (request, siguiente) => {
    const origen = filaDeAgenda(request.params['id']!);
    if (origen === undefined) return siguiente(request);
    const datos = cuerpo<{ toSlotId: string; reasonText: unknown }>(request);
    const destino = filaDeAgenda(datos.toSlotId ?? '');
    // El mismo 404 exista o no el destino, y sea o no de otra organización: no se confirma que existe.
    if (destino === undefined || destino.tenantId !== origen.tenantId) return notFound('El horario de destino no existe.');
    const sinPermisoOrigen = negarSiNoPuede(request.user, origen, 'schedule.reschedule');
    if (sinPermisoOrigen !== null) return sinPermisoOrigen;
    const sinPermisoDestino = negarSiNoPuede(request.user, destino, 'schedule.reschedule');
    if (sinPermisoDestino !== null) return sinPermisoDestino;
    const estado = estadoDe(origen);
    if (estado !== 'BOOKED' && estado !== 'CONFIRMED') return preconditionFailed('Solo se reprograma una cita reservada o confirmada.');
    if (estadoDe(destino) !== 'FREE') return conMotivo(422, 'Ese horario ya no está libre.', 'RESCHEDULE_TARGET_NOT_FREE', { slotId: destino.id });
    if (new Date(destino.start).getTime() <= Date.now()) return conMotivo(422, 'Ese horario ya pasó.', 'RESCHEDULE_TARGET_NOT_FUTURE', { field: 'toSlotId' });
    if (destino.healthcareServiceId !== origen.healthcareServiceId) {
      return conMotivo(422, 'Solo se puede mover la cita a un horario del mismo servicio.', 'RESCHEDULE_TARGET_OTHER_SERVICE', { field: 'toSlotId' });
    }
    const juicio = juzgarMotivo(datos.reasonText, 'reprogramar la cita');
    if (!juicio.ok) return juicio.respuesta;
    const motivo = juicio.motivo;
    const contenido = contenidoDe(origen);
    ajustesDeAgenda.agregar({ id: destino.id, status: estado, ...contenido });
    ajustesDeAgenda.agregar({ id: origen.id, status: 'FREE' });
    anotar(origen.tenantId, request.user!.displayName, 'schedule.reschedule', `${request.user!.displayName} movió una cita de ${nombreDeDoctor(origen)}: ${motivo}`, {
      doctorId: origen.doctorId,
    });
    return { bookingId: destino.id, fromSlotId: origen.id, toSlotId: destino.id };
  });

  router.wrap('POST', '/scheduling/bookings/:id/accept', (request, siguiente) => {
    const fila = filaDeAgenda(request.params['id']!);
    if (fila === undefined) return siguiente(request);
    const negado = negarSiNoPuede(request.user, fila, 'schedule.confirm');
    if (negado !== null) return negado;
    if (estadoDe(fila) !== 'BOOKED') return preconditionFailed('Esa cita no está esperando confirmación.');
    ajustesDeAgenda.agregar({ id: fila.id, status: 'CONFIRMED', ...contenidoDe(fila) });
    anotar(fila.tenantId, request.user!.displayName, 'schedule.confirm', `${request.user!.displayName} confirmó una cita de ${nombreDeDoctor(fila)}.`, { doctorId: fila.doctorId });
    return { bookingId: fila.id, statusConceptId: BOOKING_STATUS['BK-CONFIRMED'], occurredAt: ahora() };
  });

  /** «Atender sin cita» (y la cita directa) sobre un horario del hospital piloto. */
  router.wrap('POST', '/scheduling/appointments/direct', (request, siguiente) => {
    const datos = cuerpo<{ patientProfileId: string; resourceId: string; startAt: string; walkIn: boolean; reasonText: string; careSpaceId?: string; healthcareServiceId?: string }>(request);
    const fila = filaPorRecurso(datos.resourceId ?? '', datos.startAt ?? '');
    if (fila === undefined) return siguiente(request);
    const negado = negarSiNoPuede(request.user, fila, datos.walkIn === true ? 'schedule.walk_in' : 'schedule.create');
    if (negado !== null) return negado;
    // Lo que declara la persona de apoyo se contrasta con los lugares y servicios PROPIOS del doctor: si no atiende ahí o no
    // presta ese servicio (o no tiene servicios propios), 403 con el motivo, distinto del 403 genérico de apoyo.
    const doctor = doctorPorId(fila.doctorId);
    if (datos.careSpaceId !== undefined && !(doctor?.placements ?? []).some((p) => p.careSpaceId === datos.careSpaceId)) {
      return forbidden('El doctor no atiende en ese espacio.');
    }
    if (datos.healthcareServiceId !== undefined && !(doctor?.placements ?? []).some((p) => p.healthcareServiceId === datos.healthcareServiceId)) {
      return forbidden('El doctor no presta ese servicio.');
    }
    if (estadoDe(fila) !== 'FREE') return conMotivo(409, 'Ese horario ya no está libre.', 'SLOT_NOT_AVAILABLE', { slotId: fila.id });
    const etiqueta = etiquetaDePaciente(datos.patientProfileId ?? '');
    ajustesDeAgenda.agregar({
      id: fila.id,
      status: datos.walkIn === true ? 'CHECKED_IN' : 'CONFIRMED',
      patientLabel: etiqueta,
      reasonLabel: datos.reasonText ?? (datos.walkIn === true ? 'Sin cita' : 'Consulta'),
    });
    anotar(
      fila.tenantId,
      request.user!.displayName,
      datos.walkIn === true ? 'schedule.walk_in' : 'schedule.create',
      `${request.user!.displayName} ${datos.walkIn === true ? 'atendió sin cita a un paciente de' : 'creó una cita con'} ${nombreDeDoctor(fila)}.`,
      { doctorId: fila.doctorId },
    );
    return {
      status: 201,
      body: {
        bookingId: fila.id,
        bookableSlotId: fila.id,
        statusConceptId: BOOKING_STATUS['BK-CONFIRMED'],
        retractedSlots: 0,
        // Atender sin cita deja la llegada registrada en el mismo gesto.
        ...(datos.walkIn === true ? { checkedInAt: ahora() } : {}),
      },
    };
  });

  router.wrap('POST', '/scheduling/waitlist', (request, siguiente) => {
    const datos = cuerpo<{ patientProfileId: string; bookableSlotId: string }>(request);
    const fila = datos.bookableSlotId === undefined ? undefined : filaDeAgenda(datos.bookableSlotId);
    if (fila === undefined) return siguiente(request);
    const negado = negarSiNoPuede(request.user, fila, 'schedule.waitlist');
    if (negado !== null) return negado;
    const espera = esperasDeApoyo.agregar({ id: nuevoId('espera'), slotId: fila.id, patientLabel: etiquetaDePaciente(datos.patientProfileId ?? ''), createdAt: ahora() });
    anotar(fila.tenantId, request.user!.displayName, 'schedule.waitlist', `${request.user!.displayName} anotó a un paciente en la lista de espera de ${nombreDeDoctor(fila)}.`, { doctorId: fila.doctorId });
    return { status: 201, body: { id: espera.id, priority: 3, statusConceptId: BOOKING_STATUS['BK-CONFIRMED'] } };
  });
}
