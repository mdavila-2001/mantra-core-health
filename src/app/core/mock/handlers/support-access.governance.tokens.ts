/* ============================================================================
    El `simulationToken` del simulador (CONTRATO-GOBIERNO §5.3): una huella opaca (10 minutos) del borrador **validado**.
    Al guardar, si lo que se guarda no es lo simulado, 409 `SIMULATION_STALE` («vi una cosa y guardé otra»).

    **Igual de estricta que la API real** (`access-explain.support.ts`, B7c): la huella es la del borrador ENTERO de ESE vínculo
    —modo, plantilla, cada permiso con sus condiciones, su objetivo y su vencimiento, y los que se quitan—, no la de «alguno de los
    permisos que se simularon». Un solo permiso guardado se compara contra un borrador `PATCH` de un solo permiso; un cambio de rol,
    contra el `REPLACE` completo. Y como allá, un campo en `null` NO es lo mismo que un campo ausente.
   ========================================================================== */

const VIGENCIA_MS = 10 * 60_000;
const fichas = new Map<string, { readonly huella: string; readonly vence: number }>();

const REFERENCIAS = [
  'practitionerRoleAssignmentId',
  'healthcareServiceId',
  'careSpaceId',
  'practiceSiteId',
] as const;

/** Un permiso de un borrador, como lo manda `simulate` o lo arma el guardado. */
export interface PermisoDeBorrador {
  readonly id?: string;
  readonly effect?: string;
  readonly actions?: readonly string[];
  readonly condition?: unknown;
  readonly actionConditions?: unknown;
  readonly targetKind?: string;
  readonly practitionerRoleAssignmentId?: string | null;
  readonly healthcareServiceId?: string | null;
  readonly careSpaceId?: string | null;
  readonly practiceSiteId?: string | null;
  readonly validTo?: string | null;
}

export interface Borrador {
  readonly mode?: string;
  readonly templateCode?: string | null;
  readonly grants?: readonly PermisoDeBorrador[];
  readonly removeGrantIds?: readonly string[];
}

/** El tipo de objetivo que sale de las referencias, como `inferTargetKind` de la API. */
function objetivoDe(g: PermisoDeBorrador): string {
  const ubicacion = !!g.careSpaceId || !!g.practiceSiteId;
  if (g.practitionerRoleAssignmentId && g.healthcareServiceId) return 'PRACTITIONER_SERVICE';
  if (g.practitionerRoleAssignmentId && ubicacion) return 'PRACTITIONER_LOCATION';
  if (g.healthcareServiceId && ubicacion) return 'SERVICE_LOCATION';
  if (g.practitionerRoleAssignmentId) return 'PRACTITIONER';
  if (g.healthcareServiceId) return 'SERVICE';
  if (g.careSpaceId) return 'LOCATION';
  if (g.practiceSiteId) return 'SITE';
  return 'ALL';
}

/** JSON con las claves ordenadas y sin lo `undefined` (un `null` sí cuenta): la forma canónica de la API. */
function canonico(valor: unknown): string {
  if (valor === undefined) return 'undefined';
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  const claves = Object.keys(valor)
    .filter((k) => (valor as Record<string, unknown>)[k] !== undefined)
    .sort();
  return `{${claves.map((k) => `${JSON.stringify(k)}:${canonico((valor as Record<string, unknown>)[k])}`).join(',')}}`;
}

/** La huella de un borrador de un vínculo. */
export function huellaDelBorrador(engagementId: string, borrador: Borrador): string {
  const permisos = (borrador.grants ?? [])
    .map((g) => ({
      id: g.id,
      effect: g.effect ?? 'ALLOW',
      actions: [...new Set(g.actions ?? [])].sort(),
      condition: g.condition ?? undefined,
      actionConditions: g.actionConditions ?? undefined,
      targetKind: g.targetKind ?? objetivoDe(g),
      ...Object.fromEntries(REFERENCIAS.map((r) => [r, g[r]])),
      validTo: g.validTo ? new Date(g.validTo).toISOString() : undefined,
    }))
    .sort((a, b) => canonico(a).localeCompare(canonico(b)));
  return canonico({
    engagementId,
    draft: {
      mode: borrador.mode,
      templateCode: borrador.templateCode ?? null,
      grants: permisos,
      removeGrantIds: [...(borrador.removeGrantIds ?? [])].sort(),
    },
  });
}

/** Guarda la huella de un borrador validado y devuelve su token. */
export function guardarFichaDeSimulacion(engagementId: string, borrador: Borrador): string {
  const token = `sim_${Math.random().toString(16).slice(2, 12)}${Date.now().toString(16)}`;
  fichas.set(token, {
    huella: huellaDelBorrador(engagementId, borrador),
    vence: Date.now() + VIGENCIA_MS,
  });
  return token;
}

/** ¿Lo que se guarda es EXACTAMENTE lo que se simuló? Un token desconocido o vencido tampoco vale. */
export function coincideConLaSimulacion(
  token: string,
  engagementId: string,
  guardado: Borrador,
): boolean {
  const f = fichas.get(token);
  return (
    f !== undefined &&
    f.vence >= Date.now() &&
    f.huella === huellaDelBorrador(engagementId, guardado)
  );
}

/** Las pruebas parten sin tokens. */
export function olvidarSimulaciones(): void {
  fichas.clear();
}
