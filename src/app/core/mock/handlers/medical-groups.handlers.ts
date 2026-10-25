import {
  forbidden,
  notFound,
  preconditionFailed,
  reply,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { buildInfo } from '../../../../environments/env.generated';
import { MEDICAL, PROFESSIONALS } from '../fixtures/people';
import { ahora, cuerpo, iso, nuevoId, uuid } from '../mock-store';
import { servicios } from './practice.handlers';

/* ============================================================================
    Grupos médicos (FT-21, carril 21) en la maqueta.

    Las mismas reglas que `MedicalGroupsService` de la API, para que la
    pantalla no se acostumbre a un servidor más permisivo que el real:
    - quien crea entra como miembro aceptado; con invitaciones pendientes el
      grupo está en PENDING_TEAM y pasa a SCHEDULED cuando todas se aceptan;
    - cambio de horario sólo en SCHEDULED: si lo pide el creador, se aplica;
      si lo pide otro, queda RESCHEDULE_PENDING hasta que el creador resuelva;
    - notas del ejercicio desde la fecha y hasta una semana después; pasada la
      semana el grupo se cierra y es inmutable;
    - el nombre del paciente sólo para el creador y los miembros que aceptaron;
    - un tercero recibe 404, nunca 403.
   ========================================================================== */

const NOTES_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const DEFAULT_TERMS =
  'Términos y condiciones por defecto del servicio: cada integrante responde por su cargo, ' +
  'el pago acordado se liquida una vez realizado el servicio y los cambios de horario se ' +
  'acuerdan con quien creó el grupo.';

type Decision = 'ACCEPTED' | 'REJECTED';

interface SimMember {
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly practitionerName: string | null;
  readonly roleTitle: string;
  readonly agreedPaymentAmount: string;
  readonly additionalTermsText?: string;
  readonly isCreator: boolean;
  invitationStatus: 'PENDING' | Decision;
  respondedAt?: string;
}

interface SimGroup {
  readonly id: string;
  readonly serviceCatalogId: string;
  readonly serviceName: string | null;
  readonly requestingPractitionerId: string;
  readonly patientProfileId?: string;
  readonly patientName: string | null;
  readonly conditionId?: string;
  scheduledAt: string;
  readonly locationText: string;
  readonly notesText?: string;
  readonly termsText: string;
  status: 'PENDING_TEAM' | 'SCHEDULED' | 'RESCHEDULE_PENDING' | 'CLOSED';
  exerciseNotesText?: string;
  exerciseNotesUpdatedAt?: string;
  proposedRescheduleAt?: string;
  proposedByPractitionerId?: string;
  readonly createdAt: string;
  readonly members: SimMember[];
}

const groups = new Map<string, SimGroup>();

/* ---- datos de arranque y persistencia ------------------------------------
   Sin esto la maqueta arranca vacía y sólo se puede probar el alta: ninguna
   invitación que responder, ninguna cita realizada para cargarle notas, ningún
   expediente cerrado, y todo lo hecho se pierde al recargar. Se guarda en
   `sessionStorage` sellado con el build (mismo criterio que `Coleccion`) para
   poder comprobar «guardado → recarga → sigue ahí». */

const STORAGE_KEY = 'mock.medical-groups';

const COLLEAGUE = PROFESSIONALS[4]!;
const OTHER_COLLEAGUE = PROFESSIONALS[2]!;

function seedMember(
  group: string,
  n: number,
  who: { id: string; displayName?: string },
  roleTitle: string,
  agreedPaymentAmount: string,
  invitationStatus: SimMember['invitationStatus'],
  isCreator = false,
): SimMember {
  return {
    id: uuid(`mg-member-${group}-${n}`),
    practitionerProfileId: who.id,
    practitionerName: who.displayName ?? null,
    roleTitle,
    agreedPaymentAmount,
    isCreator,
    invitationStatus,
    ...(invitationStatus === 'PENDING' ? {} : { respondedAt: iso(-3) }),
  };
}

function seedGroups(): SimGroup[] {
  const base = {
    termsText: DEFAULT_TERMS,
    patientName: null,
  };
  const mk = (
    key: string,
    creator: { id: string; displayName?: string },
    days: number,
    place: string,
    status: SimGroup['status'],
    team: [{ id: string; displayName?: string }, string, string, SimMember['invitationStatus']][],
    extra: Partial<SimGroup> = {},
  ): SimGroup => ({
    id: uuid(`mg-${key}`),
    serviceCatalogId: uuid(`service-ECO-DOPPLER`),
    serviceName: 'Ecocardiograma Doppler',
    requestingPractitionerId: creator.id,
    scheduledAt: iso(days, 10),
    locationText: place,
    status,
    createdAt: iso(days - 20),
    members: [
      seedMember(key, 0, creator, 'Responsable del grupo', '0.00', 'ACCEPTED', true),
      ...team.map(([who, role, pay, state], i) => seedMember(key, i + 1, who, role, pay, state)),
    ],
    ...base,
    ...extra,
  });
  return [
    mk('recibida', COLLEAGUE, 4, 'Sala de procedimientos, Hospital San Lucas', 'PENDING_TEAM', [
      [MEDICAL, 'Cardiólogo de apoyo', '450.00', 'PENDING'],
    ]),
    mk('enviada', MEDICAL, 6, 'Quirófano 2, Clínica Los Olivos', 'PENDING_TEAM', [
      [OTHER_COLLEAGUE, 'Anestesiólogo', '500.00', 'PENDING'],
    ]),
    mk('realizado', MEDICAL, -2, 'Gabinete de cardiología', 'SCHEDULED', [
      [COLLEAGUE, 'Técnico de ecografía', '200.00', 'ACCEPTED'],
    ]),
    mk('cerrado', COLLEAGUE, -30, 'Consultorio Dra. Rojas', 'CLOSED', [
      [MEDICAL, 'Cardiólogo', '350.00', 'ACCEPTED'],
    ], { exerciseNotesText: 'Control realizado y registrado.', exerciseNotesUpdatedAt: iso(-29) }),
  ];
}

function loadGroups(): void {
  let rows: SimGroup[] | null = null;
  try {
    const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const saved = JSON.parse(raw) as { build?: unknown; groups?: unknown };
      if (saved.build === buildInfo.commit && Array.isArray(saved.groups)) {
        rows = saved.groups as SimGroup[];
      }
    }
  } catch {
    rows = null;
  }
  for (const group of rows ?? seedGroups()) groups.set(group.id, group);
}

