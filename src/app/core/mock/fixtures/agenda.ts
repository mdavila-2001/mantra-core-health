import { ACTIVIDAD, CANAL, ESTADO, ESTADO_RESERVA, TIPO_BLOQUEO, TIPO_CITA } from './conceptos';
import { MEDICA, PACIENTE, PACIENTES, PROFESIONALES, type ProfesionalSimulado } from './personas';
import { TENANT_CLINICA } from '../mock-session';
import { ahora, Coleccion, fecha, iso, isoDia, masMinutos, uuid } from '../mock-store';

/* ============================================================================
    La agenda: recursos (uno por profesional), plantillas de horario, cupos
    generados alrededor de hoy y reservas en todos los estados.
    ========================================================================== */

export interface RecursoSimulado {
  readonly id: string;
  readonly name: string;
  readonly resourceTypeConceptId: string;
  readonly resourceRefType: string;
  readonly resourceRefId: string;
  readonly practitionerName: string | null;
  readonly practiceId: string | null;
  readonly tenantId: string;
  readonly timeZone: string | null;
  readonly capacity: number;
  readonly stateConceptId: string;
  readonly site: { id: string; name: string; code: string; addressText: string | null; timeZone: string | null } | null;
}

export interface PlantillaSimulada {
  readonly id: string;
  readonly resourceId: string;
  readonly retired: boolean;
  readonly name: string;
  readonly rules: readonly { dayOfWeek: number; startTime: string; endTime: string; slotMinutes?: number; capacityPerSlot?: number; gapMinutes?: number }[];
  readonly slotMinutes: number;
  readonly validFrom: string;
  readonly validTo?: string;
  readonly bookingPolicyId: string;
  readonly statusConceptId: string;
}

export interface CupoSimulado {
  readonly id: string;
  readonly resourceId: string;
  readonly scheduleTemplateId: string | null;
  readonly startAt: string;
  readonly endAt: string;
  readonly capacity: number;
  readonly remainingCapacity: number;
  readonly statusConceptId: string;
  readonly serviceConceptId: string | null;
}

export interface ReservaSimulada {
  readonly id: string;
  readonly patientProfileId: string;
  readonly resourceId: string;
  readonly bookableSlotId: string;
  readonly appointmentId: string | null;
  readonly typeConceptId: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly statusConceptId: string;
  readonly serviceConceptId: string;
  readonly bookingChannelConceptId: string;
  readonly confirmedAt: string | null;
  readonly checkedInAt: string | null;
  readonly reasonText: string;
  readonly patientName: string;
  readonly insuranceCarrierName: string | null;
  readonly rescheduledFrom: string | null;
  readonly statusReason: { reasonText: string; actorKind: 'PATIENT' | 'PROVIDER'; toStateConceptId: string; changedAt: string } | null;
  readonly delayNotice: { delayMinutes: number; message: string; announcedAt: string } | null;
  readonly paymentState: { state: 'PENDING' | 'PARTIALLY_PAID' | 'PAID'; label: string; conceptId: string; insuranceUsed: boolean; markedByUserId: string; markedAt: string } | null;
  readonly createdAt: string;
}

export interface BloqueoSimulado {
  readonly id: string;
  readonly resourceId: string;
  readonly exceptionTypeConceptId: string;
  readonly exceptionType: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly reasonLabel: string;
  readonly reason: string;
  readonly isAvailable: boolean;
}

export const PRACTICE_OLIVOS = uuid('practice-olivos');
export const PRACTICE_SANLUCAS = uuid('practice-sanlucas');
export const PRACTICE_CONSULTORIO = uuid('practice-consultorio-rojas');
export const POLITICA_ESTANDAR = uuid('booking-policy-estandar');
export const RECURSO_TIPO_PROFESIONAL = ESTADO['ST-ACTIVE']!;

