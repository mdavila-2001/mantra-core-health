import type {
  AffiliationInvitation,
  CatalogDoctor,
  CatalogService,
  LocationKind,
  LocationNode,
  ConfirmedSupportEngagement,
  DelegateStatus,
  DoctorTeam,
  DoctorTeamMember,
  EngagementDecisionResult,
  InvitationRedeemResult,
  MySupportEngagements,
  NewAffiliationInvitation,
  NewSupportEngagementRequest,
  SupportActivityEntry,
  SupportActivityPage,
  SupportCatalog,
  SupportEngagement,
  SupportEngagementPage,
  SupportEngagementRequest,
  SupportEngagementStatus,
  SupportRequestPage,
  SupportRequestStatus,
} from './support-access.types';

/**
 * La **forma de cable** de los DTO de la API (`delegated_access/dto`), contra la
 * forma que usan las pantallas.
 *
 * Las pantallas hablan de `roleTemplate`, `parentEngagementId` y
 * `proposedActions`; la API pide y devuelve `roleTemplateCode`,
 * `parentAssignmentId` y, al pedir, `actions`. En vez de renombrar cuarenta
 * archivos, el cliente traduce en los dos sentidos **acá** y en ningún otro
 * lado. Manda la API: lo que sale tiene exactamente sus nombres (`forbidNonWhitelisted`
 * rechaza el resto) y lo que entra se acepta con el nombre de la API o, por si
 * una respuesta vieja trae el de la pantalla, con ese.
 */

/* ---- de la pantalla a la API ------------------------------------------------------ */

export function toWireEngagementRequest(
  request: NewSupportEngagementRequest,
): Record<string, unknown> {
  return {
    tenantId: request.tenantId,
    roleTemplateCode: request.roleTemplate,
    ...(request.parentEngagementId === undefined
      ? {}
      : { parentAssignmentId: request.parentEngagementId }),
    ...(request.message === undefined ? {} : { message: request.message }),
    items: request.items.map(({ proposedActions, ...objetivo }) => ({
      ...objetivo,
      actions: proposedActions,
    })),
  };
}

/**
 * `CreateAffiliationInvitationDto` no tiene `targetPersonLabel`: es una etiqueta
 * que solo existe en la pantalla de quien emite, y mandarla haría que la API
 * rechace el cuerpo entero.
 */
export function toWireInvitation(invitation: NewAffiliationInvitation): Record<string, unknown> {
  return {
    kind: invitation.kind,
    ...(invitation.targetPersonId === undefined
      ? {}
      : { targetPersonId: invitation.targetPersonId }),
    maxUses: invitation.maxUses,
    expiresInDays: invitation.expiresInDays,
    ...(invitation.roleTemplate === undefined ? {} : { roleTemplateCode: invitation.roleTemplate }),
  };
}

/* ---- de la API a la pantalla ---------------------------------------------------- */

type ConCodigo<T> = T & { readonly roleTemplateCode?: string };

function conPlantilla<T extends { roleTemplate?: unknown }>(fila: ConCodigo<T>): T {
  const { roleTemplateCode, ...resto } = fila;
  return (roleTemplateCode === undefined || resto.roleTemplate !== undefined
    ? resto
    : { ...resto, roleTemplate: roleTemplateCode }) as unknown as T;
}

/**
 * El estado del vínculo en la API es `ACTIVE | SUSPENDED | REVOKED | EXPIRED`; las
 * pantallas hablan de `ENDED`. Un vínculo revocado o vencido ya no rige y no vuelve
 * solo, así que los dos son «terminado».
 */
export function fromWireEngagementStatus(status: string): SupportEngagementStatus {
  switch (status) {
    case 'REVOKED':
    case 'EXPIRED':
    case 'ENDED':
      return 'ENDED';
    case 'SUSPENDED':
      return 'SUSPENDED';
    case 'PENDING':
      return 'PENDING';
    default:
      return 'ACTIVE';
  }
}

/** Un vínculo de la API. Los campos que la API deja ausentes llegan ausentes; no se inventa ninguno. */
export function fromWireEngagement(fila: SupportEngagement): SupportEngagement {
  // `recertificationDue` es un derivado que la API manda; las pantallas lo calculan con la fecha.
  const {
    status,
    recertificationDue: _vencida,
    ...resto
  } = conPlantilla(fila as ConCodigo<SupportEngagement>) as SupportEngagement & {
    recertificationDue?: boolean;
  };
  return {
    ...resto,
    status: fromWireEngagementStatus(status),
    ...(resto.grants === undefined ? {} : { grants: resto.grants.map(sinNulos) }),
  };
}

