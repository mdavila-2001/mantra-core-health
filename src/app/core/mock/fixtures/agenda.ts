import { ACTIVIDAD, CANAL, ESTADO, ESTADO_RESERVA, TIPO_BLOQUEO, TIPO_CITA } from './conceptos';
import { MEDICA, PACIENTE, PACIENTES, PROFESIONALES, type ProfesionalSimulado } from './personas';
import type { FollowUpOrigin } from '../../data-access/scheduling/follow-up.types';
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
  /** Sin turnos fijos: un bloque abierto por franja (P36). */
  readonly flexibleHours?: boolean;
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
  /**
   * De qué cita salió ésta, si es una reconsulta (C4). `null` es lo corriente.
   *
   * // TODO C8: el contrato equivalente vive en `follow-up.types.ts` y sube a
   * `scheduling.types.ts` cuando C0 publique los tipos congelados.
   */
  readonly followUpOf: FollowUpOrigin | null;
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

/** La zona de una sede que no declara la suya. Es la de las sedes de la maqueta. */
export const ZONA_HORARIA_POR_OMISION = 'America/La_Paz';

/**
 * Las dos sedes donde atienden los profesionales de demostración. Las dos son
 * instituciones inventadas de la maqueta (`instituciones.spec.ts` las nombra
 * como «los inventados que reemplaza»), así que no se le atribuye a nadie un
 * lugar real. El consultorio propio de la médica queda afuera: es de una
 * persona.
 */
export const SEDES_DEMO = {
  'Clínica Los Olivos': { practiceId: PRACTICE_OLIVOS, site: SITIO_OLIVOS },
  'Hospital San Lucas': { practiceId: PRACTICE_SANLUCAS, site: SITIO_SANLUCAS },
} as const;

/**
 * La agenda **simulada** de un profesional de demostración (R-03, 22/09/2026;
 * D-H3-PROV-01, 23/09/2026).
 *
 * Los 13 actores de `PROFESIONALES_DEMO_REGISTRADOS` no son nadie: la sede sale
 * de su organización (una de `SEDES_DEMO`), el id de la misma semilla que el
 * resto (`resource-<id del perfil>`) y el nombre dice que la agenda es
 * simulada. Una sede sin `timeZone` cae en `ZONA_HORARIA_POR_OMISION`.
 */
export function recursoDeDemo(
  p: ProfesionalSimulado,
  sede: { readonly practiceId: string; readonly site: RecursoSimulado['site'] } = SEDES_DEMO[p.organizacion as keyof typeof SEDES_DEMO] ?? SEDES_DEMO['Clínica Los Olivos'],
): RecursoSimulado {
  return {
    id: recursoDe(p),
    name: `Agenda simulada · ${p.displayName}`,
    resourceTypeConceptId: uuid('concept-resource-practitioner'),
    resourceRefType: 'health_practitioner_profiles',
    resourceRefId: p.id,
    practitionerName: p.displayName,
    practiceId: sede.practiceId,
    tenantId: p.tenantId,
    timeZone: sede.site?.timeZone ?? ZONA_HORARIA_POR_OMISION,
    capacity: 1,
    stateConceptId: ESTADO['ST-ACTIVE']!,
    site: sede.site,
  };
}

export const recursos = new Coleccion<RecursoSimulado>([
  // Los médicos de la red de las aseguradoras no tienen agenda: nadie publicó
  // sus horarios, y fabricárselos sería ofrecer turnos que no existen. Y un
  // médico escrito sin especialidad tampoco: no hay nada que reservarle.
  ...PROFESIONALES.filter((p) => p.especialidades.length > 0 && p.origen === undefined).flatMap((p, i) => {
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
  // Los profesionales de demostración van **después** de los escritos: así los
  // índices de arriba —y con ellos la alternancia mañana/tarde de sus
  // plantillas— no se mueven. Las personas de la planilla del propietario no
  // tienen agenda: la planilla no dice dónde atienden (D-H3-PROV-01).
  ...PROFESIONALES.filter((p) => p.origen === 'DEMO').map((p) => recursoDeDemo(p)),
]);

export const RECURSO_MEDICA = recursoDe(MEDICA);
export const RECURSO_CONSULTORIO_MEDICA = uuid(`resource-consultorio-${MEDICA.id}`);

/**
 * El tipo de cita de una **reconsulta** (C4).
 *
 * Se deriva acá y no se lee de `TIPO_CITA` porque `VS_APPOINTMENT_TYPE` todavía
 * no la declara: `conceptos.ts` tiene `APT-PRIMERA`, `APT-CONTROL` y
 * `APT-URGENCIA`, y ese archivo es de C0, que no publicó.
 *
 * El id que sale de acá es **exactamente** el que produciría `definir()` allá
 * —misma semilla `concept-<código>`, `conceptos.ts:69—`, así que el día que la
 * entrada exista el identificador coincide y no hay nada que migrar. Lo único
 * que falta hasta entonces es la etiqueta del catálogo, y por eso la pantalla
 * escribe «Reconsulta» literal en vez de buscarla: un uuid crudo en la agenda
 * sería peor que una palabra fija.
 *
 * // TODO C8: reemplazar por `TIPO_CITA['APT-RECONSULTA']` cuando C0 agregue
 * `['APT-RECONSULTA', 'Reconsulta']` al value set.
 */
export const TIPO_CITA_RECONSULTA = uuid('concept-APT-RECONSULTA');

export const plantillas = new Coleccion<PlantillaSimulada>([
  {
    id: uuid('template-medica-manana'),
    resourceId: RECURSO_MEDICA,
    retired: false,
    name: 'Mañanas en la clínica',
    // Lunes a SÁBADO. El sábado entró el 19/09/2026 y no es cosmético: con la
    // semana de lunes a viernes, la maqueta abierta un fin de semana mostraba
    // un día sin una sola consulta —y el panel abre con la jornada—. Una
    // maqueta que se ve vacía dos días de cada siete no sirve para mostrar
    // nada. Además es lo que hace media Santa Cruz: consultorio el sábado por
    // la mañana.
    rules: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '08:00', endTime: '12:00', slotMinutes: 30, capacityPerSlot: 1 })),
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
    // Lunes, miércoles y viernes por la tarde; el DOMINGO, guardia corta. La
    // guardia existe por el mismo motivo que el sábado de arriba —que la
    // maqueta tenga jornada los siete días— y se parece a lo que pasa de
    // verdad: tres horas de guardia, no una tarde entera de consultorio.
    rules: [
      ...[1, 3, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: '15:00', endTime: '19:00', slotMinutes: 20, capacityPerSlot: 1, gapMinutes: 10 })),
      { dayOfWeek: 0, startTime: '10:00', endTime: '13:00', slotMinutes: 20, capacityPerSlot: 1, gapMinutes: 10 },
    ],
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

