import type {
  ExplainAccessResponse,
  PolicyTraceStep,
  SimulateAccessResponse,
  SimulationScenarioResult,
  ValidationIssue,
} from '../../data-access/access-governance/access-explain.types';
import { CONDITION_KEYS } from '../../data-access/access-governance/conditions.types';
import {
  atomMeta,
  expandSupportAction,
  privilegeWeightOf,
  primaryAtomOfAction,
  SUPPORT_ATOMS,
} from '../../data-access/support-access/support-atoms';
import type { SupportAccessDecisionView } from '../../data-access/support-access/support-decision.types';
import { PACIENTES_DE_GOBIERNO, reglasDeGobierno } from '../fixtures/support-hospital-governance';
import { REGLAS_SOD_DE_PLATAFORMA } from '../fixtures/support-hospital-governance.data';
import { permisos, vinculos } from '../fixtures/support-hospital';
import {
  forbidden,
  type MockReply,
  type MockRequest,
  type MockRouter,
  validation,
} from '../mock-router';
import { ahora, cuerpo } from '../mock-store';
import { anotar, doctorDe } from './support-access.core';
import { conMotivo } from './support-access.errors';
import {
  administradorOConAtomo,
  conSesion,
  esActor,
  hayRespuesta,
  noEncontrado,
  nombreDe,
} from './support-access.governance.core';
import { atomosDe } from './support-access.governance.view';
import { guardarFichaDeSimulacion } from './support-access.governance.tokens';

/* ============================================================================
    Explicar y simular (CONTRATO-GOBIERNO §5, §8.3 A). **El mock no reimplementa la política**: devuelve respuestas fijas
    por escenario del hospital piloto (las del §11.4: Marcos cancela con 6 horas; Ana fuera de horario; el paciente
    reservado) y, para todo lo demás, una respuesta de la misma forma calculada de forma gruesa con los átomos de la persona.
    La semántica real vive solo en la API; lo que el mock garantiza es la **forma** y que los estados del front se puedan ejercitar.
   ========================================================================== */

interface EntradaDeExplicar {
  engagementId?: string;
  userId?: string;
  action?: string;
  at?: string;
  patientProfileId?: string;
  practitionerRoleAssignmentId?: string | null;
  tenantId?: string;
  assume?: {
    approvalGranted?: boolean;
    reasonProvided?: boolean;
    stepUpFresh?: boolean;
    doctorOnline?: boolean;
  };
}

const paso = (
  order: number,
  layer: PolicyTraceStep['layer'],
  passed: boolean,
  code: string,
  message: string,
  extras: Partial<PolicyTraceStep> = {},
): PolicyTraceStep => ({ order, layer, passed, code, message, ...extras });
const pasosDeLaBase = (nombre: string): PolicyTraceStep[] => [
  paso(1, 'ENGAGEMENT', true, 'ENGAGEMENT_ACTIVE', `El vínculo de ${nombre} está vigente.`),
  paso(2, 'ENGAGEMENT', true, 'DOCTOR_ACCEPTED', 'El doctor aceptó a esta persona.'),
  paso(3, 'GUARDRAIL', true, 'DELEGABLE', 'Este permiso se puede dar al personal de apoyo.'),
  paso(4, 'ORG_RULE', true, 'NO_ORG_RULE_DENY', 'Ninguna regla de la organización lo prohíbe.'),
  paso(
    5,
    'EXPLICIT_DENY',
    true,
    'NO_EXPLICIT_DENY',
    `No hay una prohibición expresa para ${nombre} en esta agenda.`,
  ),
];
const decision = (
  effect: SupportAccessDecisionView['effect'],
  reason: string,
  extras: Partial<SupportAccessDecisionView> = {},
): SupportAccessDecisionView => ({ effect, allowed: effect === 'PERMIT', reason, ...extras });