/**
 * La API manda `null` en lo que un permiso no tiene (`healthcareServiceId: null`, `validTo: null`), y las pantallas hablan de campo
 * **ausente**. No es un detalle: si ese `null` vuelve en el borrador de `simulate`, la huella (`simulationToken`) no coincide con la del
 * guardado —que arma el borrador sin esos campos— y la API contesta 409 `SIMULATION_STALE` aunque nada haya cambiado (B7c, comprobado).
 */
function sinNulos<T extends object>(fila: T): T {
  return Object.fromEntries(Object.entries(fila).filter(([, v]) => v !== null)) as T;
}

/** `POST /me/support-engagements/:id/confirm`: el vínculo más `reactivated`. */
export function fromWireConfirmed(
  fila: SupportEngagement & { readonly reactivated?: boolean },
): ConfirmedSupportEngagement {
  const { reactivated, ...vinculo } = fila;
  return { ...fromWireEngagement(vinculo as SupportEngagement), reactivated: reactivated === true };
}

export function fromWireRequest(fila: SupportEngagementRequest): SupportEngagementRequest {
  const {
    parentAssignmentId,
    roleTemplateId: _id,
    ...resto
  } = conPlantilla(fila as ConCodigo<SupportEngagementRequest>) as SupportEngagementRequest & {
    parentAssignmentId?: string;
    roleTemplateId?: string;
  };
  return parentAssignmentId === undefined || resto.parentEngagementId !== undefined
    ? resto
    : { ...resto, parentEngagementId: parentAssignmentId };
}

/**
 * El filtro `status` del listado de solicitudes: la API acepta
 * `PENDING | APPROVED | REJECTED | EXPIRED | CANCELLED` y **no** `PARTIAL` (un 400).
 * Con `PARTIAL` no se manda filtro y se recorta de lo recibido.
 */
export function toWireRequestStatus(status: SupportRequestStatus | undefined): string | undefined {
  return status === undefined || status === 'PARTIAL' ? undefined : status;
}

/** `EngagementDecisionResultDto`: no trae la solicitud, solo cómo quedó. */
export function fromWireDecision(body: EngagementDecisionResult): EngagementDecisionResult {
  return {
    requestId: body.requestId,
    status: body.status,
    ...(body.engagementId === undefined || body.engagementId === null
      ? {}
      : { engagementId: body.engagementId }),
    grantIds: body.grantIds ?? [],
    ...(body.pendingItemIds === undefined ||
    body.pendingItemIds === null ||
    body.pendingItemIds.length === 0
      ? {}
      : { pendingItemIds: body.pendingItemIds }),
  };
}

/* ---- actividad -------------------------------------------------------------------- */

type EntradaDeLaRed = Partial<SupportActivityEntry> & {
  readonly actorName?: string;
  readonly occurredAt?: string;
  readonly recordedAt?: string;
};

/**
 * Un asiento de la bitácora. La API repite la persona y el instante con tres nombres
 * (`personName`/`actorName`, `createdAt`/`occurredAt`/`recordedAt`); la pantalla lee uno
 * de cada par y los demás se descartan. `success` y `result` dicen lo mismo: manda `result`.
 */
export function fromWireActivityEntry(fila: EntradaDeLaRed): SupportActivityEntry {
  const { actorName, occurredAt, recordedAt, ...resto } = fila;
  const createdAt = resto.createdAt ?? occurredAt ?? recordedAt ?? '';
  const result = resto.result ?? (resto.success === false ? 'FAILURE' : 'SUCCESS');
  return {
    ...(resto as SupportActivityEntry),
    personName: resto.personName ?? actorName ?? '',
    createdAt,
    result,
    success: result === 'SUCCESS',
    auditAction: resto.auditAction ?? resto.action ?? '',
    entity: resto.entity ?? '',
    userId: resto.userId ?? '',
    summary: resto.summary ?? '',
    action: resto.action ?? '',
  };
}

export function fromWireActivityPage(body: {
  readonly items?: readonly EntradaDeLaRed[];
  readonly count?: number;
  readonly nextCursor?: string | null;
}): SupportActivityPage {
  const items = (body.items ?? []).map(fromWireActivityEntry);
  return { items, count: body.count ?? items.length, nextCursor: body.nextCursor ?? null };
}

