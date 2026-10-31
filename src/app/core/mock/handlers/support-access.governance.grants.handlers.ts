import { CONDITION_KEYS } from '../../data-access/access-governance/conditions.types';
import {
  atomMeta,
  expandSupportAction,
  isSupportAtom,
  SUPPORT_ATOMS,
} from '../../data-access/support-access/support-atoms';
import { permisos, vinculos } from '../fixtures/support-hospital';
import {
  ADMIN_PRINCIPAL,
  aprobaciones,
  reglasDeGobierno,
} from '../fixtures/support-hospital-governance';
import { type MockRouter, reply, validation } from '../mock-router';
import { ahora, cuerpo, iso, nuevoId } from '../mock-store';
import { anotar } from './support-access.core';
import { conMotivo } from './support-access.errors';
import { coincideConLaSimulacion } from './support-access.governance.tokens';
import { atomosDe, detallesDelCambio } from './support-access.governance.view';

/* ============================================================================
    `POST` y `PATCH /org/support-engagements/:id/grants` con átomos, efecto y condiciones (CONTRATO-GOBIERNO §8.3, «Rutas
    existentes que cambian de forma»). Envuelve las rutas de antes: **solo** atiende lo nuevo (átomos, `effect`, `condition`,
    `actionConditions`, `simulationToken`); lo antiguo, con los 15 códigos, sigue por el manejador original sin cambios.
    Respuesta: `{ id, status, warnings[], atoms[] }`. Errores: 422 `CONDITION_*`/`GUARDRAIL_*`, 409 `SIMULATION_STALE`.
   ========================================================================== */

const esNuevo = (d: Record<string, unknown>): boolean =>
  d['effect'] !== undefined ||
  d['condition'] !== undefined ||
  d['actionConditions'] !== undefined ||
  d['simulationToken'] !== undefined ||
  (Array.isArray(d['actions']) && (d['actions'] as unknown[]).some((a) => isSupportAtom(a)));

/**
 * Los 422 de condiciones que la API real da al escribir (ronda 2): `CONDITION_TOO_LARGE` (más claves en `actionConditions`
 * que permisos en el catálogo, o una condición de más de 8 KiB) y `CONDITION_NOT_APPLICABLE_TO_ATOM` (condiciones sobre un
 * permiso escrito con códigos antiguos). La API también la da para actividad y reportes, que no evalúan condiciones; el simulador
 * los deja pasar como siempre (su propia simulación los da por válidos).
 */
export function validarCondiciones(
  d: Record<string, unknown>,
  acciones: readonly string[],
): ReturnType<typeof conMotivo> | null {
  const porAtomo = d['actionConditions'];
  const claves = porAtomo !== null && typeof porAtomo === 'object' ? Object.keys(porAtomo) : [];
  if (claves.length > SUPPORT_ATOMS.length)
    return conMotivo(
      422,
      `actionConditions trae ${claves.length} claves y el catálogo solo tiene ${SUPPORT_ATOMS.length} permisos.`,
      'CONDITION_TOO_LARGE',
      { path: 'actionConditions' },
    );
  const condicion = d['condition'];
  if (condicion !== undefined && JSON.stringify(condicion).length > 8192)
    return conMotivo(422, 'La condición pesa más de 8 KiB.', 'CONDITION_TOO_LARGE', { path: 'condition' });
  const hayCondiciones = condicion !== undefined || claves.length > 0;
  if (!hayCondiciones) return null;
  if (d['effect'] !== 'DENY' && acciones.some((a) => !isSupportAtom(a)))
    return conMotivo(
      422,
      'Las condiciones no aplican a permisos escritos con códigos antiguos. Use los permisos específicos del catálogo para poder condicionarlos.',
      'CONDITION_NOT_APPLICABLE_TO_ATOM',
    );
  return null;
}