/** Hora local de La Paz (UTC−4) de un instante ISO: día de la semana y minutos desde la medianoche. */
function enLaPaz(iso: string | undefined): { dia: number; minutos: number } {
  const t = new Date(iso === undefined ? Date.now() : iso).getTime() - 4 * 3_600_000;
  const d = new Date(t);
  return { dia: d.getUTCDay(), minutos: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

function explicar(
  entrada: EntradaDeExplicar,
  esAutoservicio: boolean,
): ExplainAccessResponse | MockReply {
  const v =
    entrada.engagementId === undefined
      ? vinculos.filtrar((x) => x.userId === entrada.userId)[0]
      : vinculos.get(entrada.engagementId);
  if (v === undefined) return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
  const accion = entrada.action ?? '';
  const atomo = primaryAtomOfAction(accion);
  if (atomo === undefined)
    return validation('Esa acción no existe.', [
      { field: 'action', message: 'use un permiso del catálogo' },
    ]);
  const nombre = v.personName;
  const grants = permisos.filtrar(
    (p) =>
      p.engagementId === v.id &&
      p.status === 'ACTIVE' &&
      p.effect !== 'DENY' &&
      atomosDe(p).includes(atomo),
  );
  const base = pasosDeLaBase(nombre);
  const meta = atomMeta(atomo)!;
  const asume = entrada.assume ?? {};
  const salida = (
    d: SupportAccessDecisionView,
    resumen: string,
    razones: PolicyTraceStep[],
    extras: Partial<ExplainAccessResponse> = {},
  ): ExplainAccessResponse => ({
    decision: d,
    summary: resumen,
    decidedBy: {
      layer: razones.find((r) => !r.passed)?.layer ?? 'GRANT_COVERAGE',
      step: razones.find((r) => !r.passed)?.order ?? razones.length,
      ...(d.grantId === undefined ? {} : { grantId: d.grantId }),
      atom: atomo,
    },
    reasons: razones,
    missing: [],
    ...(esAutoservicio
      ? { askAdmin: 'Pida a su administrador que revise su permiso.' }
      : { adminFixes: [] }),
    obligations: {
      reason: meta.requiresReason ? { minLength: 10 } : null,
      stepUp: meta.requiresStepUp ? { maxAgeMinutes: 10 } : null,
      approval: meta.approvalMode === null ? null : { by: meta.approvalMode, ttlMinutes: 60 },
    },
    visibleFields: {},
    evaluatedAt: ahora(),
    correlationId: '2f3d2a5e-3c41-4f7b-9d2e-1c1b7e6a9f10',
    ...extras,
  });

  // 1) Sin el permiso: no hay nada que explicar más allá de eso.
  if (grants.length === 0) {
    return salida(
      decision('DENY', 'ACTION_NOT_GRANTED', { atom: atomo }),
      `${nombre} no tiene el permiso «${meta.name}».`,
      [
        ...base,
        paso(
          6,
          'GRANT_COVERAGE',
          false,
          'ACTION_NOT_GRANTED',
          `${nombre} no tiene el permiso «${meta.name}».`,
          { atom: atomo },
        ),
      ],
      esAutoservicio
        ? {}
        : { adminFixes: [{ type: 'ADD_ATOM', message: 'Agregar el permiso a esta persona.' }] },
    );
  }
  // Si hay varias concesiones que cubren, la que trae condiciones es la que explica (y la del doctor consultado, si se dijo cuál).
  const g =
    grants.find(
      (x) =>
        entrada.practitionerRoleAssignmentId !== undefined &&
        entrada.practitionerRoleAssignmentId !== null &&
        x.practitionerRoleAssignmentId === entrada.practitionerRoleAssignmentId,
    ) ??
    grants.find((x) => x.condition !== undefined || x.actionConditions?.[atomo] !== undefined) ??
    grants[0]!;
  const cobertura = paso(6, 'GRANT_COVERAGE', true, 'COVERED', 'El permiso cubre esta consulta.', {
    grantId: g.id,
  });

  // 2) Fuera de horario: la ventana del permiso.
  const franja = (
    g.condition as
      { time?: { windows?: { days: number[]; from: string; to: string }[] } } | undefined
  )?.time?.windows;
  if (franja !== undefined && entrada.at !== undefined) {
    const { dia, minutos } = enLaPaz(entrada.at);
    const hh = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    if (!franja.some((w) => w.days.includes(dia) && minutos >= hh(w.from) && minutos < hh(w.to))) {
      return salida(
        decision('DENY', 'TIME_WINDOW', { atom: atomo, grantId: g.id, unmet: ['time'] }),
        `${nombre} solo puede hacerlo dentro de su horario.`,
        [
          ...base,
          cobertura,
          paso(
            7,
            'CONDITION',
            false,
            'TIME_WINDOW',
            'Está fuera del horario que el permiso autoriza.',
            { grantId: g.id, atom: atomo, conditionPath: 'condition.time' },
          ),
        ],
        esAutoservicio
          ? {}
          : {
              adminFixes: [
                {
                  type: 'RELAX_CONDITION',
                  grantId: g.id,
                  conditionPath: 'condition.time',
                  message: 'Ampliar el horario del permiso.',
                },
              ],
            },
      );
    }
  }

  // 3) Paciente reservado con una prohibición expresa de motivo.
  const reservado = PACIENTES_DE_GOBIERNO.find(
    (p) => p.patientProfileId === entrada.patientProfileId && p.bandera === 'CONFIDENTIAL',
  );
  if (reservado !== undefined) {
    const deny = permisos.filtrar(
      (p) =>
        p.engagementId === v.id &&
        p.status === 'ACTIVE' &&
        p.effect === 'DENY' &&
        atomosDe(p).includes(atomo),
    )[0];
    if (deny !== undefined)
      return salida(
        decision('DENY', 'EXPLICIT_DENY', { atom: atomo, grantId: deny.id }),
        `${nombre} no puede ver este dato de un paciente confidencial.`,
        [
          ...base.slice(0, 4),
          paso(
            5,
            'EXPLICIT_DENY',
            false,
            'EXPLICIT_DENY',
            'Hay una prohibición expresa para este dato cuando el paciente es confidencial.',
            { grantId: deny.id, atom: atomo },
          ),
        ],
      );
  }

  // 4) La cancelación del piloto: con menos de 24 horas pide la aprobación del doctor (caso Marcos, §5.2).
  const anticipacion = (
    g.actionConditions?.[atomo] as
      { appointment?: { leadTime?: { minHours: number; onViolation: string } } } | undefined
  )?.appointment?.leadTime;
  if (anticipacion !== undefined && entrada.at !== undefined) {
    if (!(asume.approvalGranted === true)) {
      return salida(
        decision('CHALLENGE', 'APPROVAL_REQUIRED', {
          atom: atomo,
          grantId: g.id,
          challenge: { kind: 'APPROVAL', details: { approverKind: 'DOCTOR', atom: atomo } },
        }),
        `${nombre} no puede ${meta.name.toLowerCase()} por sí sola: faltan 6 horas y su permiso exige ${anticipacion.minHours}. Puede hacerlo si el doctor lo aprueba.`,
        [
          ...base,
          cobertura,
          paso(
            7,
            'CONDITION',
            false,
            'LEAD_TIME',
            `Faltan 6 horas para la cita; el permiso pide al menos ${anticipacion.minHours} horas de anticipación y, si no, la aprobación del doctor.`,
            {
              grantId: g.id,
              atom: atomo,
              conditionPath: `actionConditions.${atomo}.appointment.leadTime`,
              details: {
                minHours: anticipacion.minHours,
                hoursLeft: 6,
                onViolation: anticipacion.onViolation,
              },
            },
          ),
          paso(8, 'CONDITION', true, 'LIMIT_OK', 'Cancelaciones de hoy: 3 de 20.', {
            details: { used: 3, max: 20, per: 'DAY' },
          }),
        ],
        {
          missing: [
            {
              kind: 'APPROVAL',
              by: 'DOCTOR',
              message: 'Pida la aprobación del doctor (queda vigente 60 minutos).',
              fix: { type: 'REQUEST_APPROVAL', approverKind: 'DOCTOR' },
            },
            {
              kind: 'REASON',
              message: 'Escriba el motivo (al menos 10 caracteres).',
              fix: { type: 'PROVIDE_REASON', minLength: 10 },
            },
          ],
          ...(esAutoservicio
            ? {}
            : {
                adminFixes: [
                  {
                    type: 'RELAX_CONDITION',
                    grantId: g.id,
                    conditionPath: `actionConditions.${atomo}.appointment.leadTime`,
                    message: 'Bajar la anticipación mínima o quitarla.',
                  },
                ],
              }),
          usage: [{ key: `ACTIONS/DAY/${atomo}`, used: 3, max: 20, resetsAt: ahora() }],
        },
      );
    }
  }

  // 5) Obligaciones del catálogo que faltan.
  if (meta.requiresReason && asume.reasonProvided !== true) {
    return salida(
      decision('CHALLENGE', 'REASON_REQUIRED', {
        atom: atomo,
        grantId: g.id,
        challenge: { kind: 'REASON', details: { minLength: 10 } },
      }),
      `Para ${meta.name.toLowerCase()} ${nombre} debe escribir el motivo.`,
      [
        ...base,
        cobertura,
        paso(7, 'OBLIGATION', false, 'REASON_REQUIRED', 'Este permiso exige un motivo escrito.', {
          atom: atomo,
        }),
      ],
      {
        missing: [
          {
            kind: 'REASON',
            message: 'Escriba el motivo (al menos 10 caracteres).',
            fix: { type: 'PROVIDE_REASON', minLength: 10 },
          },
        ],
      },
    );
  }
  if (meta.requiresStepUp && asume.stepUpFresh !== true) {
    return salida(
      decision('CHALLENGE', 'STEP_UP_REQUIRED', {
        atom: atomo,
        grantId: g.id,
        challenge: { kind: 'STEP_UP', details: { maxAgeMinutes: 10, enrolled: true } },
      }),
      `Para ${meta.name.toLowerCase()} ${nombre} debe confirmar su identidad con el segundo paso.`,
      [
        ...base,
        cobertura,
        paso(
          7,
          'OBLIGATION',
          false,
          'STEP_UP_REQUIRED',
          'Este permiso exige el segundo paso reciente.',
          { atom: atomo },
        ),
      ],
      {
        missing: [
          {
            kind: 'STEP_UP',
            message: 'Confirme su identidad con el código de su aplicación.',
            fix: { type: 'STEP_UP' },
          },
        ],
      },
    );
  }
  const parcial =
    (g.condition as { fields?: Record<string, { mask: string }> } | undefined)?.fields ??
    (g.actionConditions?.[atomo] as { fields?: Record<string, { mask: string }> } | undefined)
      ?.fields;
  return salida(
    decision('PERMIT', 'ALLOWED', { atom: atomo, grantId: g.id }),
    `${nombre} puede hacerlo.`,
    [
      ...base,
      cobertura,
      paso(7, 'CONDITION', true, 'CONDITIONS_OK', 'Cumple todas las condiciones del permiso.', {
        grantId: g.id,
      }),
    ],
    {
      visibleFields: Object.fromEntries(
        Object.entries(parcial ?? {}).map(([k, m]) => [k, m.mask as 'PARTIAL']),
      ),
    },
  );
}

export function registrarExplicar(router: MockRouter): void {
  router.post('/org/access/explain', (request) => {
    const actor = administradorOConAtomo(request, 'audit.decisions.explain');
    if (!esActor(actor)) return actor;
    const d = cuerpo<EntradaDeExplicar>(request);
    if (d.engagementId === undefined && d.userId === undefined)
      return validation('Indique a quién se explica.', [
        { field: 'engagementId', message: 'envíe engagementId o userId' },
      ]);
    const salida = explicar(d, false);
    if (!hayRespuesta(salida))
      anotar(
        actor.tenantId,
        nombreDe(actor.user),
        'access.explained',
        'Se explicó una decisión de acceso.',
      );
    return salida;
  });

  router.post('/me/support-access/explain', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const d = cuerpo<EntradaDeExplicar>(request);
    const propio = vinculos.filtrar(
      (v) => v.userId === sesion.user.id && v.tenantId === d.tenantId && v.status !== 'ENDED',
    )[0];
    if (propio === undefined) return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
    const { engagementId: _e, userId: _u, ...resto } = d;
    return explicar({ ...resto, engagementId: propio.id }, true);
  });

  router.post('/me/practitioner/support-team/explain', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const doctor = doctorDe(sesion.user);
    if (doctor === undefined) return forbidden('Esta pantalla es para quien atiende.');
    const d = cuerpo<EntradaDeExplicar>(request);
    // Solo sobre SU agenda: cualquier otra pregunta es 404 uniforme.
    if (d.practitionerRoleAssignmentId !== doctor.id)
      return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
    // El doctor, como la persona de apoyo, no recibe `adminFixes` (de la administración): la API real manda `askAdmin` (pendiente 79).
    return explicar(d, true);
  });

  router.post('/org/access/simulate', (request) => {
    const actor = administradorOConAtomo(request, 'audit.decisions.explain', 'team.grants.assign');
    if (!esActor(actor)) return actor;
    return simular(request, actor.tenantId, nombreDe(actor.user));
  });
}

