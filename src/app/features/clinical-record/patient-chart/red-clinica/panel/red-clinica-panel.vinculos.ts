import { type NodoDeRed } from '../red-clinica.types';
import { LECTURA_DE_VINCULO, type AristaDeRed, type TipoDeVinculo } from '../red-clinica-vinculos.types';

/** A link of the open node, already read from its end. */
export interface VinculoDelPanel {
  readonly clave: string;
  readonly sentido: 'saliente' | 'entrante';
  readonly tipo: TipoDeVinculo;
  /** «Se pidió para estudiar», «Estudio pedido para esto». */
  readonly relacion: string;
  readonly otroId: string;
  /** `null` if the other end is not in `nodos` (filtered or beyond the cap). */
  readonly otro: NodoDeRed | null;
  readonly inferido: boolean;
}

export const ORIGEN: ReadonlySet<string> = new Set([
  'saliente:reconsulta-de',
  'entrante:recibida-en',
  'entrante:atendida-en',
]);
export const SIGUIENTES: ReadonlySet<string> = new Set([
  'entrante:reconsulta-de',
  'entrante:derivada-desde',
  'saliente:atendida-en',
]);

/** Reads a node's links: outgoing first, each group in date order. */
export function vinculosDe(
  nodoId: string,
  aristas: readonly AristaDeRed[],
  nodos: readonly NodoDeRed[],
): readonly VinculoDelPanel[] {
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const vinculos: VinculoDelPanel[] = [];
  aristas.forEach((a, i) => {
    if (a.desde === nodoId && a.hasta !== nodoId) {
      vinculos.push({
        clave: `s${i}`,
        sentido: 'saliente',
        tipo: a.tipo,
        relacion: LECTURA_DE_VINCULO[a.tipo].saliente,
        otroId: a.hasta,
        otro: porId.get(a.hasta) ?? null,
        inferido: a.inferido === true,
      });
    } else if (a.hasta === nodoId && a.desde !== nodoId) {
      vinculos.push({
        clave: `e${i}`,
        sentido: 'entrante',
        tipo: a.tipo,
        relacion: LECTURA_DE_VINCULO[a.tipo].entrante,
        otroId: a.desde,
        otro: porId.get(a.desde) ?? null,
        inferido: a.inferido === true,
      });
    }
  });
  const t = (v: VinculoDelPanel) => v.otro?.cuando?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return vinculos.sort(
    (a, b) => (a.sentido === b.sentido ? 0 : a.sentido === 'saliente' ? -1 : 1) || t(a) - t(b),
  );
}

/** A concrete next step the panel can take itself: open another node. */
export interface AccionDelPanel {
  readonly nodoId: string;
  readonly etiqueta: string;
}

/**
 * S3's next action for a study without a released result (ADR-0005): open
 * what it was ordered for, or else the encounter where it was ordered. `null`
 * when neither is in view.
 */
export function accionDelPedido(vinculos: readonly VinculoDelPanel[]): AccionDelPanel | null {
  const de = (tipo: TipoDeVinculo) => vinculos.find((v) => v.sentido === 'saliente' && v.tipo === tipo && v.otro !== null);
  const motivo = de('pedido-para');
  if (motivo) return { nodoId: motivo.otroId, etiqueta: 'Ver el diagnóstico por el que se pidió' };
  const atencion = de('registrado-en');
  return atencion ? { nodoId: atencion.otroId, etiqueta: 'Ver la atención donde se pidió' } : null;
}
