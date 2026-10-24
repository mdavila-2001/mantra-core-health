import { ArchivoAusente, type LectorDeArchivos } from '../data-access/glossary/glossary-shards.reader';
export { ArchivoAusente, leerConFetch, type LectorDeArchivos } from '../data-access/glossary/glossary-shards.reader';
import { uuid } from './mock-store';

/* ============================================================================
    El glosario del simulador, **bajo demanda**.

    Hasta el 2026-09-30 el simulador importaba el glosario entero
    (`fixtures/glosario.generated.ts`, 1 MB, y el atlas anatómico, otro
    1,7 MB) dentro del trozo de los manejadores. Con el glosario en castellano
    de cientos de miles de términos eso ya no entra en un bundle: ahora lee
    **shards** estáticos con `fetch` diferido, igual que la API pagina en la
    base.

    Dos raíces, en este orden:

    1. `glossary-data/` — el glosario completo, copiado de
       `glossary-data-build/` con `yarn mock:glossary:shards`. Pesa y va en
       `.gitignore`.
    2. `glossary-seed/` — el **conjunto semilla** commiteado (curados, capas de
       `data/glossary/` y atlas anatómico), que se genera con
       `yarn mock:glossary:seed`. Es el respaldo: la maqueta funciona sin la
       descarga completa.

    El formato lo escribe `scripts/lib/glossary-shards.mjs`; su cabecera lo
    describe. Este archivo sólo lee: no declara ni reescribe contenido.
    ========================================================================== */

/** Las dos raíces posibles, en orden de preferencia. */
export const RAICES_DEL_GLOSARIO = ['glossary-data', 'glossary-seed'] as const;

/** Dónde está una fila: categoría, página del shard (1-based) y posición. */
export type RefDeFila = readonly [categoryKey: string, page: number, index: number];

/** Una entrada del índice de búsqueda: la referencia, sus palabras y sus etiquetas. */
type EntradaDeBusqueda = readonly [string, number, number, string, string];

export interface CategoriaDelManifiesto {
  readonly key: string;
  readonly internalCode: string;
  readonly name: string;
  readonly description?: string;
  readonly count: number;
  /** Cuántos están en castellano (el resto sólo tiene su nombre original). */
  readonly translatedCount?: number;
  readonly pages: number;
  /** Cuántos términos de la categoría llevan cada etiqueta. */
  readonly tags: Readonly<Record<string, number>>;
}

export interface EtiquetaDelManifiesto {
  readonly key: string;
  readonly internalCode: string;
  readonly name: string;
  readonly count: number;
  readonly translatedCount?: number;
}

export interface ManifiestoDelGlosario {
  readonly version: number;
  readonly source: string;
  readonly pageSize: number;
  readonly total: number;
  readonly translatedTotal?: number;
  /** Las cubetas del índice de búsqueda que existen (dos letras por palabra). */
  readonly searchBuckets?: readonly string[];
  readonly categories: readonly CategoriaDelManifiesto[];
  readonly tags: readonly EtiquetaDelManifiesto[];
}

/** Una relación ya resuelta por el constructor de shards. */
export interface RelacionDeFila {
  readonly type: string;
  readonly targetSlug: string;
  readonly targetId: string;
  readonly targetName: string;
}