/* ---- simular ------------------------------------------------------------------------------------------------------------ */

const CLAVES_DE_CONDICION: readonly string[] = CONDITION_KEYS;

function validarCondicion(c: Record<string, unknown> | undefined, ruta: string): ValidationIssue[] {
  if (c === undefined) return [];
  const faltas: ValidationIssue[] = [];
  if (c['schemaVersion'] !== 1)
    faltas.push({
      code: 'CONDITION_SCHEMA_VERSION_UNSUPPORTED',
      path: `${ruta}.schemaVersion`,
      message: 'La versión de las condiciones no es compatible.',
    });
  for (const k of Object.keys(c))
    if (!CLAVES_DE_CONDICION.includes(k))
      faltas.push({
        code: 'CONDITION_UNKNOWN_KEY',
        path: `${ruta}.${k}`,
        message: `La condición «${k}» no existe.`,
      });
  const ventanas =
    (c['time'] as { windows?: { from: string; to: string }[] } | undefined)?.windows ?? [];
  ventanas.forEach((w, i) => {
    if (w.from === w.to)
      faltas.push({
        code: 'CONDITION_TIME_EMPTY_WINDOW',
        path: `${ruta}.time.windows[${i}]`,
        message: 'Una franja empieza y termina a la misma hora: no cubre ningún momento.',
      });
  });
  return faltas;
}

