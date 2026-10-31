import type {
  InstanceCause,
  InstanceOverall,
  InstanceState,
  InstanceType,
} from '../../../core/data-access/admin-portal/ops-liveness.types';
import type {
  Tool,
  ToolBinding,
  ToolCatalogStatus,
  ToolCheckType,
  ToolKind,
} from '../../../core/data-access/admin-portal/ops-tools.types';
import type { Tone } from '../../../shared/components/tone/tone.types';

/* ============================================================================
    Cómo se dice en pantalla cada valor del contrato. Funciones puras, sin
    Angular: la pantalla las usa y las pruebas las ejercitan directo.

    Un estado nunca se comunica sólo con color: cada chip lleva su texto y el
    tono acompaña (regla 95.4.6).
    ========================================================================== */

/** Un chip: el texto que se lee y el tono que lo acompaña. */
export interface Chip {
  readonly texto: string;
  readonly tono: Tone;
}

export const ESTADOS_DE_INSTANCIA: Readonly<Record<InstanceState, Chip>> = {
  VIVA: { texto: 'Viva', tono: 'success' },
  DEGRADADA: { texto: 'Degradada', tono: 'warning' },
  CAIDA: { texto: 'Caída', tono: 'error' },
  SIN_DATO: { texto: 'Sin dato', tono: 'info' },
};

export const ESTADO_GENERAL: Readonly<Record<InstanceOverall, Chip>> = {
  OK: { texto: 'Todo en pie', tono: 'success' },
  ATENCION: { texto: 'Requiere atención', tono: 'warning' },
  CRITICO: { texto: 'Crítico', tono: 'error' },
  SIN_DATO: { texto: 'Sin dato', tono: 'info' },
};

export const TIPOS_DE_INSTANCIA: Readonly<Record<InstanceType, string>> = {
  API: 'API',
  WORKER: 'Worker',
  DATABASE: 'Base de datos',
  SERVICE: 'Servicio',
};

/** La causa en lenguaje llano; el detalle del servidor va aparte, íntegro. */
export const CAUSAS: Readonly<Record<InstanceCause, string>> = {
  OK: 'Responde dentro del umbral.',
  HEARTBEAT_LATE: 'El último latido llegó tarde, pero todavía no venció.',
  HEARTBEAT_EXPIRED: 'Hace demasiado que no late: se la considera caída.',
  NEVER_SEEN: 'Nunca envió un latido desde que se guarda el registro.',
  STORE_UNAVAILABLE: 'No se pudo leer el almacén de latidos (Redis): no se sabe si vive.',
  CLOCK_INCONSISTENT: 'El reloj de la instancia y el de la API no coinciden: la edad no es confiable.',
  RECORD_CORRUPT: 'El registro del latido llegó roto y no se pudo leer.',
  TICK_STUCK: 'El proceso late pero su ciclo de trabajo está trabado.',
  CIRCUIT_OPEN: 'El proceso cortó el trabajo a propósito (circuito abierto) por fallas seguidas.',
  DRAINING: 'Está terminando lo que tenía y no acepta trabajo nuevo.',
  PROBE_FAILED: 'La sonda la consultó y no respondió bien.',
  PROBE_TIMEOUT: 'La sonda la consultó y no respondió a tiempo.',
  PROBE_SLOW: 'Respondió, pero más lento que el umbral.',
  NOT_PROBED: 'No se la sondea desde la API.',
};

/** Lo que la sonda declara no medir, con nombre legible. */
export const NO_MEDIDO: Readonly<Record<string, string>> = {
  replicasOfApi: 'Réplicas de la API (sólo se ve la que responde)',
  storageObjectStore: 'Contenido del almacén de objetos (sólo que responda)',
  malwareScanner: 'Resultado del antivirus (sólo que responda)',
  providerEmulator: 'Emulador de proveedores externos',
  processInternals: 'Memoria, CPU y colas internas de cada proceso',
};

/** Estado vivo de una herramienta. Sale SOLO de `isHealthy` y `checkType`, nunca de `status`. */
export type EstadoVivo = 'UP' | 'DOWN' | 'NO_PROBE' | 'NOT_APPLICABLE';

export function estadoVivo(tool: Pick<Tool, 'isHealthy' | 'checkType'>): EstadoVivo {
  if (tool.isHealthy === true) return 'UP';
  if (tool.isHealthy === false) return 'DOWN';
  return tool.checkType === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'NO_PROBE';
}

/** `CONFIGURATION` y `NOT_APPLICABLE` nunca van en rojo. */
export const ESTADOS_VIVOS: Readonly<Record<EstadoVivo, Chip>> = {
  UP: { texto: 'Operativa', tono: 'success' },
  DOWN: { texto: 'Caída', tono: 'error' },
  NO_PROBE: { texto: 'Sin chequeo en vivo', tono: 'info' },
  NOT_APPLICABLE: { texto: 'No aplica', tono: 'secondary' },
};

export const ESTADOS_DE_CATALOGO: Readonly<Record<ToolCatalogStatus, string>> = {
  ACTIVE: 'Activa',
  PLANNED: 'Planeada',
  DEPRECATED: 'En retiro',
  DISABLED: 'Apagada',
};

export const VINCULOS: Readonly<Record<ToolBinding, string>> = {
  real: 'Proveedor real',
  mock: 'Mock',
  none: 'Sin vínculo',
  simulated: 'Simulada en la API',
};

export const CHEQUEOS: Readonly<Record<ToolCheckType, string>> = {
  LIVE: 'En vivo',
  CONFIGURATION: 'Sólo configuración',
  NOT_APPLICABLE: 'No aplica',
};

export const TIPOS_DE_HERRAMIENTA: Readonly<Record<ToolKind, string>> = {
  DATABASE: 'Base de datos',
  CACHE: 'Caché',
  SEARCH: 'Búsqueda',
  OBJECT_STORAGE: 'Archivos',
  MAIL: 'Correo',
  IDENTITY: 'Identidad',
  AI: 'IA',
  FISCAL: 'Fiscal',
  ANALYTICS: 'Analítica',
  MAPS: 'Mapas',
  OBSERVABILITY: 'Observabilidad',
  SECURITY: 'Seguridad',
  EMULATOR: 'Emulador',
};

/** «Qué dice»: el mensaje íntegro y, si faltan variables, cuáles. */
export function queDice(tool: Pick<Tool, 'healthMessage' | 'missingEnvVars'>): string {
  const faltan = tool.missingEnvVars.length > 0 ? ` Faltan: ${tool.missingEnvVars.join(', ')}.` : '';
  return `${tool.healthMessage}${faltan}`.trim();
}

/** Antigüedad en palabras: «hace 5 s», «hace 3 min», «hace 2 h». */
export function haceCuanto(segundos: number | null): string {
  if (segundos === null) return 'nunca';
  if (segundos < 0) return 'en el futuro (reloj inconsistente)';
  if (segundos < 60) return `hace ${segundos} s`;
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (segundos < 86_400) return `hace ${Math.floor(segundos / 3600)} h`;
  return `hace ${Math.floor(segundos / 86_400)} d`;
}

/** Segundos enteros entre dos instantes; `null` si alguno no es fecha. */
export function segundosEntre(desde: string | null, hasta: number): number | null {
  if (desde === null) return null;
  const t = new Date(desde).getTime();
  return Number.isNaN(t) ? null : Math.max(0, Math.round((hasta - t) / 1000));
}
