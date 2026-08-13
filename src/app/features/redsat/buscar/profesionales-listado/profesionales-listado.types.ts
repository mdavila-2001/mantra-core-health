import type {
  SearchResultItem,
  SearchResultTone,
} from '../../../../shared/components/molecules';

/**
 * Un profesional en el listado, con lo que va en su columna derecha.
 *
 * La columna derecha **no está en `SearchResultItem`** a propósito: cambia por
 * completo entre los seis listados de V65 —precio y disponibilidad acá, stock y
 * farmacia en medicamentos, distancia en hospitales— y casi siempre lleva un
 * botón. Modelarla en la tarjeta habría dado un tipo con seis campos opcionales
 * de los que cada pantalla usa dos. Se proyecta, y cada pantalla declara lo
 * suyo — esto.
 */
export interface ProfesionalEnListado {
  /** Lo que la tarjeta sabe pintar por sí sola. */
  readonly resultado: SearchResultItem;
  /** El precio, con cifras tabulares para que la lista quede en columna. */
  readonly precio: string;
  /** La línea chica bajo el precio: «consulta», «teleconsulta». */
  readonly precioNota: string;
  /** El próximo hueco de agenda, tal como se lee: «Hoy 16:30». */
  readonly disponibilidad: string;
  /**
   * El tono de la disponibilidad.
   *
   * No es decorativo: `ok` es hoy, `aviso` es más adelante y `neutro` es sin
   * agenda abierta. Es la única señal de la tarjeta que distingue «puedo verlo
   * hoy» de «tengo que esperar».
   */
  readonly disponibilidadTono: SearchResultTone;
}
