/* ============================================================================
    La silueta del cuerpo, para señalar dónde duele con el dedo o con el
    teclado (P-01, doctor 22/09/2026: «un dibujo como el mapa de Bolivia…
    donde uno le dé click identifique la parte del cuerpo»).

    ## Qué es y qué no es este dato

    **Es un dibujo esquemático hecho para este control, no una lámina
    anatómica.** No tiene fuente externa porque no representa ningún dato del
    mundo: son siete formas cerradas sobre una figura neutra y frontal, con la
    proporción justa para reconocer cabeza, ojos, cuello, pecho, panza, brazos
    y piernas, y zona íntima de un vistazo a 375 px. Comparado con
    `bolivia-departments.geometry.ts` —que sí es la frontera oficial y por eso
    lleva su procedencia— acá no hay nada que citar ni nada que se pueda
    presentar como real: es lo que la regla 97 llama dato sintético declarado.

    ## Por qué el `id` es el de la tabla de zonas

    Porque el organismo no sabe de síntomas: recibe `{ id, nombre }` de quien lo
    monta y sólo dibuja las formas cuyo `id` llegó. Las zonas de
    `features/symptom-check/zonas.datos.ts` que no son una parte del cuerpo
    («piel», «ánimo», «general») no tienen forma acá y siguen viviendo como
    pastillas: esta silueta es una segunda puerta, no la única.

    ## Orden

    El orden de este arreglo es el orden del tabulador: de arriba abajo. Los
    brazos y las piernas van juntos en «huesos» porque así los agrupa la tabla
    de síntomas (dolor de espalda, rodilla, articular, hinchazón de piernas):
    son subtrazos `M…Z` de un mismo `d`, un solo control.

    ## `viewBox` y tamaño de los objetivos

    200 de ancho por 440 de alto: la figura es vertical, y un `viewBox` cuadrado
    dejaría la mitad del lienzo vacío a los lados. A 375 px de ancho el lienzo
    se pinta a ~196 px, es decir una unidad ≈ 1 px: **toda forma tiene al menos
    26 × 26 unidades de área contigua** para cumplir el mínimo de 24 × 24 px de
    WCAG 2.2 (2.5.8) sin depender del espacio alrededor. Por eso la banda de los
    ojos es más alta que un par de ojos real y el cuello es más largo que el de
    una figura proporcionada: son objetivos, no anatomía.
    ========================================================================== */

/** Una zona dibujable: su `id` (el de la tabla de zonas) y su contorno cerrado. */
export interface SiluetaDeZona {
  readonly id: string;
  /** Contorno(s) cerrado(s), `M…Z`; puede tener varios subtrazos. */
  readonly d: string;
}

export const CUERPO_VIEW_BOX = '0 0 200 440';

export const SILUETAS_DEL_CUERPO: readonly SiluetaDeZona[] = [
  {
    // La cabeza entera: la forma de abajo, sobre la que se apoya la de los ojos.
    id: 'cabeza',
    d: 'M100 10 C120 10 132 28 132 50 C132 72 120 90 100 90 C80 90 68 72 68 50 C68 28 80 10 100 10 Z',
  },
  {
    // Los ojos: una banda sobre la cara (48 × 28). Va DESPUÉS de la cabeza para quedar encima.
    id: 'ojos',
    d: 'M76 36 L124 36 L124 64 L76 64 Z',
  },
  {
    // Oído, nariz y garganta: el cuello (≥ 28 × 32), con las dos orejas a los lados de la cabeza.
    id: 'orl',
    d: 'M86 90 L114 90 L116 122 L84 122 Z M62 40 L68 40 L68 64 L62 64 Z M132 40 L138 40 L138 64 L132 64 Z',
  },
  {
    // Pecho y respiración: de los hombros a debajo de las costillas.
    id: 'pecho',
    d: 'M60 122 L140 122 L148 138 L142 202 L58 202 L52 138 Z',
  },
  {
    // Panza y digestión: hasta la cadera.
    id: 'panza',
    d: 'M58 202 L142 202 L140 258 L60 258 Z',
  },
  {
    // Huesos y músculos: los dos brazos y las dos piernas, un solo control.
    // Las piernas (32 de ancho) son las que dan el área mínima; los brazos son más finos.
    id: 'huesos',
    d:
      'M52 130 L34 136 L22 246 L42 250 L52 170 Z ' +
      'M148 130 L166 136 L178 246 L158 250 L148 170 Z ' +
      'M64 298 L96 298 L92 428 L66 428 Z ' +
      'M104 298 L136 298 L134 428 L108 428 Z',
  },
  {
    // Salud íntima: la pelvis, entre la panza y las piernas.
    id: 'intima',
    d: 'M60 258 L140 258 L136 298 L104 298 L100 310 L96 298 L64 298 Z',
  },
];
