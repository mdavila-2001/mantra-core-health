/**
 * Los tramos de los recorridos del viernes que **todavía no están en `dev`**.
 *
 * Cada flag cubre un pedazo del guion que espera un merge ajeno (o un arreglo
 * del backend). El spec deja el tramo estructurado detrás del flag: encenderlo
 * es exportar la variable de entorno antes de correr — cero cambios de código.
 *
 * La variable viaja al navegador por el bloque `expose` de `cypress.config.ts`
 * (la suite apaga `Cypress.env()`), y **la ausencia de la variable es
 * «apagado»**: una corrida sin configurar nada ejercita exactamente lo que
 * `dev` tiene hoy.
 */
export type Tramo =
  /** Alta por la pantalla `/auth/registro`. Apagado por P14: el backend responde 500 al payload de 4 partes que manda el formulario. */
  | 'TRAMO_REGISTRO'
  /** Cancelar un turno desde el portal. La pantalla no existe: espera el merge de E1. */
  | 'TRAMO_E1_CANCELAR'
  /** Registrar diagnóstico y observación en el expediente. Esperan el merge de M1. */
  | 'TRAMO_M1_CLINICA'
  /** Crear → firmar → emitir una receta, y el 422 amable al emitir sin firmar. Espera el merge de P1. */
  | 'TRAMO_P1_RECETA'
  /** Aprobar la revisión deja al titular con acceso: su resumen pasa de 403 a 200. Espera el merge del PR #54 de la API (N4/H-01). */
  | 'TRAMO_N4_ACCESO';

const ENCENDIDO = ['1', 'true', 'si', 'sí', 'yes'];

/** `true` sólo si la variable del tramo se exportó con un valor afirmativo. */
export function tramoActivo(tramo: Tramo): boolean {
  const valor = Cypress.expose(tramo) as unknown;
  return typeof valor === 'string' && ENCENDIDO.includes(valor.trim().toLowerCase());
}

/**
 * Deja constancia en el reporte de que un tramo del guion no se recorrió.
 *
 * Es la misma idea que `aparece()`: la ausencia es un **dato**, no un fallo, y
 * un tramo salteado en silencio se leería como cobertura que no existe.
 */
export function anotarTramoApagado(tramo: Tramo, pantalla: string, queCubre: string): void {
  cy.task(
    'anotarOmision',
    {
      pantalla,
      motivo: `Tramo ${tramo} apagado: ${queCubre}. Para recorrerlo, exportá ${tramo}=true antes de correr.`,
    },
    { log: false },
  );
}
