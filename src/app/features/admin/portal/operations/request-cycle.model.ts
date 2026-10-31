import type {
  Arbol,
  NodoArbol,
  OperacionDetalle,
} from '../../../../core/data-access/admin-portal/portal.types';

/* ============================================================================
    El ciclo de una petición en la API, aplicado a una operación concreta.

    Las etapas son las 21 que el descubrimiento verificó en el código de la API
    (`docs/trabajo/2026-10-30-perfil-admin-medicion-gobierno/descubrimiento/
    02-endpoints-agrupados-y-ciclo.md`, §2.1), con su `archivo:línea`. Son
    globales: se registran una vez en `main.ts`, `app.module.ts` y
    `auth.module.ts`, no por operación. Lo que sí es de cada operación es si la
    etapa **le aplica**, y eso se decide acá con los datos que el inventario
    trae de ella (`publica`, `roles`, `requerimientos`, `cuerpo`, `datos`,
    `eventos`, `trabajos`, el árbol) — nunca con una suposición. Cuando el
    inventario no registra el dato (bitácora, RLS, SLI) se dice
    «no determinable», que es la verdad.
    ========================================================================== */

export type CycleApplicability = 'APLICA' | 'NO_APLICA' | 'NO_DETERMINABLE';

export interface CyclePhase {
  readonly id: string;
  readonly label: string;
  /** Qué parte de Nest ejecuta estas etapas, para quien conoce el framework. */
  readonly note: string;
}

export interface CycleStage {
  readonly number: number;
  readonly phase: string;
  readonly label: string;
  /** Qué hace la etapa, en general, para cualquier operación. */
  readonly description: string;
  /** `archivo:línea` de la API donde está, según el descubrimiento. */
  readonly source: string;
}

export interface AssessedStage extends CycleStage {
  readonly applicability: CycleApplicability;
  /** Por qué aplica o no a esta operación, con el dato del inventario que lo dice. */
  readonly reason: string;
}

export interface AssessedPhase extends CyclePhase {
  readonly stages: readonly AssessedStage[];
}

export const CYCLE_PHASES: readonly CyclePhase[] = [
  { id: 'middleware', label: 'Entrada (middleware)', note: 'Express, antes de Nest' },
  { id: 'guards', label: 'Guards', note: 'Pueden rechazar con 401, 403 o 429' },
  { id: 'interceptors', label: 'Interceptores', note: 'Entran antes del handler y salen después' },
  { id: 'validation', label: 'Validación', note: 'ValidationPipe global' },
  { id: 'handler', label: 'Controlador y servicio', note: 'El caso de uso' },
  { id: 'persistence', label: 'Persistencia y eventos', note: 'MikroORM y outbox' },
  { id: 'async', label: 'Entrega asíncrona', note: 'Worker, fuera de la petición' },
  { id: 'errors', label: 'Errores', note: 'Filtro global de excepciones' },
];