export const SITIO_OLIVOS = { id: uuid('site-olivos-central'), name: 'Clínica Los Olivos · Sede Central', code: 'OLIVOS-C', addressText: 'Av. Banzer, 3.º anillo, Santa Cruz de la Sierra', timeZone: 'America/La_Paz' };
export const SITIO_SANLUCAS = { id: uuid('site-sanlucas'), name: 'Hospital San Lucas', code: 'SANLUCAS', addressText: 'Av. San Martín N.º 1400, Santa Cruz de la Sierra', timeZone: 'America/La_Paz' };
export const SITIO_CONSULTORIO = { id: uuid('site-consultorio-rojas'), name: 'Consultorio Dra. Rojas', code: 'ROJAS', addressText: 'Calle Libertad N.º 240, Santa Cruz de la Sierra', timeZone: 'America/La_Paz' };

export function recursoDe(p: ProfesionalSimulado): string {
  return uuid(`resource-${p.id}`);
}

export const recursos = new Coleccion<RecursoSimulado>(
  PROFESIONALES.filter((p) => p.especialidades.length > 0).flatMap((p, i) => {
    const principal: RecursoSimulado = {
      id: recursoDe(p),
      name: `Agenda de ${p.displayName}`,
      resourceTypeConceptId: uuid('concept-resource-practitioner'),
      // El nombre de la TABLA, como lo emite la API real
      // (`scheduling-agenda.service.ts`): la ficha pública y la agenda filtran
      // «los recursos de este profesional» con esa lista, y con `'PRACTITIONER'`
      // ningún recurso era suyo — la ficha decía «Todavía no publicó horarios»
      // con 41 cupos cargados.
      resourceRefType: 'health_practitioner_profiles',
      resourceRefId: p.id,
      practitionerName: p.displayName,
      practiceId: p.organizacion === 'Hospital San Lucas' ? PRACTICE_SANLUCAS : PRACTICE_OLIVOS,
      tenantId: p.tenantId,
      timeZone: 'America/La_Paz',
      capacity: 1,
      stateConceptId: ESTADO['ST-ACTIVE']!,
      site: p.organizacion === 'Hospital San Lucas' ? SITIO_SANLUCAS : SITIO_OLIVOS,
    };
    if (i !== 0) return [principal];
    // La médica tiene además su consultorio propio.
    return [
      principal,
      {
        ...principal,
        id: uuid(`resource-consultorio-${p.id}`),
        name: `Consultorio propio · ${p.displayName}`,
        practiceId: PRACTICE_CONSULTORIO,
        site: SITIO_CONSULTORIO,
      },
    ];
  }),
);

export const RECURSO_MEDICA = recursoDe(MEDICA);
export const RECURSO_CONSULTORIO_MEDICA = uuid(`resource-consultorio-${MEDICA.id}`);

