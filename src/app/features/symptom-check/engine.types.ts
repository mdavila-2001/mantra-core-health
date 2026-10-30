import type { Symptom } from './symptoms.data';

/**
 * Un síntoma reconocido, con de dónde salió.
 *
 * La `evidencia` y la `confianza` no las usa la pantalla hoy: existen porque
 * sin ellas es imposible entender por qué el motor entendió lo que entendió, y
 * un motor de salud que no se puede auditar no se puede corregir.
 */
export interface Match {
  readonly sintoma: Symptom;
  /** 0 a 1. Exacta vale 1; por sonido, 0,9; por parecido, menos. */
  readonly confianza: number;
  /** Dónde empieza en el texto normalizado. Ordena los chips. */
  readonly desde: number;
  /** El trozo de texto que lo trajo. Para depurar y para explicar. */
  readonly evidencia: string;
  /** Si el texto lo **niega** («no tengo fiebre»). */
  readonly negado: boolean;
}
