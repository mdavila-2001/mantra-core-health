import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';
import type { NavIconName } from '@shared/components/atoms/nav-icon/nav-icon.types';
import type { SearchResultItem } from '@shared/components/molecules/search-result/search-result.types';
import type { FilterDef } from '@shared/components/organisms/filter-bar/filter-bar';

/*
 * Los cortes de los directorios públicos que no son de lugar ni de categoría
 * (propietario, 24/10/2026: todos los filtros que los datos permitan). Se
 * aplican en memoria sobre lo ya cargado, como la verificación.
 */

/** Clave del chip de verificación en la URL. */
export const PARAM_VERIFICADO = 'verificado';

/** Clave de la calificación mínima, en la URL. */
export const PARAM_CALIFICACION = 'calificacion';

/** Clave del chip «con turnos en línea», en la URL. */
export const PARAM_AGENDA = 'agenda';

/** Los topes de calificación que se ofrecen, de mayor a menor. */
const TOPES_DE_CALIFICACION: readonly { readonly valor: number; readonly rotulo: string }[] = [
  { valor: 4.5, rotulo: '4,5 o más' },
  { valor: 4, rotulo: '4 o más' },
  { valor: 3, rotulo: '3 o más' },
];

/**
 * El botón de la tarjeta: lleva directo a la sección de la ficha donde se
 * elige el servicio, y no a su cabecera (propietario, 24/10/2026: menos clics
 * hasta la compra).
 */
export interface AccionDeLaFicha {
  readonly label: string;
  readonly fragment: string;
  readonly icon: NavIconName;
}

/** Los cortes comunes que están puestos. */
export interface CortesComunes {
  readonly soloVerificados: boolean;
  readonly soloConAgenda: boolean;
  readonly calificacionMinima: number | null;
}

/** Los cortes comunes, leídos con el lector de parámetros de la pantalla. */
export function cortesComunesDe(parametro: (clave: string) => string | null): CortesComunes {
  const minima = Number(parametro(PARAM_CALIFICACION));
  return {
    soloVerificados: parametro(PARAM_VERIFICADO) === 'true',
    soloConAgenda: parametro(PARAM_AGENDA) === 'true',
    calificacionMinima: Number.isFinite(minima) && minima > 0 ? minima : null,
  };
}

/** La tarjeta con el botón directo a la sección que importa, si lo hay. */
export function conAccion(
  tarjeta: SearchResultItem,
  accion: AccionDeLaFicha | null,
): SearchResultItem {
  return accion === null ? tarjeta : { ...tarjeta, action: { ...accion, link: tarjeta.link } };
}

/**
 * Si la fila pasa la verificación, la nota y la agenda. Se aplica igual en la
 * lista y en las cuentas de cada faceta, para que el número al lado de una
 * opción sea lo que de verdad trae.
 */
export function pasaLosCortesComunes(fila: PublicSearchResult, cortes: CortesComunes): boolean {
  const minima = cortes.calificacionMinima;
  return (
    (!cortes.soloVerificados || fila.verified) &&
    (!cortes.soloConAgenda || fila.hasPublishedAgenda) &&
    (minima === null || (fila.ratingAverage ?? 0) >= minima)
  );
}

/**
 * Las facetas de verificación, nota y agenda. Las dos últimas sólo si hay con
 * qué: una nota mínima sobre un directorio sin reseñas devuelve siempre cero.
 * La puesta se ofrece igual, para que no quede un filtro activo sin verse.
 */
export function filtrosComunes(
  todas: readonly PublicSearchResult[],
  cortes: CortesComunes,
): FilterDef[] {
  const filtros: FilterDef[] = [
    {
      key: PARAM_VERIFICADO,
      label: 'Verificación',
      icon: 'shield',
      asChips: true,
      options: [{ value: 'true', label: 'Sólo verificadas' }],
    },
  ];
  const notas = todas.map((fila) => fila.ratingAverage ?? 0);
  const topes = TOPES_DE_CALIFICACION.filter(({ valor }) => notas.some((nota) => nota >= valor));
  if (topes.length > 0 || cortes.calificacionMinima !== null) {
    filtros.push({
      key: PARAM_CALIFICACION,
      label: 'Calificación',
      icon: 'star',
      asChips: true,
      options: topes.map(({ valor, rotulo }) => ({ value: String(valor), label: rotulo })),
    });
  }
  if (todas.some((fila) => fila.hasPublishedAgenda) || cortes.soloConAgenda) {
    filtros.push({
      key: PARAM_AGENDA,
      label: 'Agenda',
      icon: 'calendar',
      asChips: true,
      options: [{ value: 'true', label: 'Con turnos en línea' }],
    });
  }
  return filtros;
}