export const plantillas = new Coleccion<PlantillaSimulada>([
  {
    id: uuid('template-medica-manana'),
    resourceId: RECURSO_MEDICA,
    retired: false,
    name: 'Mañanas en la clínica',
    rules: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: '08:00', endTime: '12:00', slotMinutes: 30, capacityPerSlot: 1 })),
    slotMinutes: 30,
    validFrom: isoDia(-60),
    bookingPolicyId: POLITICA_ESTANDAR,
    statusConceptId: ESTADO['ST-PUBLISHED']!,
  },
  {
    id: uuid('template-medica-tarde'),
    resourceId: RECURSO_CONSULTORIO_MEDICA,
    retired: false,
    name: 'Tardes en el consultorio',
    rules: [1, 3, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: '15:00', endTime: '19:00', slotMinutes: 20, capacityPerSlot: 1, gapMinutes: 10 })),
    slotMinutes: 20,
    validFrom: isoDia(-30),
    bookingPolicyId: POLITICA_ESTANDAR,
    statusConceptId: ESTADO['ST-PUBLISHED']!,
  },
  {
    id: uuid('template-medica-retirada'),
    resourceId: RECURSO_MEDICA,
    retired: true,
    name: 'Sábados (temporada pasada)',
    rules: [{ dayOfWeek: 6, startTime: '09:00', endTime: '13:00', slotMinutes: 30 }],
    slotMinutes: 30,
    validFrom: isoDia(-200),
    validTo: isoDia(-61),
    bookingPolicyId: POLITICA_ESTANDAR,
    statusConceptId: ESTADO['ST-ARCHIVED']!,
  },
  ...recursos
    .todos()
    .filter((r) => r.id !== RECURSO_MEDICA && r.id !== RECURSO_CONSULTORIO_MEDICA)
    .map((r, i) => ({
      id: uuid(`template-${r.id}`),
      resourceId: r.id,
      retired: false,
      name: i % 2 === 0 ? 'Horario de mañana' : 'Horario de tarde',
      rules: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: i % 2 === 0 ? '08:30' : '14:00', endTime: i % 2 === 0 ? '12:30' : '18:00', slotMinutes: 30, capacityPerSlot: 1 })),
      slotMinutes: 30,
      validFrom: isoDia(-90),
      bookingPolicyId: POLITICA_ESTANDAR,
      statusConceptId: ESTADO['ST-PUBLISHED']!,
    })),
]);

/* ---- cupos: se generan a partir de las plantillas, ±21 días ---------------- */

function generarCupos(): CupoSimulado[] {
  const cupos: CupoSimulado[] = [];
  for (const plantilla of plantillas.todos()) {
    if (plantilla.retired) continue;
    for (let dia = -21; dia <= 21; dia++) {
      const d = fecha(dia, 0);
      const regla = plantilla.rules.find((r) => r.dayOfWeek === d.getDay());
      if (regla === undefined) continue;
      const [hi, mi] = regla.startTime.split(':').map(Number) as [number, number];
      const [hf, mf] = regla.endTime.split(':').map(Number) as [number, number];
      const paso = (regla.slotMinutes ?? plantilla.slotMinutes) + (regla.gapMinutes ?? 0);
      for (let m = hi * 60 + mi; m + (regla.slotMinutes ?? plantilla.slotMinutes) <= hf * 60 + mf; m += paso) {
        const inicio = fecha(dia, Math.floor(m / 60), m % 60);
        const fin = new Date(inicio.getTime() + (regla.slotMinutes ?? plantilla.slotMinutes) * 60_000);
        cupos.push({
          id: uuid(`slot-${plantilla.id}-${dia}-${m}`),
          resourceId: plantilla.resourceId,
          scheduleTemplateId: plantilla.id,
          startAt: inicio.toISOString(),
          endAt: fin.toISOString(),
          capacity: regla.capacityPerSlot ?? 1,
          remainingCapacity: regla.capacityPerSlot ?? 1,
          statusConceptId: ESTADO['ST-ACTIVE']!,
          serviceConceptId: ACTIVIDAD['ACT-CONSULTA']!,
        });
      }
    }
  }
  return cupos;
}

export const cupos = new Coleccion<CupoSimulado>(generarCupos());

/* ---- reservas: pasado y futuro de la médica, con todos los estados --------- */

const MOTIVOS = [
  'Control de presión arterial',
  'Dolor en el pecho al subir escaleras',
  'Chequeo anual',
  'Palpitaciones nocturnas',
  'Seguimiento post infarto',
  'Resultados de laboratorio',
  'Mareos frecuentes',
  'Renovación de receta',
  'Control de colesterol',
  'Segunda opinión',
];

