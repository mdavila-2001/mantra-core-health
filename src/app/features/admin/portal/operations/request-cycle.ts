/* ============================================================================
    El ciclo de una petición en la API de Mantra Core Health.

    NO viene de la API: es un dato estático, común a todas las operaciones, que
    se leyó del código de la API (`/home/user/mantra-core-health-api`) y se
    cotejó contra el árbol actual (cada archivo:línea existe y contiene lo que
    la etapa dice). Es lectura de código, no una traza de ejecución: ver
    `NO_COMPROBADO`. Cuando la API cambie, las líneas se corren; la fuente de la
    verdad es el informe `descubrimiento/02-endpoints-agrupados-y-ciclo.md` §2.
    ========================================================================== */

export type CyclePhase =
  | 'MIDDLEWARE'
  | 'GUARDS'
  | 'INTERCEPTORES'
  | 'VALIDACION'
  | 'HANDLER'
  | 'EVENTOS'
  | 'ERRORES';

export interface CycleStage {
  readonly n: number;
  readonly fase: CyclePhase;
  readonly nombre: string;
  readonly queHace: string;
  /** `archivo:línea` en la API; la primera es la principal. */
  readonly fuentes: readonly string[];
}

export interface CyclePhaseInfo {
  readonly codigo: CyclePhase;
  readonly nombre: string;
  readonly explicacion: string;
}

/** Las fases en el orden de Nest: middleware, guards, interceptores, pipe, handler, filtro. */
export const CYCLE_PHASES: readonly CyclePhaseInfo[] = [
  { codigo: 'MIDDLEWARE', nombre: 'Middleware de Express', explicacion: 'Antes de que Nest elija el controlador.' },
  { codigo: 'GUARDS', nombre: 'Guards globales', explicacion: 'Deciden si la petición pasa. Un rechazo (401, 403, 429) va directo al filtro de errores.' },
  { codigo: 'INTERCEPTORES', nombre: 'Interceptores globales', explicacion: 'Envuelven al controlador: lo que hacen antes corre aquí y lo que hacen después, a la salida y en orden inverso.' },
  { codigo: 'VALIDACION', nombre: 'Validación', explicacion: 'Convierte y valida el cuerpo antes de llegar al controlador.' },
  { codigo: 'HANDLER', nombre: 'Controlador, servicio y repositorio', explicacion: 'Lo único propio de cada operación. El resto del ciclo es común.' },
  { codigo: 'EVENTOS', nombre: 'Eventos', explicacion: 'Sólo las operaciones que emiten un evento de dominio.' },
  { codigo: 'ERRORES', nombre: 'Filtro de errores', explicacion: 'Convierte cualquier fallo en el cuerpo de error del contrato.' },
];

