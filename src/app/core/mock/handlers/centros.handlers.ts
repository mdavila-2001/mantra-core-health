import {
  capacidadDeModalidad,
  horarioDeSemana,
  nombreDelHorarioGeneral,
  resolverHorario,
  turnosDelDia,
  validarHorario,
} from '../../data-access/diagnostic-units/center-schedule.rules';
import type {
  CenterEquipment,
  CenterSchedule,
  CenterScheduleView,
  CenterStudy,
  EquipmentStatus,
  OrderAppointment,
  OrderBookingOption,
  StudyStart,
} from '../../data-access/diagnostic-units/center-schedule.types';
import {
  esCodigoDeModalidad,
  modalidad,
  modalidadDeEquipo,
  modalidadDeEstudio,
  type ModalityCode,
} from '../../data-access/diagnostic-units/modalidades';
import { reservas, type ReservaSimulada } from '../fixtures/agenda';
import {
  definirResolverCitaDeOrden,
  estadosDeEquipos,
  horariosDeCentros,
  PUESTOS_DE_EXTRACCION,
  turnosDeOrdenes,
  type TurnoDeOrdenSimulado,
} from '../fixtures/centros';
import { ordenes } from '../fixtures/clinica';
import { ACTIVIDAD, CANAL, ESTADO_RESERVA, ESTUDIO, TIPO_CITA } from '../fixtures/conceptos';
import { pacientePorId } from '../fixtures/personas';
import { conflict, forbidden, noContent, notFound, validation, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, cuerpo, nuevoId, uuid } from '../mock-store';
import { avisarPorChatDeSoporte, fechaDelAviso } from './aviso-por-chat';
import { equipoDe, estudiosDe, pacienteDeSesion, sitioDe, UNIDADES, type UnidadSimulada } from './diagnostics.handlers';

/* ============================================================================
    Horarios y equipos de un centro de diagnóstico, y la reserva de un estudio
    desde la orden médica (mockup, 2026-10-06).

    Contrato propuesto, que la API todavía no tiene (PENDIENTES-BACKEND,
    P-CENTRO-HORARIOS):

      GET    /diagnostic-units/:unitId/schedule
      PUT    /diagnostic-units/:unitId/schedule
      PATCH  /diagnostic-units/:unitId/equipment/:equipmentId
      GET    /diagnostic-units/:unitId/study-availability?studyCode&from&to
      GET    /diagnostic-orders/:orderId/booking-options
      POST   /diagnostic-orders/:orderId/booking
      DELETE /diagnostic-orders/:orderId/booking

    Las reglas (qué horario vale para un estudio y cuántos pacientes entran por
    franja) son las de `center-schedule.rules.ts`, las mismas que usa la
    pantalla del centro.
    ========================================================================== */

/** Cuántos días hacia adelante se ofrecen turnos. */
const DIAS_DE_DISPONIBILIDAD = 14;
/** Un turno que empieza en menos de esto ya no se ofrece. */
const MARGEN_MINUTOS = 30;

/** El término del glosario de cada tipo de equipo. */
const TERMINO_DE_EQUIPO: Readonly<Record<string, string>> = {
  US: 'equipo-ecografo',
  XR: 'equipo-rayos-x',
  MR: 'equipo-resonador-magnetico',
  CT: 'equipo-tomografo',
  MG: 'equipo-mamografo',
  DX: 'equipo-densitometro-oseo',
  ANALYZER: 'equipo-analizador-de-laboratorio',
  SAMPLING_STATION: 'equipo-puesto-de-extraccion',
};

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

