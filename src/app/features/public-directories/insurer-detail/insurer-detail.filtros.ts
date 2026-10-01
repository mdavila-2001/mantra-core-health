import type { FilterDef } from '@shared/components/organisms/filter-bar/filter-bar';

import type { FilaDeClausula, PlanDelMercado } from './insurer-detail';

/**
 * **El buscador y los filtros de «Productos y planes»** (30/09/2026).
 *
 * El cliente: «en el buscador de productos de aseguradora falta un buscador y
 * filtro», con la disciplina de tablas (ADR-0015, regla 5): buscador
 * multicampo normalizado por acentos y mayúsculas, y filtros por value set
 * cerrado. Todo es local: el catálogo de una aseguradora llega entero en una
 * sola lectura, así que no hay nada que pedirle a la API.
 *
 * Funciones puras y no métodos del componente, para probarlas sin TestBed.
 */

/** Las claves de la URL. `q` es la del buscador (`SEARCH_PARAM` de la barra). */
export const CLAVE_TIPO = 'tipo';
export const CLAVE_SEGMENTO = 'segmento';
export const CLAVE_COBERTURA = 'cobertura';

const DIACRITICOS = /\p{Diacritic}/gu;

/** «Maternidad» encuentra «maternidad» y «Odontologia» encuentra «Odontología». */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function incluye(texto: string | null, termino: string): boolean {
  return texto !== null && normalizar(texto).includes(termino);
}

/** Los valores distintos, en el orden en que aparecen por primera vez. */
function distintos(valores: readonly (string | null)[]): readonly string[] {
  return [...new Set(valores.filter((valor): valor is string => valor !== null && valor !== ''))];
}

/**
 * Los filtros que tienen algo que elegir. Un desplegable con una sola opción
 * no acota nada —si todos los planes son de «Salud», «Tipo: Salud» sólo ocupa
 * lugar—, así que un filtro entra con dos opciones o más.
 */
export function filtrosDelCatalogo(planes: readonly PlanDelMercado[]): readonly FilterDef[] {
  const candidatos: readonly (FilterDef & { readonly opciones: readonly string[] })[] = [
    {
      key: CLAVE_TIPO,
      label: 'Tipo de seguro',
      placeholder: 'Todos los tipos',
      opciones: distintos(planes.map((plan) => plan.tipo)),
      options: [],
    },
    {
      key: CLAVE_SEGMENTO,
      label: 'Para quién',
      placeholder: 'Todos los segmentos',
      opciones: distintos(planes.map((plan) => plan.segmento)),
      options: [],
    },
    {
      key: CLAVE_COBERTURA,
      label: 'Que cubra',
      placeholder: 'Cualquier cobertura',
      opciones: [
        ...distintos(planes.flatMap((plan) => plan.clausulas.map((c) => c.categoria))),
      ].sort((a, b) => a.localeCompare(b, 'es')),
      options: [],
    },
  ];
  return candidatos
    .filter((filtro) => filtro.opciones.length > 1)
    .map(({ opciones, ...filtro }) => ({
      ...filtro,
      options: opciones.map((opcion) => ({ value: opcion, label: opcion })),
    }));
}

/** Lo que pidió quien busca, ya leído de la URL. */
export interface Criterio {
  readonly termino: string;
  readonly tipo: string | null;
  readonly segmento: string | null;
  readonly cobertura: string | null;
}

/**
 * Lee el criterio de los query params. Un parámetro de un filtro que no se
 * ofrece —la URL de otra aseguradora, o una editada a mano— no filtra: no hay
 * chip que lo muestre, y un listado vacío sin causa a la vista no se entiende.
 */
export function criterioDe(
  params: Readonly<Record<string, string | undefined>>,
  filtros: readonly FilterDef[],
): Criterio {
  const valor = (clave: string): string | null => {
    const filtro = filtros.find((candidato) => candidato.key === clave);
    const elegido = params[clave];
    return filtro !== undefined && filtro.options.some((o) => o.value === elegido)
      ? (elegido ?? null)
      : null;
  };
  return {
    termino: normalizar(params['q'] ?? ''),
    tipo: valor(CLAVE_TIPO),
    segmento: valor(CLAVE_SEGMENTO),
    cobertura: valor(CLAVE_COBERTURA),
  };
}

export function hayCriterio(criterio: Criterio): boolean {
  return (
    criterio.termino !== '' ||
    criterio.tipo !== null ||
    criterio.segmento !== null ||
    criterio.cobertura !== null
  );
}

/** Si el término está en lo que dice el plan de sí mismo, sin mirar sus cláusulas. */
function coincideElPlan(plan: PlanDelMercado, termino: string): boolean {
  return [plan.nombre, plan.producto, plan.tipo, plan.segmento, plan.prima].some((campo) =>
    incluye(campo, termino),
  );
}

function coincideLaClausula(fila: FilaDeClausula, termino: string): boolean {
  return [fila.cobertura, fila.requisitos, fila.autorizacion].some((campo) =>
    incluye(campo, termino),
  );
}

/** Un plan que pasó el filtro, con las cláusulas que corresponde mostrarle. */
export interface PlanFiltrado {
  readonly plan: PlanDelMercado;
  readonly clausulas: readonly FilaDeClausula[];
}

/**
 * Los planes que cumplen el criterio, cada uno con sus cláusulas a la vista.
 *
 * El buscador mira el plan (nombre, producto, tipo, segmento, prima) **y** sus
 * cláusulas (cobertura, requisitos y exclusiones). Si el término está en el
 * plan, se ven todas sus cláusulas: quien escribió «Integral» quiere ver el
 * plan Integral entero. Si sólo está en algunas cláusulas —«maternidad»—, el
 * plan entra y su tabla muestra sólo ésas, que es la respuesta a la pregunta.
 * «Que cubra» acota las cláusulas de la misma manera.
 */
export function filtrarPlanes(
  planes: readonly PlanDelMercado[],
  criterio: Criterio,
): readonly PlanFiltrado[] {
  return planes.flatMap((plan): PlanFiltrado[] => {
    if (criterio.tipo !== null && plan.tipo !== criterio.tipo) return [];
    if (criterio.segmento !== null && plan.segmento !== criterio.segmento) return [];

    let clausulas = plan.clausulas;
    if (criterio.cobertura !== null) {
      clausulas = clausulas.filter((fila) => fila.categoria === criterio.cobertura);
      if (clausulas.length === 0) return [];
    }
    if (criterio.termino !== '' && !coincideElPlan(plan, criterio.termino)) {
      clausulas = clausulas.filter((fila) => coincideLaClausula(fila, criterio.termino));
      if (clausulas.length === 0) return [];
    }
    return [{ plan, clausulas }];
  });
}
