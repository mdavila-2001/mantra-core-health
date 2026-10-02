import { ArchivoAusente, leerConFetch, type LectorDeArchivos } from './glossary-shards';

/* ============================================================================
    El directorio oficial de salud de Bolivia, **bajo demanda**.

    15 292 fichas —6 977 farmacias de AGEMED, 4 404 establecimientos del RUES
    2026 y 3 911 lugares de Overture Places— que no caben en el bundle. Las
    escribe `scripts/gen-official-directory.mjs` en `public/directorio-oficial/`
    desde el mismo dato que el paquete de seeds siembra en la base, y acá se leen
    con el lector del glosario la primera vez que una búsqueda las necesita.

    Ninguna ficha es «verificada»: existen porque un registro oficial (AGEMED,
    RUES) o una fuente comunitaria (Overture) las lista, no porque alguien las
    reclamó en AloVida. El subtítulo dice de dónde salen.
    ========================================================================== */

/** El vertical de la ficha, el mismo `kind` del buscador público. */
export type ClaseOficial = 'PHARMACY' | 'ORGANIZATION' | 'DIAGNOSTIC_UNIT';

/** Una ficha del directorio oficial, tal como la escribe el generador. */
export interface FichaOficial {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly headline: string;
  /** Código de `CATEGORIA` (categorias-publicas.ts), o `null`. */
  readonly category: string | null;
  readonly unitKind?: 'LABORATORY' | 'IMAGING';
  readonly city: string | null;
  readonly department: string | null;
  readonly address: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly phone: string | null;
  readonly source: 'AGEMED' | 'RUES' | 'OVERTURE';
  /** Nº de resolución de AGEMED (farmacias). */
  readonly license?: string;
  /** Código del establecimiento en el RUES. */
  readonly officialCode?: string;
}

const ARCHIVO: Readonly<Record<ClaseOficial, string>> = {
  PHARMACY: 'directorio-oficial/farmacias.json',
  ORGANIZATION: 'directorio-oficial/organizaciones.json',
  DIAGNOSTIC_UNIT: 'directorio-oficial/diagnostico.json',
};

/** Qué fuente, dicho para una persona. */
export const NOMBRE_DE_FUENTE: Readonly<Record<FichaOficial['source'], string>> = {
  AGEMED: 'Lista de establecimientos farmacéuticos de AGEMED (vigente al 01/10/2026)',
  RUES: 'Registro Único de Establecimientos de Salud (RUES 2026, Ministerio de Salud y Deportes)',
  OVERTURE: 'Overture Maps Places (fuente comunitaria, CDLA-Permissive-2.0)',
};

export class DirectorioOficial {
  private readonly cargas = new Map<ClaseOficial, Promise<readonly FichaOficial[]>>();

  constructor(private readonly leer: LectorDeArchivos = leerConFetch) {}

  /**
   * Las fichas de un vertical. Si el archivo no está (una maqueta sin generar)
   * o no hay de dónde leer (SSR), el directorio oficial simplemente no suma
   * nada: la búsqueda sigue respondiendo con lo de la comunidad.
   */
  de(clase: ClaseOficial): Promise<readonly FichaOficial[]> {
    let carga = this.cargas.get(clase);
    if (carga === undefined) {
      carga = this.leer(ARCHIVO[clase]).then(
        (datos) => (Array.isArray(datos) ? (datos as FichaOficial[]) : []),
        (error: unknown) => {
          if (!(error instanceof ArchivoAusente)) console.warn('[mock] directorio oficial no disponible:', error);
          return [];
        },
      );
      this.cargas.set(clase, carga);
    }
    return carga;
  }

  /** La ficha con ese slug, en cualquiera de los tres verticales. */
  async porSlug(slug: string): Promise<(FichaOficial & { readonly kind: ClaseOficial }) | undefined> {
    for (const clase of Object.keys(ARCHIVO) as ClaseOficial[]) {
      const ficha = (await this.de(clase)).find((f) => f.slug === slug);
      if (ficha !== undefined) return { ...ficha, kind: clase };
    }
    return undefined;
  }
}
