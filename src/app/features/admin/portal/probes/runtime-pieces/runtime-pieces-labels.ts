import { HttpErrorResponse } from '@angular/common/http';

import type {
  DiscoveryReport,
  EvidenceLevel,
  FindingRule,
  FindingSeverity,
  HeartbeatMode,
  PieceCause,
  PieceKind,
  PieceSchedule,
  PieceState,
  RuntimePiecesQuery,
} from '../../../../../core/data-access/admin-portal/runtime-pieces.types';
import {
  PIECE_KINDS,
  PIECE_STATES,
} from '../../../../../core/data-access/admin-portal/runtime-pieces.types';
import { CAUSAS, type Chip } from '../../../instances/instances-labels';

/* ============================================================================
    Cómo se dice en pantalla cada valor del contrato de las piezas en ejecución.
    Funciones puras, sin Angular: la pantalla las usa y las pruebas las ejercitan
    directo. Un estado nunca se comunica sólo con color: cada chip lleva su
    texto (regla 95.4.6).
    ========================================================================== */

export const ESTADOS_DE_PIEZA: Readonly<Record<PieceState, Chip & { readonly ayuda: string }>> = {
  VIVA: {
    texto: 'Viva',
    tono: 'success',
    ayuda: 'Hay un latido reciente del proceso en que corre.',
  },
  SIN_LATIDO: {
    texto: 'Sin latido',
    tono: 'error',
    ayuda: 'Está declarada y registrada, pero no se la oye.',
  },
  NO_REGISTRADA: {
    texto: 'No registrada',
    tono: 'warning',
    ayuda: 'Existe en el código y falta en el registro de herramientas.',
  },
  HUERFANA: {
    texto: 'Huérfana',
    tono: 'warning',
    ayuda: 'Está en el registro, pero ya no existe en el código.',
  },
  DESHABILITADA: {
    texto: 'Deshabilitada',
    tono: 'secondary',
    ayuda: 'Está apagada por el registro o por configuración.',
  },
  NO_MEDIBLE: {
    texto: 'No medible',
    tono: 'info',
    ayuda: 'Esta clase de pieza no tiene latido: que exista no prueba que corra.',
  },
};

export const TIPOS_DE_PIEZA: Readonly<Record<PieceKind, string>> = {
  PROCESO: 'Proceso',
  JOB_PROGRAMADO: 'Tarea programada',
  TEMPORIZADOR: 'Temporizador',
  CONSUMIDOR_COLA: 'Consumidor de cola',
  JOB_NOMBRADO: 'Job con nombre',
  ENDPOINT_INTERNO: 'Endpoint interno',
  SALUD: 'Comprobación de salud',
  CONECTOR: 'Conector externo',
};

export const NIVELES_DE_EVIDENCIA: Readonly<Record<EvidenceLevel, string>> = {
  PROPIO: 'Latido propio',
  ANFITRION: 'Sólo se ve su proceso anfitrión',
  NINGUNO: 'Sin prueba de vida',
};

/** Las causas que añaden las piezas; las de la sonda de vida se reutilizan tal cual. */
const CAUSAS_DE_PIEZA: Readonly<Record<string, string>> = {
  SELF: 'Es la propia API la que responde esta consulta.',
  HOST_ALIVE: 'Vive en un proceso que late; no se ve el tick de esta pieza por separado.',
  NOT_IN_REGISTRY: 'Existe en el código y no está en el registro de herramientas.',
  NOT_IN_CODE: 'Está en el registro de herramientas y ya no existe en el código.',
  REGISTRY_DISABLED: 'El registro de herramientas la marca como deshabilitada.',
  CONFIG_FLAG_OFF: 'Un interruptor de configuración la apaga.',
  NO_HEARTBEAT_MECHANISM: 'Esta clase de pieza no tiene mecanismo de latido.',
  HOST_UNRESOLVED: 'No se pudo saber en qué proceso corre.',
  CODE_UNAVAILABLE: 'Este despliegue no trae el código fuente.',
};

