import type { SearchResultItem, SearchResultRating } from '../search-result/search-result.types';

/**
 * La calificación de pacientes de un resultado, **sólo si es real**: la que
 * trae en `rating` o la que viene escrita en su meta («3,7 · 60 reseñas»).
 * Sin reseñas, `null`.
 *
 * Vive aparte porque la leen dos: la tarjeta, para dibujar las estrellas, y el
 * directorio, para ordenar por «Mejor puntuación». Si cada uno la leyera a su
 * manera, el orden y lo que se ve podrían no coincidir.
 *
 * Antes había un respaldo que inventaba una nota con un hash del nombre para
 * que ninguna tarjeta quedara «vacía»: un dato falso en una guía de salud.
 */
export function ratingOf(resultado: SearchResultItem): SearchResultRating | null {
  const propia = resultado.rating;
  if (propia && propia.count > 0 && propia.average > 0) {
    return propia;
  }
  const escrita = (resultado.meta ?? []).find(
    (linea) => linea.iconKey === 'puntuacion' || /reseña/i.test(linea.text),
  );
  const partes = escrita?.text.match(/(\d(?:[,.]\d)?)\s*·\s*(\d+)/);
  if (!partes) {
    return null;
  }
  return {
    average: parseFloat(partes[1]!.replace(',', '.')),
    count: parseInt(partes[2]!, 10),
  };
}
