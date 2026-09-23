/* ============================================================================
    Las zonas del cuerpo con las que se elige un síntoma sin escribir.

    ## Por qué existen

    La pantalla arrancaba con un campo de texto vacío y tres párrafos. Un campo
    vacío es la peor pregunta posible: quien no sabe a qué médico ir tampoco
    sabe con qué palabras nombrarlo, y termina escribiendo «me siento mal».

    Con las zonas, la primera decisión es **señalar dónde**, que es lo que hace
    cualquiera cuando le duele algo, y recién después elegir qué. El campo de
    texto sigue estando, porque hay síntomas que no entran en ninguna zona y
    porque escribir es más rápido para quien ya sabe qué decir — pero deja de
    ser la única puerta.

    ## Por qué la lista es por `id` y no repite los nombres

    Los nombres viven en `SINTOMAS`, que es la tabla que revisa el equipo
    médico. Repetirlos acá crearía una segunda fuente que se desincroniza en la
    primera corrección: si un `id` de esta lista no existe allá, la zona
    sencillamente no lo ofrece — se ignora, no rompe la pantalla.

    ## Los tres síntomas de alarma que NO están en ninguna zona

    `pérdida de conocimiento`, `sangrado que no para` y `convulsión` no se
    ofrecen como pastilla para tocar. Quien está en esa situación no está
    navegando una grilla, y ponerlos entre las opciones bonitas banaliza lo que
    son. Se siguen reconociendo por texto, que es como llegan de verdad, y
    disparan la derivación a urgencias igual.
    ========================================================================== */

/** Una zona del cuerpo, con los síntomas que se le preguntan. */
export interface ZonaDelCuerpo {
  readonly id: string;
  /** Cómo se llama en la pastilla. Corto: entra en dos palabras. */
  readonly nombre: string;
  /** Clave del dibujo. La resuelve el `@switch` de la plantilla. */
  readonly icono: string;
  /** Los `id` de `SINTOMAS` que esta zona ofrece, en orden de frecuencia. */
  readonly sintomas: readonly string[];
}

export const ZONAS_DEL_CUERPO: readonly ZonaDelCuerpo[] = [
  {
    id: 'cabeza',
    nombre: 'Cabeza y mareos',
    icono: 'cabeza',
    sintomas: ['dolor-de-cabeza', 'mareo', 'debilidad-de-un-lado'],
  },
  {
    id: 'ojos',
    nombre: 'Ojos',
    icono: 'ojo',
    sintomas: ['vision-borrosa'],
  },
  {
    id: 'orl',
    nombre: 'Oído, nariz y garganta',
    icono: 'garganta',
    sintomas: ['dolor-de-garganta', 'dolor-de-oido', 'congestion-nasal', 'dolor-de-muelas'],
  },
  {
    id: 'pecho',
    nombre: 'Pecho y respiración',
    icono: 'pecho',
    sintomas: ['tos', 'falta-de-aire', 'dolor-de-pecho', 'palpitaciones', 'presion-alta'],
  },
  {
    id: 'panza',
    nombre: 'Panza y digestión',
    icono: 'panza',
    sintomas: ['dolor-de-panza', 'diarrea', 'nauseas', 'acidez'],
  },
  {
    id: 'huesos',
    nombre: 'Huesos y músculos',
    icono: 'huesos',
    sintomas: ['dolor-de-espalda', 'dolor-de-rodilla', 'dolor-articular', 'hinchazon-de-piernas'],
  },
  {
    id: 'piel',
    nombre: 'Piel y pelo',
    icono: 'piel',
    sintomas: ['erupcion', 'lunar-que-cambio', 'caida-de-pelo'],
  },
  {
    id: 'animo',
    nombre: 'Ánimo y sueño',
    icono: 'animo',
    sintomas: ['ansiedad', 'tristeza', 'insomnio', 'cansancio'],
  },
  {
    id: 'intima',
    nombre: 'Salud íntima',
    icono: 'intima',
    sintomas: [
      'ardor-al-orinar',
      'dolor-menstrual',
      'atraso-menstrual',
      'control-embarazo',
      'dolor-al-tener-relaciones',
      'problemas-de-ereccion',
    ],
  },
  {
    id: 'general',
    nombre: 'General y controles',
    icono: 'general',
    sintomas: [
      'fiebre',
      'azucar-alta',
      'tiroides',
      'perdida-de-peso',
      'chequeo',
      'nutricion',
      'control-de-nino',
    ],
  },
];