/** Una fila de shard (esquema de `data/glossary/00_README.md` + `SCHEMA.md`). */
export interface FilaDeGlosario {
  readonly id: string;
  readonly slug: string;
  readonly code?: string;
  readonly codeSystem?: string;
  readonly categoryKey: string;
  readonly tagKeys: readonly string[];
  readonly lang: 'es' | 'en';
  readonly esName: string;
  readonly enDisplay?: string | null;
  readonly esSynonyms?: readonly string[];
  readonly definition: string;
  readonly plainSummaryEs: string;
  /** MedlinePlus: la frase descriptiva oficial del tema. */
  readonly metaDescription?: string | null;
  readonly relations: readonly RelacionDeFila[];
  readonly symptomIds?: readonly string[];
  readonly analysisCategory?: string;
  readonly reviewStatus?: string;
  readonly source?: string;
  readonly sourceUrl?: string | null;
  readonly sourceRetrievedAt?: string | null;
  readonly imageUrl?: string | null;
  readonly imageThumbUrl?: string | null;
  readonly imageAttribution?: string | null;
  readonly imageLicense?: string | null;
  readonly imageSourcePage?: string | null;
  readonly drugFacts?: unknown;
  readonly sourceName?: string;
  readonly sourceLicense?: string;
  readonly definitionSource?: unknown;
  readonly definitionKind?: string | null;
  /** Secciones verbatim de la fuente (guías de pruebas de MedlinePlus); sólo en `detail/`. */
  readonly sections?: unknown;
  /** La fila completa está en `detail/<slug>.json` (esquema 2 de `SCHEMA.md`). */
  readonly hasDetail?: boolean;
  /** Propiedades del catálogo que viajan tal cual (NDC de los curados, atlas). */
  readonly properties?: Readonly<Record<string, unknown>>;
}

/** Qué se le pide a una página del glosario. */
export interface PedidoDePagina {
  readonly categoryKey?: string;
  readonly tagKey?: string;
  readonly query?: string;
  readonly offset: number;
  readonly limit: number;
}

/**
 * El orden de las referencias cuando vienen de varias cubetas (búsqueda de una
 * sola letra): por categoría, en el orden del manifiesto, y dentro de ella por
 * posición, que es castellano primero y alfabético. No es el orden global
 * exacto —reconstruirlo exige las filas—; la búsqueda de dos o más letras abre
 * una sola cubeta, que ya viene en orden global.
 */
function compararPorOrden(manifiesto: ManifiestoDelGlosario) {
  const orden = new Map(manifiesto.categories.map((c, i) => [c.key, i]));
  return (a: EntradaDeBusqueda, b: EntradaDeBusqueda) =>
    (orden.get(a[0]) ?? 0) - (orden.get(b[0]) ?? 0) || a[1] - b[1] || a[2] - b[2];
}

/** Sin tildes ni mayúsculas: la misma normalización que la API y el constructor. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * Palabras que no se buscan por sí solas: están en casi todos los nombres de
 * la CIE-10-ES. La misma lista que `scripts/lib/glossary-shards.mjs`.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'lo', 'los', 'n',
  'o', 'otra', 'otras', 'otro', 'otros', 'para', 'por', 'sin', 'su', 'sus', 'u', 'un',
  'una', 'y',
]);

/** La cubeta de una palabra: sus dos primeras letras. La misma fórmula que el constructor. */
function cubetaDe(palabra: string): string {
  const clave = palabra.slice(0, 2);
  return /^[a-z0-9]{1,2}$/.test(clave) ? clave : '_';
}

function palabrasDe(texto: string): string[] {
  return normalizar(texto)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((palabra) => palabra !== '');
}

/** El id de un value set del glosario: la misma fórmula que usaban los fixtures. */
export function idDeConjunto(internalCode: string): string {
  return uuid(`value-set-${internalCode}`);
}

/** El id de la versión vigente de un value set del glosario. */
export function idDeVersion(internalCode: string): string {
  return uuid(`value-set-version-${internalCode}`);
}

/** El value set paraguas: todo término del glosario es miembro de éste. */
export const PARAGUAS_DEL_GLOSARIO = {
  key: 'all-terms',
  internalCode: 'glossary-all-terms',
  name: 'Glosario médico',
} as const;

/**
 * Lee el glosario en shards, con caché por archivo.
 *
 * Cada archivo se pide una vez por sesión: la caché guarda la promesa, así que
 * dos pedidos simultáneos de la misma página no bajan el shard dos veces.
 */
export class AlmacenDeGlosario {
  private raiz: Promise<{ base: string; manifiesto: ManifiestoDelGlosario }> | null = null;
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(private readonly leer: LectorDeArchivos) {}

  /** La raíz en uso y su manifiesto: el glosario completo si está, si no la semilla. */
  manifiesto(): Promise<ManifiestoDelGlosario> {
    return this.resolverRaiz().then((r) => r.manifiesto);
  }

