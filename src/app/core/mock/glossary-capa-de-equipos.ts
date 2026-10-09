import { CATEGORIA_EQUIPOS, filasDeEquipos, SLUGS_EXTERNOS } from './fixtures/glosario-equipos';
import {
  normalizar,
  type AlmacenDeGlosario,
  type FilaDeGlosario,
  type ManifiestoDelGlosario,
  type PedidoDePagina,
  type RefDeFila,
  type RelacionEntrante,
} from './glossary-shards';

/* ============================================================================
    El glosario de los shards más la capa de equipos de la maqueta.

    Envuelve al almacén en vez de heredarlo: el almacén se lee su propio
    manifiesto por dentro (para el total de una categoría, para el tamaño de
    página), y un manifiesto inflado con las filas de la capa lo haría buscar
    en los shards filas que no están ahí.

    Las filas de la capa van **primero** en cada lista en la que entran (su
    categoría, «todos», una búsqueda que las encuentra): son pocas, y así la
    paginación se resuelve corriendo el desplazamiento del almacén.
    ========================================================================== */

/** Lo que los handlers de terminología le piden al glosario. */
export type FuenteDeGlosario = Pick<
  AlmacenDeGlosario,
  'manifiesto' | 'origen' | 'filas' | 'porId' | 'pagina' | 'entrantes' | 'categoriaDe' | 'articulo'
>;

export class AlmacenConCapasDeLaMaqueta implements FuenteDeGlosario {
  private extras: Promise<readonly FilaDeGlosario[]> | null = null;

  constructor(private readonly base: AlmacenDeGlosario) {}

  origen(): Promise<string> {
    return this.base.origen();
  }

  filas(refs: readonly RefDeFila[]): Promise<FilaDeGlosario[]> {
    return this.base.filas(refs);
  }

  async manifiesto(): Promise<ManifiestoDelGlosario> {
    const [base, extras] = await Promise.all([this.base.manifiesto(), this.capa()]);
    const enImagen = extras.filter((f) => f.categoryKey === 'imaging').length;
    const enEquipos = extras.filter((f) => f.categoryKey === CATEGORIA_EQUIPOS.key).length;
    const categorias = base.categories.map((c) => (c.key === 'imaging' ? { ...c, count: c.count + enImagen, translatedCount: (c.translatedCount ?? c.count) + enImagen } : c));
    const otros = categorias.findIndex((c) => c.key === 'other');
    const equipos = {
      key: CATEGORIA_EQUIPOS.key,
      internalCode: CATEGORIA_EQUIPOS.internalCode,
      name: CATEGORIA_EQUIPOS.name,
      description: CATEGORIA_EQUIPOS.description,
      count: enEquipos,
      translatedCount: enEquipos,
      pages: 1,
      tags: {},
    };
    if (otros >= 0) categorias.splice(otros, 0, equipos);
    else categorias.push(equipos);
    return {
      ...base,
      total: base.total + extras.length,
      ...(base.translatedTotal === undefined ? {} : { translatedTotal: base.translatedTotal + extras.length }),
      categories: categorias,
    };
  }

  async porId(id: string): Promise<FilaDeGlosario | null> {
    const propia = (await this.capa()).find((f) => f.id === id);
    return propia ?? this.base.porId(id);
  }

  /** Las entrantes de los shards más las que salen de las filas de la capa. */
  async entrantes(id: string): Promise<readonly RelacionEntrante[]> {
    const [base, capa] = await Promise.all([this.base.entrantes(id), this.capa()]);
    const propias = capa.flatMap((fila) =>
      fila.relations
        .filter((relacion) => relacion.targetId === id)
        .map(
          (relacion): RelacionEntrante => [fila.id, relacion.type, fila.slug, fila.esName, fila.categoryKey],
        ),
    );
    return [...base, ...propias];
  }

  /** Los equipos de la capa no tienen artículo: sólo los términos de los shards. */
  articulo(id: string) {
    return this.base.articulo(id);
  }

  async categoriaDe(id: string): Promise<string | null> {
    const propia = (await this.capa()).find((f) => f.id === id);
    return propia?.categoryKey ?? this.base.categoriaDe(id);
  }

  async pagina(pedido: PedidoDePagina): Promise<{ filas: FilaDeGlosario[]; total: number }> {
    const propias = (await this.capa()).filter((f) => coincide(f, pedido));
    const k = propias.length;
    if (k === 0) return this.base.pagina(pedido);
    if (pedido.offset >= k) {
      const resto = await this.base.pagina({ ...pedido, offset: pedido.offset - k });
      return { filas: resto.filas, total: resto.total + k };
    }
    const delanteras = propias.slice(pedido.offset, pedido.offset + pedido.limit);
    const faltan = pedido.limit - delanteras.length;
    const resto = await this.base.pagina({ ...pedido, offset: 0, limit: Math.max(faltan, 1) });
    return { filas: [...delanteras, ...(faltan > 0 ? resto.filas.slice(0, faltan) : [])], total: resto.total + k };
  }

  /** Las filas de la capa, con las relaciones a los estudios curados ya resueltas. */
  private capa(): Promise<readonly FilaDeGlosario[]> {
    this.extras ??= (async () => {
      const externos = new Map<string, { id: string; name: string }>();
      try {
        const { filas } = await this.base.pagina({ categoryKey: 'imaging', offset: 0, limit: 100 });
        for (const f of filas) if (SLUGS_EXTERNOS.includes(f.slug)) externos.set(f.slug, { id: f.id, name: f.esName });
      } catch {
        // Sin glosario base no hay a quién enlazar: la capa queda sola.
      }
      return filasDeEquipos(externos);
    })();
    return this.extras;
  }
}

function coincide(fila: FilaDeGlosario, pedido: PedidoDePagina): boolean {
  if (pedido.categoryKey !== undefined && fila.categoryKey !== pedido.categoryKey) return false;
  if (pedido.tagKey !== undefined) return false;
  const consulta = normalizar(pedido.query ?? '').trim();
  if (consulta === '') return true;
  const texto = normalizar([fila.esName, ...(fila.esSynonyms ?? [])].join(' '));
  const suyas = texto.split(/\s+/);
  return consulta.split(/\s+/).every((buscada) => suyas.some((suya) => suya.startsWith(buscada)));
}
