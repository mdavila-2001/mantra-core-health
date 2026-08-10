/**
 * Resoluciones representativas.
 *
 * Vive aparte de `config.ts` porque lo importan **los dos lados**: la
 * configuración de Node, para fijar el tamaño por defecto de la ventana, y las
 * pruebas responsive, que corren en el navegador. `config.ts` lee `process.env`
 * y no puede viajar al bundle del navegador; esto es solo datos y sí puede.
 */

export interface Viewport {
  readonly ancho: number;
  readonly alto: number;
}

/** Las tres que usan las pruebas responsive. */
export const VIEWPORTS = {
  escritorio: { ancho: 1440, alto: 900 },
  tableta: { ancho: 900, alto: 1024 },
  movil: { ancho: 390, alto: 844 },
} as const satisfies Record<string, Viewport>;

export type NombreViewport = keyof typeof VIEWPORTS;