export function registrarGobiernoPermisos(router: MockRouter): void {
  router.wrap('POST', '/org/support-engagements/:id/grants', (request, siguiente) => {
    const d = cuerpo<Record<string, unknown>>(request);
    if (!esNuevo(d)) return siguiente(request);
    const v = vinculos.get(request.params['id']!);
    if (v === undefined) return siguiente(request);
    const acciones = Array.isArray(d['actions']) ? (d['actions'] as string[]) : [];
    if (acciones.length === 0 || acciones.some((a) => expandSupportAction(a).length === 0))
      return validation('El permiso necesita al menos una acción válida.', [
        { field: 'actions', message: 'use permisos del catálogo' },
      ]);
    const condicionInvalida = validarCondiciones(d, acciones);
    if (condicionInvalida !== null) return condicionInvalida;
    const condicion = d['condition'] as Record<string, unknown> | undefined;
    const desconocida =
      condicion === undefined
        ? undefined
        : Object.keys(condicion).find((k) => !(CONDITION_KEYS as readonly string[]).includes(k));
    if (desconocida !== undefined)
      return conMotivo(422, `La condición «${desconocida}» no existe.`, 'CONDITION_UNKNOWN_KEY');
    for (const a of acciones.flatMap((x) => expandSupportAction(x))) {
      const meta = atomMeta(a)!;
      if (!meta.supportAssignable)
        return conMotivo(
          422,
          `«${meta.name}» no se puede dar al personal de apoyo.`,
          'GUARDRAIL_NOT_DELEGABLE',
        );
      if (meta.sensitivity === 'CRITICAL' && d['validTo'] === undefined && d['effect'] !== 'DENY')
        return conMotivo(
          422,
          `«${meta.name}» es crítico y necesita fecha de vencimiento.`,
          'GUARDRAIL_CRITICAL_REQUIRES_EXPIRY',
        );
      const techo = reglasDeGobierno.filtrar(
        (r) =>
          r.status === 'ACTIVE' &&
          r.kind === 'CEILING' &&
          r.roleTemplateCode === v.roleTemplate &&
          a.startsWith(r.permissionPattern.replace('*', '')),
      )[0];
      if (techo !== undefined)
        return conMotivo(
          422,
          `${meta.name} no cabe en el techo de la plantilla de esta organización${techo.message === undefined ? '' : ` (regla de la organización: «${techo.message}»)`}.`,
          'GUARDRAIL_CEILING_EXCEEDED',
        );
    }
    if (
      typeof d['simulationToken'] === 'string' &&
      !coincideConLaSimulacion(d['simulationToken'], v.id, {
        mode: 'PATCH',
        grants: [
          {
            effect: d['effect'] as string | undefined,
            actions: acciones,
            condition: condicion,
            actionConditions: d['actionConditions'],
            targetKind: d['targetKind'] as string | undefined,
            practitionerRoleAssignmentId: d['practitionerRoleAssignmentId'] as string | undefined,
            healthcareServiceId: d['healthcareServiceId'] as string | undefined,
            careSpaceId: d['careSpaceId'] as string | undefined,
            practiceSiteId: d['practiceSiteId'] as string | undefined,
            validTo: d['validTo'] as string | undefined,
          },
        ],
        removeGrantIds: [],
      })
    ) {
      return conMotivo(
        409,
        'Algo cambió mientras editaba. Revise la vista previa y vuelva a guardar.',
        'SIMULATION_STALE',
      );
    }
    // Un átomo de sensibilidad CRÍTICA que la persona aún no tiene no se escribe: la API (`GRANT_CHANGE`) responde 202 y lo deja esperando.
    const yaTiene = new Set(
      permisos
        .filtrar((p) => p.engagementId === v.id && p.status === 'ACTIVE' && p.effect !== 'DENY')
        .flatMap((p) => atomosDe(p)),
    );
    const criticos = [...new Set(acciones.flatMap((x) => expandSupportAction(x)))].filter(
      (a) => atomMeta(a)?.sensitivity === 'CRITICAL' && !yaTiene.has(a),
    );
    if (d['effect'] !== 'DENY' && criticos.length > 0) {
      const a = aprobaciones.agregar({
        id: nuevoId('aprobacion'),
        tenantId: v.tenantId,
        kind: 'GRANT_CHANGE',
        status: 'PENDING',
        approverKind: 'SECOND_APPROVER',
        requesterUserId: ADMIN_PRINCIPAL.userId,
        subjectUserId: v.userId,
        reasonText: 'Permiso con accesos críticos',
        createdAt: ahora(),
        expiresAt: iso(7),
        summary: `Dar a ${v.personName} accesos críticos: ${criticos.map((c) => atomMeta(c)?.name ?? c).join(', ')}.`,
        details: detallesDelCambio(
          'ADD',
          v.tenantId,
          {
            targetKind: (d['targetKind'] ?? 'PRACTITIONER') as never,
            expansionMode: d['expansionMode'] === 'FIXED' ? 'FIXED' : 'DYNAMIC',
            ...(typeof d['practitionerRoleAssignmentId'] === 'string' ? { practitionerRoleAssignmentId: d['practitionerRoleAssignmentId'] } : {}),
            ...(typeof d['healthcareServiceId'] === 'string' ? { healthcareServiceId: d['healthcareServiceId'] } : {}),
            ...(typeof d['careSpaceId'] === 'string' ? { careSpaceId: d['careSpaceId'] } : {}),
            ...(typeof d['validTo'] === 'string' ? { validTo: d['validTo'] } : {}),
            ...(condicion === undefined ? {} : { condition: condicion as never }),
            ...(d['actionConditions'] === undefined ? {} : { actionConditions: d['actionConditions'] as never }),
          },
          [...new Set(acciones.flatMap((x) => expandSupportAction(x)))],
          ['NEW_CRITICAL_ATOMS'],
        ),
      });
      return reply(202, {
        status: 'PENDING_APPROVAL',
        approvalId: a.id,
        expiresAt: a.expiresAt,
        reasons: ['NEW_CRITICAL_ATOMS'],
        criticalAtoms: criticos,
      });
    }
    const fila = permisos.agregar({
      id: nuevoId('permiso'),
      engagementId: v.id,
      targetKind: (d['targetKind'] ?? 'PRACTITIONER') as never,
      expansionMode: d['expansionMode'] === 'FIXED' ? 'FIXED' : 'DYNAMIC',
      actions: [],
      status: 'ACTIVE',
      atoms: acciones.flatMap((a) => expandSupportAction(a)),
      effect: d['effect'] === 'DENY' ? 'DENY' : 'ALLOW',
      ...(typeof d['practitionerRoleAssignmentId'] === 'string'
        ? { practitionerRoleAssignmentId: d['practitionerRoleAssignmentId'] }
        : {}),
      ...(typeof d['healthcareServiceId'] === 'string'
        ? { healthcareServiceId: d['healthcareServiceId'] }
        : {}),
      ...(typeof d['careSpaceId'] === 'string' ? { careSpaceId: d['careSpaceId'] } : {}),
      ...(typeof d['practiceSiteId'] === 'string' ? { practiceSiteId: d['practiceSiteId'] } : {}),
      ...(typeof d['validTo'] === 'string' ? { validTo: d['validTo'] } : {}),
      ...(condicion === undefined ? {} : { condition: condicion as never }),
      ...(d['actionConditions'] === undefined
        ? {}
        : { actionConditions: d['actionConditions'] as never }),
      ...(typeof d['reasonText'] === 'string' ? { reasonText: d['reasonText'] } : {}),
    });
    anotar(
      v.tenantId,
      'Administración',
      d['effect'] === 'DENY' ? 'grant.deny_created' : 'grant.created',
      `Se agregó un permiso a ${v.personName}.`,
    );
    return reply(201, { id: fila.id, status: 'ACTIVE', warnings: [], atoms: atomosDe(fila) });
  });

  router.wrap('PATCH', '/org/support-engagements/:id/grants', (request, siguiente) => {
    const d = cuerpo<Record<string, unknown>>(request);
    if (!esNuevo(d)) return siguiente(request);
    const v = vinculos.get(request.params['id']!);
    const fila = typeof d['grantId'] === 'string' ? permisos.get(d['grantId']) : undefined;
    if (v === undefined || fila === undefined || fila.engagementId !== v.id)
      return siguiente(request);
    const condicionInvalida = validarCondiciones(
      { ...d, effect: fila.effect ?? 'ALLOW' },
      Array.isArray(d['actions']) ? (d['actions'] as string[]) : [...atomosDe(fila)],
    );
    if (condicionInvalida !== null) return condicionInvalida;
    // La API arma el borrador PATCH de UN permiso con lo guardado (efecto, objetivo y vencimiento) y lo que llega (acciones, condiciones).
    if (
      typeof d['simulationToken'] === 'string' &&
      !coincideConLaSimulacion(d['simulationToken'], v.id, {
        mode: 'PATCH',
        grants: [
          {
            id: fila.id,
            effect: fila.effect,
            actions: Array.isArray(d['actions']) ? (d['actions'] as string[]) : [...atomosDe(fila)],
            condition: d['condition'],
            actionConditions: d['actionConditions'],
            targetKind: fila.targetKind,
            practitionerRoleAssignmentId: fila.practitionerRoleAssignmentId,
            healthcareServiceId: fila.healthcareServiceId,
            careSpaceId: fila.careSpaceId,
            practiceSiteId: fila.practiceSiteId,
            validTo: typeof d['validTo'] === 'string' ? d['validTo'] : fila.validTo,
          },
        ],
        removeGrantIds: [],
      })
    ) {
      return conMotivo(
        409,
        'Algo cambió mientras editaba. Revise la vista previa y vuelva a guardar.',
        'SIMULATION_STALE',
      );
    }
    // Como la API real (ronda 2): sumar un átomo CRÍTICO, alargar la vigencia o ampliar el alcance no se escribe: queda
    // esperando a otra persona (`GRANT_CHANGE`, cuatro ojos) y se contesta 202 con los motivos.
    const atomosNuevos = Array.isArray(d['actions'])
      ? [...new Set((d['actions'] as string[]).flatMap((a) => expandSupportAction(a)))]
      : [...atomosDe(fila)];
    const yaTenia = new Set(atomosDe(fila));
    const criticosNuevos = atomosNuevos.filter((a) => atomMeta(a)?.sensitivity === 'CRITICAL' && !yaTenia.has(a));
    const alargaVigencia =
      typeof d['validTo'] === 'string' &&
      fila.validTo !== undefined &&
      new Date(d['validTo']).getTime() > new Date(fila.validTo).getTime();
    const amplia = d['expansionMode'] === 'DYNAMIC' && fila.expansionMode === 'FIXED';
    const motivos = [
      ...(criticosNuevos.length > 0 && fila.effect !== 'DENY' ? ['NEW_CRITICAL_ATOMS'] : []),
      ...(amplia ? ['SCOPE_WIDENED'] : []),
      ...(alargaVigencia ? ['VALIDITY_EXTENDED'] : []),
    ];
    if (motivos.length > 0) {
      const a = aprobaciones.agregar({
        id: nuevoId('aprobacion'),
        tenantId: v.tenantId,
        kind: 'GRANT_CHANGE',
        status: 'PENDING',
        approverKind: 'SECOND_APPROVER',
        requesterUserId: ADMIN_PRINCIPAL.userId,
        subjectUserId: v.userId,
        reasonText: 'Cambio de un permiso que necesita otra persona',
        createdAt: ahora(),
        expiresAt: iso(7),
        summary: `Cambiar un permiso de ${v.personName}.`,
        details: detallesDelCambio(
          'UPDATE',
          v.tenantId,
          {
            targetKind: fila.targetKind,
            expansionMode: amplia ? 'DYNAMIC' : fila.expansionMode,
            ...(fila.practitionerRoleAssignmentId === undefined ? {} : { practitionerRoleAssignmentId: fila.practitionerRoleAssignmentId }),
            ...(fila.healthcareServiceId === undefined ? {} : { healthcareServiceId: fila.healthcareServiceId }),
            ...(fila.careSpaceId === undefined ? {} : { careSpaceId: fila.careSpaceId }),
            ...(typeof d['validTo'] === 'string' ? { validTo: d['validTo'] } : fila.validTo === undefined ? {} : { validTo: fila.validTo }),
            ...((d['condition'] ?? fila.condition) === undefined ? {} : { condition: (d['condition'] ?? fila.condition) as never }),
            ...((d['actionConditions'] ?? fila.actionConditions) === undefined ? {} : { actionConditions: (d['actionConditions'] ?? fila.actionConditions) as never }),
          },
          atomosNuevos,
          motivos,
          ['actions', 'validTo', 'expansionMode', 'condition', 'actionConditions'].filter((k) => d[k] !== undefined),
        ),
      });
      return reply(202, {
        status: 'PENDING_APPROVAL',
        approvalId: a.id,
        expiresAt: a.expiresAt,
        reasons: motivos,
        criticalAtoms: criticosNuevos,
      });
    }
    permisos.actualizar(fila.id, {
      ...(Array.isArray(d['actions'])
        ? { atoms: (d['actions'] as string[]).flatMap((a) => expandSupportAction(a)) }
        : {}),
      ...(d['condition'] === undefined ? {} : { condition: d['condition'] as never }),
      ...(d['actionConditions'] === undefined
        ? {}
        : { actionConditions: d['actionConditions'] as never }),
      ...(typeof d['validTo'] === 'string' ? { validTo: d['validTo'] } : {}),
    });
    anotar(
      v.tenantId,
      'Administración',
      'grant.conditions_updated',
      `Se cambiaron las condiciones de un permiso de ${v.personName}.`,
    );
    return { ok: true, warnings: [], atoms: atomosDe(permisos.get(fila.id)!) };
  });
}
