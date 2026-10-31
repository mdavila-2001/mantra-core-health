import type {
  GovernanceRule,
  SodRule,
} from '../../data-access/access-governance/governance-rules.types';
import {
  ATOM_CATEGORY_LABELS,
  LEGACY_ALIAS_ATOMS,
  LEGACY_ALIAS_PRIMARY,
  SUPPORT_ATOMS,
} from '../../data-access/support-access/support-atoms';
import {
  GENTE,
  ajustesDeGobierno,
  aprobaciones,
  banderasDePacientes,
  excepcionesSod,
  reglasDeGobierno,
  reglasSodDeLaOrganizacion,
} from '../fixtures/support-hospital-governance';
import {
  AJUSTES_DE_GOBIERNO_POR_OMISION,
  REGLAS_SOD_DE_PLATAFORMA,
} from '../fixtures/support-hospital-governance.data';
import { permisos, vinculos } from '../fixtures/support-hospital';
import { conflict, notFound, type MockRouter, reply, validation } from '../mock-router';
import { ahora, cuerpo, nuevoId, uuid, iso } from '../mock-store';
import { anotar } from './support-access.core';
import { conMotivo } from './support-access.errors';
import {
  administradorOConAtomo,
  esActor,
  exigirPasoExtra,
  lista,
  nombreDe,
  noEncontrado,
  soloAdministrador,
  textoObligatorio,
} from './support-access.governance.core';
import { atomosDe } from './support-access.governance.view';

/* ============================================================================
    Reglas L1, ajustes, normalizar, SoD, banderas de pacientes y catálogo (CONTRATO-GOBIERNO §8.3 A y B).
    Las formas son las de `governance-rules.dto.ts`, `governance-sod.dto.ts`, `legacy-normalization.dto.ts` y
    `patient-restriction-flags.dto.ts` de la API.
   ========================================================================== */

const PATRON = /^([a-z_]+(\.[a-z_]+){2,3}|[a-z_]+(\.[a-z_]+){0,2}\.\*)$/;
const TIPOS_DE_REGLA = ['DENY_PERMISSION', 'CEILING', 'REQUIRE_CONDITION', 'FIELD_FLOOR'];
const BANDERAS = ['VIP', 'CONFIDENTIAL', 'STAFF_RELATIVE', 'PROTECTED'];

/** Los lotes de «normalizar»: lo que se aplicó, para poder revertir. */
const lotes = new Map<string, readonly string[]>();

/** Las pruebas parten sin lotes de normalización que revertir. */
export function olvidarLotesDeNormalizacion(): void {
  lotes.clear();
}

