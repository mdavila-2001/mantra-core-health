/** Las cuatro verticales explícitas de Cotizaciones del paciente. */
export type VerticalCotizacion =
  'TODAS' | 'MEDICAMENTOS' | 'ANALISIS' | 'IMAGENOLOGIA' | 'SERVICIOS_MEDICOS';

/** La orden que puede elegir la persona. */
export type OrdenCotizacion = 'PRECIO' | 'CERCANIA';

/**
 * Un precio publicado con su unidad y procedencia; `null` significa no publicado.
 *
 * `currency` es el código que trae la fuente (`BOB`, `USD`, `UMA`…) y se
 * muestra tal cual: UMA no es una moneda y nada acá la convierte.
 */
export interface PrecioPublicado {
  readonly amount: number;
  readonly currency: string;
  readonly source: string;
}

/** A dónde lleva la fila: una pantalla existente, con ícono + texto. */
export interface AccionDeCotizacion {
  readonly etiqueta: string;
  readonly ruta: string;
}

/** La fila normalizada que una fuente existente entrega a la pantalla. */
export interface CotizacionResultado {
  readonly id: string;
  readonly vertical: Exclude<VerticalCotizacion, 'TODAS'>;
  readonly que: string;
  readonly donde: string;
  readonly price: PrecioPublicado | null;
  readonly distanceKm: number | null;
  /** Por qué no hay distancia, dicho para la persona («no aplica», «no publicó su ubicación»). */
  readonly sinDistancia?: string;
  /** Aviso sobre la fila misma (p. ej. texto de un escaneo por revisar). */
  readonly advertencia?: string;
  readonly accion?: AccionDeCotizacion;
}

/** Quita tildes, espacios laterales y diferencias de mayúscula antes de comparar. */
export function normalizarCotizacion(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('es')
    .trim();
}

/** Aplica la búsqueda y vertical sin mutar la fuente. */
export function filtrarResultados(
  resultados: readonly CotizacionResultado[],
  termino: string,
  vertical: VerticalCotizacion,
): readonly CotizacionResultado[] {
  const buscado = normalizarCotizacion(termino);
  return resultados.filter((resultado) => {
    const pertenece = vertical === 'TODAS' || resultado.vertical === vertical;
    return (
      pertenece &&
      (buscado === '' ||
        normalizarCotizacion(resultado.que).includes(buscado) ||
        normalizarCotizacion(resultado.donde).includes(buscado))
    );
  });
}

/**
 * Ordena una copia para no alterar los resultados que mantiene la fuente.
 *
 * Monedas/unidades diferentes no se convierten ni se comparan: se agrupan por
 * código y sólo se ordenan por monto dentro de la misma unidad. Los precios no
 * publicados siempre cierran la lista.
 */
export function ordenarResultados(
  resultados: readonly CotizacionResultado[],
  orden: OrdenCotizacion,
  hasOrigin = true,
): readonly CotizacionResultado[] {
  if (orden === 'CERCANIA' && !hasOrigin) {
    return [...resultados];
  }
  return [...resultados].sort((izquierda, derecha) =>
    orden === 'PRECIO' ? compararPrecio(izquierda, derecha) : compararDistancia(izquierda, derecha),
  );
}

function compararPrecio(izquierda: CotizacionResultado, derecha: CotizacionResultado): number {
  if (izquierda.price === null && derecha.price === null) return 0;
  if (izquierda.price === null) return 1;
  if (derecha.price === null) return -1;
  const unidad = izquierda.price.currency.localeCompare(derecha.price.currency, 'es');
  return unidad === 0 ? izquierda.price.amount - derecha.price.amount : unidad;
}

function compararDistancia(izquierda: CotizacionResultado, derecha: CotizacionResultado): number {
  if (izquierda.distanceKm === null && derecha.distanceKm === null) return 0;
  if (izquierda.distanceKm === null) return 1;
  if (derecha.distanceKm === null) return -1;
  return izquierda.distanceKm - derecha.distanceKm;
}
