/* ============================================================================
    La tabla de síntomas y a qué especialidad orientan.

    ## Por qué es una tabla curada y no un modelo

    C1 del plan de UX del 22/08/2026. El efecto que el flujo tiene que producir
    es «me entendió»: que quien escribe «me duele la cabeza hace tres días y
    veo borroso» vea aparecer *dolor de cabeza* y *visión borrosa* mientras
    escribe. Un modelo agregaría latencia, coste, una dependencia y —lo peor—
    respuestas que nadie puede explicar en una pantalla de salud.

    ## Qué cambió: la tabla ya no tiene que adivinar cómo se escribe

    Antes cada fila enumeraba las frases exactas que el buscador iba a
    encontrar como subcadena, y por eso «me duele la rodilla» y «me duelen las
    rodillas» tenían que estar las dos. Ahora el motor (`motor.ts`) reduce el
    texto y la tabla a **lemas**: `dolor` + `rodilla` cubre las dos, y también
    «rodilla dolorida», «dolor fuerte en la rodilla» y «me duele la rodilla
    derecha».

    Eso cambia cómo se escribe una fila:

    - Los `sinonimos` son **maneras distintas de nombrarlo**, no variantes
      gramaticales de la misma manera. «Anginas» y «me arde la garganta» sí;
      «me duele la garganta» y «me duelen las gargantas», no.
    - `partes` es la lista de partes del cuerpo de la fila: el motor genera solo
      las combinaciones con dolor y con molestia.
    - Las faltas de ortografía **no se escriben**: el motor compara por cómo
      suena la palabra, y «caveza», «cabesa» y «cabeza» le llegan iguales.

    ## Por qué las especialidades van por NOMBRE y no por `conceptId`

    Porque esta tabla la escribe y la revisa gente del equipo médico, y un
    archivo de uuids no se puede revisar. El nombre se cruza —normalizado— con
    las especialidades que **de verdad tienen profesionales publicados** en el
    directorio, así que una especialidad que la plataforma no ofrece
    sencillamente no se recomienda. Un chip que lleva a cero resultados es peor
    que no tenerlo.

    ## Qué NO es esta tabla

    **No diagnostica.** Orienta hacia una especialidad, que es una decisión de
    a quién consultar, no de qué se tiene. La pantalla lo dice con todas las
    letras y no depende de que alguien lo recuerde.

    Las filas salen de los motivos de consulta más frecuentes de atención
    primaria. **Falta que el equipo médico las revise**: hasta entonces son una
    orientación razonable, no una lista validada.
    ========================================================================== */

/** Una especialidad candidata, con cuánto pesa para ese síntoma. */
export interface EspecialidadSugerida {
  /** El nombre tal como se lee. Se cruza normalizado con el directorio. */
  readonly nombre: string;
  /** 3 = es lo primero que uno pensaría · 1 = también podría ser. */
  readonly peso: number;
}

/** Un síntoma reconocible y a qué orienta. */
export interface Sintoma {
  readonly id: string;
  /** Cómo se lo nombra en el chip. En castellano llano. */
  readonly nombre: string;
  /**
   * Las maneras distintas de nombrarlo.
   *
   * Se escriben **sin tildes y en minúscula** porque así se comparan, y se
   * escriben en una sola forma: el motor resuelve el plural, la conjugación y
   * las faltas de ortografía. Lo que hay que enumerar es el vocabulario —lo que
   * en un país se dice «panza» y en otro «guata»—, no la gramática.
   */
  readonly sinonimos: readonly string[];
  /**
   * Las partes del cuerpo de esta fila.
   *
   * El motor arma solo «dolor de X» y «molestia en X» con cada una, que es la
   * mitad de los textos de esta pantalla y era la mitad de la tabla.
   */
  readonly partes?: readonly string[];
  /** Qué se combina con `partes`. Por omisión, dolor y molestia. */
  readonly gatillos?: readonly string[];
  /** Si en vez de orientar a una especialidad hay que ir a una guardia. */
  readonly alarma?: boolean;
  /**
   * Si es un motivo **de reserva**: vale cuando no hay ninguno concreto.
   *
   * «Quiero un control» al lado de «problemas de tiroides» sobra: la persona
   * dijo qué se quiere controlar. Con esta marca, el motivo genérico aparece
   * sólo cuando es lo único que hay, que es cuando de verdad orienta.
   */
  readonly generico?: boolean;
  /** Qué decirle a quien escribió una alarma, si el aviso general no alcanza. */
  readonly mensaje?: string;
  readonly especialidades: readonly EspecialidadSugerida[];
}

/**
 * Síntomas que **no se orientan a una especialidad: se derivan a urgencias**.
 *
 * C6 del plan. No es una lista de emergencias médicas completa ni pretende
 * serlo: es la lista corta de lo que, apareciendo en un texto libre, obliga a
 * la pantalla a dejar de recomendar y decir «andá ahora». Recomendarle
 * cardiología con turno para el jueves a alguien que escribió «me duele el
 * pecho y no puedo respirar» sería el peor resultado posible de esta pantalla.
 *
 * **Falta la revisión del equipo médico**, igual que la tabla de abajo.
 */