/**
 * La tipología de actividad de una reserva generada, determinista (C-24 /
 * hallazgo D5 post-#559): antes las tres asignaciones de `serviceConceptId`
 * de este archivo eran `ACT-CONSULTA` fijo, así que "otras atenciones" del
 * panel (`consultas-resumen.ts`) nunca tenía nada que clasificar — la lógica
 * era correcta, faltaba el dato. La teleconsulta se deduce del canal, que ya
 * la distingue; procedimientos y exámenes salen con una cadencia fija sobre
 * el índice, para que la cifra del panel se pueda contar a mano dos veces y
 * dé lo mismo.
 */
function servicioDe(indice: number, canal: string): string {
  if (canal === CANAL['CH-TELECONSULTA']) return ACTIVIDAD['ACT-TELECONSULTA']!;
  if (indice % 11 === 5) return ACTIVIDAD['ACT-PROCEDIMIENTO']!;
  if (indice % 13 === 7) return ACTIVIDAD['ACT-EXAMEN']!;
  return ACTIVIDAD['ACT-CONSULTA']!;
}

function reserva(indice: number, cupo: CupoSimulado, estado: keyof typeof ESTADO_RESERVA, extra: Partial<ReservaSimulada> = {}): ReservaSimulada {
  const paciente = PACIENTES[indice % PACIENTES.length]!;
  const confirmada = ['BK-CONFIRMED', 'BK-CHECKED-IN', 'BK-IN-PROGRESS', 'BK-COMPLETED'].includes(estado);
  const canal = indice % 3 === 0 ? CANAL['CH-TELECONSULTA']! : CANAL['CH-PRESENCIAL']!;
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
    serviceConceptId: servicioDe(indice, canal),
    bookingChannelConceptId: canal,
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
    followUpOf: null,
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

/* ---- la reconsulta sembrada (C4) ------------------------------------------

   Una cita futura que **recuerda de qué consulta salió**. Existe para que las
   tres pantallas que la muestran —la agenda del doctor, el detalle de la cita y
   «Mis citas» del paciente— tengan qué mostrar sin que nadie tenga que agendar
   una a mano primero. Es el kill-test del carril: si esto no aparece en
   `/my-account/appointments`, la reconsulta no existe.

   Se cuelga de una consulta **ya atendida de la paciente principal**, que es la
   única que se puede abrir con las dos cuentas de la maqueta. No se fija por
   índice: se busca, porque el generador de arriba reparte estados por posición
   y un cambio suyo dejaría este seed apuntando a una cita cancelada sin que
   nada fallara. */

/** El día, en milisegundos. Una reconsulta se agenda **desde mañana**. */
const UN_DIA = 24 * 60 * 60 * 1000;

function sembrarReconsulta(): void {
  const origen = reservas
    .todos()
    .filter((r) => r.patientProfileId === PACIENTE.id)
    .filter((r) => r.resourceId === RECURSO_MEDICA || r.resourceId === RECURSO_CONSULTORIO_MEDICA)
    .filter((r) => r.statusConceptId === ESTADO_RESERVA['BK-COMPLETED'])
    .filter((r) => new Date(r.startAt).getTime() < Date.now())
    .sort((a, b) => b.startAt.localeCompare(a.startAt))[0];
  if (origen === undefined) return;

  const desde = Date.now() + UN_DIA;
  const destino = cupos
    .todos()
    .filter((c) => c.resourceId === RECURSO_MEDICA)
    .filter((c) => c.remainingCapacity > 0 && c.statusConceptId === ESTADO['ST-ACTIVE'])
    .filter((c) => new Date(c.startAt).getTime() > desde)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  if (destino === undefined) return;

  reservas.agregar(
    reserva(0, destino, 'BK-CONFIRMED', {
      typeConceptId: TIPO_CITA_RECONSULTA,
      // Presencial y no el canal que le tocaría por índice: una reconsulta se
      // acuerda con la persona enfrente, en el consultorio.
      bookingChannelConceptId: CANAL['CH-PRESENCIAL']!,
      reasonText: `Reconsulta: ${origen.reasonText}`,
      // `encounterId` en `null` a propósito: el fixture de agenda no modela los
      // encuentros clínicos, y atarlo al `appointmentId` sería inventar una
      // relación que el modelo no declara. El handler sí lo propaga cuando el
      // cliente lo manda.
      followUpOf: { bookingId: origen.id, encounterId: null },
      createdAt: ahora(),
    }),
  );
  cupos.actualizar(destino.id, { remainingCapacity: 0 });
}

export const reservas = new Coleccion<ReservaSimulada>(generarReservas());

sembrarCupoPorLiberarse();
sembrarReconsulta();

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
