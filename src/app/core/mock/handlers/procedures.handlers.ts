import { ESTADO, PROCEDIMIENTO, SEVERIDAD } from '../fixtures/conceptos';
import { MEDICA, PACIENTE, PACIENTES, PROFESIONALES } from '../fixtures/personas';
import { notFound, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, nuevoId, texto, uuid } from '../mock-store';

/* ============================================================================
    Procedimientos: casos quirúrgicos (agenda perioperatoria, equipo, pasos,
    hallazgos, implantes, informes) y el registro odontológico.
    ========================================================================== */

const ROL_EQUIPO = { CIRUJANO: uuid('concept-team-role-surgeon'), ANESTESISTA: uuid('concept-team-role-anesthesiologist'), INSTRUMENTISTA: uuid('concept-team-role-scrub-nurse'), AYUDANTE: uuid('concept-team-role-assistant') } as const;
const ESTADO_MIEMBRO = { INVITADO: uuid('concept-member-invited'), ACEPTADO: uuid('concept-member-accepted'), RECHAZADO: uuid('concept-member-declined') } as const;
const ESTADO_CASO = { PROGRAMADO: uuid('concept-case-scheduled'), EN_CURSO: uuid('concept-case-in-progress'), COMPLETADO: uuid('concept-case-completed'), CANCELADO: uuid('concept-case-cancelled'), PENDIENTE_EQUIPO: uuid('concept-case-pending-team') } as const;
const QUIROFANO = { Q1: uuid('operating-room-1'), Q2: uuid('operating-room-2') } as const;
const LATERALIDAD = { DER: uuid('concept-laterality-right'), IZQ: uuid('concept-laterality-left') } as const;
const SITIO = { RODILLA: uuid('concept-body-site-knee'), ABDOMEN: uuid('concept-body-site-abdomen'), HOMBRO: uuid('concept-body-site-shoulder') } as const;

interface CasoSimulado {
  readonly id: string;
  readonly caseNumber: string;
  readonly patientProfileId: string;
  readonly primarySurgeonProfileId: string;
  readonly operatingRoomId: string;
  readonly statusConceptId: string;
  readonly scheduledStartAt: string;
  readonly scheduledEndAt: string;
  readonly procedimiento: string;
  readonly equipo: { id: string; practitionerProfileId: string; teamRoleConceptId: string; statusConceptId: string }[];
}

const CIRUJANO = PROFESIONALES[4]!;
const ANESTESISTA = PROFESIONALES[13]!;

function caso(indice: number, paciente: string, dias: number, hora: number, estado: keyof typeof ESTADO_CASO, procedimiento: string, cirujano = CIRUJANO.id): CasoSimulado {
  const id = uuid(`surgical-case-${indice}`);
  return {
    id,
    caseNumber: `CX-2026-${String(100 + indice).padStart(4, '0')}`,
    patientProfileId: paciente,
    primarySurgeonProfileId: cirujano,
    operatingRoomId: indice % 2 === 0 ? QUIROFANO.Q1 : QUIROFANO.Q2,
    statusConceptId: ESTADO_CASO[estado],
    scheduledStartAt: iso(dias, hora),
    scheduledEndAt: iso(dias, hora + 2),
    procedimiento,
    equipo: [
      { id: uuid(`team-${id}-1`), practitionerProfileId: cirujano, teamRoleConceptId: ROL_EQUIPO.CIRUJANO, statusConceptId: ESTADO_MIEMBRO.ACEPTADO },
      { id: uuid(`team-${id}-2`), practitionerProfileId: ANESTESISTA.id, teamRoleConceptId: ROL_EQUIPO.ANESTESISTA, statusConceptId: estado === 'PENDIENTE_EQUIPO' ? ESTADO_MIEMBRO.INVITADO : ESTADO_MIEMBRO.ACEPTADO },
      { id: uuid(`team-${id}-3`), practitionerProfileId: MEDICA.id, teamRoleConceptId: ROL_EQUIPO.AYUDANTE, statusConceptId: estado === 'PENDIENTE_EQUIPO' ? ESTADO_MIEMBRO.INVITADO : ESTADO_MIEMBRO.ACEPTADO },
    ],
  };
}