function simular(request: MockRequest, tenantId: string, _actor: string): unknown {
  const d = cuerpo<{
    engagementId?: string;
    userId?: string;
    draft?: {
      mode?: string;
      templateCode?: string | null;
      grants?: {
        id?: string;
        effect?: string;
        actions?: string[];
        condition?: Record<string, unknown>;
        actionConditions?: Record<string, Record<string, unknown>>;
        validTo?: string;
      }[];
      removeGrantIds?: string[];
    };
    scenarios?: { label?: string; action: string; at?: string }[];
  }>(request);
  const v =
    d.engagementId === undefined
      ? vinculos.filtrar((x) => x.userId === d.userId && x.tenantId === tenantId)[0]
      : vinculos.get(d.engagementId);
  if (d.engagementId === undefined && d.userId === undefined)
    return conMotivo(422, 'Elija a quién simular.', 'SIMULATION_NO_TARGET');
  if (v === undefined || v.tenantId !== tenantId)
    return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
  if (d.draft === undefined || !Array.isArray(d.draft.grants))
    return validation('Falta el borrador.', [{ field: 'draft', message: 'es obligatorio' }]);
  if ((d.scenarios?.length ?? 0) > 400)
    return conMotivo(422, 'La simulación es demasiado grande.', 'SIMULATION_TOO_LARGE');

  const actuales = permisos.filtrar((p) => p.engagementId === v.id && p.status === 'ACTIVE');
  const atomosAntes = [
    ...new Set(actuales.filter((p) => p.effect !== 'DENY').flatMap((p) => atomosDe(p))),
  ] as string[];
  const quitados = new Set(d.draft.removeGrantIds ?? []);
  const reemplazados = new Set(d.draft.grants.flatMap((g) => (g.id === undefined ? [] : [g.id])));
  const quedan =
    d.draft.mode === 'REPLACE'
      ? []
      : actuales.filter(
          (p) => !quitados.has(p.id) && !reemplazados.has(p.id) && p.effect !== 'DENY',
        );
  const nuevos = d.draft.grants.filter((g) => g.effect !== 'DENY');
  const atomosDespues = [
    ...new Set([
      ...quedan.flatMap((p) => atomosDe(p)),
      ...nuevos.flatMap((g) => (g.actions ?? []).flatMap((a) => expandSupportAction(a))),
    ]),
  ] as string[];

  const errores: ValidationIssue[] = [];
  const avisos: ValidationIssue[] = [];
  d.draft.grants.forEach((g, i) => {
    errores.push(...validarCondicion(g.condition, `grants[${i}].condition`));
    for (const [a, c] of Object.entries(g.actionConditions ?? {}))
      errores.push(...validarCondicion(c, `grants[${i}].actionConditions.${a}`));
    (g.actions ?? []).forEach((a, j) => {
      for (const atomo of expandSupportAction(a)) {
        const meta = atomMeta(atomo)!;
        if (!meta.supportAssignable)
          errores.push({
            code: 'GUARDRAIL_NOT_DELEGABLE',
            path: `grants[${i}].actions[${j}]`,
            message: `«${meta.name}» no se puede dar al personal de apoyo.`,
          });
        if (meta.sensitivity === 'CRITICAL' && g.validTo === undefined && g.effect !== 'DENY')
          errores.push({
            code: 'GUARDRAIL_CRITICAL_REQUIRES_EXPIRY',
            path: `grants[${i}].actions[${j}]`,
            message: `«${meta.name}» es crítico y necesita fecha de vencimiento.`,
          });
        const techo = reglasDeGobierno.filtrar(
          (r) =>
            r.status === 'ACTIVE' &&
            r.kind === 'CEILING' &&
            r.roleTemplateCode === (d.draft?.templateCode ?? v.roleTemplate) &&
            atomo.startsWith(r.permissionPattern.replace('*', '')),
        )[0];
        if (techo !== undefined)
          errores.push({
            code: 'GUARDRAIL_CEILING_EXCEEDED',
            path: `grants[${i}].actions[${j}]`,
            message: `${meta.name} no cabe en el techo de la plantilla de esta organización${techo.message === undefined ? '' : ` (regla de la organización: «${techo.message}»)`}.`,
          });
      }
    });
  });

  const hallazgos = REGLAS_SOD_DE_PLATAFORMA.filter(
    (r) =>
      r.scope === 'PERSON' &&
      r.atomsA.some((a) => atomosDespues.includes(a)) &&
      r.atomsB.some((a) => atomosDespues.includes(a)) &&
      !(
        r.atomsA.some((a) => atomosAntes.includes(a)) &&
        r.atomsB.some((a) => atomosAntes.includes(a))
      ),
  );
  for (const r of hallazgos) {
    if (r.action === 'BLOCK')
      errores.push({
        code: 'SOD_CONFLICT_BLOCKED',
        path: 'grants[0]',
        message: `${r.name}: esta combinación no se permite en una misma persona.`,
      });
    else if (r.action === 'WARN')
      avisos.push({
        code: 'SOD_WARN',
        path: 'grants[0]',
        message: `${r.name}: conflicto de funciones (advertencia).`,
      });
  }

  const antes = privilegeWeightOf(atomosAntes);
  const despues = privilegeWeightOf(atomosDespues);
  const agregados = atomosDespues.filter((a) => !atomosAntes.includes(a));
  const quitadosAtomos = atomosAntes.filter((a) => !atomosDespues.includes(a));
  const escenarios: SimulationScenarioResult[] = (
    d.scenarios ??
    agregados
      .concat(quitadosAtomos)
      .slice(0, 12)
      .map((a) => ({ label: SUPPORT_ATOMS.find((m) => m.code === a)?.name ?? a, action: a }))
  ).map((s) => {
    const atomo = primaryAtomOfAction(s.action) ?? s.action;
    const tenia = atomosAntes.includes(atomo);
    const tiene = atomosDespues.includes(atomo);
    const vista = (ok: boolean): SimulationScenarioResult['before'] =>
      ok
        ? { effect: 'PERMIT', allowed: true, reason: 'ALLOWED' }
        : { effect: 'DENY', allowed: false, reason: 'ACTION_NOT_GRANTED' };
    return {
      ...(s.label === undefined ? {} : { label: s.label }),
      change: tenia === tiene ? 'SAME' : tiene ? 'NEWLY_ALLOWED' : 'NEWLY_DENIED',
      before: vista(tenia),
      after: vista(tiene),
    };
  });
  const razonesDeCuatroOjos =
    despues - antes > 10 ? ['El cambio sube el puntaje de privilegios más de 10 puntos.'] : [];
  const valido = errores.length === 0;
  const respuesta: SimulateAccessResponse = {
    valid: valido,
    validation: { errors: errores, warnings: avisos },
    governance: {
      sodFindings: hallazgos.map((r) => ({
        ruleCode: r.code,
        action: r.action,
        atoms: [...r.atomsA, ...r.atomsB],
        message: r.rationale ?? r.name,
      })),
      needsFourEyes: { required: razonesDeCuatroOjos.length > 0, reasons: razonesDeCuatroOjos },
      privilegeScore: { before: antes, after: despues, delta: despues - antes },
    },
    summary: {
      plain: [
        `${v.personName} podrá: ${atomosDespues
          .slice(0, 4)
          .map((a) => atomMeta(a)?.name.toLowerCase() ?? a)
          .join(', ')}${atomosDespues.length > 4 ? '…' : ''}.`,
      ],
      changes: [
        ...agregados.map((a) => `Ahora podrá: ${atomMeta(a)?.name.toLowerCase() ?? a}.`),
        ...quitadosAtomos.map((a) => `Dejará de poder: ${atomMeta(a)?.name.toLowerCase() ?? a}.`),
      ],
    },
    scenarios: escenarios,
    impact: {
      newlyAllowed: escenarios.filter((s) => s.change === 'NEWLY_ALLOWED').length,
      newlyDenied: escenarios.filter((s) => s.change === 'NEWLY_DENIED').length,
      unchanged: escenarios.filter((s) => s.change === 'SAME').length,
      challengesNew: 0,
      doctorsCovered: { before: 1, after: 1 },
      servicesCovered: { before: 0, after: 0 },
      spacesCovered: { before: 1, after: 1 },
      effectiveAtoms: { added: agregados, removed: quitadosAtomos },
    },
    ...(valido ? { simulationToken: guardarFichaDeSimulacion(v.id, d.draft) } : {}),
    limits: { scenarioCount: escenarios.length, truncated: false },
    evaluatedAt: ahora(),
  };
  anotar(tenantId, _actor, 'access.simulated', 'Se simuló un cambio de permisos.');
  return respuesta;
}