export const CYCLE_STAGES: readonly CycleStage[] = [
  { number: 1, phase: 'middleware', label: 'Cabeceras de seguridad', description: 'helmet() en toda respuesta.', source: 'src/main.ts:162' },
  { number: 2, phase: 'middleware', label: 'Medición HTTP (SLI)', description: 'Anota verbo, plantilla de ruta, estado y duración; nunca URL ni usuario. Corre antes de los parsers para contar también los 4xx previos al handler.', source: 'src/main.ts:164-171; src/observability/http-sli/http-sli.middleware.ts:52,66-68' },
  { number: 3, phase: 'middleware', label: 'Lectura del cuerpo', description: 'json y urlencoded con tope de 1 MB.', source: 'src/main.ts:176-177' },
  { number: 4, phase: 'middleware', label: 'CORS', description: 'Deny-by-default con lista de orígenes.', source: 'src/main.ts:182-184' },
  { number: 5, phase: 'middleware', label: 'Id de petición', description: 'genReqId toma x-request-id del cliente sólo si TRUST_PROXY_HOPS>0; si no, UUID. Lo devuelve en X-Request-Id.', source: 'src/logging/pino-options.ts:85-91' },
  { number: 6, phase: 'guards', label: 'Limitación de tasa', description: 'AuthThrottlerGuard: 300 solicitudes cada 60 s, global; login y refresh afinan el tracker.', source: 'src/app.module.ts:147-148,270; src/common/security/auth-throttler.guard.ts:49,55' },
  { number: 7, phase: 'guards', label: 'Autenticación (JWT)', description: 'JwtAuthGuard con Passport; @Public() lo salta; exige typ === "access" y sesión activa.', source: 'src/common/auth/auth.module.ts:39; jwt-auth.guard.ts:28-36; jwt.strategy.ts:55-63' },
  { number: 8, phase: 'guards', label: 'Tenant', description: 'TenantScopeGuard resuelve request.resolvedTenantId (cabecera X-Tenant-Id o membresía única); @TenantAgnostic lo omite.', source: 'src/common/auth/tenant-scope.guard.ts:31,46,62' },
  { number: 9, phase: 'guards', label: 'Roles', description: 'RolesGuard con @Roles(...); SUPERADMIN de plataforma pasa; si no, 403 ROLE_INSUFFICIENT.', source: 'src/common/auth/roles.guard.ts:59,72,86,94-97' },
  { number: 10, phase: 'guards', label: 'Identidad verificada', description: 'Sólo actúa si el handler declara @RequiresVerifiedIdentity.', source: 'src/common/auth/verified-identity.guard.ts:52' },
  { number: 11, phase: 'interceptors', label: 'Caché pública', description: 'Sólo en rutas @Public(); garantiza que una respuesta con sesión no sea Cache-Control: public.', source: 'src/common/http/public-cache.interceptor.ts:87' },
  { number: 12, phase: 'interceptors', label: 'Contexto de tenant (RLS)', description: 'Compara ruta, cuerpo y query con el tenant; con RLS_ENFORCE=true abre em.transactional y ejecuta set_config("app.current_tenant_id", …).', source: 'src/common/tenant/tenant-context.interceptor.ts:80,147-168' },
  { number: 13, phase: 'interceptors', label: 'Bitácora (audit_log)', description: 'Sella audit.audit_log (cadena WORM) en toda mutación autenticada salvo @NotAudited; registra lecturas sólo con @AccessLogged.', source: 'src/modules/audit/interceptors/audit-trail.interceptor.ts:38,84,171,244,266' },
  { number: 14, phase: 'interceptors', label: 'Traza', description: 'Pone x-trace-id en la respuesta.', source: 'src/observability/trace-response.interceptor.ts:40-47' },
  { number: 15, phase: 'validation', label: 'Validación del DTO', description: 'ValidationPipe global; exceptionFactory agrega details.fields; rechaza propiedades no declaradas.', source: 'src/common/http/validation-pipe.ts:114-122; src/main.ts:201' },
  { number: 16, phase: 'handler', label: 'Controlador', description: 'Decoradores @Roles, @Audited, @HttpCode; delega al servicio.', source: 'el handler de la operación (ver «Código» en el resumen)' },
  { number: 17, phase: 'handler', label: 'Servicio y transacción', description: 'this.em.transactional(async (tx) => …); activeTenantId() para el tenant.', source: 'ej. src/modules/billing/services/bills.service.ts:99-100' },
  { number: 18, phase: 'persistence', label: 'Repositorio y ORM', description: 'em.create(...) / consultas de MikroORM reciben el tx; es lo que toca las tablas.', source: 'ej. src/modules/billing/repositories/bills.repository.ts:177,208-209' },
  { number: 19, phase: 'persistence', label: 'Evento (outbox)', description: 'publishDomainEvent(tx, …) escribe domain_events y outbox_messages en la misma transacción, con clave de idempotencia.', source: 'src/modules/messaging/services/outbox.service.ts:185,225,242,255,282' },
  { number: 20, phase: 'async', label: 'Relay y trabajos', description: 'El worker llama a /internal/outbox/relay/run; claimPendingOutbox y despacho a suscriptores.', source: 'src/worker/jobs/messaging/outbox-relay.job.ts:41,54; outbox.service.ts:316,472' },
  { number: 21, phase: 'errors', label: 'Filtro de errores', description: 'AllExceptionsFilter (APP_FILTER): oculta el detalle de los 5xx, añade correlationId y x-trace-id también a los fallos previos a los interceptores.', source: 'src/app.module.ts:268; src/common/filters/all-exceptions.filter.ts:170,191,217' },
];

