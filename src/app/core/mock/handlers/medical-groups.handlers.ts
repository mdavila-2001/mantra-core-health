import { conceptById } from '../fixtures/concepts';
import { MEDICAL, PATIENTS, PROFESSIONALS } from '../fixtures/people';
import {
  conflict,
  forbidden,
  notFound,
  preconditionFailed,
  reply,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, nuevoId, paginar, uuid } from '../mock-store';
import { conditionList } from '../fixtures/clinic';
import { servicios } from './practice.handlers';

/* ============================================================================
    Grupos médicos (FT-21) — las 8 rutas de `MedicalGroupsController`.

    Calca las reglas del servicio real, no sólo la forma de las respuestas:
    el creador entra como miembro aceptado y sin pago; `recibidas` son las
    invitaciones sin responder, `enviadas` los grupos propios con invitaciones
    pendientes e `historico` lo creado más lo aceptado; un cambio de horario del
    propio creador se aplica directo; las notas sólo se cargan desde que se
    realiza la cita y hasta una semana después, y pasada la semana el grupo se
    cierra; quien no es parte del grupo recibe 404, nunca 403.

    Persiste en `sessionStorage` (`Coleccion` con clave): se puede crear,
    recargar y seguir viendo el grupo, que es la única prueba de que «guardó».
    ========================================================================== */

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const IMPORTE = /^\d+(\.\d{1,2})?$/;
const ROLES = ['PRACTITIONER', 'CLINICIAN'];

type Estado = 'PENDING_TEAM' | 'SCHEDULED' | 'RESCHEDULE_PENDING' | 'CLOSED';
type Invitacion = 'PENDING' | 'ACCEPTED' | 'REJECTED';

interface MiembroSimulado {
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly roleTitle: string;
  readonly agreedPaymentAmount: string;
  readonly additionalTermsText: string | null;
  readonly isCreator: boolean;
  readonly invitationStatus: Invitacion;
  readonly respondedAt: string | null;
}

interface GrupoSimulado {
  readonly id: string;
  readonly serviceCatalogId: string;
  readonly requestingPractitionerId: string;
  readonly patientProfileId: string | null;
  readonly conditionId: string | null;
  readonly scheduledAt: string;
  readonly locationText: string;
  readonly notesText: string | null;
  readonly termsText: string;
  readonly status: Estado;
  readonly exerciseNotesText: string | null;
  readonly exerciseNotesUpdatedAt: string | null;
  readonly proposedRescheduleAt: string | null;
  readonly proposedByPractitionerId: string | null;
  readonly createdAt: string;
  readonly members: readonly MiembroSimulado[];
}

const YO = MEDICAL.id;
const COLEGA = PROFESSIONALS[4]!.id;
const OTRO_COLEGA = PROFESSIONALS[2]!.id;

function servicio(indice: number): string {
  return servicios.todos()[indice]?.id ?? uuid(`service-${indice}`);
}

function miembro(
  grupo: string,
  n: number,
  profesional: string,
  cargo: string,
  pago: string,
  invitacion: Invitacion,
  creador = false,
): MiembroSimulado {
  return {
    id: uuid(`mg-member-${grupo}-${n}`),
    practitionerProfileId: profesional,
    roleTitle: cargo,
    agreedPaymentAmount: pago,
    additionalTermsText: null,
    isCreator: creador,
    invitationStatus: invitacion,
    respondedAt: invitacion === 'PENDING' ? null : iso(-3),
  };
}