export function causaDePieza(causa: PieceCause): string {
  return CAUSAS_DE_PIEZA[causa] ?? (CAUSAS as Readonly<Record<string, string>>)[causa] ?? causa;
}

export const MODOS_DE_LATIDO: Readonly<Record<HeartbeatMode, string>> = {
  PROCESS: 'Latido propio',
  SELF: 'La propia API',
  INHERITED: 'Hereda el del proceso',
  NONE: 'Sin latido',
};

export function textoDeLatido(modo: HeartbeatMode, instancia: string | null): string {
  return instancia === null ? MODOS_DE_LATIDO[modo] : `${MODOS_DE_LATIDO[modo]} (${instancia})`;
}

/** «cada 5 s», «cada 1 h», «cron 0 * * * *»; lo que no se resolvió, tal cual está en el código. */
export function textoDeCadencia(schedule: PieceSchedule | null): string {
  if (schedule === null) return 'Sin cadencia propia';
  if (schedule.type === 'cron') {
    return schedule.cron === null
      ? `cron sin resolver («${schedule.raw}»)`
      : `cron ${schedule.cron}`;
  }
  const ms = schedule.intervalMs;
  if (ms === null) return `no resuelta («${schedule.raw}»)`;
  const prefijo = schedule.type === 'timeout' ? 'una vez a los' : 'cada';
  if (ms < 1000) return `${prefijo} ${ms} ms`;
  if (ms < 60_000) return `${prefijo} ${redondear(ms / 1000)} s`;
  if (ms < 3_600_000) return `${prefijo} ${redondear(ms / 60_000)} min`;
  return `${prefijo} ${redondear(ms / 3_600_000)} h`;
}

const redondear = (n: number): string => String(Number.isInteger(n) ? n : Math.round(n * 10) / 10);

export const GRAVEDADES: Readonly<Record<FindingSeverity, Chip>> = {
  ALTA: { texto: 'Alta', tono: 'error' },
  MEDIA: { texto: 'Media', tono: 'warning' },
  BAJA: { texto: 'Baja', tono: 'info' },
  INFO: { texto: 'Informativa', tono: 'secondary' },
};

export const REGLAS_DE_HALLAZGO: Readonly<Record<FindingRule, string>> = {
  NO_REGISTRADA: 'Existe en el código y no está registrada',
  HUERFANA: 'Registrada, pero ya no existe en el código',
  NO_CABLEADA: 'Declarada y nadie la registra',
  SIN_LATIDO_REQUERIDA: 'Proceso requerido sin latido',
  SIN_LATIDO: 'Proceso sin latido (no requerido)',
  FUERA_DE_SONDA: 'Fuera del registro de la sonda de vida',
  NO_DESPLEGADA: 'Sin servicio en ningún compose',
  HUELLA_DESACTUALIZADA: 'El registro quedó atrás del código',
  JOB_SIN_CONSUMIDOR: 'Job que nadie consume',
  SIN_PROCEDENCIA: 'Fila sin procedencia',
  CODIGO_NO_DISPONIBLE: 'Código fuente no disponible',
};

/** De una frase `CLAVE: texto` del servidor, sólo el texto. */
export function textoDeNoMedido(frase: string): string {
  const corte = frase.indexOf(': ');
  return corte > 0 && /^[A-Z_]+$/.test(frase.slice(0, corte)) ? frase.slice(corte + 2) : frase;
}

/* ---------------------------------------------------------------- la URL -- */

export const PESTANAS = ['piezas', 'instancias', 'hallazgos'] as const;
export type Pestana = (typeof PESTANAS)[number];

export const CLAVES_URL = ['vista', 'state', 'kind', 'host', 'q', 'withFindings', 'page'] as const;
export type ValoresUrl = Readonly<Record<(typeof CLAVES_URL)[number], string>>;

/** Los filtros que «Quitar filtros» limpia; la pestaña y la página no son filtros. */
export const CLAVES_DE_FILTRO = ['state', 'kind', 'host', 'q', 'withFindings'] as const;