const NOT_IN_INVENTORY = 'No determinable desde el inventario';

function requirement(op: OperacionDetalle, tipo: string): string | null {
  return op.requerimientos.find((r) => r.tipo === tipo)?.detalle ?? null;
}

function countNodes(nodes: readonly NodoArbol[], tipo: string): number {
  let n = 0;
  for (const node of nodes) {
    if (node.tipo === tipo) n += 1;
    n += countNodes(node.hijos ?? [], tipo) + countNodes(node.entonces ?? [], tipo) + countNodes(node.sino ?? [], tipo);
  }
  return n;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

type Verdict = readonly [CycleApplicability, string];

function assess(stage: CycleStage, op: OperacionDetalle, tree: Arbol | null): Verdict {
  const rate = requirement(op, 'RATE_LIMIT');
  const auth = requirement(op, 'AUTENTICACION');
  const tenant = requirement(op, 'TENANT');
  const role = requirement(op, 'ROL');
  const identity = requirement(op, 'IDENTIDAD_VERIFICADA');
  const validation = requirement(op, 'VALIDACION');
  const body = requirement(op, 'CUERPO');
  const errors = op.respuestasPosibles.filter((r) => r.estado >= 400);
  const writes = op.datos.filter((d) => d.operacion !== 'LEE').length;

  switch (stage.number) {
    case 1:
    case 4:
    case 5:
    case 14:
      return ['APLICA', 'Global: corre en toda petición.'];
    case 2:
      return ['NO_DETERMINABLE', `${NOT_IN_INVENTORY}: depende de que el SLI esté habilitado en el entorno (loadHttpSliEnv().enabled).`];
    case 3:
      return op.cuerpo
        ? ['APLICA', body ?? `Lleva cuerpo ${op.cuerpo.contentType ?? 'de tipo sin dato'}.`]
        : ['NO_APLICA', 'La operación no lleva cuerpo.'];
    case 6:
      return rate ? ['APLICA', rate] : ['NO_DETERMINABLE', `${NOT_IN_INVENTORY}: no trae requerimiento RATE_LIMIT.`];
    case 7:
      if (op.publica) return ['NO_APLICA', auth ?? 'Ruta pública (@Public): no exige token.'];
      return ['APLICA', auth ?? 'Exige sesión (el inventario no detalla el esquema).'];
    case 8:
      if (tenant?.includes('TenantAgnostic')) return ['NO_APLICA', tenant];
      if (tenant) return ['APLICA', tenant];
      if (op.publica) return ['NO_APLICA', 'Ruta pública: el inventario no registra resolución de tenant.'];
      return ['NO_DETERMINABLE', `${NOT_IN_INVENTORY}: no trae requerimiento TENANT.`];
    case 9:
      if (op.publica) return ['NO_APLICA', 'Ruta pública: no se evalúan roles.'];
      if (op.roles.length > 0) return ['APLICA', `Alguno de: ${op.roles.join(', ')}.`];
      return ['NO_APLICA', role ?? 'El controlador no declara @Roles: cualquier sesión válida pasa.'];
    case 10:
      return identity ? ['APLICA', identity] : ['NO_APLICA', 'El handler no declara @RequiresVerifiedIdentity.'];
    case 11:
      return op.publica ? ['APLICA', 'Ruta pública: la respuesta puede llevar Cache-Control público.'] : ['NO_APLICA', 'Sólo actúa en rutas @Public().'];
    case 12:
      if (tenant?.includes('TenantAgnostic')) return ['NO_APLICA', 'Ruta agnóstica de tenant.'];
      return ['NO_DETERMINABLE', `${NOT_IN_INVENTORY}: depende de RLS_ENFORCE en el entorno.`];
    case 13:
      if (op.publica) return ['NO_APLICA', 'Sólo sella mutaciones autenticadas.'];
      return ['NO_DETERMINABLE', `${NOT_IN_INVENTORY}: no registra @Audited, @NotAudited ni @AccessLogged. Regla general: toda mutación autenticada se sella.`];
    case 15: {
      if (!op.cuerpo && op.parametros.length === 0) return ['NO_APLICA', 'Sin cuerpo ni parámetros que validar.'];
      const what = [
        op.cuerpo ? `el DTO ${op.cuerpo.dto ?? 'del cuerpo'}` : null,
        op.parametros.length > 0 ? plural(op.parametros.length, 'parámetro', 'parámetros') : null,
      ].filter(Boolean);
      return ['APLICA', validation ?? `Valida ${what.join(' y ')}.`];
    }
    case 16:
      return ['APLICA', op.codigo ? `Handler en ${op.codigo}.` : 'El inventario no trae la ubicación del handler.'];
    case 17: {
      if (!tree) return ['NO_DETERMINABLE', `${NOT_IN_INVENTORY}: el árbol de decisión no está disponible.`];
      const tx = countNodes(tree.nodos, 'TRANSACCION');
      if (tx > 0) return ['APLICA', `El árbol trae ${plural(tx, 'nodo', 'nodos')} TRANSACCION${tree.truncado ? ' (árbol recortado)' : ''}.`];
      return ['NO_DETERMINABLE', `El árbol no registra una transacción explícita${tree.truncado ? ' (está recortado)' : ''}; el inventario no la marca como bandera.`];
    }
    case 18:
      if (op.datos.length > 0) return ['APLICA', `${plural(new Set(op.datos.map((d) => `${d.schema}.${d.tabla}`)).size, 'tabla', 'tablas')} (${plural(writes, 'acceso de escritura o borrado', 'accesos de escritura o borrado')}).`];
      if (op.sinTablas) return ['NO_APLICA', `No toca tablas: ${op.sinTablas}`];
      return ['NO_DETERMINABLE', `${NOT_IN_INVENTORY}: no derivó tablas ni motivo.`];
    case 19:
      return op.eventos.length > 0 ? ['APLICA', `Emite: ${op.eventos.join(', ')}.`] : ['NO_APLICA', 'No emite eventos de dominio.'];
    case 20:
      if (op.eventos.length > 0 || op.trabajos.length > 0) {
        const parts = [
          op.eventos.length > 0 ? plural(op.eventos.length, 'evento', 'eventos') : null,
          op.trabajos.length > 0 ? `${plural(op.trabajos.length, 'trabajo', 'trabajos')}: ${op.trabajos.join(', ')}` : null,
        ].filter(Boolean);
        return ['APLICA', `${parts.join(' y ')}.`];
      }
      return ['NO_APLICA', 'Ni eventos ni trabajos encolados.'];
    case 21:
      return errors.length > 0
        ? ['APLICA', `Respuestas de error enumeradas: ${errors.map((e) => `${e.estado}${e.codigo ? ` ${e.codigo}` : ''}`).join(', ')}.`]
        : ['APLICA', 'Global: atiende cualquier excepción; el inventario no enumeró respuestas de error.'];
    default:
      return ['NO_DETERMINABLE', NOT_IN_INVENTORY];
  }
}

/** El ciclo completo, por fases, con el veredicto de cada etapa para `op`. */
export function assessCycle(op: OperacionDetalle, tree: Arbol | null): readonly AssessedPhase[] {
  return CYCLE_PHASES.map((phase) => ({
    ...phase,
    stages: CYCLE_STAGES.filter((s) => s.phase === phase.id).map((stage) => {
      const [applicability, reason] = assess(stage, op, tree);
      return { ...stage, applicability, reason };
    }),
  }));
}

export function countApplicability(phases: readonly AssessedPhase[]): Readonly<Record<CycleApplicability, number>> {
  const out: Record<CycleApplicability, number> = { APLICA: 0, NO_APLICA: 0, NO_DETERMINABLE: 0 };
  for (const phase of phases) for (const s of phase.stages) out[s.applicability] += 1;
  return out;
}