function persistGroups(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ build: buildInfo.commit, groups: [...groups.values()] }),
    );
  } catch {
    // Cuota llena o almacenamiento bloqueado: se sigue en memoria.
  }
}

/** Cada escritura se guarda y responde con la ficha ya actualizada. */
function saved(group: SimGroup, me: string): unknown {
  persistGroups();
  return toDto(group, me);
}

loadGroups();

interface NewGroupBody {
  readonly serviceCatalogId: string;
  readonly patientProfileId: string;
  readonly conditionId: string;
  readonly scheduledAt: string;
  readonly locationText: string;
  readonly notesText: string;
  readonly additionalTermsText: string;
  readonly members: readonly {
    readonly practitionerProfileId?: string;
    readonly roleTitle?: string;
    readonly agreedPaymentAmount?: string;
    readonly additionalTermsText?: string;
  }[];
}

function isClosed(group: SimGroup): boolean {
  return Date.now() > new Date(group.scheduledAt).getTime() + NOTES_WINDOW_MS;
}

function isRealized(group: SimGroup): boolean {
  return Date.now() >= new Date(group.scheduledAt).getTime();
}

function inTeam(group: SimGroup, me: string): boolean {
  return group.members.some(
    (m) => m.practitionerProfileId === me && (m.isCreator || m.invitationStatus === 'ACCEPTED'),
  );
}

function sees(group: SimGroup, me: string): boolean {
  return group.members.some((m) => m.practitionerProfileId === me);
}

function toDto(group: SimGroup, me: string): unknown {
  const closed = isClosed(group);
  const realized = isRealized(group);
  return {
    ...group,
    patientName:
      group.patientProfileId !== undefined && inTeam(group, me) ? group.patientName : null,
    status: closed ? 'CLOSED' : group.status,
    isRealized: realized,
    isClosed: closed,
    canEditExerciseNotes: realized && !closed,
  };
}