export const REQUEST_CYCLE: readonly CycleStage[] = [
  { n: 1, fase: 'MIDDLEWARE', nombre: 'Cabeceras de seguridad', queHace: 'Agrega las cabeceras de seguridad de `helmet`.', fuentes: ['src/main.ts:162'] },
  {
    n: 2,
    fase: 'MIDDLEWARE',
    nombre: 'Medición HTTP (SLI)',
    queHace:
      'Corre antes de los parsers para contar también los 4xx previos al controlador. Sólo anota verbo, plantilla de ruta, estado y duración; nunca la URL ni el usuario. Existe únicamente si la medición está habilitada.',
    fuentes: ['src/main.ts:169', 'src/observability/http-sli/http-sli.middleware.ts:52', 'src/observability/http-sli/http-sli.middleware.ts:66'],
  },
  { n: 3, fase: 'MIDDLEWARE', nombre: 'Cuerpo', queHace: 'Lee JSON y formularios con un tope de 1 MB.', fuentes: ['src/main.ts:176', 'src/main.ts:177'] },
  { n: 4, fase: 'MIDDLEWARE', nombre: 'CORS', queHace: 'Deniega por defecto; sólo pasan los orígenes de la lista permitida.', fuentes: ['src/main.ts:182', 'src/main.ts:184'] },
  {
    n: 5,
    fase: 'MIDDLEWARE',
    nombre: 'Id de petición',
    queHace:
      'Toma `x-request-id` del cliente sólo si se confía en el proxy; si no, genera un UUID. Lo devuelve en `X-Request-Id` y es el `correlationId` de los errores.',
    fuentes: ['src/logging/pino-options.ts:85', 'src/app.module.ts:158'],
  },
  {
    n: 6,
    fase: 'GUARDS',
    nombre: 'Limitación de tasa',
    queHace: '300 peticiones por 60 segundos en general; el criterio de agrupación se afina en login y refresco de sesión. Rechaza con 429.',
    fuentes: ['src/app.module.ts:147', 'src/app.module.ts:270', 'src/common/security/auth-throttler.guard.ts:49'],
  },
  {
    n: 7,
    fase: 'GUARDS',
    nombre: 'Autenticación',
    queHace: 'Valida el JWT. Las rutas marcadas `@Public()` se la saltan. Exige un token de acceso y una sesión activa; si no, 401.',
    fuentes: ['src/common/auth/auth.module.ts:39', 'src/common/auth/jwt-auth.guard.ts:28', 'src/common/auth/jwt.strategy.ts:55'],
  },
  {
    n: 8,
    fase: 'GUARDS',
    nombre: 'Tenant (guard)',
    queHace: 'Resuelve la organización de la petición, por cabecera o por membresía única. `@TenantAgnostic` lo omite.',
    fuentes: ['src/common/auth/auth.module.ts:42', 'src/common/auth/tenant-scope.guard.ts:31', 'src/common/auth/tenant-scope.guard.ts:62'],
  },
  {
    n: 9,
    fase: 'GUARDS',
    nombre: 'Roles',
    queHace: 'Compara los roles de la sesión con `@Roles(...)`. El `SUPERADMIN` de plataforma pasa siempre; si ningún rol alcanza, 403 `ROLE_INSUFFICIENT`.',
    fuentes: ['src/common/auth/auth.module.ts:43', 'src/common/auth/roles.guard.ts:59', 'src/common/auth/roles.guard.ts:94'],
  },
  {
    n: 10,
    fase: 'GUARDS',
    nombre: 'Identidad verificada',
    queHace: 'Sólo actúa si el controlador declara `@RequiresVerifiedIdentity`.',
    fuentes: ['src/common/auth/auth.module.ts:44', 'src/common/auth/verified-identity.guard.ts:52'],
  },
  {
    n: 11,
    fase: 'INTERCEPTORES',
    nombre: 'Caché pública',
    queHace: 'Sólo para rutas `@Public()`: garantiza que una respuesta con sesión no salga como `Cache-Control: public`.',
    fuentes: ['src/app.module.ts:277', 'src/common/http/public-cache.interceptor.ts:87'],
  },
  {
    n: 12,
    fase: 'INTERCEPTORES',
    nombre: 'Contexto de tenant y RLS',
    queHace:
      'Compara la organización de la ruta, el cuerpo y la consulta con la de la sesión. Con `RLS_ENFORCE` abre una transacción y fija `app.current_tenant_id` para la seguridad por filas.',
    fuentes: ['src/app.module.ts:280', 'src/common/tenant/tenant-context.interceptor.ts:80', 'src/common/tenant/tenant-context.interceptor.ts:159'],
  },
  {
    n: 13,
    fase: 'INTERCEPTORES',
    nombre: 'Bitácora de auditoría',
    queHace:
      'Sella `audit.audit_log` en toda mutación autenticada (POST, PUT, PATCH, DELETE) salvo `@NotAudited`, al éxito y al fallo. Las lecturas sólo se registran con `@AccessLogged`.',
    fuentes: ['src/app.module.ts:286', 'src/modules/audit/interceptors/audit-trail.interceptor.ts:38', 'src/modules/audit/interceptors/audit-trail.interceptor.ts:244', 'src/modules/audit/interceptors/audit-trail.interceptor.ts:266'],
  },
  {
    n: 14,
    fase: 'INTERCEPTORES',
    nombre: 'Traza',
    queHace: 'Pone la cabecera `x-trace-id` en la respuesta.',
    fuentes: ['src/app.module.ts:289', 'src/observability/trace-response.interceptor.ts:40'],
  },
  {
    n: 15,
    fase: 'VALIDACION',
    nombre: 'Validación del cuerpo',
    queHace: '`ValidationPipe` global: rechaza los campos no declarados y transforma el DTO. Un fallo es 400 `VALIDATION_FAILED` con `details.fields`.',
    fuentes: ['src/common/http/validation-pipe.ts:114', 'src/main.ts:201'],
  },
  {
    n: 16,
    fase: 'HANDLER',
    nombre: 'Controlador',
    queHace: 'Declara `@Roles`, `@Audited` y `@HttpCode`, y delega al servicio. Ejemplo: registrar una factura.',
    fuentes: ['src/modules/billing/controllers/billing-payables.controller.ts:37'],
  },
  {
    n: 17,
    fase: 'HANDLER',
    nombre: 'Servicio y transacción',
    queHace: 'Abre `em.transactional(...)` y toma la organización activa. Las excepciones de dominio (404, 409, 422) salen de aquí.',
    fuentes: ['src/modules/billing/services/bills.service.ts:99'],
  },
  {
    n: 18,
    fase: 'HANDLER',
    nombre: 'Repositorio y ORM',
    queHace: 'Crea y lee con MikroORM dentro de la transacción que recibe. Es el acceso que el inventario cita como `fuente` de cada tabla.',
    fuentes: ['src/modules/billing/repositories/bills.repository.ts:177'],
  },
  {
    n: 19,
    fase: 'EVENTOS',
    nombre: 'Evento de dominio (outbox)',
    queHace: 'Escribe `domain_events` y `outbox_messages` en la misma transacción, con clave de idempotencia. La entrega a los suscriptores es la etapa siguiente.',
    fuentes: ['src/modules/messaging/services/outbox.service.ts:185', 'src/modules/messaging/services/outbox.service.ts:255', 'src/modules/messaging/services/outbox.service.ts:282'],
  },
  {
    n: 20,
    fase: 'EVENTOS',
    nombre: 'Entrega asíncrona',
    queHace: 'Un worker llama a `/internal/outbox/relay/run`; la API reclama los mensajes pendientes y los despacha a los suscriptores. Ocurre fuera de la petición.',
    fuentes: ['src/worker/jobs/messaging/outbox-relay.job.ts:54', 'src/modules/messaging/services/outbox.service.ts:316', 'src/modules/messaging/services/outbox.service.ts:472'],
  },
  {
    n: 21,
    fase: 'ERRORES',
    nombre: 'Filtro de errores',
    queHace:
      '`AllExceptionsFilter` convierte cualquier fallo en el cuerpo `code`, `message`, `correlationId`, `details`; oculta el detalle de los 5xx y también pone `x-trace-id` en los fallos anteriores a los interceptores.',
    fuentes: ['src/app.module.ts:268', 'src/common/filters/all-exceptions.filter.ts:191', 'src/common/filters/all-exceptions.filter.ts:217'],
  },
];

/** Lo que el informe declara sin comprobar en ejecución; se muestra junto al ciclo. */
export const NO_COMPROBADO: readonly string[] = [
  'El orden entre el limitador de tasa (etapa 6) y los cuatro guards de autenticación (7 a 10) se numera por convención: dentro de un módulo Nest respeta el orden declarado, pero entre módulos no se comprobó en ejecución.',
  'Si el middleware de registro (etapa 5) corre antes o después de los demás middleware de `main.ts` se razonó, no se verificó.',
  'No se comprobó que la transacción del servicio (etapa 17) se una a la que abre la seguridad por filas (etapa 12).',
  'La medición HTTP (etapa 2) sólo existe donde esté habilitada; no se leyó su valor por defecto en cada entorno.',
];

export function stagesOf(phase: CyclePhase): readonly CycleStage[] {
  return REQUEST_CYCLE.filter((s) => s.fase === phase);
}
