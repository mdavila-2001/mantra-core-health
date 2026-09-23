/* ============================================================================
    La silueta del cuerpo, para señalar dónde duele con el dedo o con el
    teclado (P-01, doctor 22/09/2026: «un dibujo como el mapa de Bolivia…
    donde uno le dé click identifique la parte del cuerpo»).

    ## Qué es y qué no es este dato

    **Es un dibujo esquemático hecho para este control, no una lámina
    anatómica.** No tiene fuente externa porque no representa ningún dato del
    mundo: son siete formas cerradas sobre una figura neutra y frontal.
    Comparado con `bolivia-departments.geometry.ts` —que sí es la frontera
    oficial y por eso lleva su procedencia— acá no hay nada que citar ni nada
    que se pueda presentar como real: es lo que la regla 97 llama dato
    sintético declarado.

    ## Cómo está dibujada

    Con las proporciones del canon de figura (≈ 7,5 cabezas de alto): el codo
    a la altura de la cintura, la muñeca a la de la cadera, la punta de los
    dedos a medio muslo, la entrepierna a ~55 % del alto y la rodilla a mitad
    de pierna. Todo contorno exterior es curvo (Bézier cúbicas): cabeza con
    mandíbula, banda de los ojos con la muesca de la nariz, orejas redondeadas, cuello que se abre en los
    trapecios, hombros, cintura, cadera, brazos con codo, muñeca y mano,
    piernas con rodilla, tobillo y pie. Las únicas rectas son las costuras
    horizontales **entre** zonas del tronco (pecho/panza y panza/pelvis), que
    marcan dónde termina una zona y empieza otra, como en cualquier mapa
    corporal. Las zonas vecinas comparten exactamente la misma curva en su
    borde común, así no quedan rendijas ni solapes entre ellas.

    La primera versión (23/09/2026) era un maniquí de bloques —ojos como un
    visor rectangular, orejas como dos pestañas, brazos y piernas rectos sin
    manos ni pies— y se rechazó por fea con toda razón. Esta la reemplaza.

    ## Por qué el `id` es el de la tabla de zonas

    Porque el organismo no sabe de síntomas: recibe `{ id, nombre }` de quien lo
    monta y sólo dibuja las formas cuyo `id` llegó. Las zonas de
    `features/symptom-check/zonas.datos.ts` que no son una parte del cuerpo
    («piel», «ánimo», «general») no tienen forma acá y siguen viviendo como
    pastillas: esta silueta es una segunda puerta, no la única.

    ## Orden

    El orden de este arreglo es el orden del tabulador y también el de pintado:
    de arriba abajo. «ojos» va después de «cabeza» para quedar encima de la
    cara, y «orl» después de las dos para que las orejas se apoyen sobre el
    borde de la cabeza. Brazos y piernas van juntos en «huesos» porque así los
    agrupa la tabla de síntomas: son subtrazos `M…Z` de un mismo `d`, un solo
    control.

    ## `viewBox` y tamaño de los objetivos

    200 de ancho por 440 de alto: la figura es vertical. A 375 px de ancho el
    lienzo se pinta a ~196 px (una unidad ≈ 1 px), así que toda zona tiene al
    menos 24 × 24 unidades de área contigua para cumplir WCAG 2.2 · 2.5.8. Por
    eso la banda de los ojos mide 30 × 26 aunque un par de ojos reales sea
    más bajo, y el cuello 24 de ancho: son objetivos, no anatomía.
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
    // La cabeza: más ancha en los pómulos, afinándose hacia el mentón.
    id: 'cabeza',
    d:
      'M100 9 C112 9 121 19 121 34 C121 49 114 61 100 66 ' +
      'C86 61 79 49 79 34 C79 19 88 9 100 9 Z',
  },
  {
    // Los ojos: una banda suave sobre la línea de los ojos, con la muesca de
    // la nariz abajo. Encima de la cabeza porque se pinta después.
    id: 'ojos',
    d:
      'M85 37 C85 30 91 25 100 25 C109 25 115 30 115 37 ' +
      'C115 46 111 51 106 51 C103 51 101 48 100 47 ' +
      'C99 48 97 51 94 51 C89 51 85 46 85 37 Z',
  },
  {
    // Oído, nariz y garganta: el cuello, que arranca pegado al mentón y se
    // abre hacia los trapecios, y las dos orejas contra los lados de la cabeza.
    id: 'orl',
    d:
      'M88 59 C94 67 106 67 112 59 C111 70 112 80 116 88 ' +
      'C106 91 94 91 84 88 C88 80 89 70 88 59 Z ' +
      'M80 30 C75 29 73 34 73 38 C73 43 75 47 80 46 C81 41 81 35 80 30 Z ' +
      'M120 30 C125 29 127 34 127 38 C127 43 125 47 120 46 C119 41 119 35 120 30 Z',
  },
  {
    // Pecho y respiración: de la base del cuello a las últimas costillas; los
    // trapecios bajan hacia los hombros y el tronco se angosta un poco.
    id: 'pecho',
    d:
      'M84 88 C74 90 62 92 54 96 C52 104 55 114 60 122 ' +
      'C62 132 63 142 64 150 L136 150 ' +
      'C137 142 138 132 140 122 C145 114 148 104 146 96 ' +
      'C138 92 126 90 116 88 C106 91 94 91 84 88 Z',
  },
  {
    // Panza y digestión: la cintura se cierra a la altura del ombligo y se
    // vuelve a abrir hacia la cadera.
    id: 'panza',
    d:
      'M64 150 L136 150 C135 160 133 166 133 174 C133 184 135 193 137 200 ' +
      'L63 200 C65 193 67 184 67 174 C67 166 65 160 64 150 Z',
  },
  {
    // Huesos y músculos: los dos brazos (hombro, codo a la altura de la
    // cintura, muñeca a la de la cadera, mano) y las dos piernas (muslo,
    // rodilla, pantorrilla, tobillo, pie), un solo control.
    id: 'huesos',
    d:
      // Brazo izquierdo del lienzo: el hombro sigue la curva del trapecio, el
      // brazo se separa del tronco (queda un hueco a la altura de la cintura),
      // el antebrazo se afina hacia la muñeca y la mano no es más ancha que él.
      'M54 96 C46 100 38 103 36 113 C34 125 34 137 33 150 C32 160 32 166 32 172 ' +
      'C31 186 30 204 29 226 C27 238 26 252 28 264 C30 271 38 272 41 266 ' +
      'C43 258 43 240 41 226 C43 206 46 188 48 172 C49 158 52 140 60 122 ' +
      'C55 114 52 104 54 96 Z ' +
      // Brazo derecho, en espejo.
      'M146 96 C154 100 162 103 164 113 C166 125 166 137 167 150 C168 160 168 166 168 172 ' +
      'C169 186 170 204 171 226 C173 238 174 252 172 264 C170 271 162 272 159 266 ' +
      'C157 258 157 240 159 226 C157 206 154 188 152 172 C151 158 148 140 140 122 ' +
      'C145 114 148 104 146 96 Z ' +
      // Pierna izquierda: muslo, rodilla, pantorrilla, tobillo y un pie que
      // apunta un poco hacia afuera.
      'M65 232 C76 236 90 239 98 244 C99 270 97 302 94 332 ' +
      'C93 340 93 348 94 354 C96 370 96 392 92 414 C92 420 93 426 92 430 ' +
      'C90 436 78 437 70 434 C66 432 69 424 77 414 C72 398 69 376 71 354 ' +
      'C72 346 72 340 71 332 C67 302 62 264 65 232 Z ' +
      // Pierna derecha, en espejo.
      'M135 232 C124 236 110 239 102 244 C101 270 103 302 106 332 ' +
      'C107 340 107 348 106 354 C104 370 104 392 108 414 C108 420 107 426 108 430 ' +
      'C110 436 122 437 130 434 C134 432 131 424 123 414 C128 398 131 376 129 354 ' +
      'C128 346 128 340 129 332 C133 302 138 264 135 232 Z',
  },
  {
    // Salud íntima: la pelvis, de la cadera a la entrepierna.
    id: 'intima',
    d:
      'M63 200 L137 200 C139 208 140 220 135 232 C124 236 110 239 102 244 ' +
      'C101 245 99 245 98 244 C90 239 76 236 65 232 C60 220 61 208 63 200 Z',
  },
];