  /** De qué raíz se está leyendo, para decirlo en las pruebas y en la consola. */
  origen(): Promise<string> {
    return this.resolverRaiz().then((r) => r.base);
  }

  private resolverRaiz(): Promise<{ base: string; manifiesto: ManifiestoDelGlosario }> {
    this.raiz ??= (async () => {
      for (const base of RAICES_DEL_GLOSARIO) {
        try {
          const manifiesto = (await this.leer(`${base}/manifest.json`)) as ManifiestoDelGlosario;
          return { base, manifiesto };
        } catch (error: unknown) {
          if (!(error instanceof ArchivoAusente)) throw error;
        }
      }
      throw new Error('No hay glosario: faltan glossary-data/ y glossary-seed/.');
    })();
    // Un fallo no se queda pegado: el próximo pedido vuelve a intentar.
    this.raiz.catch(() => (this.raiz = null));
    return this.raiz;
  }

  private async archivo<T>(ruta: string): Promise<T> {
    const { base } = await this.resolverRaiz();
    const clave = `${base}/${ruta}`;
    let promesa = this.cache.get(clave);
    if (promesa === undefined) {
      promesa = this.leer(clave);
      this.cache.set(clave, promesa);
      promesa.catch(() => this.cache.delete(clave));
    }
    return promesa as Promise<T>;
  }

  private async archivoOVacio<T>(ruta: string, vacio: T): Promise<T> {
    try {
      return await this.archivo<T>(ruta);
    } catch (error: unknown) {
      if (error instanceof ArchivoAusente) return vacio;
      throw error;
    }
  }

  /** Las filas de unas referencias, en el mismo orden. */
  async filas(refs: readonly RefDeFila[]): Promise<FilaDeGlosario[]> {
    const paginas = await Promise.all(
      refs.map(([categoria, pagina]) =>
        this.archivo<FilaDeGlosario[]>(`shards/${categoria}/page-${pagina}.json`),
      ),
    );
    return refs.flatMap(([, , indice], i) => {
      const fila = paginas[i]?.[indice];
      return fila === undefined ? [] : [fila];
    });
  }

  /**
   * Un término por su id de concepto, o `null`.
   *
   * Si la fila de la tarjeta avisa que hay una completa (`hasDetail`: los
   * medicamentos con su ficha técnica, las guías de MedlinePlus), se la trae
   * de `detail/<slug>.json` y se la combina: la del detalle aporta lo que la
   * tarjeta no carga (secciones, presentaciones); la de la tarjeta conserva lo
   * que calculó el constructor (id, relaciones resueltas, etiquetas).
   */
  async porId(id: string): Promise<FilaDeGlosario | null> {
    const cubeta = await this.archivoOVacio<Record<string, RefDeFila>>(
      `mock/ids/${id.slice(0, 2).toLowerCase()}.json`,
      {},
    );
    const ref = cubeta[id];
    if (ref === undefined) return null;
    const [fila] = await this.filas([ref]);
    if (fila === undefined) return null;
    if (fila.hasDetail !== true) return fila;
    const detalle = await this.archivoOVacio<Partial<FilaDeGlosario> | null>(
      `detail/${fila.slug}.json`,
      null,
    );
    return detalle === null
      ? fila
      : {
          ...fila,
          ...detalle,
          id: fila.id,
          esName: fila.esName,
          relations: fila.relations,
          tagKeys: fila.tagKeys,
          definition: fila.definition,
          plainSummaryEs: fila.plainSummaryEs,
          lang: fila.lang,
        };
  }

