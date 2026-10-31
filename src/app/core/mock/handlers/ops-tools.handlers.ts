import type { MockRouter } from '../mock-router';
import type { OpsTool, OpsToolsOverview } from '../../data-access/admin-portal/ops-tools.types';

/* ============================================================================
    Backend simulado de las herramientas (`GET /admin/ops/tools`).

    **DATOS SINTÉTICOS.** El catálogo y el estado de abajo son un conjunto fijo
    para ver la pantalla en `mockup`; no se midió nada. Los nombres de las
    variables de entorno son los que la API declara, pero nunca hay un valor.

    Cubre a propósito los casos que la pantalla tiene que distinguir:
    - `LIVE` + OK, `LIVE` + FAIL;
    - `CONFIGURATION` + OK (hay variables, no se probó que funcione) y
      `CONFIGURATION` + FAIL (faltan variables);
    - `NOT_PROBED` / `NOT_APPLICABLE`;
    - una herramienta crítica sin sondear, y estados no ACTIVE.
    ========================================================================== */

type Salud = OpsTool['health'];

const hace = (ahora: Date, segundos: number): string =>
  new Date(ahora.getTime() - segundos * 1000).toISOString();

function catalogo(ahora: Date): readonly OpsTool[] {
  const vivo = (segundos: number): Salud => ({
    state: 'OK',
    checkType: 'LIVE',
    observedAt: hace(ahora, segundos),
    missingEnvVars: [],
  });
  return [
    {
      code: 'postgresql',
      name: 'PostgreSQL',
      kind: 'DATABASE',
      isCritical: true,
      status: 'ACTIVE',
      requiredEnvVars: ['DATABASE_URL'],
      health: vivo(4),
    },
    {
      code: 'redis',
      name: 'Redis',
      kind: 'CACHE',
      isCritical: true,
      status: 'ACTIVE',
      requiredEnvVars: ['REDIS_URL'],
      health: vivo(4),
    },
    {
      code: 'opensearch',
      name: 'OpenSearch',
      kind: 'SEARCH',
      isCritical: false,
      status: 'ACTIVE',
      requiredEnvVars: ['OPENSEARCH_NODE'],
      health: { state: 'FAIL', checkType: 'LIVE', observedAt: hace(ahora, 4), missingEnvVars: [] },
    },
    {
      code: 'minio',
      name: 'MinIO (almacenamiento de objetos)',
      kind: 'STORAGE',
      isCritical: true,
      status: 'ACTIVE',
      requiredEnvVars: ['MINIO_ENDPOINT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET'],
      health: {
        state: 'NOT_PROBED',
        checkType: 'NOT_APPLICABLE',
        observedAt: null,
        missingEnvVars: [],
      },
    },
    {
      code: 'google-mail',
      name: 'Correo de Google',
      kind: 'MESSAGING',
      isCritical: true,
      status: 'ACTIVE',
      requiredEnvVars: [
        'GOOGLE_OAUTH_CLIENT_ID',
        'GOOGLE_OAUTH_CLIENT_SECRET',
        'GOOGLE_OAUTH_REFRESH_TOKEN',
        'GOOGLE_SENDER_EMAIL',
      ],
      health: {
        state: 'OK',
        checkType: 'CONFIGURATION',
        observedAt: hace(ahora, 30),
        missingEnvVars: [],
      },
    },
    {
      code: 'web-push',
      name: 'Notificaciones push (VAPID)',
      kind: 'MESSAGING',
      isCritical: false,
      status: 'ACTIVE',
      requiredEnvVars: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'],
      health: {
        state: 'FAIL',
        checkType: 'CONFIGURATION',
        observedAt: hace(ahora, 30),
        missingEnvVars: ['VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'],
      },
    },
    {
      code: 'siat',
      name: 'SIAT (facturación en línea)',
      kind: 'PAYMENTS',
      isCritical: true,
      status: 'ACTIVE',
      requiredEnvVars: ['SIAT_BASE_URL', 'SIAT_NIT', 'SIAT_CODIGO_SISTEMA'],
      health: {
        state: 'FAIL',
        checkType: 'CONFIGURATION',
        observedAt: hace(ahora, 30),
        missingEnvVars: ['SIAT_NIT', 'SIAT_CODIGO_SISTEMA'],
      },
    },
    {
      code: 'elevenlabs',
      name: 'ElevenLabs (voz)',
      kind: 'AI',
      isCritical: false,
      status: 'DISABLED',
      requiredEnvVars: ['ELEVENLABS_API_KEY'],
      health: {
        state: 'NOT_PROBED',
        checkType: 'NOT_APPLICABLE',
        observedAt: null,
        missingEnvVars: [],
      },
    },
    {
      code: 'google-analytics',
      name: 'Google Analytics 4',
      kind: 'ANALYTICS',
      isCritical: false,
      status: 'PLANNED',
      requiredEnvVars: [],
      health: {
        state: 'NOT_PROBED',
        checkType: 'NOT_APPLICABLE',
        observedAt: null,
        missingEnvVars: [],
      },
    },
    {
      code: 'clamav',
      name: 'ClamAV (antivirus)',
      kind: 'SECURITY',
      isCritical: true,
      status: 'ACTIVE',
      requiredEnvVars: [],
      health: {
        state: 'NOT_PROBED',
        checkType: 'NOT_APPLICABLE',
        observedAt: null,
        missingEnvVars: [],
      },
    },
    {
      code: 'prometheus',
      name: 'Prometheus',
      kind: 'OBSERVABILITY',
      isCritical: false,
      status: 'DEPRECATED',
      requiredEnvVars: [],
      health: {
        state: 'NOT_PROBED',
        checkType: 'NOT_APPLICABLE',
        observedAt: null,
        missingEnvVars: [],
      },
    },
  ];
}

export function herramientasSimuladas(ahora: Date): OpsToolsOverview {
  return {
    evaluatedAt: ahora.toISOString(),
    items: catalogo(ahora),
    notMeasured: [
      {
        code: 'google-mail',
        reason:
          'SIMULADO · Sólo se comprueba que las variables estén puestas; no se envió ningún correo de prueba.',
      },
      {
        code: 'siat',
        reason: 'SIMULADO · Sólo se comprueba la configuración; no se llamó al servicio.',
      },
      { code: 'minio', reason: 'SIMULADO · El almacenamiento de objetos no se sondea todavía.' },
    ],
  };
}

export function registrarHerramientas(router: MockRouter): void {
  router.get('/admin/ops/tools', () => herramientasSimuladas(new Date()));
}
