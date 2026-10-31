import type { TablaOperacion } from '../../../../core/data-access/admin-portal/portal.types';

/** Un acceso concreto de la operación a una tabla: dónde está y por qué camino se llega. */
export interface TableAccess {
  readonly operacion: string;
  readonly detalle: string;
  readonly confianza: string;
  /** Cadena de llamadas: controlador → servicio → repositorio. */
  readonly via: readonly string[];
  /** `archivo:línea` del acceso. */
  readonly fuente: string;
}

/** Una tabla con los accesos de la operación que caen en el grupo en que se la pinta. */
export interface AffectedTable {
  readonly clave: string;
  readonly schema: string;
  readonly tabla: string;
  readonly catalogada: boolean;
  readonly accesos: readonly TableAccess[];
}

export interface TablesSummary {
  /** Tablas distintas, cuente las veces que la operación las toque. */
  readonly distintas: number;
  readonly escribe: number;
  readonly lee: number;
  /** Tablas que la operación lee y no escribe. */
  readonly soloLee: number;
  /** Tablas que la operación lee y también escribe. */
  readonly leeYEscribe: number;
  /** De las que escribe, las que borra. */
  readonly borra: number;
  /** Filas de `datos[]`: lo que hoy cuenta el número «tablas» de la lista de operaciones. */
  readonly accesos: number;
}

export interface TableGroups {
  readonly escribe: readonly AffectedTable[];
  readonly lee: readonly AffectedTable[];
  /** Accesos con un verbo que este front no conoce: se muestran, no se descartan. */
  readonly otros: readonly AffectedTable[];
  readonly resumen: TablesSummary;
}

const ESCRIBE = new Set(['ESCRIBE', 'BORRA']);

function push(groups: Map<string, AffectedTable>, row: TablaOperacion): void {
  const clave = `${row.schema}.${row.tabla}`;
  const access: TableAccess = {
    operacion: row.operacion,
    detalle: row.detalle,
    confianza: row.confianza,
    via: row.via,
    fuente: row.fuente,
  };
  const current = groups.get(clave);
  groups.set(clave, {
    clave,
    schema: row.schema,
    tabla: row.tabla,
    catalogada: current ? current.catalogada && row.catalogada : row.catalogada,
    accesos: current ? [...current.accesos, access] : [access],
  });
}

/**
 * Reparte lo que la API devuelve en `datos[]` —una fila por (tabla, acceso)—
 * en «escribe», «lee» y «otros», una entrada por tabla. La misma tabla puede
 * estar en «escribe» y en «lee» (un `INSERT` precedido de un `SELECT`); cada
 * grupo trae sólo los accesos que le corresponden. No se interpreta nada: el
 * verbo, la confianza, la cadena y la fuente son los de la API.
 */
export function groupTables(rows: readonly TablaOperacion[]): TableGroups {
  const escribe = new Map<string, AffectedTable>();
  const lee = new Map<string, AffectedTable>();
  const otros = new Map<string, AffectedTable>();
  const borra = new Set<string>();
  for (const row of rows) {
    if (row.operacion === 'BORRA') borra.add(`${row.schema}.${row.tabla}`);
    push(ESCRIBE.has(row.operacion) ? escribe : row.operacion === 'LEE' ? lee : otros, row);
  }
  const distintas = new Set(rows.map((r) => `${r.schema}.${r.tabla}`));
  const leeYEscribe = [...lee.keys()].filter((k) => escribe.has(k)).length;
  return {
    escribe: [...escribe.values()],
    lee: [...lee.values()],
    otros: [...otros.values()],
    resumen: {
      distintas: distintas.size,
      escribe: escribe.size,
      lee: lee.size,
      soloLee: lee.size - leeYEscribe,
      leeYEscribe,
      borra: borra.size,
      accesos: rows.length,
    },
  };
}

/** «3 tablas» / «1 tabla» / «ninguna». */
export function tablesPhrase(count: number): string {
  return count === 0 ? 'ninguna' : count === 1 ? '1 tabla' : `${count} tablas`;
}