/* ---- equipo del doctor ------------------------------------------------------------ */

type MiembroDeLaRed = Omit<DoctorTeamMember, 'roleTemplate'> & {
  readonly roleTemplate?: DoctorTeamMember['roleTemplate'];
  readonly roleTemplateCode?: DoctorTeamMember['roleTemplate'];
};

/** `SupportTeamMemberDto`: trae `roleTemplateCode` y `roleTemplate` (el mismo valor). */
export function fromWireTeamMember(fila: MiembroDeLaRed): DoctorTeamMember {
  const { roleTemplateCode, roleTemplate, ...resto } = fila;
  const delegateStatus: DelegateStatus =
    resto.delegateStatus ?? (resto.status === 'REVOKED' ? 'REVOKED' : 'ACTIVE');
  return {
    ...resto,
    roleTemplate: (roleTemplate ?? roleTemplateCode) as DoctorTeamMember['roleTemplate'],
    delegateStatus,
    actions: resto.actions ?? [],
    pendingClinicalRequests: resto.pendingClinicalRequests ?? [],
  };
}

export function fromWireTeam(body: { readonly items?: readonly MiembroDeLaRed[] }): DoctorTeam {
  return { items: (body.items ?? []).map(fromWireTeamMember) };
}

export function fromWireEngagementPage(page: SupportEngagementPage): SupportEngagementPage {
  return { ...page, items: page.items.map(fromWireEngagement) };
}

export function fromWireRequestPage(page: SupportRequestPage): SupportRequestPage {
  return { ...page, items: page.items.map(fromWireRequest) };
}

/** `GET /me/support-engagements` trae `items` (vínculos) y `requests`; la pantalla los llama `engagements` y `requests`. */
export function fromWireMyEngagements(
  body: MySupportEngagements & { readonly items?: readonly SupportEngagement[] },
): MySupportEngagements {
  const vinculos = body.engagements ?? body.items ?? [];
  return {
    engagements: vinculos.map(fromWireEngagement),
    requests: (body.requests ?? []).map(fromWireRequest),
  };
}

export function fromWireInvitation(fila: AffiliationInvitation): AffiliationInvitation {
  const normal = conPlantilla(fila as ConCodigo<AffiliationInvitation>);
  // La API llama `EXHAUSTED` a la invitación con todos sus usos gastados; la pantalla, `USED`.
  return (normal.status as string) === 'EXHAUSTED' ? { ...normal, status: 'USED' } : normal;
}

/**
 * `AffiliationRedeemResultDto`: `{ kind, tenantId, membershipId?, engagementId?, requestId?, pendingApproval? }`.
 * No trae el nombre de la organización: la pantalla dice «la organización».
 *
 * - **Doctor, código multiuso**: `{ kind: 'PRACTITIONER', tenantId, roleAssignmentId, pendingApproval: true }` — sin
 *   `requestId` ni `membershipId`: queda una solicitud de afiliación pendiente que la organización aprueba o rechaza en
 *   «Médicos del centro» (`POST /role-assignments/:roleId/approve|reject`). Si la persona ya era miembro activa,
 *   recibe `membershipId` y no queda pendiente. Errores 412: `SUPPORT_PRACTITIONER_PROFILE_REQUIRED` (la cuenta no tiene
 *   perfil profesional) y `SUPPORT_AFFILIATION_PRACTICE_MISSING` (la organización no tiene una práctica activa).
 * - **Apoyo, código multiuso**: `requestId` y `pendingApproval: true`. Con un código dirigido a la persona,
 *   `engagementId`.
 */
export function fromWireRedeem(
  body: InvitationRedeemResult & { readonly kind?: 'PRACTITIONER' | 'SUPPORT_STAFF' },
): InvitationRedeemResult {
  if (body.outcome !== undefined) return body;
  const pendiente = body.pendingApproval === true;
  const outcome: InvitationRedeemResult['outcome'] =
    body.kind === 'PRACTITIONER'
      ? pendiente
        ? 'PRACTITIONER_PENDING_APPROVAL'
        : 'PRACTITIONER_AFFILIATED'
      : pendiente
        ? 'SUPPORT_REQUEST_CREATED'
        : 'SUPPORT_JOINED';
  return {
    outcome,
    organizationName: body.organizationName ?? '',
    ...(body.tenantId === undefined ? {} : { tenantId: body.tenantId }),
    ...(body.membershipId === undefined ? {} : { membershipId: body.membershipId }),
    ...(body.engagementId === undefined ? {} : { engagementId: body.engagementId }),
    ...(body.requestId === undefined ? {} : { requestId: body.requestId }),
    ...(body.roleAssignmentId === undefined ? {} : { roleAssignmentId: body.roleAssignmentId }),
    ...(pendiente ? { pendingApproval: true } : {}),
  };
}