function reserva(indice: number, cupo: CupoSimulado, estado: keyof typeof ESTADO_RESERVA, extra: Partial<ReservaSimulada> = {}): ReservaSimulada {
  const paciente = PACIENTES[indice % PACIENTES.length]!;
  const confirmada = ['BK-CONFIRMED', 'BK-CHECKED-IN', 'BK-IN-PROGRESS', 'BK-COMPLETED'].includes(estado);
  return {
    id: uuid(`booking-${cupo.id}`),
    patientProfileId: paciente.id,
    resourceId: cupo.resourceId,
    bookableSlotId: cupo.id,
    appointmentId: confirmada ? uuid(`appointment-${cupo.id}`) : null,
    typeConceptId: indice % 4 === 0 ? TIPO_CITA['APT-PRIMERA']! : TIPO_CITA['APT-CONTROL']!,
    startAt: cupo.startAt,
    endAt: cupo.endAt,
    statusConceptId: ESTADO_RESERVA[estado]!,
    serviceConceptId: ACTIVIDAD['ACT-CONSULTA']!,
    bookingChannelConceptId: indice % 3 === 0 ? CANAL['CH-TELECONSULTA']! : CANAL['CH-PRESENCIAL']!,
    confirmedAt: confirmada ? masMinutos(cupo.startAt, -60 * 24 * 2) : null,
    checkedInAt: ['BK-CHECKED-IN', 'BK-IN-PROGRESS', 'BK-COMPLETED'].includes(estado) ? masMinutos(cupo.startAt, -10) : null,
    reasonText: MOTIVOS[indice % MOTIVOS.length]!,
    patientName: paciente.displayName,
    insuranceCarrierName: paciente.aseguradora ?? null,
    rescheduledFrom: null,
    statusReason: null,
    delayNotice: null,
    paymentState:
      estado === 'BK-COMPLETED'
        ? { state: indice % 2 === 0 ? 'PAID' : 'PARTIALLY_PAID', label: indice % 2 === 0 ? 'Pagada' : 'Pago parcial', conceptId: ESTADO['ST-COMPLETED']!, insuranceUsed: paciente.aseguradora !== undefined, markedByUserId: MEDICA.userId, markedAt: masMinutos(cupo.endAt, 5) }
        : null,
    createdAt: masMinutos(cupo.startAt, -60 * 24 * 5),
    ...extra,
  };
}