export const SINTOMAS_DE_ALARMA: readonly Sintoma[] = [
  {
    id: 'dolor-de-pecho',
    nombre: 'dolor de pecho',
    sinonimos: [
      'opresion en el pecho',
      'presion en el pecho',
      'peso en el pecho',
      'aprieta el pecho',
      'dolor toracico',
      'dolor de pecho que baja al brazo',
      'me duele el pecho y el brazo',
    ],
    partes: ['pecho', 'torax'],
    alarma: true,
    especialidades: [],
  },
  {
    id: 'falta-de-aire',
    nombre: 'dificultad para respirar',
    sinonimos: [
      'no puedo respirar',
      'me falta el aire',
      'falta de aire',
      'dificultad para respirar',
      'me ahogo',
      'ahogo',
      'disnea',
      'me cuesta respirar',
      'no me entra el aire',
      'me quedo sin aire',
    ],
    alarma: true,
    especialidades: [],
  },
  {
    id: 'perdida-de-conciencia',
    nombre: 'pérdida de conocimiento',
    sinonimos: [
      'me desmaye',
      'desmayo',
      'perdi el conocimiento',
      'perdida de conocimiento',
      'sincope',
      'me desvanezco',
      'se desmayo',
      'quede inconsciente',
    ],
    alarma: true,
    especialidades: [],
  },
  {
    id: 'debilidad-de-un-lado',
    nombre: 'debilidad de un lado del cuerpo',
    sinonimos: [
      'no siento un lado',
      'se me durmio medio cuerpo',
      'no puedo mover el brazo',
      'no puedo mover la pierna',
      'se me tuerce la boca',
      'no puedo hablar bien',
      'debilidad de un lado',
      'se me traba la lengua',
      'no siento la cara',
      'no siento medio cuerpo',
      'se me durmio la cara',
      'se me durmio la mitad del cuerpo',
      'se me durmio un lado',
      'se me cae la cara',
      'no siento el brazo',
      'no siento la pierna',
    ],
    alarma: true,
    especialidades: [],
  },
  {
    id: 'derrame-cerebral',
    nombre: 'signos de derrame',
    sinonimos: ['derrame cerebral', 'acv', 'embolia', 'trombosis cerebral', 'me dio un derrame'],
    alarma: true,
    especialidades: [],
  },
  {
    id: 'infarto',
    nombre: 'signos de infarto',
    sinonimos: [
      'infarto',
      'ataque al corazon',
      'ataque cardiaco',
      'paro cardiaco',
      'me esta dando un infarto',
    ],
    alarma: true,
    especialidades: [],
  },
  {
    id: 'sangrado-abundante',
    nombre: 'sangrado que no para',
    sinonimos: [
      // «sangro mucho» a secas NO está: se reducía a una sola palabra —sangre—
      // y con ella mandaba a una guardia a quien escribió que le sangran las
      // encías al cepillarse. Una alarma se dispara con lo que la persona dijo
      // entero, no con una palabra suelta.
      'sangrado abundante',
      'no para de sangrar',
      'sangro sin parar',
      'perdi mucha sangre',
      'hemorragia',
      'vomito sangre',
      'sangre en el vomito',
      'sangrado que no para',
    ],
    alarma: true,
    especialidades: [],
  },
  {
    id: 'convulsion',
    nombre: 'convulsión',
    sinonimos: [
      // «ataque», a secas, NO está: cazaba «ataques de pánico» y mandaba a una
      // guardia a alguien con ansiedad. Es el falso positivo más caro que
      // tenía esta pantalla.
      'convulsion',
      'me convulsione',
      'ataque epileptico',
      'ataque convulsivo',
      'se convulsiono',
      'perdio el conocimiento y temblaba',
    ],
    alarma: true,
    especialidades: [],
  },
  {
    id: 'intoxicacion',
    nombre: 'intoxicación',
    sinonimos: [
      'me intoxique',
      'tome veneno',
      'tome muchas pastillas',
      'sobredosis',
      'tomo lavandina',
      'se tomo un veneno',
      'intoxicacion',
    ],
    alarma: true,
    especialidades: [],
  },
  {
    id: 'sangrado-en-el-embarazo',
    nombre: 'sangrado durante el embarazo',
    sinonimos: [
      'estoy embarazada y sangro',
      'sangrado en el embarazo',
      'perdidas en el embarazo',
      'sangre estando embarazada',
      'embarazada con sangrado',
    ],
    alarma: true,
    especialidades: [],
  },
  {
    id: 'dolor-de-cabeza-subito',
    nombre: 'dolor de cabeza súbito e intenso',
    sinonimos: [
      'el peor dolor de cabeza de mi vida',
      'dolor de cabeza de golpe',
      'dolor de cabeza de repente muy fuerte',
      'me exploto la cabeza de dolor',
    ],
    alarma: true,
    especialidades: [],
  },
  {
    id: 'ideas-suicidas',
    nombre: 'pensamientos de hacerte daño',
    sinonimos: [
      'me quiero morir',
      'quiero matarme',
      'pensamientos suicidas',
      'no quiero vivir',
      'me quiero suicidar',
      'ganas de morirme',
      'quiero hacerme dano',
      'no le encuentro sentido a vivir',
      'no le veo sentido a nada',
      'no quiero seguir viviendo',
      'no quiero vivir mas',
    ],
    alarma: true,
    mensaje:
      'No estás solo con esto y no hace falta esperar un turno. Hablá ahora con alguien: llamá a una línea de ayuda o andá a una guardia.',
    especialidades: [],
  },
];

/**
 * La tabla de síntomas frecuentes. Ver la cabecera del archivo.
 *
 * Los sinónimos van **normalizados a mano**: sin tildes y en minúsculas, que es
 * la forma en que se comparan. Escribirlos así en el dato en vez de
 * normalizarlos en cada búsqueda ahorra recorrer la tabla entera en cada tecla.
 */