const casos = new Coleccion<CasoSimulado>([
  caso(1, PACIENTES[9]!.id, -40, 8, 'COMPLETADO', PROCEDIMIENTO['PROC-ARTROSCOPIA']!),
  caso(2, PACIENTES[5]!.id, -12, 10, 'COMPLETADO', PROCEDIMIENTO['PROC-COLECISTECTOMIA']!, PROFESIONALES[10]!.id),
  caso(3, PACIENTE.id, -95, 9, 'COMPLETADO', PROCEDIMIENTO['PROC-APENDICECTOMIA']!, PROFESIONALES[10]!.id),
  caso(4, PACIENTES[7]!.id, 3, 8, 'PROGRAMADO', PROCEDIMIENTO['PROC-INFILTRACION']!),
  caso(5, PACIENTES[3]!.id, 6, 11, 'PENDIENTE_EQUIPO', PROCEDIMIENTO['PROC-ARTROSCOPIA']!),
  caso(6, PACIENTES[2]!.id, 0, 14, 'EN_CURSO', PROCEDIMIENTO['PROC-CESAREA']!, PROFESIONALES[2]!.id),
  caso(7, PACIENTES[10]!.id, -5, 8, 'CANCELADO', PROCEDIMIENTO['PROC-ENDOSCOPIA']!, PROFESIONALES[10]!.id),
]);

function vista(c: CasoSimulado) {
  return { id: c.id, caseNumber: c.caseNumber, patientProfileId: c.patientProfileId, primarySurgeonProfileId: c.primarySurgeonProfileId, operatingRoomId: c.operatingRoomId, statusConceptId: c.statusConceptId, scheduledStartAt: c.scheduledStartAt, scheduledEndAt: c.scheduledEndAt };
}

const dentales = new Coleccion<{ id: string; patientProfileId: string; procedureCodeConceptId: string; statusConceptId: string; performerProfileId: string; encounterId: string | null; noteText: string; performedAt: string; createdAt: string; sites: { id: string; bodySiteConceptId: string; description: string }[] }>(
  (
    [
      [PACIENTE.id, 'DENT-LIMPIEZA', 'Profilaxis dental', -120, '16', 'Limpieza semestral sin hallazgos.'],
      [PACIENTE.id, 'DENT-OBTURACION', 'Obturación con resina', -60, '36', 'Caries oclusal en primer molar inferior izquierdo.'],
      [PACIENTES[3]!.id, 'DENT-SELLANTE', 'Sellante de fosas y fisuras', -30, '26', 'Prevención en molar permanente.'],
      [PACIENTES[8]!.id, 'DENT-ENDODONCIA', 'Endodoncia', -10, '11', 'Pulpitis irreversible; conducto único.'],
    ] as const
  ).map(([pac, code, display, dias, diente, nota], i) => ({
    id: uuid(`dental-${i}`),
    patientProfileId: pac,
    procedureCodeConceptId: uuid(`concept-${code}`),
    statusConceptId: ESTADO['ST-COMPLETED']!,
    performerProfileId: PROFESIONALES[8]!.id,
    encounterId: null as string | null,
    noteText: `${display}. ${nota}`,
    performedAt: iso(dias, 10),
    createdAt: iso(dias, 10, 40),
    sites: [{ id: uuid(`dental-site-${i}`), bodySiteConceptId: uuid(`concept-tooth-${diente}`), description: `Pieza ${diente}` }],
  })),
);

const CATALOGO_DENTAL = {
  procedureCodes: [['DENT-LIMPIEZA', 'Profilaxis dental'], ['DENT-OBTURACION', 'Obturación con resina'], ['DENT-SELLANTE', 'Sellante de fosas y fisuras'], ['DENT-ENDODONCIA', 'Endodoncia'], ['DENT-EXTRACCION', 'Extracción simple'], ['DENT-CORONA', 'Corona de porcelana'], ['DENT-ORTODONCIA', 'Control de ortodoncia']].map(([code, display]) => ({ conceptId: uuid(`concept-${code}`), code: code!, display: display! })),
  teeth: Array.from({ length: 32 }, (_, i) => {
    const cuadrante = Math.floor(i / 8) + 1;
    const pieza = `${cuadrante}${(i % 8) + 1}`;
    return { conceptId: uuid(`concept-tooth-${pieza}`), code: pieza, display: `Pieza ${pieza}` };
  }),
  quadrants: [['Q1', 'Superior derecho'], ['Q2', 'Superior izquierdo'], ['Q3', 'Inferior izquierdo'], ['Q4', 'Inferior derecho']].map(([code, display]) => ({ conceptId: uuid(`concept-quadrant-${code}`), code: code!, display: display! })),
};