function generarReservas(): ReservaSimulada[] {
  const reservas: ReservaSimulada[] = [];
  const cuposMedica = cupos
    .todos()
    .filter((c) => c.resourceId === RECURSO_MEDICA || c.resourceId === RECURSO_CONSULTORIO_MEDICA)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const ahoraMs = Date.now();
  let i = 0;
  for (const cupo of cuposMedica) {
    const inicio = new Date(cupo.startAt).getTime();
    const esPasado = inicio < ahoraMs;
    const esHoy = new Date(cupo.startAt).toDateString() === new Date().toDateString();
    // Ocupa dos de cada tres cupos pasados y la mitad de los futuros.
    if (esPasado && !esHoy && i % 3 === 2) {
      i++;
      continue;
    }
    if (!esPasado && !esHoy && i % 2 === 1) {
      i++;
      continue;
    }
    let estado: keyof typeof ESTADO_RESERVA;
    if (esHoy) {
      const orden = cuposMedica.filter((c) => new Date(c.startAt).toDateString() === new Date().toDateString()).indexOf(cupo);
      estado = (['BK-COMPLETED', 'BK-COMPLETED', 'BK-IN-PROGRESS', 'BK-CHECKED-IN', 'BK-CONFIRMED', 'BK-CONFIRMED', 'BK-REQUESTED', 'BK-CONFIRMED'] as const)[orden % 8]!;
    } else if (esPasado) {
      estado = (['BK-COMPLETED', 'BK-COMPLETED', 'BK-COMPLETED', 'BK-NO-SHOW', 'BK-CANCELLED'] as const)[i % 5]!;
    } else {
      estado = (['BK-CONFIRMED', 'BK-CONFIRMED', 'BK-REQUESTED', 'BK-CONFIRMED', 'BK-REQUESTED'] as const)[i % 5]!;
    }
    const extra: { -readonly [K in keyof ReservaSimulada]?: ReservaSimulada[K] } = {};
    if (estado === 'BK-CANCELLED') {
      extra.statusReason = { reasonText: 'El paciente avisó que viajaba', actorKind: 'PATIENT', toStateConceptId: ESTADO_RESERVA['BK-CANCELLED']!, changedAt: masMinutos(cupo.startAt, -60 * 24) };
    }
    if (estado === 'BK-NO-SHOW') {
      extra.statusReason = { reasonText: 'No se presentó ni avisó', actorKind: 'PROVIDER', toStateConceptId: ESTADO_RESERVA['BK-NO-SHOW']!, changedAt: masMinutos(cupo.endAt, 15) };
    }
    if (!esPasado && i % 7 === 3) {
      extra.rescheduledFrom = masMinutos(cupo.startAt, -60 * 24 * 3);
    }
    reservas.push(reserva(i, cupo, estado, extra));
    if (estado !== 'BK-CANCELLED' && estado !== 'BK-REJECTED') {
      cupos.actualizar(cupo.id, { remainingCapacity: 0 });
    }
    i++;
  }
  // La paciente principal tiene turnos con otros profesionales también.
  const otros = PROFESIONALES.slice(1, 5);
  otros.forEach((p, k) => {
    const cupo = cupos
      .todos()
      .filter((c) => c.resourceId === recursoDe(p) && new Date(c.startAt).getTime() > ahoraMs && c.remainingCapacity > 0)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[k * 5 + 2];
    if (cupo === undefined) return;
    reservas.push(reserva(0, cupo, k === 0 ? 'BK-REQUESTED' : 'BK-CONFIRMED', { patientProfileId: PACIENTE.id, patientName: PACIENTE.displayName, reasonText: ['Control pediátrico de mi hijo', 'Control anual', 'Lunar que cambió de color', 'Dolor de rodilla al correr'][k]! }));
    cupos.actualizar(cupo.id, { remainingCapacity: 0 });
    const pasado = cupos
      .todos()
      .filter((c) => c.resourceId === recursoDe(p) && new Date(c.startAt).getTime() < ahoraMs)
      .sort((a, b) => b.startAt.localeCompare(a.startAt))[k * 3 + 1];
    if (pasado !== undefined) {
      reservas.push(reserva(0, pasado, 'BK-COMPLETED', { patientProfileId: PACIENTE.id, patientName: PACIENTE.displayName, reasonText: 'Consulta de control' }));
      cupos.actualizar(pasado.id, { remainingCapacity: 0 });
    }
  });
  return reservas;
}

/* ---- el cupo que se libera durante el recorrido ---------------------------

   Nace **nueve minutos antes de ahora** y con su reserva confirmada, así que
   cruza los diez minutos de gracia alrededor de un minuto después de abrir la
   aplicación. Ahí la regla de `horario-liberado.ts` lo da por libre y el aviso
   *llega* mientras alguien está mirando — que es lo que había que poder
   mostrar. Si naciera ya vencido, la notificación estaría desde el primer
   render y no se vería llegar nada.

   Es un cupo propio y no uno de los generados porque aquéllos cuelgan de las
   plantillas de horario —empiezan en horas redondas— y ninguno cae donde hace
   falta. Éste existe sólo para el recorrido.

   Lo reserva un paciente que **no** es la principal: el aviso es para ella, y
   nadie se avisa a sí mismo de que su propio cupo quedó libre. */

const CUPO_POR_LIBERARSE = uuid('slot-a-punto-de-liberarse');

/* Los mismos diez minutos que `horario-liberado.ts`, declarados acá y no
   importados de allá: aquel archivo lee este fixture, y traerlo de vuelta
   cerraría un ciclo de importación —lo que `check-architecture` prohíbe—. Una
   prueba comprueba que los dos números coinciden. */
const MINUTOS_DE_GRACIA = 10;

