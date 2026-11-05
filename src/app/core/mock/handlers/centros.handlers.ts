import {
  capacidadDeModalidad,
  horarioDeSemana,
  nombreDelHorarioGeneral,
  validarHorario,
} from '../../data-access/diagnostic-units/center-schedule.rules';
import type {
  CenterSchedule,
  CenterScheduleView,
  CenterStudy,
  OrderAppointment,
  OrderBookingOption,
} from '../../data-access/diagnostic-units/center-schedule.types';
import { esCodigoDeModalidad, modalidad, modalidadDeEstudio } from '../../data-access/diagnostic-units/modalidades';
import { reservas, type ReservaSimulada } from '../fixtures/agenda';
import { definirResolverCitaDeOrden, deviceDetails, horariosDeCentros, turnosDeOrdenes, type TurnoDeOrdenSimulado } from '../fixtures/centros';
import { orderList } from '../fixtures/clinic';
import { ACTIVITY, CANAL, BOOKING_STATUS, ESTUDIO, APPOINTMENT_TYPE } from '../fixtures/concepts';
import { patientById } from '../fixtures/people';
import { conflict, forbidden, noContent, notFound, unprocessable, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, cuerpo, nuevoId, uuid } from '../mock-store';
import { avisarPorChatDeSoporte, fechaDelAviso } from './aviso-por-chat';
import { bookingsOutsideSchedule, bookingsWithoutDevice, devicesOf, freeStarts, migrateModalities } from './center-devices.mock';
import { registerCenterEquipment } from './center-equipment.handlers';
import { estudiosDe, informes, pacienteDeSesion, sitioDe, UNIDADES, type UnidadSimulada } from './diagnostics.handlers';

/* ============================================================================
    Horarios y equipos de un centro de diagnóstico, y la reserva de un estudio
    desde la orden médica (mockup, 2026-10-06).

    El contrato de `center-schedule/` en la API (mantra-core-health-api#1342).
    Los equipos y sus rutas viven en `center-equipment.handlers.ts` y
    `center-devices.mock.ts`:

      GET    /diagnostic-units/me/schedule
      GET    /diagnostic-units/:unitId/schedule
      PUT    /diagnostic-units/:unitId/schedule
      GET    /diagnostic-units/:unitId/study-availability?studyCode&from&to
      GET    /diagnostic-results/me/orders/:orderId/booking-options
      POST   /diagnostic-results/me/orders/:orderId/booking
      DELETE /diagnostic-results/me/orders/:orderId/booking

    Las reglas de horario son las de `center-schedule.rules.ts`, las mismas que
    usa la pantalla del centro. Los turnos salen de cada equipo operativo.
    ========================================================================== */

/** Cuántos días hacia adelante se ofrecen turnos. */
const DIAS_DE_DISPONIBILIDAD = 14;

const ESTUDIO_POR_CONCEPTO = new Map(Object.entries(ESTUDIO).map(([code, id]) => [id, code]));

const unidadPorId = (id: string): UnidadSimulada | undefined => UNIDADES.find((u) => u.id === id);

/** El recurso de agenda del centro que crea `abrirAgendaDeCentro()`. */
const recursoDelCentro = (u: UnidadSimulada): string => uuid(`resource-diagnostic-${u.id}`);

/** El horario con el que arranca un centro que todavía no tocó nada. */
export function horarioDeFabrica(u: UnidadSimulada): CenterSchedule {
  return u.kind === 'LABORATORY'
    ? { general: horarioDeSemana('07:00', '10:00', 15, [1, 2, 3, 4, 5, 6]), modalities: [], studies: [] }
    : { general: horarioDeSemana('08:00', '17:00', 30), modalities: [], studies: [] };
}

export function horarioDe(u: UnidadSimulada): CenterSchedule {
  return horariosDeCentros.get(u.id)?.schedule ?? horarioDeFabrica(u);
}

/** Los estudios del catálogo de órdenes que ofrece el centro. */
export function estudiosDelCentro(u: UnidadSimulada): readonly CenterStudy[] {
  const salida: CenterStudy[] = [];
  for (const e of estudiosDe(u)) {
    const code = ESTUDIO_POR_CONCEPTO.get((e as { conceptId?: string }).conceptId ?? '');
    if (code === undefined) continue;
    const modalityCode = modalidadDeEstudio(code);
    if (modalityCode === null) continue;
    const precio = (e as unknown as { prices?: readonly { amount: number | string; currency?: { code: string } | string }[] }).prices?.[0];
    salida.push({
      code,
      name: e.name,
      modalityCode,
      price: precio === undefined ? null : Number(precio.amount),
      currency: precio === undefined ? null : typeof precio.currency === 'string' ? precio.currency : (precio.currency?.code ?? 'BOB'),
      preparation: preparacionDe(code),
    });
  }
  return salida;
}