function grupo(
  clave: string,
  creador: string,
  servicioIdx: number,
  dias: number,
  lugar: string,
  estado: Estado,
  miembros: readonly [string, string, string, Invitacion][],
  resto: Partial<GrupoSimulado> = {},
): GrupoSimulado {
  const id = uuid(`mg-${clave}`);
  return {
    id,
    serviceCatalogId: servicio(servicioIdx),
    requestingPractitionerId: creador,
    patientProfileId: null,
    conditionId: null,
    scheduledAt: iso(dias, 10),
    locationText: lugar,
    notesText: null,
    termsText: servicios.todos()[servicioIdx]?.descriptionText ?? 'Términos del servicio.',
    status: estado,
    exerciseNotesText: null,
    exerciseNotesUpdatedAt: null,
    proposedRescheduleAt: null,
    proposedByPractitionerId: null,
    createdAt: iso(dias - 20),
    members: [
      miembro(clave, 0, creador, 'Responsable del grupo', '0.00', 'ACCEPTED', true),
      ...miembros.map(([prof, cargo, pago, inv], i) => miembro(clave, i + 1, prof, cargo, pago, inv)),
    ],
    ...resto,
  };
}

const grupos = new Coleccion<GrupoSimulado>(
  [
    grupo('futuro', YO, 3, 6, 'Quirófano 2, Clínica Los Olivos', 'PENDING_TEAM', [
      [COLEGA, 'Anestesiólogo', '500.00', 'PENDING'],
      [OTRO_COLEGA, 'Instrumentista', '300.00', 'ACCEPTED'],
    ], { patientProfileId: PATIENTS[0]!.id, notesText: 'Paciente en ayunas desde la noche anterior.' }),
    grupo('recibida', COLEGA, 1, 4, 'Sala de procedimientos, Hospital San Lucas', 'PENDING_TEAM', [
      [YO, 'Cardiólogo de apoyo', '450.00', 'PENDING'],
    ]),
    grupo('realizado', YO, 2, -2, 'Gabinete de cardiología', 'SCHEDULED', [
      [COLEGA, 'Técnico de ecografía', '200.00', 'ACCEPTED'],
    ], { exerciseNotesText: 'Estudio sin hallazgos de relevancia.', exerciseNotesUpdatedAt: iso(-1) }),
    grupo('cerrado', COLEGA, 4, -30, 'Consultorio Dra. Rojas', 'CLOSED', [
      [YO, 'Cardiólogo', '350.00', 'ACCEPTED'],
    ], { exerciseNotesText: 'Control realizado y registrado.', exerciseNotesUpdatedAt: iso(-29) }),
  ],
  'mock.medical-groups',
);

/** Lo que la API deriva en cada lectura, sin guardarlo. */
function derivados(g: GrupoSimulado, ahoraMs = Date.now()) {
  const fecha = new Date(g.scheduledAt).getTime();
  const cerrado = g.status === 'CLOSED' || ahoraMs > fecha + SEMANA_MS;
  const realizado = ahoraMs >= fecha;
  return { isRealized: realizado, isClosed: cerrado, canEditExerciseNotes: realizado && !cerrado };
}

function ficha(g: GrupoSimulado) {
  const d = derivados(g);
  return { ...g, status: d.isClosed ? 'CLOSED' : g.status, ...d };
}

function actor(request: MockRequest): { readonly perfil: string } | ReturnType<typeof forbidden> {
  const usuario = request.user;
  if (usuario === null || !usuario.roles.some((rol) => ROLES.includes(rol))) return forbidden();
  if (usuario.practitionerProfileId === undefined) {
    return reply(401, {
      statusCode: 401,
      code: 'UNAUTHENTICATED',
      message: 'La cuenta no tiene un perfil profesional asociado',
      error: 'Unauthorized',
    });
  }
  return { perfil: usuario.practitionerProfileId };
}

function esParte(g: GrupoSimulado, perfil: string): boolean {
  return g.requestingPractitionerId === perfil || g.members.some((m) => m.practitionerProfileId === perfil);
}

function esMiembroActivo(g: GrupoSimulado, perfil: string): boolean {
  return (
    g.requestingPractitionerId === perfil ||
    g.members.some((m) => m.practitionerProfileId === perfil && m.invitationStatus === 'ACCEPTED')
  );
}

const noEncontrado = () => notFound('Grupo médico no encontrado');

