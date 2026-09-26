import { encuentros } from '../fixtures/clinica';
import { PACIENTE } from '../fixtures/personas';
import { forbidden, notFound, preconditionFailed, unauthorized, type MockRouter } from '../mock-router';
import { TENANT_CLINICA } from '../mock-session';
import { ahora, Coleccion, cuerpo, iso, nuevoId, uuid } from '../mock-store';
import { relacionDelProfesional } from './misc.handlers';

/* ============================================================================
    Consent (M07): «Mi privacidad» y el consentimiento informado del encuentro.

    Mismas reglas de rol y misma forma que la API: las lecturas `me` resuelven la
    persona por la sesión (nunca por un id del cuerpo), lo ajeno es 404, retirar
    cierra la vigencia y **no borra la fila**, y el médico registra el
    consentimiento informado por el encuentro (paciente y tenant salen de él).
    ========================================================================== */

type Estado = 'ACTIVE' | 'WITHDRAWN' | 'EXPIRED';

interface PropositoSimulado {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

const PROPOSITOS: readonly PropositoSimulado[] = [
  { id: uuid('purpose-treatment'), code: 'TREATMENT', name: 'Tratamiento y atención médica' },
  { id: uuid('purpose-research'), code: 'RESEARCH', name: 'Investigación con datos anonimizados' },
  { id: uuid('purpose-marketing'), code: 'COMMUNICATIONS', name: 'Comunicaciones y recordatorios' },
];

interface ConsentimientoSimulado {
  readonly id: string;
  readonly patientProfileId: string;
  readonly purposeId: string;
  readonly state: Estado;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly withdrawnAt: string | null;
  readonly policyVersion: string;
  readonly createdAt: string;
}

const consentimientos = new Coleccion<ConsentimientoSimulado>([
  {
    id: uuid('consent-tratamiento'),
    patientProfileId: PACIENTE.id,
    purposeId: PROPOSITOS[0]!.id,
    state: 'ACTIVE',
    validFrom: iso(-200),
    validTo: null,
    withdrawnAt: null,
    policyVersion: '2026.1',
    createdAt: iso(-200),
  },
  {
    id: uuid('consent-comunicaciones'),
    patientProfileId: PACIENTE.id,
    purposeId: PROPOSITOS[2]!.id,
    state: 'ACTIVE',
    validFrom: iso(-90),
    validTo: null,
    withdrawnAt: null,
    policyVersion: '2026.1',
    createdAt: iso(-90),
  },
  {
    id: uuid('consent-investigacion-retirado'),
    patientProfileId: PACIENTE.id,
    purposeId: PROPOSITOS[1]!.id,
    state: 'WITHDRAWN',
    validFrom: iso(-300),
    validTo: iso(-120),
    withdrawnAt: iso(-120),
    policyVersion: '2025.2',
    createdAt: iso(-300),
  },
]);

interface InformadoSimulado {
  readonly id: string;
  readonly patientProfileId: string;
  readonly encounterId: string;
  readonly tenantId: string;
  readonly decision: 'ACCEPTED' | 'DECLINED';
  readonly informationVersion: string | null;
  readonly signedAt: string;
}

const informados = new Coleccion<InformadoSimulado>([]);

/** Quién es el titular de la sesión (`patientProfileId` del token; la médica-paciente es la demo). */
function pacienteDeSesion(user: { patientProfileId?: string; key: string } | null): string {
  return user?.patientProfileId ?? (user?.key === 'medica' ? PACIENTE.id : '');
}

const visto = (p: PropositoSimulado | undefined, id: string) => p ?? { id, code: '', name: '' };

const informadoVisible = (i: InformadoSimulado) => ({
  id: i.id,
  encounterId: i.encounterId,
  decision: i.decision,
  informationVersion: i.informationVersion ?? undefined,
  signedAt: i.signedAt,
});

export function registrarConsentimientos(router: MockRouter): void {
  router.get('/consent/me/consents', ({ user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    const pid = pacienteDeSesion(user);
    if (pid === '') return forbidden('Esta sección es para pacientes');
    const items = consentimientos
      .filtrar((c) => c.patientProfileId === pid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => ({
        id: c.id,
        state: c.state,
        purpose: visto(
          PROPOSITOS.find((p) => p.id === c.purposeId),
          c.purposeId,
        ),
        validFrom: c.validFrom,
        validTo: c.validTo ?? undefined,
        withdrawnAt: c.withdrawnAt ?? undefined,
        policyVersion: c.policyVersion,
        createdAt: c.createdAt,
      }));
    return { items };
  });

  router.get('/consent/me/hipaa-authorizations', ({ user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    if (pacienteDeSesion(user) === '') return forbidden('Esta sección es para pacientes');
    return {
      items: [
        {
          id: uuid('hipaa-1'),
          state: 'ACTIVE',
          purpose: PROPOSITOS[0],
          recipientDescription: 'Seguros Andina — área de auditoría médica',
          informationDescription: 'Resumen de la historia clínica para el reembolso',
          expiresAt: iso(90),
          signedAt: iso(-10),
        },
      ],
    };
  });

  router.get('/consent/me/objections', ({ user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    if (pacienteDeSesion(user) === '') return forbidden('Esta sección es para pacientes');
    return { items: [] };
  });

  router.get('/consent/me/treatment-informed-consents', ({ user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    const pid = pacienteDeSesion(user);
    if (pid === '') return forbidden('Esta sección es para pacientes');
    return {
      items: informados
        .filtrar((i) => i.patientProfileId === pid)
        .sort((a, b) => b.signedAt.localeCompare(a.signedAt))
        .map(informadoVisible),
    };
  });

  /** Retirar cierra la vigencia y cambia el estado; la fila queda. Lo ajeno es 404. */
  router.post('/consent/me/consents/:id/withdraw', ({ params, user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    const c = consentimientos.get(params['id']!);
    if (c === undefined || c.patientProfileId !== pacienteDeSesion(user)) return notFound('Consentimiento no encontrado');
    if (c.state !== 'ACTIVE') return preconditionFailed('El consentimiento no está activo');
    consentimientos.actualizar(c.id, { state: 'WITHDRAWN', withdrawnAt: ahora(), validTo: ahora() });
    return { ok: true };
  });

  /**
   * El consentimiento informado, registrado por el médico desde su encuentro:
   * paciente y tenant salen del encuentro (nunca del cuerpo), y sólo quien puede
   * escribir la historia del paciente lo firma.
   */
  router.post('/consent/encounters/:encounterId/informed-consent', (request) => {
    const user = request.user;
    if (user === null) return unauthorized('Sesión vencida');
    if (!user.roles.some((rol) => ['CLINICIAN', 'PRACTITIONER'].includes(rol))) {
      return forbidden('Rol insuficiente para la operación');
    }
    const encuentro = encuentros.get(request.params['encounterId']!);
    if (encuentro === undefined) return notFound('Encuentro no encontrado');
    // Sin vínculo (o con vínculo revocado) no se escribe la historia.
    if (relacionDelProfesional(user.practitionerProfileId, encuentro.patientProfileId) === 'REVOCADA') {
      return forbidden('No tiene acceso a la historia de este paciente');
    }
    const datos = cuerpo<{ decision?: 'ACCEPTED' | 'DECLINED'; informationVersion?: string }>(request);
    if (datos.decision !== 'ACCEPTED' && datos.decision !== 'DECLINED') {
      return preconditionFailed('La decisión es obligatoria');
    }
    const nuevo = informados.agregar({
      id: nuevoId('informed-consent'),
      patientProfileId: encuentro.patientProfileId,
      encounterId: encuentro.id,
      tenantId: TENANT_CLINICA,
      decision: datos.decision,
      informationVersion: datos.informationVersion ?? null,
      signedAt: ahora(),
    });
    return {
      status: 201,
      body: {
        id: nuevo.id,
        patientProfileId: nuevo.patientProfileId,
        status: 'SIGNED',
        decision: nuevo.decision,
        createdAt: nuevo.signedAt,
      },
    };
  });

  router.get('/consent/encounters/:encounterId/informed-consent', ({ params, user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    if (!user.roles.some((rol) => ['CLINICIAN', 'PRACTITIONER'].includes(rol))) {
      return forbidden('Rol insuficiente para la operación');
    }
    return { items: informados.filtrar((i) => i.encounterId === params['encounterId']).map(informadoVisible) };
  });
}
