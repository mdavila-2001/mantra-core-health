import { LABORATORIOS_DEL_CORPUS } from '../fixtures/bolivia-eje-central';
import { MEDICA, PACIENTES, PROFESIONALES, pacientePorId } from '../fixtures/personas';
import { forbidden, reply, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { TENANT_CLINICA, TENANT_HOSPITAL, TENANT_NAMES } from '../mock-session';
import { ahora, Coleccion, cuerpo, iso, isoDia, nuevoId, texto, uuid } from '../mock-store';

/* ============================================================================
    Derivaciones (`/referrals`, `clinical_ext`) en el simulador.

    Copia el contrato de la API `b19cc52d` + `415f1fe4`: con `referralType`, destino ≥ 1 y
    servicio + resumen clínico obligatorios (400 `VALIDATION_FAILED` con
    `reason` y `details.fields`); motivo obligatorio al rechazar; responder sólo
    una pendiente (422 `REFERRAL_NOT_PENDING`); contrarreferencia del destino
    (403 `REFERRAL_COUNTER_REFERRAL_FORBIDDEN`) sobre una aceptada, o del que
    escribe la historia si el destino es sólo externo; anular una pendiente o
    aceptada (422 `REFERRAL_ALREADY_CLOSED`). Responder es sólo del destino
    (403 `REFERRAL_RESPOND_FORBIDDEN`); `informedConsentId` en el alta es 400
    `REFERRAL_CONSENT_LINK_NOT_ALLOWED`; el vínculo lo deriva el consentimiento. Las respuestas son
    `ReferralResponseDto` y el listado es un arreglo plano. Los destinos de la plataforma son los tenants y sedes del
    directorio simulado (Clínica Los Olivos, Hospital San Lucas); el externo
    sale del corpus «Bolivia Salud · Eje Central».
    ========================================================================== */

type Tipo =
  | 'CONSULTATION'
  | 'TREATMENT'
  | 'PROCEDURE'
  | 'DIAGNOSTIC'
  | 'THERAPY'
  | 'HOSPITALIZATION'
  | 'OTHER';
type Estado = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';

const TIPOS: readonly Tipo[] = [
  'CONSULTATION',
  'TREATMENT',
  'PROCEDURE',
  'DIAGNOSTIC',
  'THERAPY',
  'HOSPITALIZATION',
  'OTHER',
];

/** El concepto de estado que acompaña al estado legible. */
const CONCEPTO_DE_ESTADO: Readonly<Record<Estado, string>> = {
  PENDING: uuid('concept-ref-requested'),
  ACCEPTED: uuid('concept-ref-accepted'),
  REJECTED: uuid('concept-ref-rejected'),
  COMPLETED: uuid('concept-ref-completed'),
  CANCELLED: uuid('concept-ref-cancelled'),
};

/** Las sedes del directorio simulado, con el nombre que se resuelve. */
const SEDES: Readonly<Record<string, { readonly tenantId: string; readonly nombre: string }>> = {
  [uuid('branch-olivos-central')]: { tenantId: TENANT_CLINICA, nombre: 'Sede Central' },
  [uuid('branch-olivos-equipetrol')]: { tenantId: TENANT_CLINICA, nombre: 'Consultorios Equipetrol' },
  [uuid('branch-sanlucas-central')]: { tenantId: TENANT_HOSPITAL, nombre: 'Hospital central' },
  [uuid('branch-sanlucas-norte')]: { tenantId: TENANT_HOSPITAL, nombre: 'Anexo Norte' },
};

export interface DerivacionSimulada {
  readonly id: string;
  readonly patientProfileId: string;
  readonly sourceEncounterId: string | null;
  readonly referringProfileId: string | null;
  readonly referralType: Tipo | null;
  readonly targetProfileId: string | null;
  readonly targetTenantId: string | null;
  readonly targetBranchId: string | null;
  readonly targetExternalName: string | null;
  readonly targetExternalContact: string | null;
  readonly specialtyConceptId: string | null;
  readonly requestedServiceText: string | null;
  readonly requestedServiceConceptId: string | null;
  readonly reasonText: string | null;
  readonly diagnosisText: string | null;
  readonly clinicalSummary: string | null;
  readonly treatmentGivenText: string | null;
  readonly priorityConceptId: string | null;
  readonly status: Estado;
  readonly validUntil: string | null;
  readonly respondedAt: string | null;
  readonly rejectReason: string | null;
  readonly counterReferralText: string | null;
  readonly counterReferralAt: string | null;
  readonly informedConsentId: string | null;
  readonly createdAt: string;
}

const VACIA: Omit<DerivacionSimulada, 'id' | 'patientProfileId' | 'status' | 'createdAt'> = {
  sourceEncounterId: null,
  referringProfileId: null,
  referralType: null,
  targetProfileId: null,
  targetTenantId: null,
  targetBranchId: null,
  targetExternalName: null,
  targetExternalContact: null,
  specialtyConceptId: null,
  requestedServiceText: null,
  requestedServiceConceptId: null,
  reasonText: null,
  diagnosisText: null,
  clinicalSummary: null,
  treatmentGivenText: null,
  priorityConceptId: null,
  validUntil: null,
  respondedAt: null,
  rejectReason: null,
  counterReferralText: null,
  counterReferralAt: null,
  informedConsentId: null,
};

function semilla(): DerivacionSimulada[] {
  const paciente = PACIENTES[0]!;
  const otro = PACIENTES[1]!;
  const colega = PROFESIONALES.find((p) => p.id !== MEDICA.id && p.displayName !== '') ?? MEDICA;
  const laboratorio = LABORATORIOS_DEL_CORPUS[0];
  const sedeDelLaboratorio = laboratorio?.sites[0];
  return [
    {
      ...VACIA,
      id: uuid('referral-seed-1'),
      patientProfileId: paciente.id,
      referringProfileId: MEDICA.id,
      referralType: 'THERAPY',
      targetBranchId: uuid('branch-sanlucas-central'),
      targetTenantId: TENANT_HOSPITAL,
      requestedServiceText: 'Rehabilitación cardíaca fase II, 12 sesiones',
      diagnosisText: 'Cardiopatía isquémica estable (I25.1)',
      clinicalSummary:
        'Paciente de 58 años con angina estable de esfuerzo, ergometría positiva de bajo riesgo. Tolera caminata de 20 minutos.',
      treatmentGivenText: 'AAS 100 mg/día, atorvastatina 40 mg/día, bisoprolol 5 mg/día.',
      status: 'ACCEPTED',
      validUntil: isoDia(40),
      respondedAt: iso(-6, 11),
      createdAt: iso(-8, 10),
    },
    {
      ...VACIA,
      id: uuid('referral-seed-2'),
      patientProfileId: paciente.id,
      // Entrante: otro profesional deriva a la Dra. Rojas. Es la que ella
      // puede aceptar o rechazar en la demostración.
      referringProfileId: colega.id,
      referralType: 'CONSULTATION',
      targetProfileId: MEDICA.id,
      requestedServiceText: 'Interconsulta con cardiología por dolor torácico atípico',
      diagnosisText: 'Dolor torácico no especificado (R07.4)',
      clinicalSummary: 'Dolor punzante intermitente de 2 semanas, no relacionado con esfuerzo. ECG en reposo normal.',
      status: 'PENDING',
      validUntil: isoDia(25),
      createdAt: iso(-2, 16),
    },
    {
      ...VACIA,
      id: uuid('referral-seed-3'),
      patientProfileId: paciente.id,
      referringProfileId: MEDICA.id,
      referralType: 'DIAGNOSTIC',
      targetExternalName: laboratorio?.name ?? 'Laboratorio de análisis clínicos',
      targetExternalContact: sedeDelLaboratorio?.phone ?? sedeDelLaboratorio?.addressText ?? null,
      requestedServiceText: 'Perfil lipídico completo y hemoglobina glicosilada',
      diagnosisText: 'Dislipidemia mixta (E78.2)',
      clinicalSummary: 'Control a los tres meses del inicio de estatina.',
      status: 'COMPLETED',
      validUntil: isoDia(-10),
      respondedAt: iso(-20, 9),
      counterReferralText: 'LDL 96 mg/dL, HbA1c 7,1 %. Se envían resultados firmados.',
      counterReferralAt: iso(-15, 12),
      createdAt: iso(-30, 9),
    },
    {
      // Una fila legada: anterior al patch, sin tipo ni servicio.
      ...VACIA,
      id: uuid('referral-seed-legacy'),
      patientProfileId: otro.id,
      targetTenantId: TENANT_CLINICA,
      reasonText: 'Evaluación por traumatología',
      status: 'PENDING',
      createdAt: iso(-90, 9),
    },
  ];
}

const derivaciones = new Coleccion<DerivacionSimulada>(semilla()).persistirEn('mock.derivaciones');

/** Donde el simulador de consentimientos guarda su tabla (`consent.handlers.ts`). */
const CLAVE_DE_CONSENTIMIENTOS = 'mock.consent.treatmentInformedConsents';

/**
 * El consentimiento vinculado, como lo escribe la API (415f1fe4): registrar un
 * consentimiento ACCEPTED con `targetType=REFERRAL` sobre la derivación fija
 * `referral.informedConsentId`, y revocarlo lo vuelve a `null`.
 *
 * Se lee de la tabla persistida del simulador de consentimientos —de sólo
 * lectura— en vez de importar su colección: así los dos manejadores no se
 * acoplan y el vínculo sale del mismo dato que pinta el panel.
 */
export function consentimientoVinculado(referralId: string): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const crudo = sessionStorage.getItem(CLAVE_DE_CONSENTIMIENTOS);
    if (crudo === null) return null;
    const filas = (JSON.parse(crudo) as { filas?: unknown }).filas;
    if (!Array.isArray(filas)) return null;
    const vigentes = (filas as Record<string, unknown>[])
      .filter(
        (c) =>
          c['targetType'] === 'REFERRAL' &&
          c['targetId'] === referralId &&
          c['decision'] === 'ACCEPTED' &&
          c['status'] !== 'WITHDRAWN' &&
          (c['withdrawnAt'] ?? null) === null,
      )
      .sort((a, b) => String(b['createdAt']).localeCompare(String(a['createdAt'])));
    const id = vigentes[0]?.['id'];
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

/** La vista que devuelve la API: estado legible, concepto y nombres resueltos. */
function vista(d: DerivacionSimulada) {
  const sede = d.targetBranchId === null ? undefined : SEDES[d.targetBranchId];
  const tenant = d.targetTenantId ?? sede?.tenantId ?? null;
  return {
    ...d,
    informedConsentId: consentimientoVinculado(d.id),
    statusConceptId: CONCEPTO_DE_ESTADO[d.status],
    targetTenantName: tenant === null ? null : (TENANT_NAMES[tenant] ?? null),
    targetBranchName: sede?.nombre ?? null,
  };
}

function esClinico(request: MockRequest): boolean {
  return (request.user?.roles ?? []).some((r) => r === 'PRACTITIONER' || r === 'CLINICIAN');
}

function lleno(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/** El error con `reason`, con la forma del filtro global de la API. */
function errorDeDerivacion(
  status: number,
  code: string,
  reason: string,
  message: string,
  details: Record<string, unknown> = {},
): MockReply {
  return reply(status, { statusCode: status, code, reason, message, details });
}

const invalido = (reason: string, message: string, fields: string[]): MockReply =>
  errorDeDerivacion(400, 'VALIDATION_FAILED', reason, message, { fields });

const precondicion = (reason: string, message: string, referralId: string): MockReply =>
  errorDeDerivacion(422, 'PRECONDITION_FAILED', reason, message, { referralId });

const noExiste = (referralId: string): MockReply =>
  errorDeDerivacion(404, 'NOT_FOUND', 'REFERRAL_NOT_FOUND', 'Derivación no encontrada', { referralId });

function soloExterna(d: DerivacionSimulada): boolean {
  return (
    d.targetProfileId === null &&
    d.targetTenantId === null &&
    d.targetBranchId === null &&
    d.targetExternalName !== null
  );
}

/** El destino: el profesional, o alguien de la organización destino. */
function esDestino(d: DerivacionSimulada, request: MockRequest): boolean {
  const user = request.user;
  if (user === null) return false;
  if (d.targetProfileId !== null && d.targetProfileId === user.practitionerProfileId) return true;
  const tenant = d.targetTenantId ?? (d.targetBranchId === null ? null : (SEDES[d.targetBranchId]?.tenantId ?? null));
  return tenant !== null && user.tenants.includes(tenant);
}

/**
 * Acceso a la historia (415f1fe4: listar y emitir lo exigen). El simulador no
 * modela relaciones de cuidado: tiene acceso el rol clínico sobre una persona
 * que existe en el padrón; cualquier otro caso es 403.
 */
function sinAccesoALaHistoria(request: MockRequest, patientProfileId: string): MockReply | null {
  if (!esClinico(request) || pacientePorId(patientProfileId) === undefined) {
    return forbidden('No tenés acceso a la historia clínica de esta persona');
  }
  return null;
}

export function registrarDerivaciones(router: MockRouter): void {
  router.get('/referrals', (request) => {
    if (!esClinico(request)) return forbidden();
    const paciente = texto(request.query, 'patientProfileId');
    if (paciente === null) {
      return errorDeDerivacion(400, 'VALIDATION_FAILED', 'VALIDATION', 'Falta patientProfileId', {
        fields: ['patientProfileId'],
      });
    }
    const negado = sinAccesoALaHistoria(request, paciente);
    if (negado !== null) return negado;
    return derivaciones
      .filtrar((d) => d.patientProfileId === paciente)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(vista);
  });

  router.get('/referrals/me', (request) => {
    const paciente = request.user?.patientProfileId;
    if (paciente === undefined) return [];
    return derivaciones
      .filtrar((d) => d.patientProfileId === paciente)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(vista);
  });

  router.get('/referrals/:id', (request) => {
    if (!esClinico(request)) return forbidden();
    const id = request.params['id'] ?? '';
    const d = derivaciones.get(id);
    return d === undefined ? noExiste(id) : vista(d);
  });

  router.post('/referrals', (request) => {
    if (!esClinico(request)) return forbidden();
    const datos = cuerpo<Partial<Record<keyof DerivacionSimulada, string>>>(request);
    if (!lleno(datos.patientProfileId)) {
      return errorDeDerivacion(400, 'VALIDATION_FAILED', 'VALIDATION', 'Falta patientProfileId', {
        fields: ['patientProfileId'],
      });
    }
    // El vínculo nace del consentimiento, no del alta (415f1fe4).
    if (datos.informedConsentId !== undefined) {
      return invalido(
        'REFERRAL_CONSENT_LINK_NOT_ALLOWED',
        'El consentimiento se vincula registrándolo con targetType=REFERRAL sobre la derivación',
        ['informedConsentId'],
      );
    }
    if (datos.referralType !== undefined && !TIPOS.includes(datos.referralType as Tipo)) {
      return errorDeDerivacion(400, 'VALIDATION_FAILED', 'VALIDATION', 'referralType inválido', {
        fields: ['referralType'],
      });
    }
    // Las reglas nuevas sólo si viene `referralType`: las filas legadas siguen
    // entrando como antes.
    if (datos.referralType !== undefined) {
      if (
        !lleno(datos.targetProfileId) &&
        !lleno(datos.targetTenantId) &&
        !lleno(datos.targetBranchId) &&
        !lleno(datos.targetExternalName)
      ) {
        return invalido('REFERRAL_TARGET_REQUIRED', 'La derivación necesita al menos un destino', [
          'targetProfileId',
          'targetTenantId',
          'targetBranchId',
          'targetExternalName',
        ]);
      }
      const faltan = (['clinicalSummary', 'requestedServiceText'] as const).filter((c) => !lleno(datos[c]));
      if (faltan.length > 0) {
        return invalido(
          'REFERRAL_SERVICE_INFORMATION_INCOMPLETE',
          'Falta el resumen clínico o el servicio pedido',
          [...faltan],
        );
      }
    }
    const negado = sinAccesoALaHistoria(request, datos.patientProfileId);
    if (negado !== null) return negado;
    if (lleno(datos.targetBranchId) && SEDES[datos.targetBranchId] === undefined) {
      return errorDeDerivacion(404, 'NOT_FOUND', 'REFERRAL_TARGET_BRANCH_NOT_FOUND', 'Sede no encontrada', {
        targetBranchId: datos.targetBranchId,
      });
    }

    const sede = lleno(datos.targetBranchId) ? SEDES[datos.targetBranchId] : undefined;
    const nueva: DerivacionSimulada = {
      ...VACIA,
      ...Object.fromEntries(
        Object.entries(datos).filter(([k, v]) => typeof v === 'string' && k !== 'informedConsentId'),
      ),
      id: nuevoId('referral'),
      patientProfileId: datos.patientProfileId,
      referralType: (datos.referralType as Tipo | undefined) ?? null,
      targetTenantId: datos.targetTenantId ?? sede?.tenantId ?? null,
      referringProfileId: datos.referringProfileId ?? request.user?.practitionerProfileId ?? null,
      status: 'PENDING',
      createdAt: ahora(),
    };
    derivaciones.agregar(nueva);
    return reply(201, vista(nueva));
  });

  router.patch('/referrals/:id/respond', (request) => {
    if (!esClinico(request)) return forbidden();
    const id = request.params['id'] ?? '';
    const d = derivaciones.get(id);
    if (d === undefined) return noExiste(id);
    const datos = cuerpo<{ decision: string; rejectReason: string }>(request);
    if (datos.decision !== 'ACCEPT' && datos.decision !== 'REJECT') {
      return errorDeDerivacion(400, 'VALIDATION_FAILED', 'VALIDATION', 'decision debe ser ACCEPT o REJECT', {
        fields: ['decision'],
      });
    }
    if (datos.decision === 'REJECT' && !lleno(datos.rejectReason)) {
      return invalido('REFERRAL_REJECT_REASON_REQUIRED', 'Indicá el motivo del rechazo', ['rejectReason']);
    }
    // Responder es del destino; una sólo externa no se responde acá (415f1fe4).
    if (!esDestino(d, request)) {
      return errorDeDerivacion(
        403,
        'FORBIDDEN',
        'REFERRAL_RESPOND_FORBIDDEN',
        'Sólo el destino de la derivación puede responderla',
        { referralId: d.id },
      );
    }
    if (d.status !== 'PENDING') {
      return precondicion('REFERRAL_NOT_PENDING', 'La referencia no está en estado solicitado', d.id);
    }
    const respondida = derivaciones.actualizar(d.id, {
      status: datos.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
      respondedAt: ahora(),
      rejectReason: datos.decision === 'REJECT' ? datos.rejectReason!.trim() : null,
    })!;
    return { ok: true, ...vista(respondida) };
  });

  router.patch('/referrals/:id/counter-referral', (request) => {
    if (!esClinico(request)) return forbidden();
    const id = request.params['id'] ?? '';
    const d = derivaciones.get(id);
    if (d === undefined) return noExiste(id);
    const datos = cuerpo<{ counterReferralText: string }>(request);
    if (!lleno(datos.counterReferralText)) {
      return errorDeDerivacion(400, 'VALIDATION_FAILED', 'VALIDATION', 'Escribí la contrarreferencia', {
        fields: ['counterReferralText'],
      });
    }
    const externa = soloExterna(d);
    if (!externa && !esDestino(d, request)) {
      return errorDeDerivacion(
        403,
        'FORBIDDEN',
        'REFERRAL_COUNTER_REFERRAL_FORBIDDEN',
        'Sólo el destino de la derivación registra la contrarreferencia',
        { referralId: d.id },
      );
    }
    if (!(d.status === 'ACCEPTED' || (externa && d.status === 'PENDING'))) {
      return precondicion(
        'REFERRAL_COUNTER_REFERRAL_NOT_ALLOWED',
        'La derivación no admite contrarreferencia en su estado actual',
        d.id,
      );
    }
    const cerrada = derivaciones.actualizar(d.id, {
      status: 'COMPLETED',
      counterReferralText: datos.counterReferralText!.trim(),
      counterReferralAt: ahora(),
    })!;
    return vista(cerrada);
  });

  router.patch('/referrals/:id/cancel', (request) => {
    if (!esClinico(request)) return forbidden();
    const id = request.params['id'] ?? '';
    const d = derivaciones.get(id);
    if (d === undefined) return noExiste(id);
    if (d.status !== 'PENDING' && d.status !== 'ACCEPTED') {
      return precondicion('REFERRAL_ALREADY_CLOSED', 'La derivación ya está cerrada', d.id);
    }
    return vista(derivaciones.actualizar(d.id, { status: 'CANCELLED' })!);
  });
}
