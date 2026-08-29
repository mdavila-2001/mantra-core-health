/**
 * Un tarifario de la unidad, tal como esta consola puede conocerlo.
 *
 * No hay lectura de colección de tarifarios: la ficha trae los precios de cada
 * estudio y **de ahí se deducen** los que existen. Un tarifario recién creado
 * todavía no tiene ningún precio, así que no aparecería en esa deducción; por
 * eso la pantalla recuerda aparte los que creó.
 *
 * Vive en su propio archivo y no en el componente porque también lo consume el
 * servicio que los recuerda, y el componente ya depende de él: declararlo en el
 * componente los dejaría importándose de ida y de vuelta.
 */
export interface TarifarioDeLaUnidad {
  readonly id: string;
  readonly code: string;
  readonly esPublico: boolean;
  readonly cantidadDePrecios: number;
}
