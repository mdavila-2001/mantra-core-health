/* ============================================================================
    Qué endpoint pertenece a qué funcionalidad.

    La API mide el tráfico **por plantilla de ruta** (`GET /patients/:id`), no por
    funcionalidad. Esta tabla es la que traduce una cosa en la otra, y es
    declarada y revisable a propósito: si una ruta cae en la funcionalidad
    equivocada, se corrige acá, en una línea, y se ve en el diff.

    Reglas:
    - Cada funcionalidad lista **prefijos de ruta** (segmentos completos, sin
      barra inicial): `scheduling` cubre `/scheduling` y `/scheduling/bookings`,
      pero no `/scheduling-x`.
    - Gana el prefijo **más largo**: `clinical/prescriptions` (Farmacia) le gana
      a `clinical` (Historia clínica).
    - Lo que ningún prefijo reclama va a «Otros», que la pantalla muestra con la
      lista de rutas que contiene. Nada se descarta ni se reparte "por parecido".
    - Los prefijos salen de los `@Controller` reales de la API
      (`mantra-core-health-api/src/modules/**`), no de una suposición. Un
      controlador nuevo cae en «Otros» hasta que alguien lo ubique acá.

    No es un permiso ni una frontera de datos: sólo agrupa números.
    ========================================================================== */

export interface Funcionalidad {
  /** Clave estable (se usa como identificador de fila). */
  readonly id: string;
  /** Nombre para la persona que mide. */
  readonly label: string;
  /** Prefijos de ruta, en minúsculas y sin barra inicial. */
  readonly prefixes: readonly string[];
}

/** Lo que ningún prefijo reclama. Existe siempre, aunque esté vacío. */
export const OTROS: Funcionalidad = { id: 'otros', label: 'Otros', prefixes: [] };

/** Rutas especiales que la API usa para lo que no pudo asignar a una plantilla. */
export const RUTAS_SIN_PLANTILLA: ReadonlySet<string> = new Set(['UNMATCHED', '__overflow__']);

export const FUNCIONALIDADES: readonly Funcionalidad[] = [
  {
    id: 'agenda',
    label: 'Agenda y citas',
    prefixes: ['scheduling', 'appointments', 'visit-agenda', 'visit-requests', 'visit-records', 'virtual-encounters'],
  },
  {
    id: 'historia-clinica',
    label: 'Historia clínica',
    prefixes: [
      'charts',
      'clinical',
      'forms',
      'health-data',
      'health-context',
      'order-sets',
      'clinical-alerts',
    ],
  },
  {
    id: 'farmacia',
    label: 'Farmacia y recetas',
    prefixes: [
      'pharmacy',
      'pharmacies',
      'pharmacy-inventory',
      'pharma-labs',
      'prescription-favorites',
      'clinical/prescriptions',
      'clinical/prescription-signature-policies',
      'inventory-items',
    ],
  },
  {
    id: 'laboratorio',
    label: 'Laboratorio e imágenes',
    prefixes: [
      'diagnostics',
      'diagnostic-results',
      'diagnostic-units',
      'diagnostic-equipment',
      'diagnostic-unit-sites',
      'diagnostic-unit-accreditations',
      'dicomweb',
    ],
  },
  {
    id: 'seguros',
    label: 'Seguros',
    prefixes: [
      'insurance',
      'insurance-claims',
      'insurance-campaigns',
      'claim-disputes',
      'broker-commission-statements',
    ],
  },
  {
    id: 'facturacion',
    label: 'Facturación, pagos y contabilidad',
    prefixes: [
      'billing',
      'quotations',
      'accounting',
      'payments',
      'reconciliation-batches',
      'practitioner-settlement-batches',
      'finops',
      'patient-spending',
      'erp',
    ],
  },
  {
    id: 'mensajeria',
    label: 'Mensajería y notificaciones',
    prefixes: ['community/conversations', 'notifications'],
  },
  {
    id: 'comunidad',
    label: 'Comunidad',
    prefixes: [
      'community',
      'internal/community',
      'moderation',
      'surveys',
      'visit-surveys',
      'referrals',
      'education',
      'ads',
      'marketing',
      'crm',
    ],
  },
  {
    id: 'identidad',
    label: 'Identidad y accesos',
    prefixes: [
      'iam',
      'auth',
      'auth-providers',
      'identity',
      'internal/identity',
      'authz',
      'role-assignments',
      'delegated-permission-sets',
      'access-requests',
      'admissions',
    ],
  },
  {
    id: 'consentimiento',
    label: 'Consentimiento y privacidad',
    prefixes: ['consent', 'privacy'],
  },
  {
    id: 'personas',
    label: 'Pacientes, profesionales y organizaciones',
    prefixes: [
      'patients',
      'practitioners',
      'practices',
      'profiles',
      'medical-centers',
      'medical-groups',
      'orgext',
      'care-teams',
      'practitioner-delegates',
      'sites',
      'tenants',
    ],
  },
  {
    id: 'geolocalizacion',
    label: 'Geolocalización',
    prefixes: ['geo', 'public/geo', 'tracking'],
  },
  {
    id: 'terminologia',
    label: 'Terminología y datos de referencia',
    prefixes: ['terminology', 'search', 'graph', 'vector-rag', 'read-models', 'lakehouse', 'reporting', 'research'],
  },
  {
    id: 'archivos',
    label: 'Archivos y datos comunes',
    prefixes: ['common', 'internal/files', 'object-storage', 'audio-assets', 'internal/audio-assets', 'document-store'],
  },
  {
    id: 'integraciones',
    label: 'Integraciones y flujos',
    prefixes: ['integration', 'integrations', 'fhir', 'webhooks', 'automation', 'workflow'],
  },
  {
    id: 'administracion',
    label: 'Administración y operación',
    prefixes: [
      'admin',
      'governance',
      'internal/governance',
      'ops',
      'internal/ops',
      'telemetry',
      'audit',
      'system-context',
      'workers',
      'qa',
      'internal/qa',
      'redis-runtime',
      'ts',
    ],
  },
];

/** Todas las funcionalidades, «Otros» incluido y al final. */
export const TODAS_LAS_FUNCIONALIDADES: readonly Funcionalidad[] = [...FUNCIONALIDADES, OTROS];

interface Regla {
  readonly segmentos: readonly string[];
  readonly funcionalidad: Funcionalidad;
}

/** Los prefijos ya partidos en segmentos, del más largo al más corto. */
const REGLAS: readonly Regla[] = FUNCIONALIDADES.flatMap((funcionalidad) =>
  funcionalidad.prefixes.map((prefijo) => ({ segmentos: prefijo.split('/'), funcionalidad })),
).sort((a, b) => b.segmentos.length - a.segmentos.length);

/**
 * La funcionalidad de una plantilla de ruta. `UNMATCHED` y `__overflow__` (y lo
 * que no empieza por un prefijo conocido) devuelven «Otros».
 */
export function funcionalidadDe(route: string): Funcionalidad {
  if (RUTAS_SIN_PLANTILLA.has(route)) return OTROS;
  const segmentos = route
    .split('?')[0]!
    .split('/')
    .filter((s) => s !== '')
    .map((s) => s.toLowerCase());
  for (const regla of REGLAS) {
    if (regla.segmentos.length > segmentos.length) continue;
    if (regla.segmentos.every((s, i) => s === segmentos[i])) return regla.funcionalidad;
  }
  return OTROS;
}
