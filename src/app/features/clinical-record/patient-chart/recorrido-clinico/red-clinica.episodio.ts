/* ============================================================================
    One clinical episode: its shape and how it is assembled from its members.
    ========================================================================== */

import type { Tone } from '../../../../shared/components/tone/tone.types';
import type { CertezaDiagnostica, ClaseDeLaRed, RegistroDeLaRed } from './red-clinica.model';

export const ID_SIN_DIAGNOSTICO = 'episodio:sin-diagnostico';

/** A milestone of the summary strip: what shows with the episode collapsed. */
export interface HitoDelEpisodio {
  readonly id: string;
  readonly clase: ClaseDeLaRed;
  readonly cuando: Date | null;
  readonly titulo: string;
  /** Which kind of milestone: decides the marker's shape. */
  readonly tipo: 'presuntivo' | 'confirmado' | 'descartado' | 'historico' | 'derivacion' | 'internacion' | 'procedimiento' | 'momento';
}

export interface EpisodioClinico {
  readonly id: string;
  readonly clase: 'problema' | 'sin-diagnostico';
  readonly nombre: string;
  readonly estado: string;
  readonly tonoDelEstado?: Tone;
  /** The chain's diagnoses, in chronological order. */
  readonly diagnosticos: readonly string[];
  /** The records drawn in this episode. */
  readonly miembros: readonly string[];
  /**
   * Those drawn in another episode that also belong to this one —a shared
   * encounter—: the summary counts them and the network joins them.
   */
  readonly compartidos: readonly string[];
  readonly desde: Date | null;
  readonly hasta: Date | null;
  readonly conteos: Readonly<Partial<Record<ClaseDeLaRed, number>>>;
  readonly descartados: number;
  readonly hitos: readonly HitoDelEpisodio[];
}

export interface RedPorEpisodios {
  readonly episodios: readonly EpisodioClinico[];
  /** The episode where each record is drawn. */
  readonly episodioDe: ReadonlyMap<string, string>;
  /** Every episode each record belongs to (its own first). */
  readonly pertenencias: ReadonlyMap<string, readonly string[]>;
}

export function antes(a: RegistroDeLaRed, b: RegistroDeLaRed): boolean {
  const ta = a.cuando?.getTime() ?? Number.POSITIVE_INFINITY;
  const tb = b.cuando?.getTime() ?? Number.POSITIVE_INFINITY;
  return ta < tb || (ta === tb && a.id < b.id);
}

const ESTADO_DE_LA_CERTEZA: Readonly<Record<CertezaDiagnostica, { estado: string; tono: Tone }>> = {
  presuntivo: { estado: 'En estudio', tono: 'warning' },
  confirmado: { estado: 'Confirmado', tono: 'success' },
  descartado: { estado: 'Descartado', tono: 'error' },
  historico: { estado: 'Histórico', tono: 'secondary' },
};

export function armarEpisodio(
  id: string,
  registros: readonly RegistroDeLaRed[],
  porId: ReadonlyMap<string, RegistroDeLaRed>,
  episodioDe: ReadonlyMap<string, string>,
  pertenencias: ReadonlyMap<string, readonly string[]>,
  raiz: (id: string) => string,
): EpisodioClinico {
  const miembros = registros.filter((r) => episodioDe.get(r.id) === id);
  const compartidos = registros.filter(
    (r) => episodioDe.get(r.id) !== id && (pertenencias.get(r.id) ?? []).includes(id),
  );
  const cadena = registros
    .filter((r) => r.clase === 'diagnostico' && id === `episodio:${raiz(r.id)}`)
    .sort((a, b) => (antes(a, b) ? -1 : 1));
  const fechas = [...miembros, ...compartidos]
    .map((r) => r.cuando)
    .filter((f): f is Date => f !== null)
    .map((f) => f.getTime());
  const conteos: Partial<Record<ClaseDeLaRed, number>> = {};
  for (const r of [...miembros, ...compartidos]) {
    conteos[r.clase] = (conteos[r.clase] ?? 0) + 1;
  }
  const hitos: HitoDelEpisodio[] = [];
  for (const r of [...miembros, ...compartidos]) {
    const tipo: HitoDelEpisodio['tipo'] | null =
      r.clase === 'diagnostico'
        ? (r.certeza ?? 'confirmado')
        : r.clase === 'derivacion' || r.clase === 'internacion' || r.clase === 'procedimiento'
          ? r.clase
          : r.clase === 'atencion' || r.clase === 'cita'
            ? 'momento'
            : null;
    if (tipo !== null) {
      hitos.push({ id: r.id, clase: r.clase, cuando: r.cuando, titulo: r.titulo, tipo });
    }
  }
  hitos.sort((a, b) => (a.cuando?.getTime() ?? Infinity) - (b.cuando?.getTime() ?? Infinity));

  if (id === ID_SIN_DIAGNOSTICO) {
    return {
      id,
      clase: 'sin-diagnostico',
      nombre: 'Atenciones sin diagnóstico asociado',
      estado: '',
      diagnosticos: [],
      miembros: miembros.map((r) => r.id),
      compartidos: compartidos.map((r) => r.id),
      desde: fechas.length === 0 ? null : new Date(Math.min(...fechas)),
      hasta: fechas.length === 0 ? null : new Date(Math.max(...fechas)),
      conteos,
      descartados: 0,
      hitos,
    };
  }
  // The name: the most recent standing diagnosis; if all were ruled out, the
  // last ruled-out one, and the status says so.
  const vigentes = cadena.filter((d) => d.certeza !== 'descartado');
  const cabeza = (vigentes.length > 0 ? vigentes : cadena).at(-1) ?? porId.get(id.slice('episodio:'.length));
  const certeza = cabeza?.certeza ?? 'confirmado';
  return {
    id,
    clase: 'problema',
    nombre: cabeza?.titulo ?? 'Problema clínico',
    estado: cabeza?.estado || ESTADO_DE_LA_CERTEZA[certeza].estado,
    tonoDelEstado: cabeza?.tonoDelEstado ?? ESTADO_DE_LA_CERTEZA[certeza].tono,
    diagnosticos: cadena.map((d) => d.id),
    miembros: miembros.map((r) => r.id),
    compartidos: compartidos.map((r) => r.id),
    desde: fechas.length === 0 ? null : new Date(Math.min(...fechas)),
    hasta: fechas.length === 0 ? null : new Date(Math.max(...fechas)),
    conteos,
    descartados: cadena.filter((d) => d.certeza === 'descartado').length,
    hitos,
  };
}
