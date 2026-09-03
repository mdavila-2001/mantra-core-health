import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { forkJoin, map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { BoDepartmentsCatalog } from './bo-departments.service';
import { TerminologyClient } from './terminology.client';
import type { ValueSetOption } from './terminology.types';

/** El código interno del catálogo de municipios, el que la API sirve. */
export const CODIGO_CATALOGO_MUNICIPIOS = 'VS_BO_MUNICIPALITY';

/**
 * Prefijo del código de concepto de un municipio: `geo:bo:municipality:030101`.
 *
 * Lo que sigue al prefijo es el código del INE, `DDPPMM`, y sus dos primeros
 * dígitos son el departamento.
 */
const PREFIJO_MUNICIPIO = 'geo:bo:municipality:';

/** Prefijo del código de concepto de un departamento: `geo:bo:department:SC`. */
const PREFIJO_DEPARTAMENTO = 'geo:bo:department:';

/** Un municipio, ya resuelto contra su departamento. */
export interface Municipio {
  /** Identificador del concepto — lo que viaja al backend. */
  readonly conceptId: string;
  /** Nombre del municipio, sin el departamento pegado. */
  readonly nombre: string;
  /** Código del INE, `DDPPMM`. */
  readonly ine: string;
}

/** Un departamento con los municipios que le cuelgan. */
export interface RamaDepartamento {
  /** Identificador del concepto del departamento. */
  readonly conceptId: string;
  /** Sigla de la cédula: `CH`, `LP`, `SC`… */
  readonly sigla: string;
  /** Nombre del departamento, el titular del grupo. */
  readonly nombre: string;
  /** Sus municipios, en el orden del INE. */
  readonly municipios: readonly Municipio[];
}

/**
 * De los dos primeros dígitos del código del INE a la sigla del departamento.
 *
 * Es el mismo orden que publica el INE y el mismo que siembra la API
 * (`BO_DEPARTMENT_BY_INE_PREFIX` en `bo-geography.catalog.ts`). Se repite acá
 * —nueve pares— porque la alternativa es una petición más sólo para
 * descubrir una correspondencia que no cambia desde 1826.
 */
const SIGLA_POR_PREFIJO_INE: ReadonlyMap<string, string> = new Map([
  ['01', 'CH'],
  ['02', 'LP'],
  ['03', 'CB'],
  ['04', 'OR'],
  ['05', 'PT'],
  ['06', 'TJ'],
  ['07', 'SC'],
  ['08', 'BE'],
  ['09', 'PD'],
]);

/**
 * Resuelve el departamento tanto del código canónico del seeder nuevo
 * (`geo:bo:municipality:030101`) como del catálogo legado que sigue publicado
 * en la base reconstruida (`CB-SACABA`). Ese catálogo usa `PA` para Pando,
 * mientras el de departamentos usa `PD`.
 */
function siglaDeMunicipio(code: string): string | undefined {
  const ine = code.replace(PREFIJO_MUNICIPIO, '');
  const porIne = SIGLA_POR_PREFIJO_INE.get(ine.slice(0, 2));
  if (porIne !== undefined) return porIne;

  const siglaLegada = /^([A-Z]{2})-/.exec(code)?.[1];
  return siglaLegada === 'PA' ? 'PD' : siglaLegada;
}

/**
 * El árbol de departamentos y municipios de Bolivia, para «dónde vivís».
 *
 * ## Por qué es un árbol y no una lista
 *
 * Porque 340 opciones en un desplegable plano no se recorren, y porque siete
 * nombres se repiten entre departamentos: un «San Pedro» suelto no identifica
 * nada. Agrupado por departamento, cada nombre vuelve a ser inequívoco.
 *
 * ## Cómo se arma la jerarquía
 *
 * La expansión de un conjunto de valores devuelve `conceptId`, `code` y
 * `display` — **no** las propiedades del concepto. Así que el padre no se lee
 * de la propiedad `geo:bo:department` que la API siembra, sino del propio
 * código: `geo:bo:municipality:030101` empieza en `03`, que es Cochabamba. La
 * API valida esa correspondencia al sembrar, así que el prefijo y la propiedad
 * no pueden discrepar.
 *
 * Los nombres de los departamentos salen de `BoDepartmentsCatalog`, que ya
 * estaba: el árbol no reimplementa ese catálogo, lo usa.
 */
@Injectable({ providedIn: 'root' })
export class BoMunicipalitiesCatalog {
  private readonly terminology = inject(TerminologyClient);
  private readonly departamentos = inject(BoDepartmentsCatalog);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La lectura en curso o ya resuelta. `null` mientras nadie la pidió. */
  private cache: Observable<readonly RamaDepartamento[]> | null = null;

  /**
   * El árbol completo: cada departamento con sus municipios.
   *
   * **Bajo SSR no se pide nada**, por lo mismo que el catálogo de
   * departamentos: el registro es una ruta pública y por lo tanto
   * prerenderizada, y durante el prerender no hay API a la que preguntar. Se
   * devuelve el árbol vacío —el campo es opcional y la pantalla sabe seguir sin
   * él— y no se cachea ese vacío, para que el navegador lo pida de verdad tras
   * hidratar.
   *
   * @returns Los departamentos con sus municipios, en el orden del INE.
   */
  listar(): Observable<readonly RamaDepartamento[]> {
    if (!this.isBrowser) {
      return of([]);
    }
    this.cache ??= this.leerArbol().pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.cache;
  }

  /**
   * Olvida lo cacheado, para un reintento explícito después de un fallo.
   *
   * Olvida también el catálogo de departamentos: el árbol lo necesita entero, y
   * si el fallo fue de ése, reintentar sin limpiarlo repetiría el mismo error
   * guardado por `shareReplay` sin llegar a tocar la red.
   */
  olvidar(): void {
    this.cache = null;
    this.departamentos.olvidar();
  }

  private leerArbol(): Observable<readonly RamaDepartamento[]> {
    return forkJoin({
      departamentos: this.departamentos.listar(),
      municipios: this.leerMunicipios(),
    }).pipe(
      map(({ departamentos, municipios }) =>
        this.agrupar(departamentos, municipios),
      ),
    );
  }

  private leerMunicipios(): Observable<readonly ValueSetOption[]> {
    return this.terminology
      .listValueSets({ code: CODIGO_CATALOGO_MUNICIPIOS })
      .pipe(
        map((pagina) =>
          pagina.items.find(
            (conjunto) => conjunto.internalCode === CODIGO_CATALOGO_MUNICIPIOS,
          ),
        ),
        switchMap((conjunto) => {
          if (conjunto === undefined) {
            return throwError(
              () =>
                new Error(
                  `El catálogo ${CODIGO_CATALOGO_MUNICIPIOS} no está sembrado`,
                ),
            );
          }
          return this.terminology.readAllOptions(conjunto.id);
        }),
        map((opciones) =>
          opciones.filter((opcion) => opcion.selectable !== false),
        ),
      );
  }

  /**
   * Cuelga cada municipio de su departamento, por el prefijo de su código.
   *
   * Un departamento sin municipios **no aparece**: un grupo vacío en el árbol
   * es una rama que sólo se puede abrir para descubrir que no hay nada. Un
   * municipio cuyo prefijo no case con ningún departamento tampoco: preferible
   * perder una opción que inventarle un padre.
   */
  private agrupar(
    departamentos: readonly ValueSetOption[],
    municipios: readonly ValueSetOption[],
  ): readonly RamaDepartamento[] {
    const porSigla = new Map<string, ValueSetOption>();
    for (const departamento of departamentos) {
      porSigla.set(
        departamento.code.replace(PREFIJO_DEPARTAMENTO, ''),
        departamento,
      );
    }

    const ramas = new Map<string, Municipio[]>();
    for (const municipio of municipios) {
      const ine = municipio.code.replace(PREFIJO_MUNICIPIO, '');
      const sigla = siglaDeMunicipio(municipio.code);
      if (sigla === undefined || !porSigla.has(sigla)) {
        continue;
      }
      const rama = ramas.get(sigla) ?? [];
      rama.push({
        conceptId: municipio.conceptId,
        nombre: municipio.display,
        ine,
      });
      ramas.set(sigla, rama);
    }

    // El recorrido es sobre `departamentos` y no sobre `ramas` para que el
    // orden del árbol sea el de la expansión de departamentos —el del INE— y no
    // el de aparición de los municipios.
    return departamentos
      .map((departamento) => {
        const sigla = departamento.code.replace(PREFIJO_DEPARTAMENTO, '');
        return {
          conceptId: departamento.conceptId,
          sigla,
          nombre: departamento.display,
          municipios: ramas.get(sigla) ?? [],
        };
      })
      .filter((rama) => rama.municipios.length > 0);
  }
}
