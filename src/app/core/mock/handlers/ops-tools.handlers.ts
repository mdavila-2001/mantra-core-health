import type { MockRouter } from '../mock-router';
import type { OpsTools, Tool } from '../../data-access/admin-portal/ops-tools.types';

/* ============================================================================
    Backend SIMULADO del catálogo de herramientas (`GET /admin/ops/tools`).

    Devuelve el contrato exacto de la API (doc 03-herramientas-e-instancias
    §4.2) con datos sintéticos y fijos. Cubre los tres `checkType` (LIVE,
    CONFIGURATION, NOT_APPLICABLE), los cuatro `binding`, los cuatro estados de
    catálogo, dos caídas críticas, una herramienta lenta pero viva y una a la
    que le faltan variables de entorno. `summary` se calcula de la lista con la misma
    regla que el front (estado vivo sólo de `isHealthy` + `checkType`), así que
    nunca discrepan.

    Cada `healthMessage` empieza por «Simulado:» para que nadie confunda esto
    con una medición real.
    ========================================================================== */

type Semilla = Omit<Tool, 'checkedAt'> & { readonly checkedSecondsAgo: number | null };

const SEMILLAS: readonly Semilla[] = [
  { code: 'postgresql', name: 'PostgreSQL', kind: 'DATABASE', provider: 'PostgreSQL 16', purpose: 'Base de datos principal: personas, agenda, clínica, facturación.', isCritical: true, status: 'ACTIVE', binding: 'real', isConfigured: true, missingEnvVars: [], requiredEnvVars: ['DATABASE_URL'], checkType: 'LIVE', isHealthy: true, healthMessage: 'Simulado: SELECT 1 respondió en 4 ms.', latencyMs: 4, checkedSecondsAgo: 1, ownerTeam: 'plataforma', failureImpact: 'Nada funciona: ninguna pantalla puede leer ni guardar.', fallback: 'Ninguno. Restaurar desde el último respaldo probado.' },
  { code: 'mongodb', name: 'MongoDB', kind: 'DATABASE', provider: 'MongoDB 7', purpose: 'Documentos clínicos, mensajería y contenido.', isCritical: true, status: 'ACTIVE', binding: 'real', isConfigured: true, missingEnvVars: [], requiredEnvVars: ['MONGODB_URI'], checkType: 'LIVE', isHealthy: true, healthMessage: 'Simulado: ping respondió en 6 ms.', latencyMs: 6, checkedSecondsAgo: 1, ownerTeam: 'plataforma', failureImpact: 'Sin historia clínica ni chat.', fallback: 'Ninguno.' },
  { code: 'redis', name: 'Redis', kind: 'CACHE', provider: 'Redis 7', purpose: 'Caché, sesiones, colas y latidos de los workers.', isCritical: true, status: 'ACTIVE', binding: 'real', isConfigured: true, missingEnvVars: [], requiredEnvVars: ['REDIS_URL'], checkType: 'LIVE', isHealthy: true, healthMessage: 'Simulado: PING respondió en 1 ms.', latencyMs: 1, checkedSecondsAgo: 1, ownerTeam: 'plataforma', failureImpact: 'Caen las colas y la sonda de vida pierde los latidos.', fallback: 'La API sigue leyendo de PostgreSQL sin caché.' },
  { code: 'opensearch', name: 'OpenSearch', kind: 'SEARCH', provider: 'OpenSearch 2', purpose: 'Búsqueda del directorio y de terminología.', isCritical: false, status: 'ACTIVE', binding: 'real', isConfigured: true, missingEnvVars: [], requiredEnvVars: ['OPENSEARCH_URL'], checkType: 'LIVE', isHealthy: true, healthMessage: 'Simulado: el clúster respondió «yellow» en 1 850 ms; más lento que el umbral de 1 000 ms.', latencyMs: 1850, checkedSecondsAgo: 2, ownerTeam: 'plataforma', failureImpact: 'El buscador deja de responder; el resto sigue.', fallback: 'Búsqueda por SQL, más lenta y sin sinónimos.' },
  { code: 'minio', name: 'MinIO', kind: 'OBJECT_STORAGE', provider: 'MinIO (S3)', purpose: 'Archivos adjuntos, estudios y documentos.', isCritical: true, status: 'ACTIVE', binding: 'real', isConfigured: true, missingEnvVars: [], requiredEnvVars: ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'], checkType: 'LIVE', isHealthy: true, healthMessage: 'Simulado: /minio/health/live respondió en 12 ms.', latencyMs: 12, checkedSecondsAgo: 1, ownerTeam: 'plataforma', failureImpact: 'No se pueden subir ni abrir archivos.', fallback: 'Ninguno.' },
  { code: 'smtp', name: 'Correo saliente', kind: 'MAIL', provider: 'SMTP (Mailpit en desarrollo)', purpose: 'Correos de alta, recuperación de clave y avisos.', isCritical: true, status: 'ACTIVE', binding: 'real', isConfigured: true, missingEnvVars: [], requiredEnvVars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'], checkType: 'LIVE', isHealthy: false, healthMessage: 'Simulado: la conexión al puerto 1025 fue rechazada (ECONNREFUSED) tras 3 000 ms.', latencyMs: 3000, checkedSecondsAgo: 2, ownerTeam: 'plataforma', failureImpact: 'Nadie recibe correos: altas sin confirmar y claves sin recuperar.', fallback: 'Los correos quedan en cola y se reintentan al volver.' },
  { code: 'firebase-auth', name: 'Firebase Authentication', kind: 'IDENTITY', provider: 'Google Firebase', purpose: 'Ingreso con Google y teléfono.', isCritical: false, status: 'ACTIVE', binding: 'real', isConfigured: true, missingEnvVars: [], requiredEnvVars: ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'], checkType: 'CONFIGURATION', isHealthy: null, healthMessage: 'Simulado: credenciales presentes; Firebase no expone un chequeo en vivo desde el servidor.', latencyMs: null, checkedSecondsAgo: null, ownerTeam: 'identidad', failureImpact: 'Falla el ingreso social; el ingreso con correo y clave sigue.', fallback: 'Correo y clave.' },
  { code: 'openai', name: 'OpenAI', kind: 'AI', provider: 'OpenAI API', purpose: 'Orientación de síntomas y resúmenes clínicos.', isCritical: false, status: 'ACTIVE', binding: 'mock', isConfigured: false, missingEnvVars: ['OPENAI_API_KEY'], requiredEnvVars: ['OPENAI_API_KEY', 'OPENAI_MODEL'], checkType: 'CONFIGURATION', isHealthy: null, healthMessage: 'Simulado: falta la clave; en este entorno responde el emulador de proveedores.', latencyMs: null, checkedSecondsAgo: null, ownerTeam: 'producto', failureImpact: 'Sin orientación de síntomas; el resto no cambia.', fallback: 'Emulador con respuestas fijas.' },
  { code: 'siat', name: 'SIAT (Impuestos Nacionales)', kind: 'FISCAL', provider: 'SIN Bolivia', purpose: 'Facturación electrónica con validez fiscal.', isCritical: true, status: 'ACTIVE', binding: 'simulated', isConfigured: true, missingEnvVars: [], requiredEnvVars: ['SIAT_NIT', 'SIAT_TOKEN', 'SIAT_CUIS'], checkType: 'LIVE', isHealthy: false, healthMessage: 'Simulado: el servicio de sincronización de catálogos devolvió 503 en 2 400 ms.', latencyMs: 2400, checkedSecondsAgo: 5, ownerTeam: 'facturación', failureImpact: 'No se emiten facturas con validez fiscal.', fallback: 'Facturación fuera de línea (CUFD vigente) y envío diferido.' },
  { code: 'google-maps', name: 'Google Maps', kind: 'MAPS', provider: 'Google Maps Platform', purpose: 'Geocodificación de direcciones de centros y farmacias.', isCritical: false, status: 'ACTIVE', binding: 'real', isConfigured: true, missingEnvVars: [], requiredEnvVars: ['GOOGLE_MAPS_API_KEY'], checkType: 'CONFIGURATION', isHealthy: null, healthMessage: 'Simulado: clave presente; no se gasta cuota en chequeos.', latencyMs: null, checkedSecondsAgo: null, ownerTeam: 'producto', failureImpact: 'Las direcciones nuevas quedan sin coordenadas.', fallback: 'Carga manual de coordenadas.' },
  { code: 'otel-collector', name: 'OpenTelemetry Collector', kind: 'OBSERVABILITY', provider: 'OTel → Jaeger', purpose: 'Trazas y métricas de la API y del front.', isCritical: false, status: 'ACTIVE', binding: 'real', isConfigured: true, missingEnvVars: [], requiredEnvVars: ['OTEL_EXPORTER_OTLP_ENDPOINT'], checkType: 'LIVE', isHealthy: true, healthMessage: 'Simulado: el colector aceptó un lote vacío en 9 ms.', latencyMs: 9, checkedSecondsAgo: 3, ownerTeam: 'plataforma', failureImpact: 'Se pierden trazas; la operación no se afecta.', fallback: 'Registros locales.' },
  { code: 'clamav', name: 'ClamAV', kind: 'SECURITY', provider: 'ClamAV', purpose: 'Antivirus de los archivos subidos.', isCritical: false, status: 'DISABLED', binding: 'none', isConfigured: false, missingEnvVars: ['CLAMAV_HOST'], requiredEnvVars: ['CLAMAV_HOST', 'CLAMAV_PORT'], checkType: 'NOT_APPLICABLE', isHealthy: null, healthMessage: 'Simulado: apagado en este entorno; los archivos se aceptan sin escanear.', latencyMs: null, checkedSecondsAgo: null, ownerTeam: 'seguridad', failureImpact: 'Ninguno mientras esté apagado a propósito.', fallback: 'Escaneo diferido al encenderlo.' },
  { code: 'mock-provider-server', name: 'Emulador de proveedores', kind: 'EMULATOR', provider: 'Interno', purpose: 'Responde por los proveedores externos en desarrollo y pruebas.', isCritical: false, status: 'ACTIVE', binding: 'real', isConfigured: true, missingEnvVars: [], requiredEnvVars: ['MOCK_PROVIDER_URL'], checkType: 'LIVE', isHealthy: true, healthMessage: 'Simulado: /health respondió en 2 ms.', latencyMs: 2, checkedSecondsAgo: 1, ownerTeam: 'plataforma', failureImpact: 'Sólo en desarrollo: los proveedores emulados dejan de responder.', fallback: 'Ninguno en producción (no existe allí).' },
  { code: 'ga4', name: 'Google Analytics 4', kind: 'ANALYTICS', provider: 'Google', purpose: 'Analítica de producto en el sitio público.', isCritical: false, status: 'PLANNED', binding: 'none', isConfigured: false, missingEnvVars: ['GA4_MEASUREMENT_ID'], requiredEnvVars: ['GA4_MEASUREMENT_ID'], checkType: 'NOT_APPLICABLE', isHealthy: null, healthMessage: 'Simulado: planeada; todavía no se integró.', latencyMs: null, checkedSecondsAgo: null, ownerTeam: 'marketing', failureImpact: 'Ninguno: no está en uso.', fallback: 'Analítica propia (telemetry).' },
  { code: 'sendgrid', name: 'SendGrid', kind: 'MAIL', provider: 'Twilio SendGrid', purpose: 'Correo transaccional anterior, en retiro.', isCritical: false, status: 'DEPRECATED', binding: 'none', isConfigured: false, missingEnvVars: [], requiredEnvVars: [], checkType: 'NOT_APPLICABLE', isHealthy: null, healthMessage: 'Simulado: reemplazada por SMTP; se conserva en el catálogo para la auditoría.', latencyMs: null, checkedSecondsAgo: null, ownerTeam: null, failureImpact: 'Ninguno: no está en uso.', fallback: 'SMTP.' },
];

/** La respuesta entera, evaluada «ahora»: las fechas se mueven, los estados no. */
export function herramientasSimuladas(ahora = Date.now()): OpsTools {
  const tools: Tool[] = SEMILLAS.map(({ checkedSecondsAgo, ...t }) => ({
    ...t,
    checkedAt: checkedSecondsAgo === null ? null : new Date(ahora - checkedSecondsAgo * 1000).toISOString(),
  }));
  const vivo = (t: Tool) => (t.isHealthy === true ? 'UP' : t.isHealthy === false ? 'DOWN' : t.checkType === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'NO_PROBE');
  const contar = (estado: ReturnType<typeof vivo>) => tools.filter((t) => vivo(t) === estado).length;
  return {
    modelVersion: 'ops-tools/v1',
    evaluatedAt: new Date(ahora).toISOString(),
    summary: {
      total: tools.length,
      healthy: contar('UP'),
      down: contar('DOWN'),
      noProbe: contar('NO_PROBE'),
      notApplicable: contar('NOT_APPLICABLE'),
      critical: tools.filter((t) => t.isCritical).length,
    },
    tools,
  };
}

export function registrarHerramientas(router: MockRouter): void {
  router.get('/admin/ops/tools', () => herramientasSimuladas());
}