function sembrarCupoPorLiberarse(): void {
  const inicio = masMinutos(ahora(), -(MINUTOS_DE_GRACIA - 1));
  cupos.agregar({
    id: CUPO_POR_LIBERARSE,
    resourceId: RECURSO_MEDICA,
    scheduleTemplateId: null,
    startAt: inicio,
    endAt: masMinutos(inicio, 30),
    capacity: 1,
    remainingCapacity: 0,
    statusConceptId: ESTADO['ST-ACTIVE']!,
    serviceConceptId: ACTIVIDAD['ACT-CONSULTA']!,
  });
  const cupo = cupos.get(CUPO_POR_LIBERARSE);
  if (cupo === undefined) return;
  reservas.agregar(
    reserva(1, cupo, 'BK-CONFIRMED', {
      reasonText: 'Control de presión arterial',
    }),
  );
}

export const reservas = new Coleccion<ReservaSimulada>(generarReservas());

sembrarCupoPorLiberarse();

/* ---- bloqueos ------------------------------------------------------------- */

export const bloqueos = new Coleccion<BloqueoSimulado>([
  {
    id: uuid('exception-vacaciones'),
    resourceId: RECURSO_MEDICA,
    exceptionTypeConceptId: TIPO_BLOQUEO['EXC-VACACIONES']!,
    exceptionType: 'VACATION',
    startAt: iso(28, 0),
    endAt: iso(35, 23, 59),
    reasonLabel: 'Vacaciones',
    reason: 'Vacaciones familiares',
    isAvailable: false,
  },
  {
    id: uuid('exception-congreso'),
    resourceId: RECURSO_MEDICA,
    exceptionTypeConceptId: TIPO_BLOQUEO['EXC-CONGRESO']!,
    exceptionType: 'CONFERENCE',
    startAt: iso(9, 8),
    endAt: iso(10, 18),
    reasonLabel: 'Congreso',
    reason: 'Congreso Boliviano de Cardiología',
    isAvailable: false,
  },
  {
    id: uuid('exception-pasada'),
    resourceId: RECURSO_MEDICA,
    exceptionTypeConceptId: TIPO_BLOQUEO['EXC-PERSONAL']!,
    exceptionType: 'ERRAND',
    startAt: iso(-6, 10),
    endAt: iso(-6, 12),
    reasonLabel: 'Motivo personal',
    reason: 'Trámite bancario',
    isAvailable: false,
  },
  {
    id: uuid('exception-extra'),
    resourceId: RECURSO_CONSULTORIO_MEDICA,
    exceptionTypeConceptId: TIPO_BLOQUEO['EXC-CIRUGIA']!,
    exceptionType: 'EXTRA',
    startAt: iso(3, 19),
    endAt: iso(3, 21),
    reasonLabel: 'Horario extra',
    reason: 'Atención extendida por demanda',
    isAvailable: true,
  },
]);

export const listaDeEspera = new Coleccion<{
  id: string;
  patientProfileId: string;
  resourceId: string;
  resourceLabel: string;
  desiredFrom: string;
  desiredTo: string;
  priority: number;
  statusConceptId: string;
  createdAt: string;
}>([
  {
    id: uuid('waitlist-1'),
    patientProfileId: PACIENTE.id,
    resourceId: recursoDe(PROFESIONALES[6]!),
    resourceLabel: `Agenda de ${PROFESIONALES[6]!.displayName}`,
    desiredFrom: iso(1, 8),
    desiredTo: iso(14, 18),
    priority: 2,
    statusConceptId: ESTADO['ST-PENDING']!,
    createdAt: iso(-2, 11),
  },
]);

export const TENANT_AGENDA = TENANT_CLINICA;

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
recursos.persistirEn('mock.agenda.recursos');
plantillas.persistirEn('mock.agenda.plantillas');
reservas.persistirEn('mock.agenda.reservas');
bloqueos.persistirEn('mock.agenda.bloqueos');
listaDeEspera.persistirEn('mock.agenda.listaDeEspera');