export const TAMANO_DE_PAGINA = 10;
const MAXIMO_DE_TEXTO = 100;

export function pestanaDe(valores: Pick<ValoresUrl, 'vista'>): Pestana {
  return (PESTANAS as readonly string[]).includes(valores.vista)
    ? (valores.vista as Pestana)
    : 'piezas';
}

export function paginaDe(valores: Pick<ValoresUrl, 'page'>): number {
  const n = Number(valores.page);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Lo que la API rechazaría con 400 se descarta aquí en vez de mandarse. */
export function consultaDe(valores: ValoresUrl): RuntimePiecesQuery {
  const q = valores.q.trim();
  const host = valores.host.trim();
  return {
    page: paginaDe(valores),
    pageSize: TAMANO_DE_PAGINA,
    ...((PIECE_STATES as readonly string[]).includes(valores.state)
      ? { state: valores.state as PieceState }
      : {}),
    ...((PIECE_KINDS as readonly string[]).includes(valores.kind)
      ? { kind: valores.kind as PieceKind }
      : {}),
    ...(host !== '' && host.length <= MAXIMO_DE_TEXTO ? { host } : {}),
    ...(q !== '' && q.length <= MAXIMO_DE_TEXTO ? { q } : {}),
    ...(valores.withFindings === 'true' ? { withFindings: true } : {}),
  };
}

export function hayFiltros(valores: ValoresUrl): boolean {
  return CLAVES_DE_FILTRO.some((clave) => valores[clave] !== '');
}

/* -------------------------------------------------------- el descubrimiento -- */

const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;

/** El resultado de descubrir, en una frase que dice qué pasó y qué no. */
export function textoDeInforme(r: DiscoveryReport): string {
  const efecto = r.dryRun
    ? `Simulación, no se escribió nada: se registrarían ${plural(r.created, 'pieza', 'piezas')} y se actualizarían ${r.updated}`
    : `Se registraron ${plural(r.created, 'pieza', 'piezas')} y se actualizaron ${r.updated}`;
  const partes = [
    `${efecto}. ${r.unchanged} ya estaban al día (de ${r.scanned} encontradas en el código).`,
  ];
  if (r.created === 0 && r.updated === 0) {
    partes.push('Repetirlo sin cambios en el código no modifica nada.');
  }
  if (r.orphans > 0) {
    partes.push(
      `${plural(r.orphans, 'pieza registrada ya no existe', 'piezas registradas ya no existen')} en el código: se informan, no se borran.`,
    );
  }
  if (r.conflicts > 0) {
    partes.push(
      `${plural(r.conflicts, 'fila escrita a mano no se tocó', 'filas escritas a mano no se tocaron')}.`,
    );
  }
  return partes.join(' ');
}

/** Por qué falló descubrir, para quien lo pidió. Nunca el cuerpo crudo del servidor. */
export function fallaDeDescubrimiento(error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : null;
  const reason =
    error instanceof HttpErrorResponse
      ? (error.error as { reason?: unknown } | null)?.reason
      : undefined;
  if (status === 403) return 'Su rol puede ver las piezas, pero no registrarlas.';
  if (status === 409 && reason === 'RUNTIME_PIECES_SOURCE_UNAVAILABLE') {
    return 'Este despliegue no trae el código fuente, así que no hay nada que descubrir aquí. Ejecútelo donde esté el código.';
  }
  if (status === 422 && reason === 'RUNTIME_PIECES_CONCEPTS_MISSING') {
    return 'Faltan conceptos del catálogo para registrar las piezas. Quien opera la API debe ejecutar el seed de terminología.';
  }
  if (status === 0) return 'No se pudo llegar a la API. Revise la conexión e intente de nuevo.';
  return 'No se pudo completar el descubrimiento. Actualice la lista para ver el estado real e intente de nuevo; si persiste, avise a quien opera la API.';
}
