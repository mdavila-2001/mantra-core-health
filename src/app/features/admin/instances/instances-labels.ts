import type { DeviceBreakdownItem } from '../../../core/data-access/admin-portal/analytics-devices.types';
import type {
  InstanceType,
  LivenessInstance,
  LivenessState,
} from '../../../core/data-access/admin-portal/ops-liveness.types';
import type {
  OpsTool,
  ToolCheckType,
  ToolHealthState,
  ToolKind,
  ToolStatus,
} from '../../../core/data-access/admin-portal/ops-tools.types';
import type { Tone } from '../../../shared/components/tone/tone.types';

/* ============================================================================
    Rótulos, tonos y orden de «Instancias y herramientas».

    Traducen los códigos del servidor a texto y a tono. No deciden nada: un
    código que no está acá se muestra tal cual con tono neutro, en vez de
    inventarle un significado.

    Regla de honestidad: **el verde sólo se gana con evidencia**. `SIN_DATO`,
    «sin sondear» y «sólo configuración» nunca son verdes, y todo estado lleva
    su palabra: el color acompaña, no informa solo.
    ========================================================================== */

export interface Rotulo {
  readonly label: string;
  readonly tone: Tone;
}

/* -- Instancias ---------------------------------------------------------- */

export const ESTADOS_DE_VIDA: readonly LivenessState[] = ['CAIDA', 'DEGRADADA', 'SIN_DATO', 'VIVA'];

const VIDA: Readonly<Record<LivenessState, Rotulo>> = {
  VIVA: { label: 'Viva', tone: 'success' },
  DEGRADADA: { label: 'Degradada', tone: 'warning' },
  CAIDA: { label: 'Caída', tone: 'error' },
  SIN_DATO: { label: 'Sin dato', tone: 'secondary' },
};

export function estadoDeVida(estado: string | null | undefined): Rotulo {
  const conocido = estado ? VIDA[estado as LivenessState] : undefined;
  return conocido ?? { label: estado ?? 'Sin dato', tone: 'secondary' };
}

/** Plural para los conteos del resumen («Vivas», «Sin dato»…). */
export const CONTEO_DE_VIDA: Readonly<Record<LivenessState, string>> = {
  VIVA: 'Vivas',
  DEGRADADA: 'Degradadas',
  CAIDA: 'Caídas',
  SIN_DATO: 'Sin dato',
};

export const TIPOS_DE_INSTANCIA: readonly {
  readonly value: InstanceType;
  readonly label: string;
}[] = [
  { value: 'api', label: 'API' },
  { value: 'worker', label: 'Worker' },
  { value: 'database', label: 'Base de datos' },
  { value: 'service', label: 'Servicio' },
];

export function tipoDeInstancia(tipo: string): string {
  return TIPOS_DE_INSTANCIA.find((t) => t.value === tipo)?.label ?? tipo;
}

const CAUSAS: Readonly<Record<string, string>> = {
  HEARTBEAT_LATE: 'Latido tardío',
  HEARTBEAT_EXPIRED: 'Latido vencido',
  NEVER_SEEN: 'Nunca se recibió un latido',
  STORE_UNAVAILABLE: 'No se pudo leer el registro de latidos',
  CLOCK_INCONSISTENT: 'Reloj inconsistente',
  RECORD_CORRUPT: 'Registro ilegible',
  PROBE_FAILED: 'La sonda falló',
  PROBE_TIMEOUT: 'La sonda no contestó a tiempo',
  PROBE_SLOW: 'Responde lento',
  PROBE_UNAVAILABLE: 'No se pudo sondear',
};

/** `null` es «sin causa» (la instancia está viva): no se inventa una. */
export function causaDeVida(causa: string | null): string {
  return causa === null ? '—' : (CAUSAS[causa] ?? causa);
}

/**
 * «hace 8 s», «hace 3 min 34 s», «hace 1 h 5 min». `null` es «nunca»: no hay
 * edad que mostrar, y un 0 pasaría por «recién».
 */
