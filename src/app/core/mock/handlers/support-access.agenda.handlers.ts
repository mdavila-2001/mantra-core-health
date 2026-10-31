import { BOOKING_STATUS } from '../fixtures/concepts';
import { ajustesDeAgenda, vinculos } from '../fixtures/support-hospital';
import { filaDeAgenda } from '../fixtures/support-hospital-agenda';
import { conflict, preconditionFailed, validation, type MockRouter } from '../mock-router';
import { ahora, cuerpo, nuevoId } from '../mock-store';
import { doctorPorId, anotar, negarSiNoPuede, etiquetaDePaciente } from './support-access.core';

/* ============================================================================
    Lo que ya tenía dueño y ahora también atiende al hospital piloto: retener,
    confirmar y registrar la llegada sobre sus horarios, y la búsqueda exacta de
    pacientes para quien tiene un vínculo de apoyo.
   ========================================================================== */

export function registrarApoyoAgenda(router: MockRouter): void {
  /* ---- agenda: lo que ya tenía dueño y ahora también atiende al hospital ---- */

  router.wrap('POST', '/scheduling/slots/:id/holds', (request, siguiente) => {
    const fila = filaDeAgenda(request.params['id']!);
    if (fila === undefined) return siguiente(request);
    const negado = negarSiNoPuede(request.user, fila, 'schedule.create');
    if (negado !== null) return negado;
    const estado = ajustesDeAgenda.get(fila.id)?.status ?? fila.status;
    if (estado !== 'FREE') return conflict('Ese horario ya no está libre.', { slotId: fila.id });
    return { status: 201, body: { id: nuevoId('hold'), holdToken: `hp-hold.${fila.id}`, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), remainingCapacity: 0 } };
  });

  router.wrap('POST', '/scheduling/holds/:token/confirm', (request, siguiente) => {
    const token = request.params['token'] ?? '';
    if (!token.startsWith('hp-hold.')) return siguiente(request);
    const fila = filaDeAgenda(token.slice('hp-hold.'.length));
    if (fila === undefined) return preconditionFailed('El hold venció o no existe');
    const negado = negarSiNoPuede(request.user, fila, 'schedule.create');
    if (negado !== null) return negado;
    const estado = ajustesDeAgenda.get(fila.id)?.status ?? fila.status;
    if (estado !== 'FREE') return conflict('Ese horario ya no está libre.', { slotId: fila.id });
    const datos = cuerpo<{ patientProfileId: string; reasonText?: string }>(request);
    const etiqueta = etiquetaDePaciente(datos.patientProfileId ?? '');
    ajustesDeAgenda.agregar({ id: fila.id, status: 'CONFIRMED', patientLabel: etiqueta, reasonLabel: datos.reasonText ?? 'Consulta' });
    const doctor = doctorPorId(fila.doctorId)!;
    anotar(fila.tenantId, request.user!.displayName, 'schedule.create', `${request.user!.displayName} creó una cita con ${doctor.name}.`, { doctorId: doctor.id, patientLabel: etiqueta.split(' · ')[0]!.split(' ').map((p) => p[0]).join('. ') });
    return { status: 201, body: { id: fila.id, bookableSlotId: fila.id, statusConceptId: BOOKING_STATUS['BK-CONFIRMED'], remindersScheduled: 0 } };
  });

  router.wrap('POST', '/scheduling/bookings/:id/check-in', (request, siguiente) => {
    const fila = filaDeAgenda(request.params['id']!);
    if (fila === undefined) return siguiente(request);
    const negado = negarSiNoPuede(request.user, fila, 'schedule.check_in');
    if (negado !== null) return negado;
    const estado = ajustesDeAgenda.get(fila.id)?.status ?? fila.status;
    if (estado === 'FREE') return preconditionFailed('Ese horario no tiene una cita.');
    const previo = ajustesDeAgenda.get(fila.id);
    ajustesDeAgenda.agregar({
      id: fila.id,
      status: 'CHECKED_IN',
      ...(previo?.patientLabel ?? fila.patientLabel ? { patientLabel: previo?.patientLabel ?? fila.patientLabel! } : {}),
      ...(previo?.reasonLabel ?? fila.reasonLabel ? { reasonLabel: previo?.reasonLabel ?? fila.reasonLabel! } : {}),
    });
    const doctor = doctorPorId(fila.doctorId)!;
    anotar(fila.tenantId, request.user!.displayName, 'schedule.check_in', `${request.user!.displayName} registró la llegada de un paciente de ${doctor.name}.`, { doctorId: doctor.id });
    return { bookingId: fila.id, checkedInAt: ahora() };
  });

  /**
   * La búsqueda de pacientes de quien tiene un vínculo de apoyo es **exacta**:
   * documento completo. Escribir «Juan» no devuelve nada (caso 13). Cada
   * búsqueda queda en la bitácora.
   */
  router.wrap('POST', '/profiles/patients/search', (request, siguiente) => {
    const user = request.user;
    const esApoyo = user !== null && vinculos.filtrar((v) => v.userId === user.id && v.status === 'ACTIVE').length > 0;
    if (!esApoyo) return siguiente(request);
    const datos = cuerpo<{ nationalId?: string; query?: string }>(request);
    const tenantId = vinculos.filtrar((v) => v.userId === user.id && v.status === 'ACTIVE')[0]!.tenantId;
    if (datos.nationalId === undefined || datos.nationalId.trim().length < 5) {
      anotar(tenantId, user.displayName, 'patient.search_refused', `${user.displayName} intentó una búsqueda parcial de pacientes y se rechazó.`);
      return validation('La búsqueda es exacta: escriba el documento completo del paciente.', [{ field: 'nationalId', message: 'escriba el documento completo' }]);
    }
    anotar(tenantId, user.displayName, 'patient.search', `${user.displayName} buscó a un paciente por documento.`);
    return siguiente(request);
  });
}