/**
 * Lo que el paciente tiene que saber antes de ir. Indicaciones generales de
 * la maqueta, rotuladas como tales en la pantalla: el centro real publica las
 * suyas en `preparation_instructions`.
 */
function preparacionDe(code: string): string | null {
  switch (code) {
    case 'STUDY-ECO-ABD':
      return 'Ayuno de 6 a 8 horas.';
    case 'STUDY-ECO-OBSTETRICA':
      return 'Tome un litro de agua una hora antes y no orines.';
    case 'STUDY-GLUCOSA':
    case 'STUDY-PERFIL-LIPIDICO':
      return 'Ayuno de 8 a 12 horas. Puede tomar agua.';
    case 'STUDY-MAMOGRAFIA':
      return 'No use desodorante ni talco ese día.';
    default:
      return null;
  }
}

function esPersonalDelCentro(request: MockRequest, u: UnidadSimulada): boolean {
  const user = request.user;
  if (user === undefined || user === null) return false;
  return user.key === 'superadmin' || user.tenants.includes(u.tenantId);
}

function vistaDelCentro(u: UnidadSimulada): CenterScheduleView {
  return {
    bookingsWithoutEquipment: bookingsWithoutDevice(u, horarioDe(u)),
    unitId: u.id,
    unitName: u.name,
    kind: u.kind,
    schedule: horarioDe(u),
    studies: estudiosDelCentro(u),
    equipment: devicesOf(u),
    updatedAt: horariosDeCentros.get(u.id)?.updatedAt ?? null,
  };
}