export const SINTOMAS: readonly Sintoma[] = [
  /* --- General ---------------------------------------------------------- */
  {
    id: 'fiebre',
    nombre: 'fiebre',
    sinonimos: [
      'fiebre',
      'temperatura',
      'calentura',
      'febril',
      'decimas de fiebre',
      'destemplado',
      'escalofrios',
      'me hierve la cabeza',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Infectología', peso: 2 },
      { nombre: 'Pediatría', peso: 1 },
    ],
  },
  {
    id: 'resfrio',
    nombre: 'resfrío o gripe',
    sinonimos: [
      'resfrio',
      'resfriado',
      'gripe',
      'gripa',
      'engripado',
      'catarro',
      'me agarre un resfrio',
      'estoy resfriado',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Infectología', peso: 1 },
    ],
  },
  {
    id: 'covid',
    nombre: 'sospecha de covid',
    sinonimos: [
      'covid',
      'coronavirus',
      'me dio positivo el test',
      'hisopado positivo',
      'perdi el olfato y el gusto',
    ],
    especialidades: [
      { nombre: 'Infectología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Neumología', peso: 1 },
    ],
  },
  {
    id: 'dengue',
    nombre: 'sospecha de dengue',
    sinonimos: [
      'dengue',
      'me pico un mosquito y tengo fiebre',
      'zika',
      'chikungunya',
      'fiebre con dolor detras de los ojos',
    ],
    especialidades: [
      { nombre: 'Infectología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'cansancio',
    nombre: 'cansancio persistente',
    sinonimos: [
      'cansancio',
      'me canso mucho',
      'fatiga',
      'sin energia',
      'agotado',
      'debilidad',
      'sin fuerzas',
      'me falta energia',
      'decaido',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Endocrinología', peso: 2 },
      { nombre: 'Hematología', peso: 1 },
    ],
  },
  {
    id: 'perdida-de-peso',
    nombre: 'pérdida de peso sin motivo',
    sinonimos: [
      // Todas llevan la marca de que **no fue buscado**: sin ella, «bajar de
      // peso» es lo que escribe quien quiere adelgazar, que es la fila de
      // nutrición y no ésta.
      'baje de peso sin querer',
      'perdida de peso sin motivo',
      'adelgace sin hacer nada',
      'estoy bajando de peso sin querer',
      'perdi peso sin hacer dieta',
      'baje mucho de peso de golpe',
      'baje kilos sin querer',
      'perdi kilos sin proponermelo',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Endocrinología', peso: 2 },
      { nombre: 'Oncología', peso: 1 },
    ],
  },
  {
    id: 'ganglios',
    nombre: 'ganglios inflamados',
    sinonimos: [
      'ganglios',
      'ganglios inflamados',
      'bolitas en el cuello',
      'bulto en el cuello',
      'bulto en la axila',
      'ganglios en la ingle',
      'nodulos en la axila',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Infectología', peso: 2 },
      { nombre: 'Hematología', peso: 2 },
      { nombre: 'Oncología', peso: 1 },
    ],
  },
  {
    id: 'sudoracion-nocturna',
    nombre: 'sudores nocturnos',
    sinonimos: [
      'sudores nocturnos',
      'sudo de noche',
      'me despierto transpirado',
      'transpiro mucho de noche',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Endocrinología', peso: 1 },
      { nombre: 'Oncología', peso: 1 },
    ],
  },
  {
    id: 'anemia',
    nombre: 'anemia',
    sinonimos: [
      'anemia',
      'hemoglobina baja',
      'tengo la sangre baja',
      'estoy palido',
      'ferritina baja',
    ],
    especialidades: [
      { nombre: 'Hematología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Nutrición', peso: 1 },
    ],
  },
  {
    id: 'moretones',
    nombre: 'moretones sin golpe',
    sinonimos: [
      'moretones',
      'me salen moretones',
      'hematomas sin golpearme',
      'moretones sin motivo',
    ],
    especialidades: [
      { nombre: 'Hematología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },

  /* --- Cabeza y sistema nervioso ---------------------------------------- */
  {
    id: 'dolor-de-cabeza',
    nombre: 'dolor de cabeza',
    sinonimos: ['cefalea', 'jaqueca', 'migrana', 'me parte la cabeza', 'presion en la cabeza'],
    // «nuca» va acá y no en el cuello: el dolor de nuca que alguien escribe en
    // una pantalla de síntomas casi siempre viene con la presión alta.
    partes: ['cabeza', 'sien', 'nuca', 'craneo'],
    especialidades: [
      { nombre: 'Neurología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Oftalmología', peso: 1 },
    ],
  },
  {
    id: 'mareo',
    nombre: 'mareo',
    sinonimos: [
      'mareo',
      'me mareo',
      'vertigo',
      'todo me da vueltas',
      'la cabeza me da vueltas',
      'siento que me caigo',
      'inestable al caminar',
    ],
    especialidades: [
      { nombre: 'Otorrinolaringología', peso: 3 },
      { nombre: 'Neurología', peso: 2 },
      { nombre: 'Cardiología', peso: 1 },
    ],
  },
  {
    id: 'hormigueo',
    nombre: 'hormigueo o adormecimiento',
    sinonimos: [
      'hormigueo',
      'se me duermen las manos',
      'se me duermen los pies',
      'adormecimiento',
      'entumecimiento',
      'se me duermen las piernas',
      'siento pinchazos en las manos',
      'calambres',
    ],
    especialidades: [
      { nombre: 'Neurología', peso: 3 },
      { nombre: 'Traumatología', peso: 1 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'temblor',
    nombre: 'temblor',
    sinonimos: ['temblor', 'me tiemblan las manos', 'tiemblo', 'temblor en las manos'],
    especialidades: [
      { nombre: 'Neurología', peso: 3 },
      { nombre: 'Endocrinología', peso: 1 },
    ],
  },
  {
    id: 'olvidos',
    nombre: 'olvidos o fallas de memoria',
    sinonimos: [
      'me olvido de todo',
      'perdida de memoria',
      'fallas de memoria',
      'olvidos',
      'mi mama se olvida las cosas',
      'no me acuerdo de nada',
    ],
    especialidades: [
      { nombre: 'Neurología', peso: 3 },
      { nombre: 'Psiquiatría', peso: 1 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },

  /* --- Ojos --------------------------------------------------------------- */
  {
    id: 'vision-borrosa',
    nombre: 'visión borrosa',
    sinonimos: [
      'veo borroso',
      'vision borrosa',
      'no veo bien',
      'vista nublada',
      'se me nubla la vista',
      'veo manchas',
      'veo doble',
      'veo lucecitas',
    ],
    especialidades: [
      { nombre: 'Oftalmología', peso: 3 },
      { nombre: 'Neurología', peso: 2 },
    ],
  },
  {
    id: 'ojo-irritado',
    nombre: 'ojo rojo o irritado',
    sinonimos: [
      'ojo rojo',
      'conjuntivitis',
      'me pica el ojo',
      'ojo irritado',
      'lagrimeo',
      'lagana',
      'me arde el ojo',
      'ojo seco',
    ],
    partes: ['ojo'],
    especialidades: [
      { nombre: 'Oftalmología', peso: 3 },
      { nombre: 'Alergología', peso: 1 },
    ],
  },
  {
    id: 'necesito-lentes',
    nombre: 'la vista de cerca o de lejos',
    sinonimos: [
      'no veo de cerca',
      'no veo de lejos',
      'vista cansada',
      'necesito lentes',
      'graduar la vista',
      'control de la vista',
      'me cambio la vista',
      'presbicia',
      'miopia',
    ],
    especialidades: [{ nombre: 'Oftalmología', peso: 3 }],
  },

  /* --- Oído, nariz y garganta -------------------------------------------- */
  {
    id: 'dolor-de-garganta',
    nombre: 'dolor de garganta',
    sinonimos: [
      'garganta inflamada',
      'anginas',
      'me arde la garganta',
      'dolor al tragar',
      'me cuesta tragar',
      'faringitis',
      'placas en la garganta',
    ],
    partes: ['garganta'],
    especialidades: [
      { nombre: 'Otorrinolaringología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'dolor-de-oido',
    nombre: 'dolor de oído',
    sinonimos: [
      'oido tapado',
      'zumbido en el oido',
      'no escucho bien',
      'otitis',
      'me sale liquido del oido',
      'tinnitus',
    ],
    partes: ['oido', 'oreja'],
    especialidades: [
      { nombre: 'Otorrinolaringología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'congestion-nasal',
    nombre: 'congestión nasal o alergia',
    sinonimos: [
      'congestion nasal',
      'nariz tapada',
      'estornudos',
      'alergia',
      'rinitis',
      'mocos',
      'me pica la nariz',
      'sinusitis',
      'goteo nasal',
    ],
    especialidades: [
      { nombre: 'Otorrinolaringología', peso: 3 },
      { nombre: 'Alergología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'sangrado-de-nariz',
    nombre: 'sangrado de nariz',
    sinonimos: ['me sangra la nariz', 'sangrado de nariz', 'epistaxis', 'sangre por la nariz'],
    especialidades: [
      { nombre: 'Otorrinolaringología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'ronquera',
    nombre: 'ronquera o afonía',
    sinonimos: [
      // «estoy ronco» no está: «ronco» a secas es también el verbo de roncar,
      // y se llevaba puesta la consulta por ronquidos.
      'ronquera',
      'afonia',
      'afonico',
      'me quede sin voz',
      'me quede ronco',
      'voz ronca',
      'me duele al hablar',
    ],
    especialidades: [{ nombre: 'Otorrinolaringología', peso: 3 }],
  },
  {
    id: 'ronquidos',
    nombre: 'ronquidos o apneas',
    sinonimos: [
      'ronco de noche',
      'ronco cuando duermo',
      'ronco mucho',
      'ronquidos',
      'apnea del sueno',
      'dejo de respirar mientras duermo',
    ],
    especialidades: [
      { nombre: 'Neumología', peso: 3 },
      { nombre: 'Otorrinolaringología', peso: 2 },
    ],
  },

  /* --- Boca --------------------------------------------------------------- */
  {
    id: 'dolor-de-muelas',
    nombre: 'dolor de muelas',
    sinonimos: [
      'caries',
      'encias sangrantes',
      'me sangran las encias',
      'me sale sangre al cepillarme',
      'sangre al cepillarme los dientes',
      'encias inflamadas',
      'flemon',
      'absceso dental',
    ],
    partes: ['muela', 'diente', 'encia'],
    especialidades: [{ nombre: 'Odontología', peso: 3 }],
  },
  {
    id: 'llagas-en-la-boca',
    nombre: 'llagas en la boca',
    sinonimos: [
      'aftas',
      'llagas en la boca',
      'ampollas en la boca',
      'herpes labial',
      'me salieron llagas',
    ],
    especialidades: [
      { nombre: 'Odontología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'consulta-dental',
    nombre: 'limpieza u ortodoncia',
    sinonimos: [
      'limpieza dental',
      'brackets',
      'ortodoncia',
      'blanqueamiento',
      'me falta un diente',
      'implante dental',
      'mal aliento',
    ],
    especialidades: [{ nombre: 'Odontología', peso: 3 }],
  },

  /* --- Pecho y respiración ----------------------------------------------- */
  {
    id: 'tos',
    nombre: 'tos',
    sinonimos: ['tos', 'tos seca', 'tos con flema', 'no paro de toser', 'tos de noche'],
    especialidades: [
      { nombre: 'Neumología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Otorrinolaringología', peso: 1 },
    ],
  },
  {
    id: 'asma',
    nombre: 'silbido al respirar o asma',
    sinonimos: [
      'asma',
      'silbido en el pecho',
      'me silba el pecho',
      'broncoespasmo',
      'uso el inhalador seguido',
    ],
    especialidades: [
      { nombre: 'Neumología', peso: 3 },
      { nombre: 'Alergología', peso: 2 },
    ],
  },
  {
    id: 'palpitaciones',
    nombre: 'palpitaciones',
    sinonimos: [
      'palpitaciones',
      'el corazon me late fuerte',
      'taquicardia',
      'se me acelera el corazon',
      'corazon acelerado',
      'siento el corazon en la garganta',
      'arritmia',
    ],
    especialidades: [
      { nombre: 'Cardiología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'presion-alta',
    nombre: 'presión alta',
    sinonimos: [
      'presion alta',
      'hipertension',
      'me subio la presion',
      'la presion me dio alta',
      'pastillas para la presion',
      'remedio para la presion',
      'receta de la presion',
    ],
    especialidades: [
      { nombre: 'Cardiología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Nefrología', peso: 1 },
    ],
  },
  {
    id: 'hinchazon-de-piernas',
    nombre: 'hinchazón de piernas',
    sinonimos: [
      'piernas hinchadas',
      'hinchazon de piernas',
      'se me hinchan los pies',
      'edema',
      'tobillos hinchados',
    ],
    especialidades: [
      { nombre: 'Cardiología', peso: 3 },
      { nombre: 'Nefrología', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'varices',
    nombre: 'várices',
    sinonimos: [
      'varices',
      'venas saltadas en las piernas',
      'aranitas en las piernas',
      'venas hinchadas',
    ],
    especialidades: [
      { nombre: 'Cirugía general', peso: 2 },
      { nombre: 'Cardiología', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },

  /* --- Panza y digestión -------------------------------------------------- */
  {
    id: 'dolor-de-panza',
    nombre: 'dolor de panza',
    sinonimos: ['retorcijones', 'colicos', 'me duele la boca del estomago', 'punzadas en la panza'],
    // Cada país tiene su palabra y ninguna se deduce de otra: van todas.
    partes: ['panza', 'estomago', 'barriga', 'guata', 'vientre', 'abdomen'],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Cirugía general', peso: 1 },
    ],
  },
  {
    id: 'diarrea',
    nombre: 'diarrea',
    sinonimos: [
      'diarrea',
      'descompuesto del estomago',
      'suelto del estomago',
      'voy mucho al bano',
      'deposiciones liquidas',
      'estoy flojo del estomago',
    ],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Infectología', peso: 1 },
    ],
  },
  {
    id: 'estrenimiento',
    nombre: 'estreñimiento',
    sinonimos: [
      'estrenimiento',
      'estrenido',
      'no puedo obrar',
      'no hago del bano',
      'constipacion',
      'hace dias que no voy al bano',
    ],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Nutrición', peso: 1 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'nauseas',
    nombre: 'náuseas o vómitos',
    sinonimos: ['nauseas', 'ganas de vomitar', 'vomito', 'asco', 'descompostura', 'arcadas'],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'acidez',
    nombre: 'acidez o reflujo',
    sinonimos: [
      'acidez',
      'reflujo',
      'ardor en el pecho despues de comer',
      'agruras',
      'me quema el estomago',
      'ardor despues de comer',
      'me sube la comida',
      'gastritis',
    ],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'gases',
    nombre: 'gases o hinchazón',
    sinonimos: [
      'gases',
      'panza hinchada',
      'me hincho despues de comer',
      'meteorismo',
      'distension abdominal',
    ],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Nutrición', peso: 1 },
    ],
  },
  {
    id: 'hemorroides',
    nombre: 'hemorroides',
    sinonimos: [
      'hemorroides',
      'almorranas',
      'sangre al obrar',
      'me arde al obrar',
      'bulto al obrar',
    ],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Cirugía general', peso: 2 },
    ],
  },

  /* --- Huesos y músculos --------------------------------------------------- */
  {
    id: 'dolor-de-espalda',
    nombre: 'dolor de espalda',
    sinonimos: ['lumbago', 'ciatica', 'me quede duro de la espalda', 'contractura en la espalda'],
    partes: ['espalda', 'cintura', 'columna', 'lumbar'],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Fisioterapia', peso: 2 },
    ],
  },
  {
    id: 'dolor-de-cuello',
    nombre: 'dolor de cuello',
    sinonimos: [
      'torticolis',
      'contractura en el cuello',
      'cervicalgia',
      'me quede duro del cuello',
    ],
    partes: ['cuello', 'cervical'],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Fisioterapia', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-hombro',
    nombre: 'dolor de hombro',
    sinonimos: ['no puedo levantar el brazo', 'tendinitis en el hombro', 'manguito rotador'],
    partes: ['hombro'],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Fisioterapia', peso: 2 },
    ],
  },
  {
    id: 'dolor-de-rodilla',
    nombre: 'dolor de rodilla',
    sinonimos: ['rodilla hinchada', 'me falla la rodilla', 'me truena la rodilla', 'menisco'],
    partes: ['rodilla'],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Reumatología', peso: 2 },
      { nombre: 'Fisioterapia', peso: 2 },
    ],
  },
  {
    id: 'dolor-de-cadera',
    nombre: 'dolor de cadera',
    sinonimos: ['cadera desgastada', 'me duele al caminar la cadera'],
    partes: ['cadera'],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Reumatología', peso: 2 },
      { nombre: 'Fisioterapia', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-mano',
    nombre: 'dolor de mano o muñeca',
    sinonimos: ['tunel carpiano', 'no puedo cerrar la mano', 'dedos rigidos'],
    partes: ['mano', 'muneca', 'codo'],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Reumatología', peso: 2 },
      { nombre: 'Fisioterapia', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-pie',
    nombre: 'dolor de pie o tobillo',
    sinonimos: ['fascitis plantar', 'me duele el talon', 'juanete', 'espolon'],
    partes: ['pie', 'tobillo'],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Fisioterapia', peso: 2 },
    ],
  },
  {
    id: 'dolor-articular',
    nombre: 'dolor en las articulaciones',
    sinonimos: [
      'dolor de huesos',
      'artritis',
      'artrosis',
      'articulaciones hinchadas',
      'me duele todo el cuerpo',
      'rigidez al levantarme',
    ],
    partes: ['articulacion', 'hueso', 'coyuntura'],
    especialidades: [
      { nombre: 'Reumatología', peso: 3 },
      { nombre: 'Traumatología', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'golpe-o-torcedura',
    nombre: 'un golpe o una torcedura',
    sinonimos: [
      // «me caí» a secas no está: se reduce a una sola palabra —caída— y con
      // ella se quedaba con «se me cae el pelo» y con «se me cae la cara»,
      // que es un signo de urgencia.
      'me torci el tobillo',
      'esguince',
      'me cai al piso',
      'me cai de la escalera',
      'sufri una caida',
      'me golpee',
      'me lastime jugando',
      'creo que me fracture',
      'luxacion',
    ],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Fisioterapia', peso: 1 },
    ],
  },

  /* --- Piel ---------------------------------------------------------------- */
  {
    id: 'erupcion',
    nombre: 'manchas o ronchas en la piel',
    sinonimos: [
      'ronchas',
      'sarpullido',
      'erupcion',
      'manchas en la piel',
      'urticaria',
      'me pica la piel',
      'picazon',
      'me salio una alergia en la piel',
    ],
    especialidades: [
      { nombre: 'Dermatología', peso: 3 },
      { nombre: 'Alergología', peso: 2 },
    ],
  },
  {
    id: 'acne',
    nombre: 'acné',
    sinonimos: ['acne', 'granos en la cara', 'espinillas', 'barros', 'puntos negros'],
    especialidades: [{ nombre: 'Dermatología', peso: 3 }],
  },
  {
    id: 'hongos',
    nombre: 'hongos en la piel o las uñas',
    sinonimos: ['hongos', 'pie de atleta', 'unas amarillas', 'micosis', 'hongos en la piel'],
    especialidades: [{ nombre: 'Dermatología', peso: 3 }],
  },
  {
    id: 'caida-de-pelo',
    nombre: 'caída del pelo',
    sinonimos: [
      'se me cae el pelo',
      'se me cae el cabello',
      'caida del pelo',
      'caida de cabello',
      'calvicie',
      'alopecia',
      'se me hacen peladas',
    ],
    especialidades: [
      { nombre: 'Dermatología', peso: 3 },
      { nombre: 'Endocrinología', peso: 1 },
    ],
  },
  {
    id: 'lunar-que-cambio',
    nombre: 'un lunar que cambió',
    sinonimos: ['lunar', 'me cambio un lunar', 'mancha que crece', 'lunar raro', 'verruga'],
    especialidades: [
      { nombre: 'Dermatología', peso: 3 },
      { nombre: 'Oncología', peso: 1 },
    ],
  },
  {
    id: 'herida-que-no-cierra',
    nombre: 'una herida que no cierra',
    sinonimos: [
      'herida que no cierra',
      'herida que no cicatriza',
      'la herida se me infecto',
      'ulcera en la pierna',
      'llaga que no cura',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Cirugía general', peso: 2 },
      { nombre: 'Dermatología', peso: 2 },
    ],
  },
  {
    id: 'picadura',
    nombre: 'picadura o mordedura',
    sinonimos: [
      'me pico un bicho',
      'me pico un zancudo',
      'me pico un mosquito',
      'picadura',
      'me mordio un perro',
      'mordedura',
      'me pico una arana',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Alergología', peso: 2 },
      { nombre: 'Infectología', peso: 1 },
    ],
  },

  /* --- Ánimo y sueño ------------------------------------------------------ */
  {
    id: 'ansiedad',
    nombre: 'ansiedad',
    sinonimos: [
      'ansiedad',
      'estoy ansioso',
      'ataques de panico',
      'angustia',
      'nervios',
      'estres',
      'no puedo parar de pensar',
      'me agarran crisis de nervios',
    ],
    especialidades: [
      { nombre: 'Psiquiatría', peso: 3 },
      { nombre: 'Psicología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'tristeza',
    nombre: 'tristeza persistente',
    sinonimos: [
      'estoy triste',
      'depresion',
      'no tengo ganas de nada',
      'me siento mal animicamente',
      'lloro por cualquier cosa',
      'lloro sin motivo',
      'lloro seguido',
      'me siento vacio',
      'nada me entusiasma',
    ],
    especialidades: [
      { nombre: 'Psicología', peso: 3 },
      { nombre: 'Psiquiatría', peso: 3 },
    ],
  },
  {
    id: 'insomnio',
    nombre: 'problemas para dormir',
    sinonimos: [
      'no puedo dormir',
      'insomnio',
      'me cuesta dormir',
      'duermo mal',
      'desvelo',
      'me despierto de madrugada',
      'no me deja dormir',
      'no puedo conciliar el sueno',
      'doy vueltas en la cama',
    ],
    especialidades: [
      { nombre: 'Psiquiatría', peso: 2 },
      { nombre: 'Psicología', peso: 2 },
      { nombre: 'Neurología', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'duelo',
    nombre: 'estoy pasando un duelo',
    sinonimos: [
      'se murio un familiar',
      'fallecio mi papa',
      'se murio mi mama',
      'perdi a un ser querido',
      'estoy de duelo',
      'perdi a alguien',
      'me separe',
      'problemas de pareja',
      'terapia de pareja',
    ],
    especialidades: [{ nombre: 'Psicología', peso: 3 }],
  },
  {
    id: 'adiccion',
    nombre: 'consumo de alcohol u otras sustancias',
    sinonimos: [
      'quiero dejar de fumar',
      'dejar el cigarrillo',
      'dejar el tabaco',
      'tomo mucho alcohol',
      'adiccion',
      'consumo drogas',
      'no puedo dejar de tomar',
      'ludopatia',
    ],
    especialidades: [
      { nombre: 'Psiquiatría', peso: 3 },
      { nombre: 'Psicología', peso: 2 },
    ],
  },

  /* --- Hormonas y metabolismo --------------------------------------------- */
  {
    id: 'azucar-alta',
    nombre: 'azúcar alta',
    sinonimos: [
      'azucar alta',
      'diabetes',
      'glucosa alta',
      'me sube el azucar',
      'tengo azucar',
      'mucha sed y orino mucho',
      'tomo mucha agua y orino seguido',
    ],
    especialidades: [
      { nombre: 'Endocrinología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Nutrición', peso: 2 },
    ],
  },
  {
    id: 'tiroides',
    nombre: 'problemas de tiroides',
    sinonimos: [
      'tiroides',
      'hipotiroidismo',
      'hipertiroidismo',
      'bocio',
      'nodulo en el cuello',
      'tsh alta',
    ],
    especialidades: [
      { nombre: 'Endocrinología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'colesterol',
    nombre: 'colesterol o triglicéridos altos',
    sinonimos: [
      'colesterol alto',
      'trigliceridos altos',
      'tengo el colesterol por las nubes',
      'grasa en la sangre',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Cardiología', peso: 2 },
      { nombre: 'Nutrición', peso: 2 },
    ],
  },
  {
    id: 'nutricion',
    nombre: 'quiero mejorar mi alimentación',
    sinonimos: [
      'bajar de peso',
      'dieta',
      'nutricion',
      'alimentacion',
      'subir de peso',
      'sobrepeso',
      'obesidad',
      'plan alimentario',
    ],
    especialidades: [
      { nombre: 'Nutrición', peso: 3 },
      { nombre: 'Endocrinología', peso: 2 },
    ],
  },

  /* --- Riñón y vías urinarias ---------------------------------------------- */
  {
    id: 'ardor-al-orinar',
    nombre: 'ardor al orinar',
    sinonimos: [
      'ardor al orinar',
      'me arde al orinar',
      'duele orinar',
      'infeccion urinaria',
      'voy seguido al bano a orinar',
      'orino seguido',
      'cistitis',
    ],
    especialidades: [
      { nombre: 'Urología', peso: 3 },
      { nombre: 'Ginecología', peso: 2 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'sangre-en-la-orina',
    nombre: 'sangre en la orina',
    sinonimos: ['sangre en la orina', 'orino sangre', 'orina roja', 'hematuria'],
    especialidades: [
      { nombre: 'Urología', peso: 3 },
      { nombre: 'Nefrología', peso: 2 },
    ],
  },
  {
    id: 'colico-renal',
    nombre: 'cólico renal',
    sinonimos: [
      'piedras en el rinon',
      'calculos renales',
      'colico renal',
      'dolor de rinon',
      'me duele el rinon',
    ],
    especialidades: [
      { nombre: 'Urología', peso: 3 },
      { nombre: 'Nefrología', peso: 2 },
    ],
  },
  {
    id: 'prostata',
    nombre: 'consulta de próstata',
    sinonimos: [
      'prostata',
      'me cuesta orinar',
      'el chorro sale debil',
      'me levanto de noche a orinar',
      'psa alto',
    ],
    especialidades: [
      { nombre: 'Urología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-testiculos',
    nombre: 'dolor o bulto en los testículos',
    sinonimos: ['bulto en el testiculo', 'varicocele', 'me duelen los testiculos'],
    partes: ['testiculo'],
    especialidades: [{ nombre: 'Urología', peso: 3 }],
  },
  {
    id: 'problemas-de-ereccion',
    nombre: 'problemas de erección',
    sinonimos: [
      'problemas de ereccion',
      'disfuncion erectil',
      'no puedo tener ereccion',
      'impotencia',
      'eyaculacion precoz',
    ],
    especialidades: [
      { nombre: 'Urología', peso: 3 },
      { nombre: 'Endocrinología', peso: 1 },
    ],
  },

  /* --- Salud de la mujer y embarazo ---------------------------------------- */
  {
    id: 'dolor-menstrual',
    nombre: 'dolor menstrual',
    sinonimos: [
      'colicos menstruales',
      'me duele la regla',
      'dolor de ovarios',
      'menstruacion dolorosa',
      'regla dolorosa',
      'dismenorrea',
    ],
    partes: ['menstruacion', 'regla', 'periodo', 'ovario'],
    especialidades: [
      { nombre: 'Ginecología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'atraso-menstrual',
    nombre: 'atraso menstrual',
    sinonimos: [
      'no me vino',
      'no me baja la regla',
      'no me viene la menstruacion',
      'creo que estoy embarazada',
      'prueba de embarazo',
      'test de embarazo positivo',
    ],
    // El motor arma «atraso de la regla», «se me retrasó la menstruación» y las
    // demás combinaciones solo.
    partes: ['regla', 'menstruacion', 'periodo'],
    gatillos: ['atraso', 'retraso'],
    especialidades: [
      { nombre: 'Ginecología', peso: 3 },
      { nombre: 'Obstetricia', peso: 3 },
    ],
  },
  {
    id: 'sangrado-menstrual-abundante',
    nombre: 'sangrado menstrual abundante o irregular',
    sinonimos: [
      'sangrado entre reglas',
      'regla abundante',
      'me viene mucho la regla',
      'reglas irregulares',
      'sangro fuera de la regla',
      'me dura mucho la regla',
    ],
    especialidades: [{ nombre: 'Ginecología', peso: 3 }],
  },
  {
    id: 'control-embarazo',
    nombre: 'control de embarazo',
    sinonimos: [
      'estoy embarazada',
      'control prenatal',
      'control de embarazo',
      'semanas de embarazo',
      'ecografia del embarazo',
    ],
    especialidades: [
      { nombre: 'Obstetricia', peso: 3 },
      { nombre: 'Ginecología', peso: 2 },
    ],
  },
  {
    id: 'flujo-vaginal',
    nombre: 'flujo o picazón vaginal',
    sinonimos: [
      'flujo vaginal',
      'flujo',
      'descenso',
      'me pica la vagina',
      'candidiasis',
      'mal olor vaginal',
      'ardor vaginal',
    ],
    especialidades: [{ nombre: 'Ginecología', peso: 3 }],
  },
  {
    id: 'control-ginecologico',
    nombre: 'control ginecológico',
    sinonimos: [
      'papanicolau',
      'pap',
      'control ginecologico',
      'colposcopia',
      'mamografia',
      'ecografia mamaria',
    ],
    especialidades: [{ nombre: 'Ginecología', peso: 3 }],
  },
  {
    id: 'bulto-en-la-mama',
    nombre: 'un bulto en la mama',
    sinonimos: [
      'bulto en la mama',
      'bulto en el seno',
      'bulto en la teta',
      'me toque una bolita en la mama',
      'nodulo en el pecho',
      'me sale liquido del pezon',
    ],
    especialidades: [
      { nombre: 'Ginecología', peso: 3 },
      { nombre: 'Oncología', peso: 2 },
    ],
  },
  {
    id: 'menopausia',
    nombre: 'síntomas de menopausia',
    sinonimos: [
      'menopausia',
      'sofocos',
      'calores',
      'climaterio',
      // «se me fue la regla hace meses» no está: se reducía a «regla» sola y
      // con eso se quedaba con cualquier consulta sobre la menstruación.
      'se me retiro la regla',
    ],
    especialidades: [
      { nombre: 'Ginecología', peso: 3 },
      { nombre: 'Endocrinología', peso: 1 },
    ],
  },
  {
    id: 'anticoncepcion',
    nombre: 'anticoncepción',
    sinonimos: [
      'pastillas anticonceptivas',
      'anticonceptivo',
      'quiero cuidarme',
      'diu',
      'implante anticonceptivo',
      'ligadura',
      'vasectomia',
    ],
    especialidades: [
      { nombre: 'Ginecología', peso: 3 },
      { nombre: 'Urología', peso: 1 },
    ],
  },
  {
    id: 'dolor-al-tener-relaciones',
    nombre: 'dolor en las relaciones',
    sinonimos: ['dolor al tener relaciones', 'dolor en las relaciones', 'dispareunia'],
    especialidades: [
      { nombre: 'Ginecología', peso: 3 },
      { nombre: 'Urología', peso: 2 },
    ],
  },
  {
    id: 'infeccion-de-transmision-sexual',
    nombre: 'una infección de transmisión sexual',
    sinonimos: [
      'enfermedad de transmision sexual',
      'infeccion de transmision sexual',
      'vih',
      'sifilis',
      'gonorrea',
      'herpes genital',
      'verrugas genitales',
      'tuve relaciones sin proteccion',
      'tuve relaciones sin cuidarme',
    ],
    especialidades: [
      { nombre: 'Infectología', peso: 3 },
      { nombre: 'Urología', peso: 2 },
      { nombre: 'Ginecología', peso: 2 },
    ],
  },

  /* --- Niños ---------------------------------------------------------------- */
  {
    id: 'control-de-nino',
    nombre: 'control del niño',
    sinonimos: [
      'control del nino',
      'mi hijo',
      'mi hija',
      'control pediatrico',
      'vacunas del bebe',
      'mi bebe',
      'control de nino sano',
      'mi nene',
      'mi nena',
    ],
    especialidades: [{ nombre: 'Pediatría', peso: 3 }],
  },
  {
    id: 'desarrollo-del-nino',
    nombre: 'el desarrollo del niño',
    sinonimos: [
      'mi hijo no habla',
      'no camina todavia',
      'no sube de peso el bebe',
      'problemas de aprendizaje',
      'llora mucho el bebe',
    ],
    especialidades: [
      { nombre: 'Pediatría', peso: 3 },
      { nombre: 'Psicología', peso: 1 },
    ],
  },

  /* --- Controles y trámites ------------------------------------------------- */
  {
    id: 'chequeo',
    nombre: 'un chequeo general',
    sinonimos: [
      'chequeo',
      'control general',
      'examenes de rutina',
      'control anual',
      'analisis de rutina',
      'me quiero hacer estudios',
      'quiero un control',
      'me quiero controlar',
      'necesito un control',
    ],
    generico: true,
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Nutrición', peso: 1 },
    ],
  },
  {
    id: 'leer-analisis',
    nombre: 'que me expliquen unos análisis',
    sinonimos: [
      // «Análisis» a secas no está: es una palabra que aparece en cualquier
      // frase —«me lo vieron en el análisis»— y por sí sola no es un motivo de
      // consulta.
      'me salieron mal los analisis',
      'quiero que me lean los resultados',
      'resultados de laboratorio',
      'resultado de mis analisis',
      'necesito que me vean unos analisis',
    ],
    especialidades: [{ nombre: 'Medicina general', peso: 3 }],
  },
  {
    id: 'receta',
    nombre: 'una receta o renovar medicación',
    sinonimos: [
      'necesito una receta',
      'renovar la medicacion',
      'se me termino el remedio',
      'repetir receta',
    ],
    especialidades: [{ nombre: 'Medicina general', peso: 3 }],
  },
  {
    id: 'certificado',
    nombre: 'un certificado médico',
    sinonimos: [
      'certificado',
      'certificado medico',
      'apto fisico',
      'certificado para el trabajo',
      'carpeta medica',
    ],
    especialidades: [{ nombre: 'Medicina general', peso: 3 }],
  },
  {
    id: 'vacunas',
    nombre: 'vacunas',
    sinonimos: [
      'vacuna',
      'me quiero vacunar',
      'vacuna de la gripe',
      'refuerzo de la vacuna',
      'calendario de vacunacion',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Infectología', peso: 1 },
    ],
  },
];