export function registrarGruposMedicos(router: MockRouter): void {
  router.get('/medical-groups', (request) => {
    const quien = actor(request);
    if (!('perfil' in quien)) return quien;
    const tab = request.query.get('tab') ?? 'historico';
    const todos = grupos.todos().filter((g) => {
      const mios = g.members.filter((m) => m.practitionerProfileId === quien.perfil);
      if (tab === 'recibidas') return mios.some((m) => m.invitationStatus === 'PENDING');
      if (tab === 'enviadas') {
        return g.requestingPractitionerId === quien.perfil && g.members.some((m) => !m.isCreator && m.invitationStatus === 'PENDING');
      }
      return g.requestingPractitionerId === quien.perfil || mios.some((m) => m.invitationStatus === 'ACCEPTED');
    });
    const ordenados = todos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pagina = paginar(ordenados, request.query, 20);
    return {
      items: pagina.items.map((g) => ({
        id: g.id,
        serviceCatalogId: g.serviceCatalogId,
        scheduledAt: g.scheduledAt,
        locationText: g.locationText,
        status: derivados(g).isClosed ? 'CLOSED' : g.status,
        isCreator: g.requestingPractitionerId === quien.perfil,
        patientProfileId: g.patientProfileId,
        pendingMembersCount: g.members.filter((m) => !m.isCreator && m.invitationStatus === 'PENDING').length,
      })),
      nextCursor: pagina.nextCursor,
    };
  });

  router.get('/medical-groups/patients/:patientProfileId/conditions', (request) => {
    const quien = actor(request);
    if (!('perfil' in quien)) return quien;
    const condiciones = conditionList
      .filtrar((c) => c.patientProfileId === request.params['patientProfileId'])
      .sort((a, b) => b.onsetAt.localeCompare(a.onsetAt));
    return condiciones.map((c, i) => {
      const concepto = conceptById(c.codeConceptId);
      return {
        id: c.id,
        code: concepto?.code ?? c.codeConceptId,
        display: concepto?.display ?? '(diagnóstico sin descripción en el catálogo)',
        onsetAt: c.onsetAt,
        isMostRecent: i === 0,
      };
    });
  });

  router.get('/medical-groups/:id', (request) => {
    const quien = actor(request);
    if (!('perfil' in quien)) return quien;
    const g = grupos.get(request.params['id']!);
    return g === undefined || !esParte(g, quien.perfil) ? noEncontrado() : ficha(g);
  });

  router.post('/medical-groups', (request) => {
    const quien = actor(request);
    if (!('perfil' in quien)) return quien;
    const datos = cuerpo<{
      serviceCatalogId: string;
      patientProfileId: string;
      conditionId: string;
      scheduledAt: string;
      locationText: string;
      notesText: string;
      additionalTermsText: string;
      members: { practitionerProfileId: string; roleTitle: string; agreedPaymentAmount: string; additionalTermsText?: string }[];
    }>(request);

    if (typeof datos.locationText !== 'string' || datos.locationText.trim() === '' || datos.locationText.length > 300) {
      return validation('Datos inválidos', [{ field: 'locationText', message: 'debe tener entre 1 y 300 caracteres' }]);
    }
    if (typeof datos.scheduledAt !== 'string' || Number.isNaN(new Date(datos.scheduledAt).getTime())) {
      return validation('Datos inválidos', [{ field: 'scheduledAt', message: 'debe ser una fecha ISO 8601' }]);
    }
    const miembros = Array.isArray(datos.members) ? datos.members : null;
    if (miembros === null) {
      return validation('Datos inválidos', [{ field: 'members', message: 'debe ser un arreglo' }]);
    }
    for (const [i, m] of miembros.entries()) {
      if (typeof m.roleTitle !== 'string' || m.roleTitle.trim() === '' || m.roleTitle.length > 120) {
        return validation('Datos inválidos', [{ field: `members.${i}.roleTitle`, message: 'debe tener entre 1 y 120 caracteres' }]);
      }
      if (typeof m.agreedPaymentAmount !== 'string' || !IMPORTE.test(m.agreedPaymentAmount)) {
        return validation('Datos inválidos', [
          { field: `members.${i}.agreedPaymentAmount`, message: 'El pago acordado debe ser un número positivo con hasta dos decimales' },
        ]);
      }
    }

    const servicioElegido = servicios.get(datos.serviceCatalogId ?? '');
    if (servicioElegido === undefined || !servicioElegido.isActive) return notFound('Servicio médico no encontrado');
    if (datos.conditionId !== undefined && datos.patientProfileId === undefined) {
      return preconditionFailed('Seleccione primero el paciente para poder elegir un diagnóstico');
    }
    if (datos.conditionId !== undefined && conditionList.get(datos.conditionId)?.patientProfileId !== datos.patientProfileId) {
      return notFound('Diagnóstico no encontrado');
    }
    const vistos = new Set<string>([quien.perfil]);
    for (const m of miembros) {
      if (vistos.has(m.practitionerProfileId)) {
        return conflict('Un mismo profesional no puede repetirse (ni ser también el creador)', {
          practitionerProfileId: m.practitionerProfileId,
        });
      }
      vistos.add(m.practitionerProfileId);
      if (!PROFESSIONALS.some((p) => p.id === m.practitionerProfileId)) return notFound('Profesional no encontrado');
    }

    const id = nuevoId('medical-group');
    const adicionales = (datos.additionalTermsText ?? '').trim();
    const terminos = [servicioElegido.descriptionText, adicionales].filter((t) => t !== undefined && t !== '').join('\n\n');
    const nuevo: GrupoSimulado = {
      id,
      serviceCatalogId: servicioElegido.id,
      requestingPractitionerId: quien.perfil,
      patientProfileId: datos.patientProfileId ?? null,
      conditionId: datos.conditionId ?? null,
      scheduledAt: new Date(datos.scheduledAt).toISOString(),
      locationText: datos.locationText,
      notesText: datos.notesText ?? null,
      termsText: terminos,
      status: miembros.length > 0 ? 'PENDING_TEAM' : 'SCHEDULED',
      exerciseNotesText: null,
      exerciseNotesUpdatedAt: null,
      proposedRescheduleAt: null,
      proposedByPractitionerId: null,
      createdAt: ahora(),
      members: [
        { id: nuevoId('mg-member'), practitionerProfileId: quien.perfil, roleTitle: 'Responsable del grupo', agreedPaymentAmount: '0.00', additionalTermsText: null, isCreator: true, invitationStatus: 'ACCEPTED', respondedAt: ahora() },
        ...miembros.map((m): MiembroSimulado => ({
          id: nuevoId('mg-member'),
          practitionerProfileId: m.practitionerProfileId,
          roleTitle: m.roleTitle,
          agreedPaymentAmount: m.agreedPaymentAmount,
          additionalTermsText: m.additionalTermsText ?? null,
          isCreator: false,
          invitationStatus: 'PENDING',
          respondedAt: null,
        })),
      ],
    };
    grupos.agregar(nuevo);
    return reply(201, ficha(nuevo));
  });

  router.post('/medical-groups/:id/members/:memberId/respond', (request) => {
    const quien = actor(request);
    if (!('perfil' in quien)) return quien;
    const g = grupos.get(request.params['id']!);
    if (g === undefined) return noEncontrado();
    const m = g.members.find((x) => x.id === request.params['memberId']);
    if (m === undefined || m.practitionerProfileId !== quien.perfil) return notFound('Solicitud no encontrada');
    if (m.invitationStatus !== 'PENDING') return preconditionFailed('Esta solicitud ya fue respondida');
    const decision = cuerpo<{ decision: string }>(request).decision;
    if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
      return validation('Datos inválidos', [{ field: 'decision', message: 'debe ser ACCEPTED o REJECTED' }]);
    }
    const miembros = g.members.map((x) => (x.id === m.id ? { ...x, invitationStatus: decision, respondedAt: ahora() } as MiembroSimulado : x));
    const sinResponder = miembros.some((x) => x.invitationStatus === 'PENDING');
    const estado: Estado = decision === 'ACCEPTED' && g.status === 'PENDING_TEAM' && !sinResponder ? 'SCHEDULED' : g.status;
    return ficha(grupos.actualizar(g.id, { members: miembros, status: estado })!);
  });

  router.post('/medical-groups/:id/reschedule-requests/respond', (request) => {
    const quien = actor(request);
    if (!('perfil' in quien)) return quien;
    const g = grupos.get(request.params['id']!);
    if (g === undefined) return noEncontrado();
    if (g.requestingPractitionerId !== quien.perfil) {
      return reply(401, { statusCode: 401, code: 'UNAUTHENTICATED', message: 'Sólo quien creó la solicitud puede resolver el cambio de horario propuesto', error: 'Unauthorized' });
    }
    if (g.status !== 'RESCHEDULE_PENDING') return preconditionFailed('No hay ningún cambio de horario pendiente');
    const decision = cuerpo<{ decision: string }>(request).decision;
    if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
      return validation('Datos inválidos', [{ field: 'decision', message: 'debe ser ACCEPTED o REJECTED' }]);
    }
    return ficha(
      grupos.actualizar(g.id, {
        scheduledAt: decision === 'ACCEPTED' && g.proposedRescheduleAt !== null ? g.proposedRescheduleAt : g.scheduledAt,
        status: 'SCHEDULED',
        proposedRescheduleAt: null,
        proposedByPractitionerId: null,
      })!,
    );
  });

  router.post('/medical-groups/:id/reschedule-requests', (request) => {
    const quien = actor(request);
    if (!('perfil' in quien)) return quien;
    const g = grupos.get(request.params['id']!);
    if (g === undefined || !esMiembroActivo(g, quien.perfil)) return noEncontrado();
    if (derivados(g).isClosed) return preconditionFailed('El expediente ya está cerrado y es inmutable');
    if (g.status !== 'SCHEDULED') {
      return preconditionFailed('Sólo se puede solicitar cambio de horario sobre una cita programada y aún no realizada');
    }
    const propuesta = new Date(cuerpo<{ proposedAt: string }>(request).proposedAt ?? '');
    if (Number.isNaN(propuesta.getTime())) {
      return validation('Datos inválidos', [{ field: 'proposedAt', message: 'debe ser una fecha ISO 8601' }]);
    }
    return ficha(
      grupos.actualizar(
        g.id,
        g.requestingPractitionerId === quien.perfil
          ? { scheduledAt: propuesta.toISOString(), proposedRescheduleAt: null, proposedByPractitionerId: null }
          : { status: 'RESCHEDULE_PENDING', proposedRescheduleAt: propuesta.toISOString(), proposedByPractitionerId: quien.perfil },
      )!,
    );
  });

  router.patch('/medical-groups/:id/exercise-notes', (request) => {
    const quien = actor(request);
    if (!('perfil' in quien)) return quien;
    const g = grupos.get(request.params['id']!);
    if (g === undefined || !esMiembroActivo(g, quien.perfil)) return noEncontrado();
    const d = derivados(g);
    if (d.isClosed) return preconditionFailed('El expediente ya está cerrado y es inmutable');
    if (!d.isRealized) {
      return preconditionFailed('Todavía no se realizó la cita: las notas del procedimiento se cargan después');
    }
    const texto = cuerpo<{ notesText: string }>(request).notesText;
    if (typeof texto !== 'string' || texto.length > 8000) {
      return validation('Datos inválidos', [{ field: 'notesText', message: 'debe ser un texto de hasta 8000 caracteres' }]);
    }
    return ficha(grupos.actualizar(g.id, { exerciseNotesText: texto, exerciseNotesUpdatedAt: ahora() })!);
  });
}