export function antiguedad(segundos: number | null): string {
  if (segundos === null) return 'Nunca';
  if (segundos < 1) return 'ahora mismo';
  if (segundos < 60) return `hace ${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) {
    const resto = segundos % 60;
    return resto === 0 ? `hace ${minutos} min` : `hace ${minutos} min ${resto} s`;
  }
  const horas = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `hace ${horas} h` : `hace ${horas} h ${m} min`;
}

/** Lo más grave primero; a igual estado, las requeridas antes; después, por nombre. */
export function ordenarInstancias(
  instancias: readonly LivenessInstance[],
): readonly LivenessInstance[] {
  const peso = (e: string): number => {
    const i = ESTADOS_DE_VIDA.indexOf(e as LivenessState);
    return i === -1 ? ESTADOS_DE_VIDA.length : i;
  };
  return [...instancias].sort(
    (a, b) =>
      peso(a.state) - peso(b.state) ||
      Number(b.required) - Number(a.required) ||
      a.id.localeCompare(b.id),
  );
}

/* -- Herramientas -------------------------------------------------------- */

const TIPOS_DE_HERRAMIENTA: Readonly<Record<ToolKind, string>> = {
  DATABASE: 'Base de datos',
  CACHE: 'Caché',
  SEARCH: 'Búsqueda',
  STORAGE: 'Almacenamiento',
  MESSAGING: 'Mensajería',
  PAYMENTS: 'Pagos y facturación',
  AI: 'Inteligencia artificial',
  MAPS: 'Mapas',
  ANALYTICS: 'Analítica',
  SECURITY: 'Seguridad',
  OBSERVABILITY: 'Observabilidad',
  OTHER: 'Otra',
};

export function tipoDeHerramienta(tipo: string): string {
  return TIPOS_DE_HERRAMIENTA[tipo as ToolKind] ?? tipo;
}

const REGISTRO: Readonly<Record<ToolStatus, Rotulo>> = {
  ACTIVE: { label: 'Activa', tone: 'primary' },
  PLANNED: { label: 'Planeada', tone: 'secondary' },
  DEPRECATED: { label: 'En retiro', tone: 'warning' },
  DISABLED: { label: 'Apagada', tone: 'secondary' },
};

export function estadoDeRegistro(estado: string): Rotulo {
  return REGISTRO[estado as ToolStatus] ?? { label: estado, tone: 'secondary' };
}

/**
 * La salud, dicha según CÓMO se comprobó. `OK` sólo es «Responde» si hubo una
 * sonda en vivo; con la configuración es «Configurada (no probada)». Una
 * comprobación de configuración que falla es una advertencia, no una caída; y
 * lo que no se sondeó nunca es verde ni rojo.
 */
export function saludDeHerramienta(
  estado: ToolHealthState | string,
  comprobacion: ToolCheckType | string,
): Rotulo {
  if (estado === 'NOT_PROBED' || comprobacion === 'NOT_APPLICABLE')
    return { label: 'Sin sondear', tone: 'secondary' };
  if (comprobacion === 'LIVE') {
    if (estado === 'OK') return { label: 'Responde', tone: 'success' };
    if (estado === 'FAIL') return { label: 'No responde', tone: 'error' };
  }
  if (comprobacion === 'CONFIGURATION') {
    if (estado === 'OK') return { label: 'Configurada (no probada)', tone: 'info' };
    if (estado === 'FAIL') return { label: 'Configuración incompleta', tone: 'warning' };
  }
  return { label: 'Sin sondear', tone: 'secondary' };
}

const COMPROBACION: Readonly<Record<ToolCheckType, string>> = {
  LIVE: 'Sonda en vivo',
  CONFIGURATION: 'Sólo revisa la configuración',
  NOT_APPLICABLE: 'No se comprueba',
};

export function tipoDeComprobacion(tipo: string): string {
  return COMPROBACION[tipo as ToolCheckType] ?? tipo;
}

/** Opciones del filtro de salud: se filtra por lo que se VE, no por el código crudo. */
export const FILTROS_DE_SALUD = [
  { value: 'Responde', label: 'Responde' },
  { value: 'No responde', label: 'No responde' },
  { value: 'Configuración incompleta', label: 'Configuración incompleta' },
  { value: 'Configurada (no probada)', label: 'Configurada (no probada)' },
  { value: 'Sin sondear', label: 'Sin sondear' },
] as const;

/** Críticas primero; después lo más grave; después, por nombre. */
export function ordenarHerramientas(herramientas: readonly OpsTool[]): readonly OpsTool[] {
  const peso = (t: OpsTool): number => {
    switch (saludDeHerramienta(t.health.state, t.health.checkType).label) {
      case 'No responde':
        return 0;
      case 'Configuración incompleta':
        return 1;
      case 'Sin sondear':
        return 2;
      case 'Configurada (no probada)':
        return 3;
      default:
        return 4;
    }
  };
  return [...herramientas].sort(
    (a, b) =>
      Number(b.isCritical) - Number(a.isCritical) ||
      peso(a) - peso(b) ||
      a.name.localeCompare(b.name),
  );
}

/** El conteo de las herramientas críticas, honesto sobre lo que no se sondeó. */
export interface ResumenCriticas {
  readonly total: number;
  /** Con sonda en vivo que falló. */
  readonly noResponden: number;
  /** Con sonda en vivo que respondió. */
  readonly responden: number;
  /** Sólo se revisó la configuración, y está completa: no prueba que funcione. */
  readonly soloConfiguradas: number;
  /** Faltan variables. */
  readonly configuracionIncompleta: number;
  /** Nadie las sondeó. */
  readonly sinSondear: number;
}

export function resumirCriticas(items: readonly OpsTool[]): ResumenCriticas {
  const criticas = items.filter((t) => t.isCritical);
  const por = (etiqueta: string): number =>
    criticas.filter(
      (t) => saludDeHerramienta(t.health.state, t.health.checkType).label === etiqueta,
    ).length;
  return {
    total: criticas.length,
    noResponden: por('No responde'),
    responden: por('Responde'),
    soloConfiguradas: por('Configurada (no probada)'),
    configuracionIncompleta: por('Configuración incompleta'),
    sinSondear: por('Sin sondear'),
  };
}

/* -- Dispositivos -------------------------------------------------------- */

/** `UNSPECIFIED` es un contexto que no informó la dimensión: se dice, no se oculta. */
export function etiquetaDeDispositivo(item: DeviceBreakdownItem): string {
  return item.code === 'UNSPECIFIED' ? 'Sin informar' : item.label;
}
