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

/*
    ## Zonas finas: una zona, pocas especialidades

    La primera tabla tenía siete zonas del cuerpo, y «Huesos y músculos» juntaba
    la rodilla con el hombro y la mano. Tocar el hombro y que te ofrezcan
    «dolor de rodilla» es la señal de que la figura no escucha. Ahora cada
    parte que uno señala tiene su zona —hombros, brazos, manos, caderas,
    rodillas, pies, nuca, espalda, cintura— y cada una ofrece los síntomas de
    ESA parte, que es lo que las lleva a especialidades distintas: la cara a
    oftalmología, otorrino u odontología; la cintura a urología y nefrología;
    la pierna a traumatología o a cardiología por la circulación.

    Un síntoma puede estar en más de una zona (el hormigueo se siente en la
    mano y en el pie): la zona es por dónde se entra, no una clasificación.
*/
export const ZONAS_DEL_CUERPO: readonly ZonaDelCuerpo[] = [
  // ─── La cabeza y la cara ───────────────────────────────────────────────
  {
    id: 'cabeza',
    nombre: 'Cabeza',
    icono: 'cabeza',
    sintomas: ['dolor-de-cabeza', 'mareo', 'hormigueo', 'temblor', 'olvidos', 'debilidad-de-un-lado'],
  },
  {
    id: 'ojos',
    nombre: 'Ojos',
    icono: 'ojo',
    sintomas: ['vision-borrosa', 'ojo-irritado', 'necesito-lentes'],
  },
  {
    id: 'oidos',
    nombre: 'Oídos',
    icono: 'garganta',
    sintomas: ['dolor-de-oido', 'mareo'],
  },
  {
    id: 'nariz',
    nombre: 'Nariz',
    icono: 'garganta',
    sintomas: ['congestion-nasal', 'resfrio', 'sangrado-de-nariz', 'ronquidos'],
  },
  {
    id: 'boca',
    nombre: 'Boca y dientes',
    icono: 'garganta',
    sintomas: ['dolor-de-muelas', 'llagas-en-la-boca', 'dolor-de-mandibula', 'consulta-dental'],
  },
  {
    id: 'garganta',
    nombre: 'Garganta y cuello',
    icono: 'garganta',
    sintomas: ['dolor-de-garganta', 'ronquera', 'tiroides', 'ganglios', 'dolor-de-cuello'],
  },
  {
    id: 'nuca',
    nombre: 'Nuca',
    icono: 'huesos',
    sintomas: ['dolor-de-cuello', 'dolor-de-cabeza', 'mareo'],
  },
  // ─── El tronco ─────────────────────────────────────────────────────────
  {
    id: 'pecho',
    nombre: 'Pecho y respiración',
    icono: 'pecho',
    sintomas: [
      'tos',
      'falta-de-aire',
      'dolor-de-pecho',
      'palpitaciones',
      'asma',
      'presion-alta',
      'bulto-en-la-mama',
    ],
  },
  {
    id: 'estomago',
    nombre: 'Estómago',
    icono: 'panza',
    sintomas: ['acidez', 'nauseas', 'dolor-de-panza', 'gases'],
  },
  {
    id: 'abdomen',
    nombre: 'Panza e intestino',
    icono: 'panza',
    sintomas: ['dolor-de-panza', 'diarrea', 'estrenimiento', 'gases'],
  },
  {
    id: 'espalda',
    nombre: 'Espalda',
    icono: 'huesos',
    sintomas: ['dolor-de-espalda', 'dolor-de-cuello'],
  },
  {
    id: 'rinones',
    nombre: 'Cintura y riñones',
    icono: 'huesos',
    sintomas: ['dolor-de-espalda', 'colico-renal', 'sangre-en-la-orina', 'ardor-al-orinar'],
  },
  {
    id: 'intima',
    nombre: 'Salud íntima',
    icono: 'intima',
    sintomas: [
      'ardor-al-orinar',
      'sangre-en-la-orina',
      'flujo-vaginal',
      'dolor-menstrual',
      'atraso-menstrual',
      'sangrado-menstrual-abundante',
      'control-embarazo',
      'prostata',
      'dolor-de-testiculos',
      'problemas-de-ereccion',
      'dolor-al-tener-relaciones',
      'infeccion-de-transmision-sexual',
    ],
  },
  {
    id: 'gluteos',
    nombre: 'Glúteos y cola',
    icono: 'huesos',
    sintomas: ['hemorroides', 'dolor-de-cadera', 'dolor-de-espalda'],
  },
  // ─── Brazos y piernas ─────────────────────────────────────────────────
  {
    id: 'hombros',
    nombre: 'Hombros',
    icono: 'huesos',
    sintomas: ['dolor-de-hombro', 'golpe-o-torcedura', 'dolor-articular'],
  },
  {
    id: 'brazos',
    nombre: 'Brazos y codos',
    icono: 'huesos',
    sintomas: ['dolor-de-codo', 'hormigueo', 'golpe-o-torcedura', 'dolor-articular'],
  },
  {
    id: 'manos',
    nombre: 'Manos y muñecas',
    icono: 'huesos',
    sintomas: ['dolor-de-mano', 'hormigueo', 'dolor-articular', 'hongos'],
  },
  {
    id: 'caderas',
    nombre: 'Caderas',
    icono: 'huesos',
    sintomas: ['dolor-de-cadera', 'dolor-articular', 'golpe-o-torcedura'],
  },
  {
    id: 'piernas',
    nombre: 'Piernas',
    icono: 'huesos',
    sintomas: ['hinchazon-de-piernas', 'varices', 'hormigueo', 'golpe-o-torcedura'],
  },
  {
    id: 'rodillas',
    nombre: 'Rodillas',
    icono: 'huesos',
    sintomas: ['dolor-de-rodilla', 'dolor-articular', 'golpe-o-torcedura'],
  },
  {
    id: 'pies',
    nombre: 'Pies y tobillos',
    icono: 'huesos',
    sintomas: ['dolor-de-pie', 'hinchazon-de-piernas', 'hongos', 'herida-que-no-cierra'],
  },
  // ─── Lo que no está en un lugar del cuerpo ─────────────────────────────
  {
    id: 'piel',
    nombre: 'Piel y pelo',
    icono: 'piel',
    sintomas: ['erupcion', 'lunar-que-cambio', 'acne', 'hongos', 'caida-de-pelo', 'picadura'],
  },
  {
    id: 'animo',
    nombre: 'Ánimo y sueño',
    icono: 'animo',
    sintomas: ['ansiedad', 'tristeza', 'insomnio', 'cansancio', 'duelo', 'adiccion'],
  },
  {
    id: 'general',
    nombre: 'General y controles',
    icono: 'general',
    sintomas: [
      'fiebre',
      'azucar-alta',
      'tiroides',
      'colesterol',
      'perdida-de-peso',
      'chequeo',
      'nutricion',
      'control-de-nino',
      'vacunas',
    ],
  },
];