  /**
   * Una página del glosario: las filas y cuántas coinciden en total.
   *
   * - Sin texto ni etiqueta, una categoría se lee directo de sus shards, y
   *   «todos» del orden global (`mock/order/`).
   * - Con etiqueta, de `mock/tags/<clave>.json`, acotado por categoría.
   * - Con texto, del índice por inicial de palabra (`mock/search/`): cada
   *   palabra buscada tiene que ser el principio de alguna palabra del término
   *   —nombre, sinónimos, nombre en inglés o código—, sin tildes. Es un poco
   *   más estricto que el «contiene» de la API (buscar «tension» no trae
   *   «hipertensión»); lo que el simulador no puede es bajar el corpus entero
   *   para buscar una subcadena.
   */
  async pagina(pedido: PedidoDePagina): Promise<{ filas: FilaDeGlosario[]; total: number }> {
    const refs = await this.referencias(pedido);
    if ('todas' in refs) {
      const hasta = Math.min(refs.total, pedido.offset + pedido.limit);
      const elegidas: RefDeFila[] = [];
      for (let i = pedido.offset; i < hasta; i++) elegidas.push(await refs.en(i));
      return { filas: await this.filas(elegidas), total: refs.total };
    }
    const elegidas = refs.lista.slice(pedido.offset, pedido.offset + pedido.limit);
    return { filas: await this.filas(elegidas), total: refs.lista.length };
  }

  private async referencias(
    pedido: PedidoDePagina,
  ): Promise<
    | { readonly lista: readonly RefDeFila[] }
    | { readonly todas: true; readonly total: number; en(i: number): Promise<RefDeFila> }
  > {
    const manifiesto = await this.manifiesto();
    const tamano = manifiesto.pageSize;
    const todas = palabrasDe(pedido.query ?? '');
    const palabras = todas.filter((palabra) => !STOPWORDS.has(palabra));

    if (todas.length > 0) {
      // Sólo palabras vacías («de la»): no hay cubeta que abrir.
      if (palabras.length === 0) return { lista: [] };
      // Se abre la cubeta de la palabra más larga: es la más chica.
      const guia = [...palabras].sort((a, b) => b.length - a.length)[0]!;
      const cubetas =
        guia.length >= 2
          ? [cubetaDe(guia)]
          : (manifiesto.searchBuckets ?? []).filter((clave) => clave.startsWith(guia));
      const vistas = new Set<string>();
      const entradas = (
        await Promise.all(
          cubetas.map((clave) =>
            this.archivoOVacio<EntradaDeBusqueda[]>(`mock/search/${clave}.json`, []),
          ),
        )
      )
        .flat()
        .filter(([categoria, pagina, indice]) => {
          // Con varias cubetas (búsqueda de una letra) un término puede venir
          // dos veces; y el orden global se recupera por la referencia.
          const clave = `${categoria}/${pagina}/${indice}`;
          if (vistas.has(clave)) return false;
          vistas.add(clave);
          return true;
        });
      if (cubetas.length > 1) entradas.sort(compararPorOrden(manifiesto));
      const lista = entradas
        .filter(([categoria, , , texto, etiquetas]) => {
          if (pedido.categoryKey !== undefined && categoria !== pedido.categoryKey) return false;
          if (pedido.tagKey !== undefined && !etiquetas.split(' ').includes(pedido.tagKey)) {
            return false;
          }
          const suyas = texto.split(' ');
          return palabras.every((buscada) => suyas.some((suya) => suya.startsWith(buscada)));
        })
        .map(([categoria, pagina, indice]) => [categoria, pagina, indice] as const);
      return { lista };
    }

    if (pedido.tagKey !== undefined) {
      const todas = await this.archivoOVacio<RefDeFila[]>(`mock/tags/${pedido.tagKey}.json`, []);
      return {
        lista:
          pedido.categoryKey === undefined
            ? todas
            : todas.filter(([categoria]) => categoria === pedido.categoryKey),
      };
    }

    if (pedido.categoryKey !== undefined) {
      const categoria = manifiesto.categories.find((c) => c.key === pedido.categoryKey);
      const clave = pedido.categoryKey;
      return {
        todas: true,
        total: categoria?.count ?? 0,
        en: (i) => Promise.resolve([clave, Math.floor(i / tamano) + 1, i % tamano] as const),
      };
    }

    return {
      todas: true,
      total: manifiesto.total,
      en: async (i) => {
        const pagina = await this.archivo<RefDeFila[]>(
          `mock/order/page-${Math.floor(i / tamano) + 1}.json`,
        );
        return pagina[i % tamano]!;
      },
    };
  }
}