/** Los equipos del centro con su estado vigente y su modalidad. */
export function equiposDe(u: UnidadSimulada): readonly CenterEquipment[] {
  const propios = equipoDe(u).map((e): CenterEquipment => ({
    id: e.id,
    name: e.type.display,
    manufacturer: e.manufacturer,
    model: e.model,
    modalityCode: modalidadDeEquipo(e.type.code),
    status: estadosDeEquipos.get(e.id)?.status ?? (e.operationalStatus.code as EquipmentStatus),
    glossarySlug: TERMINO_DE_EQUIPO[e.type.code] ?? null,
  }));
  if (u.kind !== 'LABORATORY') return propios;
  // En un laboratorio el turno lo limitan los puestos de extracción, no los
  // analizadores: la muestra se procesa después, en lote.
  const puestos = Array.from({ length: PUESTOS_DE_EXTRACCION }, (_, i): CenterEquipment => {
    const id = uuid(`equipment-${u.id}-puesto-${i}`);
    return {
      id,
      name: `Puesto de extracción ${i + 1}`,
      manufacturer: null,
      model: null,
      modalityCode: 'LAB',
      status: estadosDeEquipos.get(id)?.status ?? 'OPERATIONAL',
      glossarySlug: TERMINO_DE_EQUIPO['SAMPLING_STATION']!,
    };
  });
  return [...puestos, ...propios];
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
      return 'Tomá un litro de agua una hora antes y no orines.';
    case 'STUDY-GLUCOSA':
    case 'STUDY-PERFIL-LIPIDICO':
      return 'Ayuno de 8 a 12 horas. Podés tomar agua.';
    case 'STUDY-MAMOGRAFIA':
      return 'No uses desodorante ni talco ese día.';
    default:
      return null;
  }
}

function esPersonalDelCentro(request: MockRequest, u: UnidadSimulada): boolean {
  const user = request.user;
  if (user === undefined || user === null) return false;
  return user.key === 'superadmin' || user.tenants.includes(u.tenantId);
}

/** Turnos de orden activos del centro para una modalidad, en una franja. */
function ocupados(u: UnidadSimulada, modalityCode: ModalityCode, inicio: number, fin: number, salvoOrden?: string): number {
  return turnosDeOrdenes.filtrar(
    (t) =>
      t.unitId === u.id &&
      t.modalityCode === modalityCode &&
      t.id !== salvoOrden &&
      new Date(t.startAt).getTime() < fin &&
      new Date(t.endAt).getTime() > inicio,
  ).length;
}

/** Los turnos libres de un estudio en el centro, con su cupo. */
export function disponibilidad(
  u: UnidadSimulada,
  studyCode: string,
  desde: Date,
  hasta: Date,
  schedule: CenterSchedule = horarioDe(u),
  equipos: readonly CenterEquipment[] = equiposDe(u),
): { readonly origin: 'STUDY' | 'MODALITY' | 'GENERAL'; readonly items: readonly StudyStart[] } {
  const modalityCode = modalidadDeEstudio(studyCode);
  if (modalityCode === null) return { origin: 'GENERAL', items: [] };
  const { block, origin } = resolverHorario(schedule, studyCode, modalityCode);
  const capacidad = capacidadDeModalidad(equipos, modalityCode);
  if (capacidad === 0) return { origin, items: [] };
  const minimo = Math.max(desde.getTime(), Date.now() + MARGEN_MINUTOS * 60_000);
  const items: StudyStart[] = [];
  const dia = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  while (dia.getTime() <= hasta.getTime()) {
    for (const { inicio, fin } of turnosDelDia(block, dia)) {
      if (inicio.getTime() < minimo || inicio.getTime() > hasta.getTime()) continue;
      const libres = capacidad - ocupados(u, modalityCode, inicio.getTime(), fin.getTime());
      if (libres > 0) items.push({ startAt: inicio.toISOString(), endAt: fin.toISOString(), remaining: libres, capacity: capacidad });
    }
    dia.setDate(dia.getDate() + 1);
  }
  return { origin, items };
}

