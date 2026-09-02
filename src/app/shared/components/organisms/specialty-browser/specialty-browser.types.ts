/**
 * Un tramo rotulado del explorador: una especialidad y lo que trae adentro.
 *
 * Los grupos llegan **ya armados y ordenados** por quien tiene los datos. El
 * organismo no agrupa ni ordena: cada pantalla sabe si su criterio es la
 * etiqueta de terminología, la cercanía o el orden que devolvió el backend, y
 * unificarlo acá obligaría a elegir uno y empeorar a los demás.
 */
export interface SpecialtyGroup<T> {
  /**
   * Concept id de la especialidad. Es la clave del `@for` y la que ata el
   * encabezado con su grilla — nunca se muestra en pantalla.
   */
  readonly conceptId: string;
  /**
   * La etiqueta legible del tramo. Quien la resuelve es el consumidor, que es
   * el que habló con terminología y sabe qué poner si el concepto no resolvió.
   */
  readonly label: string;
  readonly items: readonly T[];
}

/**
 * El contexto con el que se estampa la tarjeta que aporta el consumidor.
 *
 * ```html
 * <ng-template let-formulario let-grupo="group"> … </ng-template>
 * ```
 *
 * Va el grupo además del ítem porque una tarjeta suele querer nombrar de dónde
 * cuelga —«Cardiología · Ficha base»— y volver a buscarlo desde afuera sería
 * recorrer los grupos de nuevo.
 */
export interface SpecialtyItemContext<T> {
  readonly $implicit: T;
  readonly group: SpecialtyGroup<T>;
}