/** El perfil profesional de quien pide; sin él la API responde 401. */
function practitionerOf(request: MockRequest): string | null {
  return request.user?.practitionerProfileId ?? null;
}

function findVisible(request: MockRequest): SimGroup | null {
  const me = practitionerOf(request);
  const group = groups.get(request.params['id'] ?? '');
  return group === undefined || me === null || !sees(group, me) ? null : group;
}

export function registerMedicalGroups(router: MockRouter): void {
  router.get('/medical-groups', (request) => {
    const me = practitionerOf(request);
    if (me === null) return forbidden();
    const tab = request.query.get('tab') ?? 'historico';
    const items = [...groups.values()]
      .filter((group) => {
        const mine = group.requestingPractitionerId === me;
        const member = group.members.find((m) => m.practitionerProfileId === me && !m.isCreator);
        if (tab === 'recibidas') return member?.invitationStatus === 'PENDING';
        if (tab === 'enviadas') {
          return (
            mine && group.members.some((m) => !m.isCreator && m.invitationStatus === 'PENDING')
          );
        }
        return mine || member?.invitationStatus === 'ACCEPTED';
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((group) => ({
        id: group.id,
        serviceCatalogId: group.serviceCatalogId,
        serviceName: group.serviceName,
        scheduledAt: group.scheduledAt,
        locationText: group.locationText,
        status: isClosed(group) ? 'CLOSED' : group.status,
        isCreator: group.requestingPractitionerId === me,
        patientProfileId: group.patientProfileId,
        pendingMembersCount: group.members.filter(
          (m) => !m.isCreator && m.invitationStatus === 'PENDING',
        ).length,
      }));
    return { items, nextCursor: null };
  });

  router.get('/medical-groups/patients/:patientProfileId/conditions', () => []);

  // Dos colegas de la misma organización para poder armar un equipo en la maqueta.
  router.get('/medical-groups/eligible-members', (request) =>
    practitionerOf(request) === null
      ? forbidden()
      : [COLLEAGUE, OTHER_COLLEAGUE].map((p) => ({
          practitionerProfileId: p.id,
          name: p.displayName ?? null,
        })),
  );

  router.get('/medical-groups/:id', (request) => {
    const group = findVisible(request);
    return group === null
      ? notFound('Grupo médico no encontrado')
      : toDto(group, practitionerOf(request)!);
  });

  router.post('/medical-groups', (request) => {
    const me = practitionerOf(request);
    if (me === null) return forbidden();
    const body = cuerpo<NewGroupBody>(request);
    if (typeof body.serviceCatalogId !== 'string' || body.serviceCatalogId === '') {
      return validation('Elija el servicio de salud.');
    }
    if (typeof body.scheduledAt !== 'string' || Number.isNaN(Date.parse(body.scheduledAt))) {
      return validation('La fecha de realización no es válida.');
    }
    if (typeof body.locationText !== 'string' || body.locationText.trim() === '') {
      return validation('Escriba el lugar de realización.');
    }
    const invited = body.members ?? [];
    if (invited.some((m) => !AMOUNT.test(m.agreedPaymentAmount ?? ''))) {
      return validation('El pago acordado debe ser un número positivo con hasta dos decimales');
    }
    const id = nuevoId('grupo');
    const group: SimGroup = {
      id,
      serviceCatalogId: body.serviceCatalogId,
      // El nombre sale del catálogo de la maqueta, como lo resuelve la API real.
      serviceName: servicios.get(body.serviceCatalogId)?.name ?? 'Servicio del catálogo',
      requestingPractitionerId: me,
      ...(body.patientProfileId ? { patientProfileId: body.patientProfileId } : {}),
      patientName: body.patientProfileId ? 'Paciente de la maqueta' : null,
      ...(body.conditionId ? { conditionId: body.conditionId } : {}),
      scheduledAt: body.scheduledAt,
      locationText: body.locationText.trim(),
      ...(body.notesText ? { notesText: body.notesText } : {}),
      termsText: body.additionalTermsText
        ? `${DEFAULT_TERMS}\n\n${body.additionalTermsText}`
        : DEFAULT_TERMS,
      status: invited.length > 0 ? 'PENDING_TEAM' : 'SCHEDULED',
      createdAt: ahora(),
      members: [
        {
          id: nuevoId('miembro'),
          practitionerProfileId: me,
          practitionerName: request.user?.displayName ?? null,
          roleTitle: 'Responsable del grupo',
          agreedPaymentAmount: '0.00',
          isCreator: true,
          invitationStatus: 'ACCEPTED',
        },
        ...invited.map((m) => ({
          id: nuevoId('miembro'),
          practitionerProfileId: m.practitionerProfileId ?? '',
          practitionerName: null,
          roleTitle: m.roleTitle ?? '',
          agreedPaymentAmount: m.agreedPaymentAmount ?? '0',
          ...(m.additionalTermsText ? { additionalTermsText: m.additionalTermsText } : {}),
          isCreator: false,
          invitationStatus: 'PENDING' as const,
        })),
      ],
    };
    groups.set(id, group);
    persistGroups();
    return reply(201, toDto(group, me));
  });

  router.post('/medical-groups/:id/members/:memberId/respond', (request) => {
    const group = findVisible(request);
    const me = practitionerOf(request);
    const member = group?.members.find(
      (m) => m.id === request.params['memberId'] && m.practitionerProfileId === me,
    );
    if (group === null || member === undefined || me === null) {
      return notFound('Grupo médico no encontrado');
    }
    if (member.invitationStatus !== 'PENDING') {
      return preconditionFailed('Esta invitación ya fue respondida.');
    }
    const { decision } = cuerpo<{ decision: Decision }>(request);
    member.invitationStatus = decision === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED';
    member.respondedAt = ahora();
    if (group.members.every((m) => m.invitationStatus === 'ACCEPTED')) group.status = 'SCHEDULED';
    return saved(group, me);
  });

  router.post('/medical-groups/:id/reschedule-requests', (request) => {
    const group = findVisible(request);
    const me = practitionerOf(request);
    if (group === null || me === null || !inTeam(group, me))
      return notFound('Grupo médico no encontrado');
    if (group.status !== 'SCHEDULED' || isRealized(group)) {
      return preconditionFailed(
        'Sólo se puede cambiar el horario de un grupo programado y no realizado.',
      );
    }
    const { proposedAt } = cuerpo<{ proposedAt: string }>(request);
    if (typeof proposedAt !== 'string' || Date.parse(proposedAt) <= Date.now()) {
      return preconditionFailed('La fecha propuesta tiene que ser futura.');
    }
    if (group.requestingPractitionerId === me) {
      group.scheduledAt = proposedAt;
    } else {
      group.status = 'RESCHEDULE_PENDING';
      group.proposedRescheduleAt = proposedAt;
      group.proposedByPractitionerId = me;
    }
    return saved(group, me);
  });

  router.post('/medical-groups/:id/reschedule-requests/respond', (request) => {
    const group = findVisible(request);
    const me = practitionerOf(request);
    if (group === null || me === null || group.requestingPractitionerId !== me) {
      return notFound('Grupo médico no encontrado');
    }
    if (group.status !== 'RESCHEDULE_PENDING') {
      return preconditionFailed('No hay un cambio de horario pendiente.');
    }
    const { decision } = cuerpo<{ decision: Decision }>(request);
    if (decision === 'ACCEPTED' && group.proposedRescheduleAt)
      group.scheduledAt = group.proposedRescheduleAt;
    group.status = 'SCHEDULED';
    delete group.proposedRescheduleAt;
    delete group.proposedByPractitionerId;
    return saved(group, me);
  });

  router.patch('/medical-groups/:id/exercise-notes', (request) => {
    const group = findVisible(request);
    const me = practitionerOf(request);
    if (group === null || me === null || !inTeam(group, me))
      return notFound('Grupo médico no encontrado');
    if (isClosed(group)) return preconditionFailed('El expediente del grupo está cerrado.');
    if (!isRealized(group)) {
      return preconditionFailed('Las notas se cargan después de realizado el procedimiento.');
    }
    const { notesText } = cuerpo<{ notesText: string }>(request);
    group.exerciseNotesText = notesText ?? '';
    group.exerciseNotesUpdatedAt = ahora();
    return saved(group, me);
  });
}