function vistaDelCentro(u: UnidadSimulada): CenterScheduleView {
  return {
    unitId: u.id,
    unitName: u.name,
    kind: u.kind,
    schedule: horarioDe(u),
    studies: estudiosDelCentro(u),
    equipment: equiposDe(u),
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
  const orden = ordenes.get(request.params['orderId'] ?? '');
  if (orden === undefined) return { error: notFound('Orden no encontrada') } as const;
  if (orden.patientProfileId !== pacienteDeSesion(request)) return { error: notFound('Orden no encontrada') } as const;
  const studyCode = ESTUDIO_POR_CONCEPTO.get(orden.codeConceptId);
  const modalityCode = studyCode === undefined ? null : modalidadDeEstudio(studyCode);
  if (studyCode === undefined || modalityCode === null) {
    return { error: validation('Esta orden no es de un estudio que se reserve en un centro.') } as const;
  }
  return { orden, studyCode, modalityCode } as const;
}

export function registrarCentros(router: MockRouter): void {
  definirResolverCitaDeOrden(citaDeOrden);

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
    const problemas = validarHorario(schedule, (donde) =>
      donde === 'general'
        ? nombreDelHorarioGeneral(schedule)
        : esCodigoDeModalidad(donde)
          ? modalidad(donde).label
          : (estudiosDelCentro(u).find((e) => e.code === donde)?.name ?? donde),
    );
    if (problemas.length > 0) return validation('El horario tiene datos incompletos.', problemas);
    const afectados = turnosFueraDeHorario(u, schedule, equiposDe(u));
    if (afectados > 0) {
      return conflict(`Hay ${afectados} turno${afectados === 1 ? '' : 's'} reservado${afectados === 1 ? '' : 's'} que quedaría${afectados === 1 ? '' : 'n'} fuera del horario nuevo.`, {
        affectedBookings: afectados,
      });
    }
    horariosDeCentros.agregar({ id: u.id, schedule, updatedAt: ahora() });
    return vistaDelCentro(u);
  });

  router.patch('/diagnostic-units/:unitId/equipment/:equipmentId', (request) => {
    const u = unidadPorId(request.params['unitId']!);
    if (u === undefined) return notFound('Centro no encontrado');
    if (!esPersonalDelCentro(request, u)) return forbidden('Sólo el personal del centro cambia sus equipos.');
    const equipo = equiposDe(u).find((e) => e.id === request.params['equipmentId']);
    if (equipo === undefined) return notFound('Equipo no encontrado');
    const { status } = cuerpo<{ status?: EquipmentStatus }>(request);
    if (status !== 'OPERATIONAL' && status !== 'MAINTENANCE' && status !== 'OUT_OF_SERVICE') {
      return validation('Elegí un estado: operativo, en mantenimiento o fuera de servicio.');
    }
    estadosDeEquipos.agregar({ id: equipo.id, status, updatedAt: ahora() });
    return vistaDelCentro(u);
  });

  router.get('/diagnostic-units/:unitId/study-availability', (request) => {
    const u = unidadPorId(request.params['unitId']!);
    if (u === undefined) return notFound('Centro no encontrado');
    const studyCode = request.query.get('studyCode') ?? '';
    if (!estudiosDelCentro(u).some((e) => e.code === studyCode)) return notFound('El centro no hace ese estudio');
    const desde = new Date(request.query.get('from') ?? Date.now());
    const hasta = new Date(request.query.get('to') ?? Date.now() + DIAS_DE_DISPONIBILIDAD * 86_400_000);
    const { origin, items } = disponibilidad(u, studyCode, desde, hasta);
    return { unitId: u.id, studyCode, origin, items };
  });

  router.get('/diagnostic-orders/:orderId/booking-options', (request) => {
    const r = ordenDelPaciente(request);
    if ('error' in r) return r.error;
    const paciente = pacientePorId(r.orden.patientProfileId) as { homeLat?: number | null; homeLng?: number | null } | undefined;
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
      const { items } = disponibilidad(u, r.studyCode, desde, hasta);
      options.push({
        unitId: u.id,
        unitName: u.name,
        addressText: sitio.addressText ?? null,
        price: estudio.price,
        currency: estudio.currency,
        distanceKm: Number.isFinite(u.lat) && Number.isFinite(u.lng) ? distanciaKm(casa.lat, casa.lng, u.lat, u.lng) : null,
        nextStartAt: items[0]?.startAt ?? null,
        preparation: estudio.preparation,
        operationalEquipment: capacidadDeModalidad(equiposDe(u), r.modalityCode),
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

  router.post('/diagnostic-orders/:orderId/booking', (request) => {
    const r = ordenDelPaciente(request);
    if ('error' in r) return r.error;
    if (turnosDeOrdenes.has(r.orden.id)) return conflict('Esta orden ya tiene un turno. Cancelalo para elegir otro.');
    const { unitId, startAt } = cuerpo<{ unitId?: string; startAt?: string }>(request);
    const u = unidadPorId(unitId ?? '');
    if (u === undefined) return notFound('Centro no encontrado');
    const inicio = new Date(startAt ?? '');
    if (Number.isNaN(inicio.getTime())) return validation('Falta el horario elegido.');
    const libre = disponibilidad(u, r.studyCode, inicio, inicio).items.find((i) => i.startAt === inicio.toISOString());
    if (libre === undefined) return conflict('Ese horario se acaba de ocupar. Elegí otro.', { slotTaken: true });
    const paciente = pacientePorId(r.orden.patientProfileId);
    const estudio = estudiosDelCentro(u).find((e) => e.code === r.studyCode)!;
    const reserva: ReservaSimulada = {
      id: nuevoId('booking'),
      patientProfileId: r.orden.patientProfileId,
      resourceId: recursoDelCentro(u),
      bookableSlotId: nuevoId('slot'),
      appointmentId: nuevoId('appointment'),
      typeConceptId: TIPO_CITA['APT-PRIMERA']!,
      startAt: libre.startAt,
      endAt: libre.endAt,
      statusConceptId: ESTADO_RESERVA['BK-CONFIRMED']!,
      serviceConceptId: ACTIVIDAD['ACT-EXAMEN']!,
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
    });
    avisarPorChatDeSoporte(
      r.orden.patientProfileId,
      `Tu turno para ${estudio.name} en ${u.name} quedó confirmado para el ${fechaDelAviso(libre.startAt)}.` +
        (estudio.preparation === null ? '' : ` Preparación: ${estudio.preparation}`) +
        ' Podés verlo en «Mis órdenes».',
    );
    return { status: 201, body: turnoComoCita(turno) };
  });

  router.delete('/diagnostic-orders/:orderId/booking', (request) => {
    const r = ordenDelPaciente(request);
    if ('error' in r) return r.error;
    const turno = turnosDeOrdenes.get(r.orden.id);
    if (turno === undefined) return notFound('La orden no tiene turno');
    reservas.actualizar(turno.bookingId, {
      statusConceptId: ESTADO_RESERVA['BK-CANCELLED']!,
      statusReason: { reasonText: 'Cancelado por el paciente', actorKind: 'PATIENT', toStateConceptId: ESTADO_RESERVA['BK-CANCELLED']!, changedAt: ahora() },
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

/** Turnos de orden futuros que no entrarían en el horario o el cupo nuevos. */
function turnosFueraDeHorario(u: UnidadSimulada, schedule: CenterSchedule, equipos: readonly CenterEquipment[]): number {
  const ahoraMs = Date.now();
  let afectados = 0;
  for (const t of turnosDeOrdenes.filtrar((x) => x.unitId === u.id && new Date(x.startAt).getTime() > ahoraMs)) {
    const inicio = new Date(t.startAt);
    const { block } = resolverHorario(schedule, t.studyCode, t.modalityCode);
    const entra = turnosDelDia(block, inicio).some((x) => x.inicio.getTime() === inicio.getTime());
    const cupo = capacidadDeModalidad(equipos, t.modalityCode);
    const otros = ocupados(u, t.modalityCode, inicio.getTime(), new Date(t.endAt).getTime(), t.id);
    if (!entra || otros >= cupo) afectados++;
  }
  return afectados;
}
