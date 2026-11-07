/* ============================================================================
    What the clinical network says in words: the episode summaries, the
    accessible name of every node and the dates shown on a card. Pure
    functions, so the component only wires them to its signals.
    ========================================================================== */

import { ASPECTO_DE_LA_CLASE, type ClaseDeLaRed } from './red-clinica.model';
import type { EpisodioClinico } from './red-clinica.episodio';
import type { ColumnaDeLaRed, HiloDeLaRed, NodoDeLaRed, PlanoDeLaRed } from './red-clinica.geometria.types';

/** A record's own date when it is not its column's. */
export interface FechaPropia {
  readonly rotulo: string;
  readonly fecha: Date;
  readonly formato: string;
}

const fechaLarga = (f: Date): string => f.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

/** The summary counts, in short words. */
export function conteosDe(episodio: EpisodioClinico): readonly string[] {
  const orden: readonly [ClaseDeLaRed, string, string][] = [
    ['atencion', 'atención', 'atenciones'],
    ['cita', 'cita', 'citas'],
    ['estudio', 'estudio', 'estudios'],
    ['medicacion', 'receta', 'recetas'],
    ['derivacion', 'derivación', 'derivaciones'],
    ['internacion', 'internación', 'internaciones'],
    ['procedimiento', 'procedimiento', 'procedimientos'],
  ];
  return orden
    .filter(([clase]) => (episodio.conteos[clase] ?? 0) > 0)
    .map(([clase, uno, varios]) => {
      const n = episodio.conteos[clase] ?? 0;
      return `${n} ${n === 1 ? uno : varios}`;
    });
}

/** The accessible name of an episode's button: the whole summary. */
export function nombreDelEpisodio(hilo: HiloDeLaRed): string {
  const e = hilo.episodio;
  const fecha = (f: Date | null): string => (f === null ? '' : fechaLarga(f));
  const rango = e.desde === null ? '' : e.hasta === null || e.hasta.getTime() === e.desde.getTime() ? `el ${fecha(e.desde)}` : `del ${fecha(e.desde)} al ${fecha(e.hasta)}`;
  const partes = [
    `Episodio: ${e.nombre}`,
    e.estado,
    rango,
    conteosDe(e).join(', '),
    e.descartados > 0 ? `${e.descartados} diagnóstico${e.descartados === 1 ? '' : 's'} descartado${e.descartados === 1 ? '' : 's'}` : '',
    e.compartidos.length > 0 ? `${e.compartidos.length} registro${e.compartidos.length === 1 ? '' : 's'} compartido${e.compartidos.length === 1 ? '' : 's'} con otro episodio` : '',
  ];
  return partes.filter((p) => p !== '').join('. ');
}

/** The accessible name of each node: class, record, status, date and links. */
export function nombresDeLosNodos(
  plano: PlanoDeLaRed,
  relaciones: ReadonlyMap<string, readonly string[]>,
  compartidoCon: (nodo: NodoDeLaRed) => readonly string[],
  resaltado: (id: string) => boolean,
): ReadonlyMap<string, string> {
  const nombres = new Map<string, string>();
  for (const nodo of plano.nodos) {
    if (nodo.forma === 'grupo' && nodo.grupo !== undefined) {
      nombres.set(
        nodo.id,
        nodo.grupo.accion === 'expandir'
          ? `Mostrar ${nodo.grupo.ocultos.length} registros de detalle: ${nodo.grupo.ocultos.map((r) => r.titulo).join(', ')}`
          : 'Agrupar el detalle',
      );
      continue;
    }
    const r = nodo.registro!;
    if (nodo.forma === 'descartado') {
      nombres.set(nodo.id, `Diagnóstico descartado: ${r.titulo}. Mostrar`);
      continue;
    }
    if (nodo.forma === 'plegar') {
      nombres.set(nodo.id, `Ocultar el diagnóstico descartado ${r.titulo}`);
      continue;
    }
    const otros = compartidoCon(nodo);
    const partes = [
      `${ASPECTO_DE_LA_CLASE[r.clase].singular}: ${r.titulo}`,
      r.detalle,
      r.estado,
      r.cuando === null ? '' : `fecha ${fechaLarga(r.cuando)}`,
      ...(relaciones.get(r.id) ?? []),
      otros.length > 0 ? `también en el episodio ${otros.join(' y ')}` : '',
      resaltado(r.id) ? 'resaltado' : '',
    ];
    nombres.set(nodo.id, partes.filter((p) => p !== '').join('. '));
  }
  return nombres;
}

/** What the column is, in words: the visible header. */
export function contextoDe(columna: ColumnaDeLaRed): string {
  return columna.contexto === 'atencion' ? 'Atención' : columna.contexto === 'dia' ? 'Registros del día' : 'Sin atención';
}

/** The record's own date when it is not its column's (`angosto`: the phone always shows the year). */
export function fechaPropia(nodo: NodoDeLaRed, columna: ColumnaDeLaRed | undefined, angosto: boolean): FechaPropia | null {
  const r = nodo.registro;
  if (nodo.forma !== 'tarjeta' || r === undefined || r.cuando === null || columna === undefined || columna.fecha === null) return null;
  if (r.cuando.toDateString() === columna.fecha.toDateString()) return null;
  const rotulo = r.clase === 'diagnostico' ? 'Inicio' : r.clase === 'medicacion' ? 'Desde' : 'Del';
  const dias = Math.abs(r.cuando.getTime() - columna.fecha.getTime()) / 86_400_000;
  const formato = angosto
    ? 'd MMM y'
    : r.cuando.getFullYear() === columna.fecha.getFullYear()
      ? 'd MMM'
      : dias < 90
        ? 'd MMM y'
        : 'MMM y';
  return { rotulo, fecha: r.cuando, formato };
}
