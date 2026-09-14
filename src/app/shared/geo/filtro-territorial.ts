/* ============================================================================
    El lugar en dos pasos —departamento, después municipio— para un directorio
    público cuyo contrato sólo trae la ciudad de cada ficha como texto.

    Es el mismo corte que ya tienen clínicas, farmacias y hospitales, escrito una
    vez para la vertical que lo suma en la subtarea 2.3: aseguradoras. No trae
    geografía propia: los departamentos, los
    municipios y la relación entre los dos son los de `BoMunicipalitiesCatalog`.
    ========================================================================== */

import { computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type Params } from '@angular/router';

import type {
  CorteTerritorial,
  FilaConCiudad,
} from '@core/data-access/public-directory/public-search.store';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '@core/data-access/terminology/bo-municipalities.service';
import type { DepartamentoElegible } from '@shared/components/organisms/department-map/department-map';

import {
  lugarInequivocoPorCiudad,
  normalizarLugar,
  type LugarDeCiudad,
} from './departamento-de-ciudad';

/** Clave del departamento elegido en el mapa. La misma que usan los directorios ya mergeados. */
export const PARAM_DEPARTAMENTO = 'departamento';

/** Clave del municipio elegido por chip. La misma que usan los directorios ya mergeados. */
export const PARAM_CIUDAD = 'ciudad';