export function registrarProcedimientos(router: MockRouter): void {
  router.get('/procedure-cases', ({ query }) => {
    const patient = texto(query, 'patientProfileId');
    const surgeon = texto(query, 'primarySurgeonProfileId');
    const room = texto(query, 'operatingRoomId');
    const status = texto(query, 'statusConceptId');
    const from = texto(query, 'from');
    const to = texto(query, 'to');
    const offset = Number(query.get('offset') ?? 0);
    const limit = Number(query.get('limit') ?? 50) || 50;
    const todos = casos
      .todos()
      .filter((c) => patient === null || c.patientProfileId === patient)
      .filter((c) => surgeon === null || c.primarySurgeonProfileId === surgeon || c.equipo.some((m) => m.practitionerProfileId === surgeon))
      .filter((c) => room === null || c.operatingRoomId === room)
      .filter((c) => status === null || c.statusConceptId === status)
      .filter((c) => (from === null || c.scheduledStartAt >= from) && (to === null || c.scheduledStartAt <= to))
      .sort((a, b) => b.scheduledStartAt.localeCompare(a.scheduledStartAt));
    return { items: todos.slice(offset, offset + limit).map(vista), total: todos.length };
  });

  router.get('/procedure-cases/:id', ({ params }) => {
    const c = casos.get(params['id']!);
    if (c === undefined) return notFound('Caso no encontrado');
    const completado = c.statusConceptId === ESTADO_CASO.COMPLETADO;
    return {
      case: vista(c),
      team: c.equipo,
      operativeSteps: completado
        ? [
            { id: uuid(`step-${c.id}-1`), stepNumber: 1, stepCodeConceptId: uuid('concept-step-anesthesia'), description: 'Inducción anestésica', performedByProfileId: ANESTESISTA.id, bodySiteConceptId: null, lateralityConceptId: null, statusConceptId: ESTADO['ST-COMPLETED']!, startedAt: c.scheduledStartAt, endedAt: iso(0, 0) < c.scheduledStartAt ? null : c.scheduledStartAt },
            { id: uuid(`step-${c.id}-2`), stepNumber: 2, stepCodeConceptId: c.procedimiento, description: 'Tiempo quirúrgico principal', performedByProfileId: c.primarySurgeonProfileId, bodySiteConceptId: SITIO.RODILLA, lateralityConceptId: LATERALIDAD.DER, statusConceptId: ESTADO['ST-COMPLETED']!, startedAt: c.scheduledStartAt, endedAt: c.scheduledEndAt },
            { id: uuid(`step-${c.id}-3`), stepNumber: 3, stepCodeConceptId: uuid('concept-step-closure'), description: 'Cierre y curación', performedByProfileId: MEDICA.id, bodySiteConceptId: null, lateralityConceptId: null, statusConceptId: ESTADO['ST-COMPLETED']!, startedAt: c.scheduledEndAt, endedAt: c.scheduledEndAt },
          ]
        : [],
      findings: completado ? [{ id: uuid(`finding-${c.id}`), operativeStepId: uuid(`step-${c.id}-2`), findingCodeConceptId: uuid('concept-finding-lesion'), findingText: 'Lesión compatible con el diagnóstico preoperatorio; sin complicaciones.', bodySiteConceptId: SITIO.RODILLA, lateralityConceptId: LATERALIDAD.DER, severityConceptId: SEVERIDAD['SEV-MILD']!, recordedByProfileId: c.primarySurgeonProfileId, recordedAt: c.scheduledEndAt }] : [],
      implants: completado && c.procedimiento === PROCEDIMIENTO['PROC-ARTROSCOPIA'] ? [{ id: uuid(`implant-${c.id}`), procedureId: c.id, implantDeviceId: uuid('device-anchor'), implantRoleConceptId: uuid('concept-implant-role-fixation'), bodySiteConceptId: SITIO.RODILLA, lateralityConceptId: LATERALIDAD.DER, implantedAt: c.scheduledEndAt, explantedAt: null, statusConceptId: ESTADO['ST-ACTIVE']!, identifiers: [{ id: uuid(`udi-${c.id}`), identifierTypeConceptId: uuid('concept-identifier-udi'), identifierValue: '(01)00889842048306(17)280131(10)L2405', issuingSystem: 'GS1', lotNumber: 'L2405', serialNumber: null, expirationDate: '2028-01-31' }] }] : [],
      operativeReports: completado ? [{ id: uuid(`report-${c.id}`), reportVersion: 1, statusConceptId: ESTADO['ST-COMPLETED']!, signedAt: c.scheduledEndAt }] : [],
    };
  });

  router.get('/procedure-cases/:id/team-members', ({ params }) => casos.get(params['id']!)?.equipo ?? notFound('Caso no encontrado'));

  router.post('/procedure-cases/:id/team-members', (request) => {
    const c = casos.get(request.params['id']!);
    if (c === undefined) return notFound('Caso no encontrado');
    const datos = cuerpo<{ practitionerProfileId: string; teamRoleConceptId?: string }>(request);
    const nuevo = { id: nuevoId('team'), practitionerProfileId: datos.practitionerProfileId ?? '', teamRoleConceptId: datos.teamRoleConceptId ?? ROL_EQUIPO.AYUDANTE, statusConceptId: ESTADO_MIEMBRO.INVITADO };
    casos.actualizar(c.id, { equipo: [...c.equipo, nuevo] });
    return { status: 201, body: nuevo };
  });

  const responder = (estado: string) => (request: { params: Readonly<Record<string, string>>; body: unknown }) => {
    const c = casos.get(request.params['id']!);
    if (c === undefined) return notFound('Caso no encontrado');
    const equipo = c.equipo.map((m) => (m.id === request.params['memberId'] ? { ...m, statusConceptId: estado } : m));
    const todosAceptaron = equipo.every((m) => m.statusConceptId === ESTADO_MIEMBRO.ACEPTADO);
    casos.actualizar(c.id, { equipo, ...(todosAceptaron && c.statusConceptId === ESTADO_CASO.PENDIENTE_EQUIPO ? { statusConceptId: ESTADO_CASO.PROGRAMADO } : {}) });
    return { id: request.params['memberId'], procedureCaseId: c.id, statusConceptId: estado, teamSize: equipo.length };
  };
  router.post('/procedure-cases/:id/team-members/:memberId/accept', responder(ESTADO_MIEMBRO.ACEPTADO));
  router.post('/procedure-cases/:id/team-members/:memberId/respond', responder(ESTADO_MIEMBRO.RECHAZADO));
  router.post('/procedure-cases/:id/team-members/:memberId/decline', responder(ESTADO_MIEMBRO.RECHAZADO));

  /* ---- odontología --------------------------------------------------------- */

  router.get('/dental-procedures/catalog', () => CATALOGO_DENTAL);

  router.get('/dental-procedures', ({ query }) => {
    const patient = texto(query, 'patientProfileId');
    const items = dentales.filtrar((d) => patient === null || d.patientProfileId === patient).sort((a, b) => b.performedAt.localeCompare(a.performedAt));
    return { items, total: items.length };
  });

  router.post('/dental-procedures', (request) => {
    const datos = cuerpo<{ patientProfileId: string; procedureCodeConceptId: string; performerProfileId?: string; toothSiteConceptId?: string; siteDetail?: string; noteText?: string; encounterId?: string; performedAt?: string }>(request);
    const nuevo = dentales.agregar({
      id: nuevoId('dental'),
      patientProfileId: datos.patientProfileId ?? '',
      procedureCodeConceptId: datos.procedureCodeConceptId ?? '',
      statusConceptId: ESTADO['ST-COMPLETED']!,
      performerProfileId: datos.performerProfileId ?? request.user?.practitionerProfileId ?? MEDICA.id,
      encounterId: datos.encounterId ?? null,
      noteText: datos.noteText ?? '',
      performedAt: datos.performedAt ?? ahora(),
      createdAt: ahora(),
      sites: datos.toothSiteConceptId === undefined ? [] : [{ id: nuevoId('dental-site'), bodySiteConceptId: datos.toothSiteConceptId, description: datos.siteDetail ?? '' }],
    });
    return { status: 201, body: { id: nuevo.id, patientProfileId: nuevo.patientProfileId, statusConceptId: nuevo.statusConceptId, createdAt: nuevo.createdAt } };
  });
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
casos.persistirEn('mock.procedures.casos');
dentales.persistirEn('mock.procedures.dentales');