function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (g: number): number => (g * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** La casa del paciente, o la plaza de su ciudad si nunca la marcó (igual que su perfil). */
const PLAZA_DE_SANTA_CRUZ = { lat: -17.7833, lng: -63.1821 };

function turnoComoCita(t: TurnoDeOrdenSimulado): OrderAppointment | null {
  const u = unidadPorId(t.unitId);
  if (u === undefined) return null;
  const estudio = estudiosDelCentro(u).find((e) => e.code === t.studyCode);
  const sitio = sitioDe(u) as { addressText?: string | null };
  return {
    bookingId: t.bookingId,
    unitId: u.id,
    unitName: u.name,
    addressText: sitio.addressText ?? null,
    startAt: t.startAt,
    endAt: t.endAt,
    studyName: estudio?.name ?? t.studyCode,
    price: estudio?.price ?? null,
    currency: estudio?.currency ?? null,
    preparation: estudio?.preparation ?? null,
  };
}

/** El turno activo de una orden, para la lista «Mis órdenes». */
export function citaDeOrden(orderId: string): OrderAppointment | null {
  const t = turnosDeOrdenes.get(orderId);
  return t === undefined ? null : turnoComoCita(t);
}

function ordenDelPaciente(request: MockRequest) {
  const orden = orderList.get(request.params['orderId'] ?? '');
  if (orden === undefined) return { error: notFound('Orden no encontrada') } as const;
  if (orden.patientProfileId !== pacienteDeSesion(request)) return { error: notFound('Orden no encontrada') } as const;
  const studyCode = ESTUDIO_POR_CONCEPTO.get(orden.codeConceptId);
  const modalityCode = studyCode === undefined ? null : modalidadDeEstudio(studyCode);
  if (studyCode === undefined || modalityCode === null) {
    return { error: unprocessable('Esta orden no es de un estudio que se reserve en un centro.') } as const;
  }
  // La autoridad es el servidor: una orden con su resultado publicado ya se
  // hizo, y no se reserva aunque alguien llegue a la URL de reserva.
  if (informes.filtrar((i) => i.serviceRequestId === orden.id && i.released).length > 0) {
    return { error: conflict('Esta orden ya tiene su resultado: no hace falta reservar.') } as const;
  }
  return { orden, studyCode, modalityCode } as const;
}

export function registrarCentros(router: MockRouter): void {
  definirResolverCitaDeOrden(citaDeOrden);
  registerCenterEquipment(router, { view: vistaDelCentro, scheduleOf: horarioDe });

  // El centro de la organización activa: la pantalla del centro no sabe su id
  // de unidad, sabe con qué organización entró.
  router.get('/diagnostic-units/me/schedule', (request) => {
    const tenants = request.user?.tenants ?? [];
    const u = UNIDADES.find((x) => x.publiclyListed && tenants.includes(x.tenantId));
    if (u === undefined) return notFound('Su organización no tiene un centro de diagnóstico con agenda.');
    return vistaDelCentro(u);
  });

  router.get('/diagnostic-units/:unitId/schedule', (request) => {
    const u = unidadPorId(request.params['unitId']!);
    if (u === undefined) return notFound('Centro no encontrado');
    if (!esPersonalDelCentro(request, u)) return forbidden('Sólo el personal del centro ve su agenda.');
    return vistaDelCentro(u);
  });

  router.put('/diagnostic-units/:unitId/schedule', (request) => {
    const u = unidadPorId(request.params['unitId']!);
    if (u === undefined) return notFound('Centro no encontrado');
    if (!esPersonalDelCentro(request, u)) return forbidden('Sólo el personal del centro cambia su agenda.');
    const datos = cuerpo<Partial<CenterSchedule>>(request);
    const schedule: CenterSchedule = {
      general: datos.general ?? horarioDeFabrica(u).general,
      modalities: (datos.modalities ?? []).filter((m) => esCodigoDeModalidad(m.modalityCode)),
      studies: (datos.studies ?? []).filter((s) => modalidadDeEstudio(s.studyCode) !== null),
    };
    // A modality schedule is a default for devices: with devices it becomes
    // their own hours, and it only stays published while it has none.
    const problemas = validarHorario(schedule, (donde) =>
      donde === 'general'
        ? nombreDelHorarioGeneral(schedule)
        : esCodigoDeModalidad(donde)
          ? modalidad(donde).label
          : (estudiosDelCentro(u).find((e) => e.code === donde)?.name ?? donde),
    );
    if (problemas.length > 0) return unprocessable('El horario tiene datos incompletos.', problemas.map((p) => ({ field: p.donde, problem: p.mensaje })));
    const before = devicesOf(u).map((d) => ({ id: d.id, detail: deviceDetails.get(d.id) }));
    const conservadas = migrateModalities(u, schedule.modalities, ahora());
    const publicado: CenterSchedule = { ...schedule, modalities: conservadas };
    const afectados = bookingsOutsideSchedule(u, publicado);
    if (afectados > 0) {
      for (const { id, detail } of before) {
        if (detail === undefined) deviceDetails.borrar(id);
        else deviceDetails.agregar(detail);
      }
      return conflict(`Hay ${afectados} turno${afectados === 1 ? '' : 's'} reservado${afectados === 1 ? '' : 's'} que quedaría${afectados === 1 ? '' : 'n'} fuera del horario nuevo.`, {
        affectedBookings: afectados,
      });
    }
    horariosDeCentros.agregar({ id: u.id, schedule: publicado, updatedAt: ahora() });
    return vistaDelCentro(u);
  });

  router.get('/diagnostic-units/:unitId/study-availability', (request) => {
    const u = unidadPorId(request.params['unitId']!);
    if (u === undefined) return notFound('Centro no encontrado');
    const studyCode = request.query.get('studyCode') ?? '';
    if (!estudiosDelCentro(u).some((e) => e.code === studyCode)) return notFound('El centro no hace ese estudio');
    const desde = new Date(request.query.get('from') ?? Date.now());
    const hasta = new Date(request.query.get('to') ?? Date.now() + DIAS_DE_DISPONIBILIDAD * 86_400_000);
    const { origin, items } = freeStarts(u, horarioDe(u), studyCode, desde, hasta);
    return { unitId: u.id, studyCode, origin, items };
  });

  router.get('/diagnostic-results/me/orders/:orderId/booking-options', (request) => {
    const r = ordenDelPaciente(request);
    if ('error' in r) return r.error;
    const paciente = patientById(r.orden.patientProfileId) as { homeLat?: number | null; homeLng?: number | null } | undefined;
    const casa =
      paciente?.homeLat != null && paciente.homeLng != null ? { lat: paciente.homeLat, lng: paciente.homeLng } : PLAZA_DE_SANTA_CRUZ;
    const desde = new Date();
    const hasta = new Date(Date.now() + DIAS_DE_DISPONIBILIDAD * 86_400_000);
    const options: OrderBookingOption[] = [];
    for (const u of UNIDADES) {
      if (!u.publiclyListed) continue;
      const estudio = estudiosDelCentro(u).find((e) => e.code === r.studyCode);
      if (estudio === undefined) continue;
      const sitio = sitioDe(u) as { addressText?: string | null };
      const { items } = freeStarts(u, horarioDe(u), r.studyCode, desde, hasta);
      options.push({
        unitId: u.id,
        unitName: u.name,
        addressText: sitio.addressText ?? null,
        price: estudio.price,
        currency: estudio.currency,
        distanceKm: Number.isFinite(u.lat) && Number.isFinite(u.lng) ? distanciaKm(casa.lat, casa.lng, u.lat, u.lng) : null,
        nextStartAt: items[0]?.startAt ?? null,
        preparation: estudio.preparation,
        operationalEquipment: capacidadDeModalidad(devicesOf(u), r.modalityCode),
      });
    }
    // Primero los que pueden atender pronto; sin turnos, al final.
    options.sort((a, b) => (a.nextStartAt ?? '9999').localeCompare(b.nextStartAt ?? '9999'));
    return {
      orderId: r.orden.id,
      studyCode: r.studyCode,
      studyName: estudioNombre(r.studyCode),
      modalityCode: r.modalityCode,
      modalityLabel: modalidad(r.modalityCode).label,
      options,
    };
  });

  router.post('/diagnostic-results/me/orders/:orderId/booking', (request) => {
    const r = ordenDelPaciente(request);
    if ('error' in r) return r.error;
    if (turnosDeOrdenes.has(r.orden.id)) return conflict('Esta orden ya tiene un turno. Cancélelo para elegir otro.');
    const { unitId, startAt } = cuerpo<{ unitId?: string; startAt?: string }>(request);
    const u = unidadPorId(unitId ?? '');
    if (u === undefined) return notFound('Centro no encontrado');
    const inicio = new Date(startAt ?? '');
    if (Number.isNaN(inicio.getTime())) return unprocessable('Falta el horario elegido.');
    const libres = freeStarts(u, horarioDe(u), r.studyCode, inicio, inicio);
    const libre = libres.items.find((i) => i.startAt === inicio.toISOString());
    if (libre === undefined) return conflict('Ese horario se acaba de ocupar. Elija otro.', { slotTaken: true });
    const paciente = patientById(r.orden.patientProfileId);
    const estudio = estudiosDelCentro(u).find((e) => e.code === r.studyCode)!;
    const reserva: ReservaSimulada = {
      id: nuevoId('booking'),
      patientProfileId: r.orden.patientProfileId,
      resourceId: recursoDelCentro(u),
      bookableSlotId: nuevoId('slot'),
      appointmentId: nuevoId('appointment'),
      typeConceptId: APPOINTMENT_TYPE['APT-PRIMERA']!,
      startAt: libre.startAt,
      endAt: libre.endAt,
      statusConceptId: BOOKING_STATUS['BK-CONFIRMED']!,
      serviceConceptId: ACTIVITY['ACT-EXAMEN']!,
      bookingChannelConceptId: CANAL['CH-PRESENCIAL']!,
      confirmedAt: ahora(),
      checkedInAt: null,
      reasonText: estudio.name,
      patientName: paciente?.displayName ?? 'Paciente',
      insuranceCarrierName: paciente?.aseguradora ?? null,
      rescheduledFrom: null,
      statusReason: null,
      delayNotice: null,
      paymentState: null,
      followUpOf: null,
      createdAt: ahora(),
    };
    reservas.agregar(reserva);
    const turno = turnosDeOrdenes.agregar({
      id: r.orden.id,
      patientProfileId: r.orden.patientProfileId,
      bookingId: reserva.id,
      unitId: u.id,
      studyCode: r.studyCode,
      modalityCode: r.modalityCode,
      startAt: libre.startAt,
      endAt: libre.endAt,
      createdAt: ahora(),
      equipmentId: libres.devicesAt.get(libre.startAt)![0]!,
    });
    avisarPorChatDeSoporte(
      r.orden.patientProfileId,
      `Su cita para ${estudio.name} en ${u.name} quedó confirmado para el ${fechaDelAviso(libre.startAt)}.` +
        (estudio.preparation === null ? '' : ` Preparación: ${estudio.preparation}`) +
        ' Puede verlo en «Mis órdenes».',
    );
    return { status: 201, body: turnoComoCita(turno) };
  });

  router.delete('/diagnostic-results/me/orders/:orderId/booking', (request) => {
    const r = ordenDelPaciente(request);
    if ('error' in r) return r.error;
    const turno = turnosDeOrdenes.get(r.orden.id);
    if (turno === undefined) return notFound('La orden no tiene cita');
    reservas.actualizar(turno.bookingId, {
      statusConceptId: BOOKING_STATUS['BK-CANCELLED']!,
      statusReason: { reasonText: 'Cancelado por el paciente', actorKind: 'PATIENT', toStateConceptId: BOOKING_STATUS['BK-CANCELLED']!, changedAt: ahora() },
    });
    turnosDeOrdenes.borrar(turno.id);
    return noContent();
  });
}

function estudioNombre(code: string): string {
  for (const u of UNIDADES) {
    const e = estudiosDelCentro(u).find((x) => x.code === code);
    if (e !== undefined) return e.name;
  }
  return code;
}