/** El valor de un parámetro, o `null` si no está o viene vacío. */
function valorDe(parametros: Params, clave: string): string | null {
  const valor: unknown = parametros[clave];
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

/**
 * El corte territorial de un directorio público.
 *
 * Se construye como campo del componente —necesita el contexto de inyección— y
 * se le entrega a `BusquedaPublica`, que es quien tiene las filas.
 *
 * ## La URL es la fuente, y lo que no cuadra no se inventa
 *
 * El departamento y el municipio viven en `?departamento=` y `?ciudad=`, como
 * en los otros tres directorios: un directorio filtrado se puede pegar en un
 * mensaje. Pero un enlace puede traer cualquier cosa, así que se lee con dos
 * reglas:
 *
 * - Un departamento que no está en el catálogo **no filtra**: se ve todo el
 *   país, en vez de una lista vacía sin explicación.
 * - Un municipio sólo filtra si pertenece al departamento elegido. «La Paz»
 *   dentro de Cochabamba, o un municipio sin departamento, no forman una
 *   combinación válida y se ignoran: nunca se conserva un par incoherente.
 *
 * ## Por qué los municipios salen de los resultados y no del catálogo entero
 *
 * Por lo mismo que en hospitales: de los ochenta y siete municipios de La Paz la
 * mayoría no tiene nada publicado, y un chip que siempre devuelve cero es peor
 * que no tenerlo. Pero cada chip se rotula con el nombre **del catálogo** y sólo
 * aparece si ese municipio es del departamento elegido, que es lo que acota las
 * opciones a ese departamento y a ningún otro.
 */
export class FiltroTerritorial implements CorteTerritorial {
  private readonly catalogo = inject(BoMunicipalitiesCatalog);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** El árbol de departamentos y municipios. Vacío mientras no llegue. */
  private readonly ramas = signal<readonly RamaDepartamento[]>([]);

  private readonly _catalogoCaido = signal(false);

  /** El catálogo no llegó: el mapa no se dibuja y se ofrece reintentar. */
  readonly catalogoCaido = this._catalogoCaido.asReadonly();

  /** Los departamentos, para el mapa. Todos, tengan o no algo publicado. */
  readonly departamentos = computed<readonly DepartamentoElegible[]>(() =>
    this.ramas().map(({ conceptId, sigla, nombre }) => ({ conceptId, sigla, nombre })),
  );

  /** De cada nombre de municipio no ambiguo a su departamento. */
  private readonly lugares = computed(() => lugarInequivocoPorCiudad(this.ramas()));

  private readonly parametros = toSignal(this.ruta.queryParams, {
    initialValue: {} as Params,
  });

  /** El departamento de la URL, sólo si es uno del catálogo. */
  readonly departamentoElegido = computed<string | null>(() => {
    const elegido = valorDe(this.parametros(), PARAM_DEPARTAMENTO);
    if (elegido === null) {
      return null;
    }
    return this.ramas().some((rama) => rama.conceptId === elegido) ? elegido : null;
  });

  /**
   * El municipio de la URL, sólo si es del departamento elegido.
   *
   * Devuelve el nombre del catálogo, no el escrito en el enlace:
   * `?ciudad=quillacollo` marca el chip «Quillacollo».
   */
  readonly ciudad = computed<string | null>(() => {
    const departamento = this.departamentoElegido();
    const escrita = valorDe(this.parametros(), PARAM_CIUDAD);
    if (departamento === null || escrita === null) {
      return null;
    }
    const lugar = this.lugares().get(normalizarLugar(escrita));
    return lugar?.departamento === departamento ? lugar.municipio : null;
  });

  /** El nombre del departamento elegido, para escribirlo. */
  readonly nombreDelDepartamento = computed<string | null>(() => {
    const elegido = this.departamentoElegido();
    if (elegido === null) {
      return null;
    }
    return this.ramas().find((rama) => rama.conceptId === elegido)?.nombre ?? null;
  });

  constructor() {
    this.leer();
  }

  /** Dónde queda una fila, o `null` si su ciudad no dice de qué departamento es. */
  lugarDe(fila: FilaConCiudad): LugarDeCiudad | null {
    if (fila.city === null || fila.city.trim() === '') {
      return null;
    }
    return this.lugares().get(normalizarLugar(fila.city)) ?? null;
  }

  /** Las filas del departamento elegido, sin el corte de municipio. Sin departamento, todas. */
  delDepartamento<T extends FilaConCiudad>(filas: readonly T[]): readonly T[] {
    const departamento = this.departamentoElegido();
    if (departamento === null) {
      return filas;
    }
    return filas.filter((fila) => this.lugarDe(fila)?.departamento === departamento);
  }

  /** Las filas que quedan después de los dos cortes. */
  recortar<T extends FilaConCiudad>(filas: readonly T[]): readonly T[] {
    const ciudad = this.ciudad();
    const delDepartamento = this.delDepartamento(filas);
    if (ciudad === null) {
      return delDepartamento;
    }
    return delDepartamento.filter((fila) => this.lugarDe(fila)?.municipio === ciudad);
  }

  /**
   * Los municipios del departamento elegido que tienen algo publicado, el más
   * cargado primero. Sin departamento, ninguno: el mapa es el corte de arriba.
   */
  ciudades(filas: readonly FilaConCiudad[]): readonly string[] {
    if (this.departamentoElegido() === null) {
      return [];
    }
    const cuenta = new Map<string, number>();
    for (const fila of this.delDepartamento(filas)) {
      const municipio = this.lugarDe(fila)?.municipio;
      if (municipio !== undefined) {
        cuenta.set(municipio, (cuenta.get(municipio) ?? 0) + 1);
      }
    }
    return [...cuenta.entries()]
      .sort(([a, cuentaA], [b, cuentaB]) => cuentaB - cuentaA || a.localeCompare(b, 'es'))
      .map(([municipio]) => municipio);
  }

  /** Cuántas filas tiene cada departamento, sin aplicar el corte del propio mapa. */
  cuentaPorDepartamento(filas: readonly FilaConCiudad[]): ReadonlyMap<string, number> {
    const cuenta = new Map<string, number>();
    for (const fila of filas) {
      const departamento = this.lugarDe(fila)?.departamento;
      if (departamento !== undefined) {
        cuenta.set(departamento, (cuenta.get(departamento) ?? 0) + 1);
      }
    }
    return cuenta;
  }

  /** Cuántas filas no se pueden ubicar en ningún departamento. */
  sinUbicar(filas: readonly FilaConCiudad[]): number {
    return filas.filter((fila) => this.lugarDe(fila) === null).length;
  }

  /** Elegir en el mapa va a la URL y **suelta el municipio** del departamento anterior. */
  elegirDepartamento(conceptId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { [PARAM_DEPARTAMENTO]: conceptId, [PARAM_CIUDAD]: null },
      queryParamsHandling: 'merge',
    });
  }

  /** Elegir un chip va a la URL. `null` vuelve a todo el departamento. */
  elegirCiudad(municipio: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { [PARAM_CIUDAD]: municipio },
      queryParamsHandling: 'merge',
    });
  }

  /** Reintenta la lectura del catálogo tras un fallo. */
  reintentar(): void {
    this.catalogo.olvidar();
    this.leer();
  }

  private leer(): void {
    this._catalogoCaido.set(false);
    this.catalogo
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ramas) => this.ramas.set(ramas),
        error: () => {
          this.ramas.set([]);
          this._catalogoCaido.set(true);
        },
      });
  }
}