/* ---- el catálogo de doctores, servicios y lugares ------------------------------------------- */

/**
 * `GET /org/support-catalog` y `GET /me/support-catalog` (`SupportCatalogResponseDto`): los doctores traen
 * `practitionerRoleAssignmentId` y `displayName`, y los lugares **no** traen `path` ni más tipos que `SITE`/`SPACE`
 * (comprobado contra la API real en B7c). El simulador manda la forma de la pantalla; las dos se aceptan.
 */
interface CatalogoDeLaRed {
  readonly tenantId?: string;
  readonly organizationName?: string;
  readonly doctors?: readonly (Partial<CatalogDoctor> & {
    readonly practitionerRoleAssignmentId?: string;
    readonly displayName?: string;
  })[];
  readonly services?: readonly CatalogService[];
  readonly locations?: readonly (Omit<Partial<LocationNode>, 'kind'> & {
    readonly id: string;
    readonly name: string;
    readonly kind: string;
    readonly parentId?: string | null;
    readonly practiceSiteId?: string;
  })[];
}

/**
 * La API solo distingue sede de espacio; la pantalla agrupa por tipo («pisos», «consultorios», «camas»). Se deduce por el lugar
 * que ocupa y por su nombre: una sede es sede, un espacio con espacios adentro es un edificio, y de las hojas manda el nombre.
 */
function tipoDeLugar(kind: string, tieneHijos: boolean, name: string): LocationKind {
  if (kind === 'SITE') return 'SITE';
  const known: readonly string[] = [
    'BUILDING',
    'LEVEL',
    'WING',
    'CONSULTING_ROOM',
    'OPERATING_ROOM',
    'PROCEDURE_ROOM',
    'BED',
  ];
  if (known.includes(kind)) return kind as LocationKind;
  if (tieneHijos) return 'BUILDING';
  if (/\bcama\b/i.test(name)) return 'BED';
  if (/quir[óo]fano/i.test(name)) return 'OPERATING_ROOM';
  if (/\b(piso|planta)\b/i.test(name)) return 'LEVEL';
  if (/\b(sala|toma de muestras)\b/i.test(name)) return 'PROCEDURE_ROOM';
  return 'CONSULTING_ROOM';
}

export function fromWireCatalog(body: CatalogoDeLaRed): SupportCatalog {
  const lugares = body.locations ?? [];
  const porId = new Map(lugares.map((l) => [l.id, l]));
  const conHijos = new Set(
    lugares.flatMap((l) => (l.parentId === undefined || l.parentId === null ? [] : [l.parentId])),
  );
  /** `/sede/edificio/espacio/`: la ruta materializada que las pantallas usan para saber quién contiene a quién. */
  const rutaDe = (id: string, vistos: ReadonlySet<string> = new Set()): string => {
    const lugar = porId.get(id);
    if (
      lugar?.parentId === undefined ||
      lugar.parentId === null ||
      vistos.has(id) ||
      !porId.has(lugar.parentId)
    )
      return `/${id}/`;
    return `${rutaDe(lugar.parentId, new Set([...vistos, id]))}${id}/`;
  };
  return {
    organizationName: body.organizationName ?? '',
    doctors: (body.doctors ?? []).map((d) => ({
      id: d.id ?? d.practitionerRoleAssignmentId ?? '',
      name: d.name ?? d.displayName ?? '',
      specialty: d.specialty ?? '',
      placements: d.placements ?? [],
    })),
    services: (body.services ?? []).map((s) => ({ id: s.id, name: s.name })),
    locations: lugares.map((l) => ({
      id: l.id,
      kind: tipoDeLugar(l.kind, conHijos.has(l.id), l.name),
      name: l.name,
      parentId: l.parentId ?? null,
      path: l.path ?? rutaDe(l.id),
    })),
  };
}
