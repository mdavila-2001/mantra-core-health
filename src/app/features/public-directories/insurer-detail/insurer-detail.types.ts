/** Una cláusula, lista para la tabla: todo en palabras, nada que calcular. */
export interface FilaDeClausula {
  readonly id: string;
  /** La categoría sola («Maternidad»): es el value set del filtro «Que cubra». */
  readonly categoria: string;
  readonly cobertura: string;
  readonly cubre: string;
  readonly copago: string;
  readonly deducible: string;
  readonly tope: string;
  readonly autorizacion: string;
  readonly requisitos: string;
}

/** Una cobertura del plan dicha en una línea: qué y cuánto cubre. */
export interface CoberturaDestacada {
  readonly id: string;
  readonly cobertura: string;
  readonly cubre: string;
}

/** Un plan de la aseguradora, como lo lee quien lo va a contratar. */
export interface PlanDelMercado {
  readonly id: string;
  readonly nombre: string;
  readonly producto: string;
  /** El tipo de producto («Salud», «Accidentes personales»): filtro «Tipo de seguro». */
  readonly tipo: string;
  readonly segmento: string | null;
  /**
   * Qué es y para quién, en una línea: «Salud · Individual y familiar». Es el
   * rótulo de la tarjeta del plan; el nombre del producto repite el de la
   * aseguradora, que ya está en el título de la página.
   */
  readonly rotulo: string;
  /** La prima mensual formateada, o `null` si la aseguradora no la publicó. */
  readonly prima: string | null;
  /** El plan de mayor cobertura del producto (`planType` PREMIUM). */
  readonly mayorCobertura: boolean;
  /**
   * Las primeras coberturas, en el orden en que la aseguradora las publicó:
   * lo que la tarjeta del plan alcanza a decir sin abrir la tabla.
   */
  readonly destacadas: readonly CoberturaDestacada[];
  /** Cuántas coberturas, el tope anual mayor y cuántas piden autorización. */
  readonly resumen: string;
  readonly clausulas: readonly FilaDeClausula[];
}