export function registrarGobiernoReglas(router: MockRouter): void {
  /* ---- catálogo y resúmenes ---------------------------------------------------------------------------- */

  router.get('/org/permission-catalog', (request) => {
    const actor = administradorOConAtomo(request, 'team.members.view');
    if (!esActor(actor)) return actor;
    return {
      atoms: SUPPORT_ATOMS.map((a) => ({ ...a, category: a.category })),
      categories: Object.entries(ATOM_CATEGORY_LABELS).map(([code, name]) => ({ code, name })),
      aliases: Object.entries(LEGACY_ALIAS_ATOMS).map(([code, atoms]) => ({
        code,
        atoms,
        primary: LEGACY_ALIAS_PRIMARY[code]!,
      })),
    };
  });

  router.get('/org/support-engagements/:id/summary', (request) => {
    const actor = administradorOConAtomo(request, 'team.members.view');
    if (!esActor(actor)) return actor;
    const vinculo = vinculos.get(request.params['id']!);
    if (vinculo === undefined || vinculo.tenantId !== actor.tenantId)
      return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
    const grants = permisos
      .filtrar((p) => p.engagementId === vinculo.id && p.status === 'ACTIVE')
      .map((p) => ({
        grantId: p.id,
        effect: p.effect ?? 'ALLOW',
        targetKind: p.targetKind,
        atoms: atomosDe(p),
        summary: `${p.effect === 'DENY' ? 'No puede' : 'Puede'}: ${atomosDe(p).slice(0, 3).join(', ')}${atomosDe(p).length > 3 ? '…' : ''}.`,
      }));
    return {
      engagementId: vinculo.id,
      grants,
      plain: grants.map(
        (g) => `${vinculo.personName} ${g.summary.charAt(0).toLowerCase()}${g.summary.slice(1)}`,
      ),
    };
  });

  router.get('/org/support-engagements/:id/effective', (request) => {
    const actor = administradorOConAtomo(request, 'team.members.view');
    if (!esActor(actor)) return actor;
    const vinculo = vinculos.get(request.params['id']!);
    if (vinculo === undefined || vinculo.tenantId !== actor.tenantId)
      return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
    const vivos = permisos.filtrar((p) => p.engagementId === vinculo.id && p.status === 'ACTIVE');
    const atoms = [
      ...new Set(vivos.filter((p) => p.effect !== 'DENY').flatMap((p) => atomosDe(p))),
    ].map((code) => {
      const meta = SUPPORT_ATOMS.find((a) => a.code === code)!;
      const dados = vivos.filter((p) => p.effect !== 'DENY' && atomosDe(p).includes(code as never));
      return {
        atom: code,
        name: meta.name,
        sensitivity: meta.sensitivity,
        origin: dados.some((p) => p.atoms !== undefined) ? 'ATOM' : 'LEGACY',
        grantIds: dados.map((p) => p.id),
        conditional: dados.some(
          (p) => p.condition !== undefined || p.actionConditions?.[code] !== undefined,
        ),
      };
    });
    return {
      engagementId: vinculo.id,
      atoms,
      denied: vivos
        .filter((p) => p.effect === 'DENY')
        .flatMap((p) => atomosDe(p).map((atom) => ({ atom, grantId: p.id }))),
    };
  });

  /* ---- normalizar ------------------------------------------------------------------------------------------ */

  router.post('/org/governance/normalize-legacy', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const datos = cuerpo<{
      dryRun?: boolean;
      engagementIds?: string[];
      acknowledgeTightening?: boolean;
    }>(request);
    const dryRun = datos.dryRun !== false;
    // La API real pide el paso extra solo al APLICAR el lote: el simulacro (`dryRun`, el valor por omisión) no escribe nada.
    if (!dryRun) {
      const paso = exigirPasoExtra(actor.user.id);
      if (paso !== null) return paso;
    }
    const alias = permisos.filtrar(
      (p) =>
        p.status === 'ACTIVE' &&
        p.atoms === undefined &&
        p.effect !== 'DENY' &&
        p.actions.length > 0 &&
        (datos.engagementIds === undefined || datos.engagementIds.includes(p.engagementId)),
    );
    const porVinculo = new Map<string, typeof alias>();
    for (const p of alias)
      porVinculo.set(p.engagementId, [...(porVinculo.get(p.engagementId) ?? []), p]);
    const engagements = [...porVinculo.entries()].map(([engagementId, filas]) => {
      const v = vinculos.get(engagementId)!;
      const grants = filas.map((p) => {
        const despues = [...new Set(p.actions.flatMap((a) => LEGACY_ALIAS_ATOMS[a] ?? []))];
        const nuevas = despues
          .map((a) => SUPPORT_ATOMS.find((m) => m.code === a)!)
          .filter((m) => m.requiresReason || m.requiresStepUp || m.approvalMode !== null);
        return {
          grantId: p.id,
          aliases: p.actions,
          atomsBefore: despues,
          atomsAfter: despues,
          atomsAdded: [] as string[],
          newObligations: nuevas.map((m) => ({
            atom: m.code,
            requiresReason: m.requiresReason,
            requiresStepUp: m.requiresStepUp,
            approval: m.approvalMode,
            message: `«${m.name}» pasará a pedir ${[m.requiresReason ? 'motivo' : '', m.requiresStepUp ? 'segundo paso' : '', m.approvalMode === 'DOCTOR' ? 'aprobación del doctor' : m.approvalMode === 'SECOND_APPROVER' ? 'una segunda aprobación' : ''].filter(Boolean).join(', ')}.`,
          })),
        };
      });
      const tightening = grants.flatMap((g) =>
        g.newObligations
          .filter((o) => o.approval !== null || o.requiresStepUp)
          .map((o) => ({ engagementId, atom: o.atom, message: o.message })),
      );
      return { engagementId, userId: v.userId, templateCode: v.roleTemplate, grants, tightening };
    });
    const requiresAcknowledgement = engagements.some((e) => e.tightening.length > 0);
    const totals = {
      engagements: engagements.length,
      grants: alias.length,
      tightening: engagements.reduce((n, e) => n + e.tightening.length, 0),
    };
    if (dryRun) return { dryRun: true, engagements, totals, requiresAcknowledgement };
    if (requiresAcknowledgement && datos.acknowledgeTightening !== true) {
      return conMotivo(
        422,
        'Este cambio exige más a algunas personas. Confirme que lo revisó.',
        'NORMALIZE_TIGHTENING_NOT_ACKNOWLEDGED',
      );
    }
    const batchId = nuevoId('lote');
    lotes.set(
      batchId,
      alias.map((p) => p.id),
    );
    for (const p of alias) permisos.actualizar(p.id, { atoms: atomosDe(p) as readonly string[] });
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'grant.normalized',
      `Se pasaron ${alias.length} permisos antiguos a permisos atómicos.`,
    );
    return { dryRun: false, batchId, engagements, totals, requiresAcknowledgement };
  });

  router.post('/org/governance/normalize-legacy/revert', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const paso = exigirPasoExtra(actor.user.id);
    if (paso !== null) return paso;
    const lote = lotes.get(String(cuerpo<{ batchId?: string }>(request).batchId ?? ''));
    if (lote === undefined) return noEncontrado('NORMALIZE_BATCH_NOT_FOUND');
    for (const id of lote) {
      const p = permisos.get(id);
      if (p !== undefined) permisos.actualizar(id, { atoms: undefined });
    }
    lotes.delete(String(cuerpo<{ batchId?: string }>(request).batchId));
    return {
      batchId: cuerpo<{ batchId?: string }>(request).batchId,
      restoredAliasRows: lote.length,
      removedAtomRows: lote.length,
    };
  });

  /* ---- reglas de la organización (L1) ---------------------------------------------------------------------------- */

  router.get('/org/governance/rules', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const kind = request.query.get('kind');
    const status = request.query.get('status');
    return lista(
      reglasDeGobierno.filtrar(
        (r) => (kind === null || r.kind === kind) && (status === null || r.status === status),
      ),
    );
  });

  router.post('/org/governance/rules', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const paso = exigirPasoExtra(actor.user.id);
    if (paso !== null) return paso;
    const d = cuerpo<Partial<GovernanceRule> & { appliesTo?: string }>(request);
    if (
      !TIPOS_DE_REGLA.includes(String(d.kind)) ||
      typeof d.permissionPattern !== 'string' ||
      !PATRON.test(d.permissionPattern)
    ) {
      return validation('La regla necesita su tipo y el permiso al que aplica.', [
        {
          field: 'permissionPattern',
          message: 'use un permiso como billing.* o agenda.appointment.cancel',
        },
      ]);
    }
    if (d.kind === 'FIELD_FLOOR' && d.maxVisibility === undefined)
      return validation('Indique cuánto se ve del dato.', [
        { field: 'maxVisibility', message: 'elija PARTIAL, REDACT o NULLIFY' },
      ]);
    if (
      reglasDeGobierno.filtrar(
        (r) =>
          r.status === 'ACTIVE' &&
          r.kind === d.kind &&
          r.permissionPattern === d.permissionPattern &&
          r.roleTemplateCode === d.roleTemplateCode,
      ).length > 0
    ) {
      return conMotivo(409, 'Ya existe una regla igual.', 'GOVERNANCE_RULE_DUPLICATE');
    }
    const fila: GovernanceRule = {
      id: nuevoId('regla'),
      kind: d.kind!,
      status: 'ACTIVE',
      permissionPattern: d.permissionPattern,
      createdAt: ahora(),
      updatedAt: ahora(),
      rowVersion: 1,
      ...(d.roleTemplateCode === undefined ? {} : { roleTemplateCode: d.roleTemplateCode }),
      ...(d.message === undefined ? {} : { message: d.message }),
      ...(d.condition === undefined ? {} : { condition: d.condition }),
      ...(d.maxVisibility === undefined ? {} : { maxVisibility: d.maxVisibility }),
      ...(d.validFrom === undefined ? {} : { validFrom: d.validFrom }),
      ...(d.validTo === undefined ? {} : { validTo: d.validTo }),
    };
    reglasDeGobierno.agregar(fila);
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'governance.rule_created',
      'Se creó una regla de la organización.',
    );
    return reply(201, fila);
  });

  router.patch('/org/governance/rules/:id', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const paso = exigirPasoExtra(actor.user.id);
    if (paso !== null) return paso;
    const regla = reglasDeGobierno.get(request.params['id']!);
    if (regla === undefined) return notFound('Regla no encontrada.');
    const d = cuerpo<Partial<GovernanceRule> & { expectedRowVersion?: number }>(request);
    if (typeof d.expectedRowVersion !== 'number')
      return validation('Falta la versión que vio.', [
        { field: 'expectedRowVersion', message: 'es obligatoria' },
      ]);
    if (d.expectedRowVersion !== regla.rowVersion)
      return conMotivo(
        409,
        'Otra persona cambió esto mientras lo editaba.',
        'ROW_VERSION_CONFLICT',
        { currentRowVersion: regla.rowVersion },
      );
    const { expectedRowVersion: _v, ...cambios } = d;
    return reglasDeGobierno.actualizar(regla.id, {
      ...cambios,
      updatedAt: ahora(),
      rowVersion: regla.rowVersion + 1,
    });
  });

  router.post('/org/governance/rules/:id/retire', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const paso = exigirPasoExtra(actor.user.id);
    if (paso !== null) return paso;
    const regla = reglasDeGobierno.get(request.params['id']!);
    if (regla === undefined) return notFound('Regla no encontrada.');
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'governance.rule_retired',
      'Se retiró una regla de la organización.',
    );
    return reglasDeGobierno.actualizar(regla.id, {
      status: 'REVOKED',
      updatedAt: ahora(),
      rowVersion: regla.rowVersion + 1,
    });
  });

  /* ---- ajustes ------------------------------------------------------------------------------------------------------ */

  router.get('/org/governance/settings', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const fila = ajustesDeGobierno.get('settings');
    if (fila === undefined) return { settings: AJUSTES_DE_GOBIERNO_POR_OMISION, isDefault: true };
    const { id: _id, updatedAt, ...settings } = fila;
    return { settings, isDefault: false, updatedAt };
  });

  router.put('/org/governance/settings', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const paso = exigirPasoExtra(actor.user.id);
    if (paso !== null) return paso;
    const d = cuerpo<Record<string, unknown>>(request);
    const enteros = [
      'inactivityDays',
      'unusedDays',
      'maxSodExceptionDays',
      'creepThreshold',
      'fourEyesActionTtlMinutes',
      'suspensionReviewAfterDays',
    ];
    const malos = enteros.filter(
      (k) => d[k] !== undefined && (!Number.isInteger(d[k]) || (d[k] as number) < 1),
    );
    if (
      malos.length > 0 ||
      (d['reviewCadenceMonths'] !== undefined &&
        d['reviewCadenceMonths'] !== 6 &&
        d['reviewCadenceMonths'] !== 12)
    ) {
      return conMotivo(
        422,
        'Algún ajuste no es válido. Revise los valores.',
        'GOVERNANCE_SETTINGS_INVALID',
        { fields: malos },
      );
    }
    const actual = ajustesDeGobierno.get('settings') ?? {
      id: 'settings',
      ...AJUSTES_DE_GOBIERNO_POR_OMISION,
      updatedAt: ahora(),
    };
    const siguiente = { ...actual, ...d, id: 'settings', updatedAt: ahora() } as typeof actual;
    ajustesDeGobierno.agregar(siguiente);
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'governance.settings_updated',
      'Se cambiaron los ajustes de gobierno de accesos.',
    );
    const { id: _id, updatedAt, ...settings } = siguiente;
    return { settings, isDefault: false, updatedAt };
  });

  /* ---- SoD ---------------------------------------------------------------------------------------------------------------- */

  router.get('/org/governance/sod-rules', (request) => {
    const actor = administradorOConAtomo(request, 'team.members.view');
    if (!esActor(actor)) return actor;
    return lista<SodRule>([
      ...REGLAS_SOD_DE_PLATAFORMA,
      ...reglasSodDeLaOrganizacion.todos().map((r) => ({ ...r, platform: false })),
    ]);
  });

  router.post('/org/governance/sod-rules', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const paso = exigirPasoExtra(actor.user.id);
    if (paso !== null) return paso;
    const d = cuerpo<Partial<SodRule>>(request);
    if (
      typeof d.code !== 'string' ||
      !/^[A-Z][A-Z0-9]*(-[A-Z0-9]+){1,3}$/.test(d.code) ||
      typeof d.name !== 'string' ||
      !Array.isArray(d.atomsA) ||
      !Array.isArray(d.atomsB)
    ) {
      return validation('La regla necesita código, nombre y los dos grupos de permisos.', [
        { field: 'code', message: 'use un código como SOD-ORG-01' },
      ]);
    }
    const base = REGLAS_SOD_DE_PLATAFORMA.find((r) => r.code === d.baseRuleCode);
    if (base !== undefined && base.isHard && d.action !== 'BLOCK')
      return conMotivo(
        422,
        'Una regla de la organización no puede aflojar la de la plataforma.',
        'SOD_RULE_LOOSENS_BASE',
      );
    if (
      REGLAS_SOD_DE_PLATAFORMA.some((r) => r.code === d.code) ||
      reglasSodDeLaOrganizacion.todos().some((r) => r.code === d.code)
    )
      return conflict('Ya existe una regla con ese código.');
    const fila = {
      id: nuevoId('sod'),
      code: d.code,
      name: d.name,
      atomsA: d.atomsA,
      atomsB: d.atomsB,
      scope: d.scope ?? 'PERSON',
      action: d.action ?? 'WARN',
      isHard: d.isHard === true,
      platform: false,
      rowVersion: 1,
      ...(d.rationale === undefined ? {} : { rationale: d.rationale }),
      ...(d.baseRuleCode === undefined ? {} : { baseRuleCode: d.baseRuleCode }),
      ...(d.maxExceptionDays === undefined ? {} : { maxExceptionDays: d.maxExceptionDays }),
    } as SodRule & { id: string };
    reglasSodDeLaOrganizacion.agregar(fila);
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'sod.rule_created',
      `Se creó la regla de separación de funciones ${fila.code}.`,
    );
    return reply(201, fila);
  });

  router.patch('/org/governance/sod-rules/:id', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const paso = exigirPasoExtra(actor.user.id);
    if (paso !== null) return paso;
    const id = request.params['id']!;
    if (REGLAS_SOD_DE_PLATAFORMA.some((r) => r.code === id || r.id === id))
      return conMotivo(
        422,
        'Las reglas de la plataforma no se pueden editar.',
        'SOD_RULE_PLATFORM_READ_ONLY',
      );
    const regla = reglasSodDeLaOrganizacion.get(id);
    if (regla === undefined) return notFound('Regla no encontrada.');
    const d = cuerpo<Partial<SodRule> & { expectedRowVersion?: number }>(request);
    if (d.expectedRowVersion !== regla.rowVersion)
      return conMotivo(
        409,
        'Otra persona cambió esto mientras lo editaba.',
        'ROW_VERSION_CONFLICT',
        { currentRowVersion: regla.rowVersion },
      );
    const { expectedRowVersion: _v, ...cambios } = d;
    return reglasSodDeLaOrganizacion.actualizar(id, {
      ...cambios,
      rowVersion: (regla.rowVersion ?? 1) + 1,
    });
  });

  router.get('/org/governance/sod-findings', (request) => {
    const actor = administradorOConAtomo(request, 'audit.reports.governance.view');
    if (!esActor(actor)) return actor;
    const ricardo = GENTE.ricardo;
    const excepcion = excepcionesSod
      .todos()
      .find((e) => e.engagementId === ricardo.engagementId && e.status === 'ACTIVE');
    const regla = REGLAS_SOD_DE_PLATAFORMA.find((r) => r.code === 'SOD-GOV-03')!;
    return lista([
      {
        engagementId: ricardo.engagementId,
        userId: ricardo.userId,
        ruleCode: regla.code,
        ruleName: regla.name,
        action: regla.action,
        outcome: excepcion === undefined ? 'CONFLICT' : 'EXCEPTION_ACTIVE',
        atomsA: ['team.grants.assign'],
        atomsB: ['billing.payment.collect'],
        admitsException: true,
        message: 'Ricardo Terceros reparte permisos y también cobra en caja.',
        ...(excepcion === undefined
          ? {}
          : { exceptionId: excepcion.id, exceptionValidTo: excepcion.validTo }),
      },
    ]);
  });

  router.get('/org/governance/sod-exceptions', (request) => {
    const actor = administradorOConAtomo(request, 'audit.reports.governance.view');
    if (!esActor(actor)) return actor;
    return lista(excepcionesSod.todos().map(({ requestedBy: _r, ...e }) => e));
  });

  router.post('/org/governance/sod-exceptions', (request) => {
    const actor = administradorOConAtomo(request, 'team.sod.exception.request');
    if (!esActor(actor)) return actor;
    const d = cuerpo<{
      engagementId?: string;
      ruleCode?: string;
      justification?: string;
      validTo?: string;
    }>(request);
    const regla =
      REGLAS_SOD_DE_PLATAFORMA.find((r) => r.code === d.ruleCode) ??
      reglasSodDeLaOrganizacion.todos().find((r) => r.code === d.ruleCode);
    const vinculo = d.engagementId === undefined ? undefined : vinculos.get(d.engagementId);
    if (regla === undefined || vinculo === undefined || vinculo.tenantId !== actor.tenantId)
      return noEncontrado('SOD_EXCEPTION_NOT_FOUND');
    if (regla.isHard) return conMotivo(422, 'Esa regla no admite excepciones.', 'SOD_RULE_HARD');
    const just = textoObligatorio(d.justification, 40, 'SOD_JUSTIFICATION_TOO_SHORT');
    if (!just.ok) return just.respuesta;
    if (typeof d.validTo !== 'string')
      return validation('Indique hasta cuándo vale la excepción.', [
        { field: 'validTo', message: 'es obligatorio' },
      ]);
    const excepcion = excepcionesSod.agregar({
      id: nuevoId('sodex'),
      ruleCode: regla.code,
      engagementId: vinculo.id,
      justification: just.texto,
      validFrom: ahora(),
      validTo: d.validTo,
      status: 'PENDING',
      requestedBy: actor.user.id,
    });
    const aprobacion = aprobaciones.agregar({
      id: uuid(`sodex-approval-${excepcion.id}`),
      tenantId: actor.tenantId,
      kind: 'SOD_EXCEPTION',
      status: 'PENDING',
      approverKind: 'SECOND_APPROVER',
      requesterUserId: actor.user.id,
      subjectUserId: vinculo.userId,
      reasonText: just.texto,
      createdAt: ahora(),
      expiresAt: iso(1),
      summary: `Excepción a «${regla.name}» para ${vinculo.personName} hasta ${d.validTo}.`,
    });
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'sod.exception_requested',
      `Se pidió una excepción a ${regla.code} para ${vinculo.personName}.`,
    );
    return reply(202, {
      approvalId: aprobacion.id,
      status: 'PENDING',
      expiresAt: aprobacion.expiresAt,
      approverKind: 'SECOND_APPROVER',
    });
  });

  router.post('/org/governance/sod-exceptions/:id/revoke', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const fila = excepcionesSod.get(request.params['id']!);
    if (fila === undefined) return noEncontrado('SOD_EXCEPTION_NOT_FOUND');
    if (fila.status !== 'ACTIVE' && fila.status !== 'PENDING')
      return conflict('Esa excepción ya no está vigente.');
    const motivo = textoObligatorio(
      cuerpo<{ reason?: string }>(request).reason,
      10,
      'REASON_REQUIRED',
    );
    if (!motivo.ok) return motivo.respuesta;
    const { requestedBy: _r, ...vista } = excepcionesSod.actualizar(fila.id, {
      status: 'REVOKED',
      revokedAt: ahora(),
    })!;
    return vista;
  });

  /* ---- banderas de pacientes restringidos -------------------------------------------------------------------------------------- */

  router.get('/org/patients/:patientProfileId/restriction-flags', (request) => {
    const id = request.params['patientProfileId']!;
    return {
      patientProfileId: id,
      flags: banderasDePacientes
        .filtrar((b) => b.patientProfileId === id)
        .map(({ id: _i, patientProfileId: _p, ...f }) => f),
    };
  });

  router.put('/org/patients/:patientProfileId/restriction-flags', (request) => {
    const id = request.params['patientProfileId']!;
    const d = cuerpo<{ flags?: { flag?: string; reason?: string; validTo?: string }[] }>(request);
    if (!Array.isArray(d.flags))
      return validation('Envíe la lista de banderas.', [
        { field: 'flags', message: 'debe ser una lista' },
      ]);
    for (const f of d.flags) {
      if (!BANDERAS.includes(String(f.flag)))
        return validation('Una bandera no es válida.', [
          { field: 'flags', message: 'use VIP, CONFIDENTIAL, STAFF_RELATIVE o PROTECTED' },
        ]);
      if (typeof f.reason !== 'string' || f.reason.trim().length < 5)
        return validation('Cada bandera lleva su motivo.', [
          { field: 'flags', message: 'el motivo tiene al menos 5 caracteres' },
        ]);
    }
    for (const previa of banderasDePacientes.filtrar((b) => b.patientProfileId === id))
      banderasDePacientes.borrar(previa.id);
    for (const f of d.flags)
      banderasDePacientes.agregar({
        id: nuevoId('bandera'),
        patientProfileId: id,
        flag: f.flag as never,
        reason: f.reason!.trim(),
        validFrom: ahora(),
        ...(f.validTo === undefined ? {} : { validTo: f.validTo }),
      });
    anotar(
      tenantDeSesion(request),
      nombreDe(request.user!),
      'patient.restriction_flags_updated',
      'Se actualizaron las banderas de un paciente.',
    );
    return {
      patientProfileId: id,
      flags: banderasDePacientes
        .filtrar((b) => b.patientProfileId === id)
        .map(({ id: _i, patientProfileId: _p, ...f }) => f),
    };
  });
}

const tenantDeSesion = (request: {
  readonly headers: { get(n: string): string | null };
  readonly user: { readonly tenants: readonly string[] } | null;
}): string => request.headers.get('X-Tenant-Id') ?? request.user?.tenants[0] ?? '';
