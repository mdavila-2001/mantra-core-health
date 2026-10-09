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
    rodillas» tenían que estar las dos. Ahora el motor (`engine.ts`) reduce el
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
  /**
   * Si el síntoma sólo corresponde a un sexo (P-04, 2026-09-25): próstata,
   * testículos y erección son `'MALE'`; menstruación, embarazo y flujo
   * vaginal son `'FEMALE'`. Sin esta marca, el síntoma es de cualquiera.
   *
   * `symptom-check` la usa para no ofrecer en «Salud íntima» —ni por
   * pastilla, ni por texto reconocido, ni por sugerencia— lo que no
   * corresponde al sexo del propio perfil. Sin ese dato (sin sesión, perfil
   * `INTERSEX`/`UNKNOWN`, o todavía sin resolver) no se filtra nada: mejor
   * mostrar de más que esconder un síntoma real.
   */
  readonly soloParaSexo?: 'MALE' | 'FEMALE';
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
      'no deja de sangrar',
      'sigue sangrando y sangrando',
      'sangro sin parar',
      'perdi mucha sangre',
      'hemorragia',
      'vomito sangre',
      'sangre en el vomito',
      'sangrado que no para',
      'sangrado que no se corta',
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
      // Camba «cosar»: ataque epiléptico o epileptiforme (Sanabria Fernández).
      'cosar',
      'le dio el cosar',
      'me dio el cosar',
      'cosariento',
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
      // Autolesión: va con la misma urgencia. «me corto» a secas NO: es también un corte en la cocina.
      'me corto a proposito',
      'me hago cortes',
      'me corto cuando estoy mal',
      'me corto las munecas',
      'me autolesiono',
      'autolesion',
      'me lastimo a proposito',
      'me quiero cortar las venas',
      'estoy cansado de vivir',
      'quisiera no despertar',
      'quiero desaparecer',
      'mejor estaria muerto',
    ],
    alarma: true,
    mensaje:
      'Usted no está solo con esto y no hace falta esperar una cita. Hable ahora con alguien: llame a una línea de ayuda o vaya a una guardia.',
    especialidades: [],
  },
  {
    id: 'violencia-o-abuso',
    nombre: 'violencia o abuso',
    sinonimos: [
      'me violaron',
      'abuso sexual',
      'abusaron de mi',
      'me pega mi pareja',
      'mi marido me pega',
      'mi esposo me pega',
      'me golpea mi pareja',
      'violencia familiar',
      'violencia domestica',
      'me maltratan en mi casa',
    ],
    alarma: true,
    mensaje:
      'Lo que le pasó no es su culpa y no tiene que esperar una cita. Si está en peligro o fue hace poco, vaya ahora a una guardia: allí lo atienden, lo protegen y hay medicación que sirve sólo en las primeras horas.',
    especialidades: [],
  },
  {
    id: 'mordedura-peligrosa',
    nombre: 'mordedura de serpiente o murciélago',
    // Serpiente: puede necesitar suero antiofídico. Murciélago: la rabia se previene sólo si la vacuna
    // se pone a tiempo (en el oriente boliviano hay murciélagos hematófagos). Las dos van a una guardia.
    sinonimos: [
      'me mordio una culebra',
      'me mordio una vibora',
      'me mordio una serpiente',
      'mordedura de serpiente',
      'mordedura de vibora',
      'me pico una vibora',
      'me mordio una cascabel',
      'me mordio una yarara',
      'me mordio un murcielago',
      'mordedura de murcielago',
    ],
    alarma: true,
    mensaje:
      'Vaya ahora a una guardia: una mordedura de serpiente o de murciélago puede necesitar suero o vacuna que sólo sirven si se aplican a tiempo. Lave la herida con agua y jabón, y no haga cortes ni torniquetes.',
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
      // Bolivia: «chujcho» (del quechua) es estar con escalofríos y fiebre.
      'chujcho',
      'chujchu',
      'terciana',
      'tercianas',
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
      // Bolivia: el «surazo» es el viento frío del sur; «me agarró el surazo» es resfriarse.
      'me agarro el surazo',
      'surazo',
      // Camba «arrebato» (resfrío fuerte) NO entra: el motor lo reduce a «arrebato» a secas y
      // cazaba «en un arrebato le grité a mi jefe» (lo detectó el banco).
      'me moquea la nariz',
      'tengo flema',
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
      // Bolivia: «estoy hecho bolsa» / «molido» = agotado.
      'estoy hecho bolsa',
      'hecho bolsa',
      'estoy molido',
      'no tengo fuerzas',
      'no tengo energia',
      'estoy debil',
      'me siento debil',
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
      'baje de peso sin hacer dieta',
      'baje de peso sin dieta',
      // Sin apetito + adelgazar: mismo estudio de base.
      // «no tengo hambre» NO: queda en «no» + «hambre» y caza «tengo hambre y no …».
      'estoy muy flaco',
      'estoy muy delgado',
      'estoy flaquisimo',
      'estoy muy flaca',
      'estoy flaca',
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
      'sudo mucho',
      'sudo demasiado',
      'sudor frio',
      'hiperhidrosis',
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
      'tengo la piel palida',
      'muy palido',
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
    sinonimos: [
      'cefalea',
      'jaqueca',
      'migrana',
      'me parte la cabeza',
      'presion en la cabeza',
      'me late la cabeza',
      'me martillea la cabeza',
      'me revienta la cabeza',
      // Fuente: «Locro e' letras» (M. Melgar Añez y A. Rodríguez Peña, Gob. Autónomo Municipal de Santa Cruz, 2022), sección «Partes del cuerpo humano en expresiones cambas».
      // «Tari»: la cabeza de una persona (también la vasija).
      'me duele el tari',
      'me duele mucho el tari',
    ],
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
      // «Sorojchi»: mal de altura (Diccionario de Americanismos, ASALE).
      'sorojchi',
      'sorojche',
      'soroche',
      'me dio sorojchi',
      'mal de altura',
      'me apune',
      // Fuente: «Palabras y frases del Oriente boliviano» (H. Sanabria Fernández, R. Gandarilla y J. Sánchez Suárez; eju.tv, 14/09/2021).
      // «Turumba»: aturdido.
      'estoy turumba',
      'ando turumba',
      'se me va la cabeza',
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
      // Camba «chicó»: adormecimiento pasajero de una parte del cuerpo. Sólo en frase: sin tilde es «chico».
      'me dio chico',
      'me da chico',
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
      'cataratas',
      'vista nublada',
      'ojo blanco',
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
      // Camba «lopopo/lopopudo»: párpado hinchado; «sapirá»: lagañoso (O. Roca).
      'lopopo',
      'ojos lopopos',
      'lopopudo',
      'lopopuda',
      'parpado hinchado',
      'sapira',
      'tengo laganas',
      'ojos llorosos',
      'lagrimeo',
      'me lloran los ojos',
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
      // Fuente: «Locro e' letras» (M. Melgar Añez y A. Rodríguez Peña, Gob. Autónomo Municipal de Santa Cruz, 2022), sección «Partes del cuerpo humano en expresiones cambas».
      // «Tacuara»: garganta.
      'me duele la tacuara',
      'tengo mal la tacuara',
      'amigdalitis',
      'amigdalas inflamadas',
      'garganta roja',
      'tengo la garganta inflamada',
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
      // «no escucho bien» a secas NO: el motor lo reduce a «no» + «escuchar» sin orden y cazaba
      // «escucho voces y no hay nadie», que es de Psiquiatría.
      'no escucho bien del oido',
      'escucho mal',
      'no escucho bien',
      'no oigo bien',
      'me estoy quedando sordo',
      'sordera',
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
      'no tengo voz',
      'me quede sin voz',
      'sin voz',
      'perdi la voz',
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
      // Camba «chío»: diente corroído por las caries.
      'tengo un chio',
      'diente chio',
      'muela chio',
      'diente picado',
      'muela picada',
      'caries',
      'sarro',
      'muela del juicio',
      'me sangran las encias',
      'encia inflamada',
    ],
    partes: ['muela', 'diente', 'encia'],
    especialidades: [{ nombre: 'Odontología', peso: 3 }],
  },
  {
    id: 'dolor-de-mandibula',
    nombre: 'dolor de mandíbula',
    sinonimos: [
      'bruxismo',
      'aprieto los dientes',
      'rechino los dientes',
      'me cruje la mandibula',
      'me traba la mandibula',
      'no puedo abrir bien la boca',
      // Fuente: «Locro e' letras» (M. Melgar Añez y A. Rodríguez Peña, Gob. Autónomo Municipal de Santa Cruz, 2022), sección «Partes del cuerpo humano en expresiones cambas».
      // «Jajo»: mentón / mandíbula inferior.
      'me duele el jajo',
      'me duele mucho el jajo',
    ],
    partes: ['mandibula', 'quijada'],
    especialidades: [
      { nombre: 'Odontología', peso: 3 },
      { nombre: 'Traumatología', peso: 1 },
    ],
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
      'me late a mil',
      'el corazon se me sale',
      'se me sale el corazon',
      'el corazon me late raro',
      'me late raro el corazon',
      'el corazon me late rapido',
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
      'presion por las nubes',
      'presion disparada',
      'la presion me esta por las nubes',
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
      'venas moradas',
      'venitas moradas en las piernas',
      'venas marcadas en las piernas',
      'mala circulacion',
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
    sinonimos: [
      'retorcijones',
      'colicos',
      'me duele la boca del estomago',
      'punzadas en la panza',
      // Camba «ajitería/ahitera»: indigestión por haber comido mucho (Sanabria Fernández).
      'ajiteria',
      'ahitera',
      'empacho',
      'estoy empachado',
      'me empache',
      // Fuente: «Locro e' letras» (M. Melgar Añez y A. Rodríguez Peña, Gob. Autónomo Municipal de Santa Cruz, 2022), sección «Partes del cuerpo humano en expresiones cambas».
      // «Buche»: estómago de las personas en habla camba. «Petaca»: barriga.
      'me duele el buche',
      'me duele la petaca',
      'tengo el buche hinchado',
      'tengo la petaca inflada',
      'indigestion',
      'me cayo mal la comida',
      'comi algo malo',
      'me duele el estomago',
    ],
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
      // Fuente: «El habla popular de Santa Cruz» (H. Sanabria Fernández, vía soysantacruz.com.bo) y Diccionario Camba de O. Roca.
      // «Cursialera»: defecación líquida y frecuente. «Estar de curso» lo resuelve el tokenizador
      // (text.ts): «curso» a secas es el de inglés.
      'cursialera',
      // Quechua «q'echa» = diarrea (PMC3259717).
      'qecha',
      'q echa',
      'cagadera',
      'caca aguada',
      'popo aguado',
      'estomago suelto',
      // Fuente: «Palabras y frases del Oriente boliviano» (H. Sanabria Fernández, R. Gandarilla y J. Sánchez Suárez; eju.tv, 14/09/2021).
      // «Estar de banderita»: desarreglo gástrico con evacuaciones continuas.
      'estoy de banderita',
      'ando de banderita',
      'estar de banderita',
      'caca blanda',
      'tengo soltura',
      'suelto el estomago',
      'disenteria',
      'descomposicion',
      'rotavirus',
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
      'no puedo ir al bano',
      'no voy al bano',
      'no puedo cagar',
      // «no cago hace días» NO: quedaba en «no» + «cago» y cazaba «cago sangre pero no me duele».
      'llevo dias sin cagar',
      'estoy tapado',
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
    sinonimos: [
      'nauseas',
      'ganas de vomitar',
      'vomito',
      'asco',
      'descompostura',
      'arcadas',
      // Fuente: «Palabras y frases del Oriente boliviano» (H. Sanabria Fernández, R. Gandarilla y J. Sánchez Suárez; eju.tv, 14/09/2021).
      // «Echar los turos»: vomitar largamente.
      'echar los turos',
      'estoy echando los turos',
      'echo los turos',
    ],
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
      'me repite la comida',
      'tengo agruras',
      'tengo reflujo',
      'reflujo',
      'agruras',
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
      // Camba «chupeé»: recto, porción final del intestino (Sanabria Fernández).
      'me duele el chupee',
      'me arde el chupee',
      // Registro popular (2026-10-08): quien lo dice así no por eso está menos enfermo.
      'me arde el culo al cagar',
      'me duele el culo al cagar',
      'me duele el poto al cagar',
      'bolitas en el culo',
      'bolitas en el poto',
    ],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Cirugía general', peso: 2 },
    ],
  },
  {
    // «Cago sangre», «caca con sangre», «heces negras»: sangrado digestivo bajo o melena. No es
    // alarma por sí solo (casi siempre son hemorroides o una fisura), pero lo ve un gastroenterólogo.
    id: 'sangre-en-las-heces',
    nombre: 'sangre en las heces',
    sinonimos: [
      'sangre en las heces',
      'heces con sangre',
      'cago sangre',
      'cagar sangre',
      'me sangra el culo',
      'me sangra el poto',
      'sangre en el culo',
      'sangre en el poto',
      'estoy cagando sangre',
      'caca con sangre',
      'sangre en la caca',
      'popo con sangre',
      'sangre en el popo',
      'deposiciones con sangre',
      // «obro sangre» NO: empataba con «sangre al obrar», que es la fila de hemorroides.
      // «sangre por el ano» NO: el motor descarta «ano» (3 letras) y quedaba «sangre» a secas, que
      // cazaba nariz, encías y análisis de sangre (lo detectó el banco de 296 textos).
      'sangrado anal',
      'sangre por el recto',
      'rectorragia',
      'heces negras',
      'caca negra',
      'popo negro',
      'kgo sangre',
      'cg sangre',
    ],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Cirugía general', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    // Hematospermia. Camba «acabar»: eyacular (Sanabria Fernández).
    id: 'sangre-en-el-semen',
    nombre: 'sangre en el semen',
    sinonimos: [
      'sangre en el semen',
      'semen con sangre',
      'eyaculo sangre',
      'eyacule sangre',
      'eyaculacion con sangre',
      'hematospermia',
      'acabo con sangre',
      'semen rojo',
      'semen marron',
    ],
    soloParaSexo: 'MALE',
    especialidades: [
      { nombre: 'Urología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    // Bolivianismo «macurca» (RAE) y camba «agujeta»: dolor muscular por cansancio o esfuerzo.
    id: 'dolor-muscular',
    nombre: 'dolor muscular',
    sinonimos: [
      'dolor muscular',
      'me duelen los musculos',
      'dolor de musculos',
      'macurca',
      'tengo macurca',
      'agujetas',
      'contractura',
      'me dan calambres',
      'calambres',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Traumatología', peso: 2 },
      { nombre: 'Fisioterapia', peso: 2 },
    ],
  },

  /* --- Huesos y músculos --------------------------------------------------- */
  {
    id: 'dolor-de-espalda',
    nombre: 'dolor de espalda',
    sinonimos: [
      'lumbago',
      'ciatica',
      'me quede duro de la espalda',
      'contractura en la espalda',
      'lumbalgia',
      'lumbago',
    ],
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
      'me duele el coto',
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
    sinonimos: [
      'cadera desgastada',
      'me duele al caminar la cadera',
      // Camba «toco»: la cadera (O. Roca).
      'me duele el toco',
    ],
    partes: ['cadera'],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Reumatología', peso: 2 },
      { nombre: 'Fisioterapia', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-codo',
    nombre: 'dolor de codo',
    sinonimos: ['codo de tenista', 'epicondilitis', 'no puedo estirar el brazo'],
    partes: ['codo', 'antebrazo'],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Fisioterapia', peso: 2 },
      { nombre: 'Reumatología', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-mano',
    nombre: 'dolor de mano o muñeca',
    sinonimos: ['tunel carpiano', 'no puedo cerrar la mano', 'dedos rigidos'],
    partes: ['mano', 'muneca', 'dedo'],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Reumatología', peso: 2 },
      { nombre: 'Fisioterapia', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-pie',
    nombre: 'dolor de pie o tobillo',
    sinonimos: [
      'fascitis plantar',
      'me duele el talon',
      'juanete',
      'espolon',
      // Fuente: «Palabras y frases del Oriente boliviano» (H. Sanabria Fernández, R. Gandarilla y J. Sánchez Suárez; eju.tv, 14/09/2021).
      // «Patichi»: dolencia o defecto del pie que impide caminar con normalidad.
      'estoy patichi',
      'ando patichi',
    ],
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
      'reuma',
      'reumatismo',
      'acido urico',
      'acido urico alto',
      'dolor de huesos',
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
      'se me doblo el tobillo',
      'me doble el tobillo',
      'se me doblo el pie',
      // Fuente: «Palabras y frases del Oriente boliviano» (H. Sanabria Fernández, R. Gandarilla y J. Sánchez Suárez; eju.tv, 14/09/2021).
      // «Taporito»: contusiones en el rostro por golpes recibidos.
      'tengo la cara taporito',
      'quede taporito',
      'hueso roto',
      'fractura',
      'me cai de la moto',
      'me cai de la bicicleta',
      'me cai de las gradas',
      'me cai en la calle',
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
      // Camba «pitaí»: erupción cutánea con escozor producida por el calor.
      'pitai',
      'me salio pitai',
      'tengo pitai',
      'granos',
      'tengo granos',
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
    sinonimos: [
      'hongos',
      'pie de atleta',
      'unas amarillas',
      'micosis',
      'hongos en la piel',
      'comezon entre los dedos',
      'picazon entre los dedos',
      'picazon entre los dedos del pie',
      'piel pelada entre los dedos',
    ],
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
      'herida que no se cura',
      'no se me cura la herida',
      'llaga que no sana',
      'pie diabetico',
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
      // Una mordedura de perro, gato o mono puede necesitar la vacuna antirrábica: Medicina general primero.
      'mordedura de perro',
      'me mordio un gato',
      'me mordio una rata',
      'me mordio un mono',
      'me mordio un animal',
      'me pico una arana',
      // «Boro»: larva de la mosca Dermatobia hominis bajo la piel (Sanabria Fernández).
      'tengo un boro',
      'me entro un boro',
      'me salio un boro',
      'boro',
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
      'miedo a morirme',
      'siento que me voy a morir',
      'ataque de nervios',
      'crisis de ansiedad',
      'estres laboral',
      'burnout',
      'estoy colapsado',
      'vivo preocupado',
      'fobia',
      'miedo a salir de la casa',
      'miedo a la gente',
      'ansiedad social',
      'tengo los nervios de punta',
      // Agotamiento por el trabajo o el jefe: Psicología primero.
      'mi jefe me tiene podrido',
      'mi jefe me tiene harto',
      'estoy harto de mi jefe',
      'estoy harto del trabajo',
      'el trabajo me tiene podrido',
      // «Susto» andino: afección popular con nervios, insomnio y desgano. A secas NO («me dio un susto»).
      'me agarro el susto',
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
      'estoy depre',
      'tengo la depre',
      'estoy bajoneado',
      'ando con el bajon',
      'estoy deprimido',
      'soledad',
      'me siento abandonado',
      'no valgo nada',
      'me siento inutil',
      'baja autoestima',
      'no tengo ganas de levantarme',
      'no disfruto nada',
      // Fuente: «Palabras y frases del Oriente boliviano» (H. Sanabria Fernández, R. Gandarilla y J. Sánchez Suárez; eju.tv, 14/09/2021).
      // «Estar a las cachuchas»: situación depresiva, como víctima de la mala suerte.
      'estoy a las cachuchas',
      'ando a las cachuchas',
      // Fuente: ídem. «Amartelo»: malestar por la distancia de un ser querido (en el estudio, hijos que quedaron en Bolivia). Muestra pequeña: 27 personas.
      'tengo amartelo',
      'tengo mucha pena',
      'me da pena todo',
      'tengo pena',
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
      'no pego un ojo',
      'paso la noche en vela',
      'tengo el sueno cambiado',
      // Fuente: «Palabras y frases del Oriente boliviano» (H. Sanabria Fernández, R. Gandarilla y J. Sánchez Suárez; eju.tv, 14/09/2021).
      // «Dormir por enciminga»: tener el sueño muy leve.
      'duermo por enciminga',
      // «No duermo bien» NO: el motor reduce «duermo» y «duerme» al mismo verbo y cazaba «mi esposa no duerme» (es su ronquido).
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
      // «chupar» en Bolivia: tomar alcohol.
      'chupo mucho',
      'me emborracho seguido',
      'no puedo dejar el trago',
      'fumo marihuana',
      'consumo cocaina',
      'juego mucho por plata',
      'apuestas',
      'no puedo dejar el celular',
      'fumo mucho',
      'fumo demasiado',
    ],
    especialidades: [
      { nombre: 'Psiquiatría', peso: 3 },
      { nombre: 'Psicología', peso: 2 },
    ],
  },

  {
    id: 'alucinaciones',
    nombre: 'escuchar voces o ver cosas que no están',
    sinonimos: [
      'escucho voces',
      'oigo voces',
      'me hablan voces en la cabeza',
      'escucho gente que no esta',
      'oigo gente hablandome',
      'veo cosas que no hay',
      'veo cosas que no existen',
      'alucinaciones',
      'alucino',
      'siento que me persiguen',
      'siento que me vigilan',
      'paranoia',
      'creo que me quieren envenenar',
    ],
    especialidades: [
      { nombre: 'Psiquiatría', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'obsesiones',
    nombre: 'pensamientos o manías que no puedo frenar',
    sinonimos: [
      // «toc» NO: tres letras, el motor las descarta.
      'trastorno obsesivo compulsivo',
      'pensamientos intrusivos',
      'pensamientos que no me puedo sacar',
      'me lavo las manos todo el tiempo',
      // Nada que quede en «revisar» u «ordenar» solos: cazaban «quiero que me revisen» u «ordenar estudios».
      'compulsion por revisar',
      'reviso varias veces las puertas',
      'reviso mil veces si cerre la puerta',
      // «chequear» solo NO (también es «chequear mi presión»): siempre con lo que se revisa.
      'chequear la cocina',
      'chequear la puerta',
      'chequear el gas',
      'chequear las llaves',
      'tengo manias',
      'obsesion por el orden',
      'obsesiones',
    ],
    especialidades: [
      { nombre: 'Psiquiatría', peso: 3 },
      { nombre: 'Psicología', peso: 3 },
    ],
  },
  {
    id: 'trastorno-alimentario',
    nombre: 'problemas con la comida',
    sinonimos: [
      'anorexia',
      'bulimia',
      'me hago vomitar',
      'me provoco el vomito',
      'atracones',
      // «como» se descarta (es también «como si»): todas dicen «comer».
      'comer a escondidas',
      'comer sin control',
      'me siento gorda aunque estoy flaca',
      'dejo de comer para no engordar',
      'me da culpa comer',
      'miedo a engordar',
      'vomito a proposito',
      'miedo a subir de peso',
      'casi no comer para no engordar',
    ],
    especialidades: [
      { nombre: 'Psiquiatría', peso: 3 },
      { nombre: 'Psicología', peso: 3 },
      { nombre: 'Nutrición', peso: 2 },
    ],
  },
  {
    id: 'ira',
    nombre: 'enojo que no puedo controlar',
    sinonimos: [
      'me enojo por todo',
      'no controlo la ira',
      'no controlo mi enojo',
      'exploto de rabia',
      'ataques de ira',
      'estoy muy irritable',
      // «rabia» sola NO: es también la enfermedad («vacuna contra la rabia»).
      'siento mucha rabia',
      'me peleo con todos',
      'me pongo agresivo',
      'agresividad',
    ],
    especialidades: [
      { nombre: 'Psicología', peso: 3 },
      { nombre: 'Psiquiatría', peso: 2 },
    ],
  },
  {
    id: 'trauma',
    nombre: 'algo que me pasó y no puedo superar',
    sinonimos: [
      'trauma',
      'estres postraumatico',
      'tengo pesadillas',
      'pesadillas',
      'no puedo superar lo que me paso',
      'revivo lo que paso',
      'me asaltaron y tengo miedo',
      'recuerdos que no me dejan',
      'no puedo dejar de pensar en el accidente',
      'desde el accidente tengo miedo',
    ],
    especialidades: [
      { nombre: 'Psicología', peso: 3 },
      { nombre: 'Psiquiatría', peso: 2 },
    ],
  },
  {
    id: 'concentracion',
    nombre: 'problemas de atención y concentración',
    sinonimos: [
      'no me puedo concentrar',
      'me cuesta concentrarme',
      'me distraigo facil',
      'deficit de atencion',
      'tdah',
      'hiperactividad',
      'no puedo estar quieto',
      'no rindo en el estudio',
    ],
    especialidades: [
      { nombre: 'Psiquiatría', peso: 3 },
      { nombre: 'Psicología', peso: 2 },
      { nombre: 'Neurología', peso: 1 },
    ],
  },
  {
    id: 'cambios-de-humor',
    nombre: 'cambios bruscos de ánimo',
    sinonimos: [
      'cambios de humor',
      'cambios de animo',
      'mi humor cambia mucho',
      'un dia estoy feliz y otro triste',
      'un rato bien y otro mal',
      'bipolar',
      'estoy euforico',
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
      // «Coto» = bocio (Sanabria Fernández). «me duele el coto» es cuello y va en esa fila.
      'tengo coto',
      'me salio coto',
      'coto en el cuello',
      'bocio',
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
      'he subido de peso',
      'subi de peso',
      'estoy gordo',
      'estoy pasado de peso',
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
      'me arde al mear',
      'me arde cuando meo',
      'me arde el pichi',
      'ardor al hacer pichi',
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
    sinonimos: [
      'sangre en la orina',
      'orino sangre',
      'orina roja',
      'hematuria',
      'meo sangre',
      'mear sangre',
      'pichi con sangre',
    ],
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
    soloParaSexo: 'MALE',
    especialidades: [
      { nombre: 'Urología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-testiculos',
    nombre: 'dolor o bulto en los testículos',
    sinonimos: [
      'bulto en el testiculo',
      'varicocele',
      'me duelen los testiculos',
      // Registro popular (2026-10-08). «Huevos» a secas NO: es también el alimento.
      'me duelen los huevos',
      'me duelen las bolas',
      'me duelen las pelotas',
      'me duelen los cojones',
      'huevos hinchados',
      'bolas hinchadas',
      'bulto en los huevos',
      'bulto en la bola',
    ],
    partes: ['testiculo'],
    soloParaSexo: 'MALE',
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
      // Registro popular (2026-10-08). Ninguna se apoya en «no» + una palabra («no se me para» a
      // secas cazaba cualquier negación): siempre nombran la parte y el verbo.
      'la pilila no se me pone dura',
      'la paloma no se me pone dura',
      'la paloma no se me endurece',
      'la pilila no me responde',
      'la paloma no me responde',
      'no se me levanta la paloma',
      'no se me levanta la pilila',
      'no se me para',
      'no se me levanta',
      'no se me para el pene',
      'eyaculacion precoz',
      // «no se me para» a secas NO: el motor se queda con «no» y cazaba cualquier negación.
      // Ninguna se apoya en «no» + «pene» solos: cazaban «me duele el pene y no …».
      'el pene no se me pone duro',
      'el pene no se me endurece',
      'no se me levanta el pene',
      'se me pone blando el pene',
      'se me baja rapido',
    ],
    soloParaSexo: 'MALE',
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
      'me duele cuando me viene la regla',
      'dolor de regla',
    ],
    partes: ['menstruacion', 'regla', 'periodo', 'ovario'],
    soloParaSexo: 'FEMALE',
    especialidades: [
      { nombre: 'Ginecología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'atraso-menstrual',
    nombre: 'atraso menstrual',
    sinonimos: [
      'no me vino la regla',
      'no me baja la regla',
      'no me viene la menstruacion',
      'creo que estoy embarazada',
      'prueba de embarazo',
      'test de embarazo positivo',
      'regla atrasada',
      'tengo la regla atrasada',
      'me atrase',
    ],
    // El motor arma «atraso de la regla», «se me retrasó la menstruación» y las
    // demás combinaciones solo.
    partes: ['regla', 'menstruacion', 'periodo'],
    gatillos: ['atraso', 'retraso'],
    soloParaSexo: 'FEMALE',
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
    soloParaSexo: 'FEMALE',
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
      // Fuente: «Palabras y frases del Oriente boliviano» (H. Sanabria Fernández, R. Gandarilla y J. Sánchez Suárez; eju.tv, 14/09/2021).
      // «Enbombada»: mujer preñada.
      'estoy enbombada',
      'estoy embombada',
    ],
    soloParaSexo: 'FEMALE',
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
      // Registro popular (2026-10-08). «Concha» NO está acá: a una letra de «roncha» mandaba las erupciones
      // a Ginecología (la capa anatómica del servicio sí la entiende, por palabra exacta). «Cuca» a secas tampoco.
      'me pica la cuca',
      'me arde la cuca',
      'me arde la chucha',
      'me pica la chucha',
      // «Cocho» = vagina: reportado por el propietario (2026-10-08) como habla real en Bolivia; ninguna
      // fuente consultada lo registra (en Perú es «viejito», en México «cerdo»). Siempre con la molestia.
      'me pica el cocho',
      'me arde el cocho',
      'flujo en el cocho',
      'candidiasis',
      'mal olor vaginal',
      'ardor vaginal',
      'infeccion vaginal',
      'hongos vaginales',
    ],
    soloParaSexo: 'FEMALE',
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
      // «calores» a secas NO: se reduce a «calor» y cazaba «me salió pitaí por el calor».
      'bochornos',
      'calores de la menopausia',
      'climaterio',
      // «se me fue la regla hace meses» no está: se reducía a «regla» sola y
      // con eso se quedaba con cualquier consulta sobre la menstruación.
      'se me retiro la regla',
    ],
    soloParaSexo: 'FEMALE',
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
      'planificacion familiar',
      'metodo para no quedar embarazada',
      'cuidarme para no quedar embarazada',
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
      'me sale pus del pene',
      'pus del pene',
      'pus de la pilila',
      'pus de la paloma',
      'me sale pus de la chota',
      'me gotea la pilila',
      'me gotea la paloma',
      'me sale algo de la pilila',
      'me sale algo de la paloma',
      'secrecion del pene',
      'goteo en el pene',
      'purgaciones',
      'llagas en el pene',
      'llagas en la vagina',
      'ladillas',
      'herpes',
      'condilomas',
      'papiloma',
      'vph',
      'chancro',
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
      // Fuente: P. Rodríguez et al., síndromes de filiación cultural en inmigrantes bolivianos (Rev. Latino-Am. Enfermagem, 2017, PMC5511005): los pasmos son típicos del oriente (Beni y Santa Cruz) y de bebés.
      // «Mocheó»: estado enfermizo de los niños (Sanabria Fernández et al.). «Pasmo» a secas NO: es también el espasmo.
      'mi bebe tiene pasmo',
      'pasmo de luna',
      'pasmo de sol',
      'pasmo de sereno',
      'mi hijo tiene mocheo',
    ],
    especialidades: [{ nombre: 'Pediatría', peso: 3 }],
  },
  {
    id: 'desarrollo-del-nino',
    nombre: 'el desarrollo del niño',
    sinonimos: [
      'mi hijo no habla',
      'mi hijo no camina todavia',
      'el bebe todavia no camina',
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
      'quiero leer mis analisis',
      'leer mis analisis',
      'que me expliquen mis analisis',
      'no entiendo mis analisis',
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

  /* --- Lo que faltaba: palabras comunes de salud (2026-10-08) -------------------------- */
  {
    id: 'infeccion-respiratoria',
    nombre: 'bronquitis o neumonía',
    // Registro común hispanoamericano (2026-10-08, batería de 311 frases): sin fuente boliviana específica salvo donde se cita.
    sinonimos: [
      'bronquitis',
      'neumonia',
      'pulmonia',
      'infeccion en los pulmones',
      'pecho cargado',
      'pecho cerrado',
      'tos con pecho cerrado',
    ],
    especialidades: [
      { nombre: 'Neumología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Infectología', peso: 1 },
    ],
  },
  {
    id: 'colitis-ulcera',
    nombre: 'colitis o úlcera',
    sinonimos: [
      'colitis',
      'ulcera de estomago',
      'ulcera gastrica',
      'colon irritable',
      'colon inflamado',
    ],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'parasitos',
    nombre: 'parásitos o lombrices',
    // Registro común hispanoamericano (2026-10-08, batería de 311 frases): sin fuente boliviana específica salvo donde se cita.
    sinonimos: [
      'parasitos',
      'lombrices',
      'lombriz',
      'solitaria',
      'oxiuros',
      'giardia',
      'amebas',
      'tengo bichos en la barriga',
      'me salio un gusano',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Gastroenterología', peso: 2 },
      { nombre: 'Infectología', peso: 2 },
      { nombre: 'Pediatría', peso: 1 },
    ],
  },
  {
    id: 'vesicula',
    nombre: 'vesícula o cálculos biliares',
    sinonimos: [
      'calculos en la vesicula',
      'piedras en la vesicula',
      'dolor de vesicula',
      'vesicula inflamada',
      'colecistitis',
      'mal de la vesicula',
    ],
    especialidades: [
      { nombre: 'Cirugía general', peso: 3 },
      { nombre: 'Gastroenterología', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'apendicitis',
    nombre: 'posible apendicitis',
    sinonimos: [
      'apendicitis',
      'dolor en el lado derecho abajo de la panza',
      'dolor en la fosa iliaca derecha',
    ],
    especialidades: [
      { nombre: 'Cirugía general', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'hernia',
    nombre: 'hernia',
    sinonimos: [
      'hernia',
      'hernia inguinal',
      'hernia umbilical',
      'bulto en la ingle',
      'bulto en el ombligo',
      'me salio una bola en la ingle',
    ],
    especialidades: [
      { nombre: 'Cirugía general', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'hipo',
    nombre: 'hipo que no se quita',
    sinonimos: [
      'hipo',
      'hipo que no se quita',
      'hipo que no para',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Gastroenterología', peso: 1 },
    ],
  },
  {
    id: 'mal-aliento',
    nombre: 'mal aliento o lengua blanca',
    sinonimos: [
      'halitosis',
      'aliento feo',
      'lengua blanca',
      'sabor amargo en la boca',
      'sabor feo en la boca',
    ],
    especialidades: [
      { nombre: 'Odontología', peso: 2 },
      { nombre: 'Gastroenterología', peso: 2 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'boca-seca',
    nombre: 'boca seca',
    sinonimos: [
      'boca seca',
      'sequedad en la boca',
      'me seca la boca',
      'mucha sed por la noche',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Odontología', peso: 2 },
      { nombre: 'Endocrinología', peso: 1 },
    ],
  },
  {
    id: 'falta-de-apetito',
    nombre: 'falta de apetito',
    // «No tengo hambre» vale desde que el motor exige el «no» pegado a la palabra siguiente.
    sinonimos: [
      'falta de apetito',
      'sin apetito',
      'sin hambre',
      'perdi el apetito',
      'perdi el hambre',
      'sin ganas de comer',
      'perdi las ganas de comer',
      'no quiero comer',
      'no tengo hambre',
      'no me da hambre',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Nutrición', peso: 1 },
      { nombre: 'Psiquiatría', peso: 1 },
    ],
  },
  {
    id: 'mucha-hambre-o-sed',
    nombre: 'mucha hambre o mucha sed',
    sinonimos: [
      // «Mucha hambre» y «mucha sed» NO: «mucha» se descarta y quedaban en «hambre» o «sed» a secas.
      'hambre todo el tiempo',
      'hambre a cada rato',
      'hambre excesiva',
      'sed todo el tiempo',
      'sed a cada rato',
      'sed excesiva',
      'polifagia',
      'polidipsia',
    ],
    especialidades: [
      { nombre: 'Endocrinología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Nutrición', peso: 1 },
    ],
  },
  {
    id: 'cambios-en-la-orina',
    nombre: 'cambios en la orina',
    // Registro común hispanoamericano (2026-10-08, batería de 311 frases): sin fuente boliviana específica salvo donde se cita.
    sinonimos: [
      'orino mucho',
      'orino poco',
      'orino a cada rato',
      'orina oscura',
      'orina turbia',
      'orina con mal olor',
      'orina espumosa',
      'se me escapa la orina',
      'pierdo orina',
      'incontinencia',
      'me orino sin querer',
      'no puedo orinar',
      'no sale la orina',
    ],
    especialidades: [
      { nombre: 'Urología', peso: 3 },
      { nombre: 'Nefrología', peso: 1 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'miomas-quistes',
    nombre: 'miomas o quistes en los ovarios',
    sinonimos: [
      'miomas',
      'fibromas',
      'quistes en los ovarios',
      'quiste de ovario',
      'ovarios poliquisticos',
      'tumor en el utero',
    ],
    soloParaSexo: 'FEMALE',
    especialidades: [
      { nombre: 'Ginecología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'enfermedad-de-la-piel',
    nombre: 'eczema, dermatitis o psoriasis',
    // «Saro»: piel escamosa por la sequedad del ambiente (Sanabria Fernández et al., 2021).
    sinonimos: [
      'eczema',
      'eccema',
      'dermatitis',
      'psoriasis',
      'caspa',
      'vitiligo',
      'rosacea',
      'piel muy seca',
      'piel reseca',
      'piel escamosa',
      'piel pelada',
      'saro',
    ],
    especialidades: [
      { nombre: 'Dermatología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'piojos-sarna',
    nombre: 'piojos o sarna',
    sinonimos: [
      'piojos',
      'piojo',
      'liendres',
      'sarna',
      'escabiosis',
      'pulgas',
      'chinches',
      'me pica de noche entre los dedos',
    ],
    especialidades: [
      { nombre: 'Dermatología', peso: 3 },
      { nombre: 'Pediatría', peso: 1 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'quemadura',
    nombre: 'quemadura',
    sinonimos: [
      'quemadura',
      'me queme',
      'me quemo el sol',
      'quemadura de sol',
      'me escalde',
      'me queme con aceite',
      'me queme con agua caliente',
      'ampollas por quemadura',
      'me quemo la plancha',
    ],
    especialidades: [
      { nombre: 'Cirugía general', peso: 3 },
      { nombre: 'Dermatología', peso: 2 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'herida-o-corte',
    nombre: 'herida o corte',
    // Cada frase nombra lo cortado o el objeto: «me corto» a secas es también la autolesión (ver ideas-suicidas).
    sinonimos: [
      'me corte el dedo',
      'me corte la mano',
      'me corte con un cuchillo',
      'me corte con un vidrio',
      'herida profunda',
      'herida abierta',
      'cortadura',
      'tajo',
      'me raspe',
      'raspadura',
      'me hice una herida',
      'herida que sangra',
    ],
    especialidades: [
      { nombre: 'Cirugía general', peso: 3 },
      { nombre: 'Medicina general', peso: 3 },
    ],
  },
  {
    id: 'ampolla-callo',
    nombre: 'ampolla o callo',
    sinonimos: [
      'ampolla',
      'ampollas',
      'callo',
      'callos',
      'callosidad',
    ],
    especialidades: [
      { nombre: 'Dermatología', peso: 2 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Traumatología', peso: 1 },
    ],
  },
  {
    id: 'ictericia',
    nombre: 'piel o ojos amarillos',
    sinonimos: [
      'ojos amarillos',
      'piel amarilla',
      'ictericia',
      'hepatitis',
      'amarillez',
      'me puse amarillo',
      'mal del higado',
    ],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Infectología', peso: 1 },
    ],
  },
  {
    id: 'osteoporosis-escoliosis',
    nombre: 'huesos débiles o columna torcida',
    sinonimos: [
      'osteoporosis',
      'escoliosis',
      'huesos debiles',
      'columna torcida',
      'joroba',
      'espalda encorvada',
      'cifosis',
    ],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Reumatología', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'presion-baja',
    nombre: 'presión baja',
    sinonimos: [
      'presion baja',
      'tengo la presion baja',
      'hipotension',
      'se me baja la presion',
      'bajon de presion',
      'me baja la presion',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Cardiología', peso: 2 },
    ],
  },
  {
    id: 'azucar-baja',
    nombre: 'azúcar baja',
    sinonimos: [
      'azucar baja',
      'tengo el azucar baja',
      'hipoglucemia',
      'bajon de azucar',
      'se me baja el azucar',
    ],
    especialidades: [
      { nombre: 'Endocrinología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'somnolencia',
    nombre: 'sueño excesivo',
    // «Duermo mucho / poco / demasiado» NO: el motor descarta la cantidad y queda «dormir» a secas.
    sinonimos: [
      'tengo sueno todo el dia',
      'mucho sueno',
      'me quedo dormido en el dia',
      'somnolencia',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Neurología', peso: 1 },
      { nombre: 'Psiquiatría', peso: 1 },
    ],
  },
  {
    id: 'malaria',
    nombre: 'malaria o paludismo',
    sinonimos: [
      'malaria',
      'paludismo',
      'fiebre terciana',
      'fiebre con escalofrios y temblores',
    ],
    especialidades: [
      { nombre: 'Infectología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'chagas',
    nombre: 'mal de Chagas',
    // Endémico en Bolivia; el contagio es por la vinchuca.
    sinonimos: [
      'chagas',
      'mal de chagas',
      'vinchuca',
      'me pico una vinchuca',
      'me pico la vinchuca',
      'tengo chagas',
    ],
    especialidades: [
      { nombre: 'Infectología', peso: 3 },
      { nombre: 'Cardiología', peso: 2 },
      { nombre: 'Gastroenterología', peso: 1 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'leishmaniasis',
    nombre: 'leishmaniasis',
    // «Uta» (leishmaniasis cutánea en Bolivia) no se agrega: el motor descarta las palabras de 3 letras.
    sinonimos: [
      'leishmaniasis',
      'espundia',
      'llaga de la selva',
      'llaga que no sana en la selva',
      'herida del mosquito que no sana',
    ],
    especialidades: [
      { nombre: 'Infectología', peso: 3 },
      { nombre: 'Dermatología', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'tuberculosis',
    nombre: 'tuberculosis',
    sinonimos: [
      'tuberculosis',
      'tisis',
      'tos con sangre',
      'escupo sangre',
      'esputo con sangre',
      'tos de mas de dos semanas',
      'tos de mas de quince dias',
    ],
    especialidades: [
      { nombre: 'Neumología', peso: 3 },
      { nombre: 'Infectología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'tifoidea',
    nombre: 'fiebre tifoidea',
    sinonimos: [
      'tifoidea',
      'fiebre tifoidea',
      'salmonela',
      'salmonelosis',
    ],
    especialidades: [
      { nombre: 'Infectología', peso: 3 },
      { nombre: 'Gastroenterología', peso: 2 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'enfermedad-infantil-contagiosa',
    nombre: 'varicela, sarampión u otra enfermedad infantil',
    // «Lechina»: varicela en el habla popular de la región andina.
    sinonimos: [
      'varicela',
      'sarampion',
      'paperas',
      'rubeola',
      'escarlatina',
      'roseola',
      'tos ferina',
      'coqueluche',
      'lechina',
    ],
    especialidades: [
      { nombre: 'Pediatría', peso: 3 },
      { nombre: 'Infectología', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'alzheimer-parkinson',
    nombre: 'Parkinson, Alzheimer o demencia',
    // «Tembleque»: persona con Parkinson (Sanabria Fernández et al., 2021).
    sinonimos: [
      'parkinson',
      'mal de parkinson',
      'tembleque',
      'alzheimer',
      'demencia',
      'se le olvida todo',
      'no reconoce a la familia',
    ],
    especialidades: [
      { nombre: 'Neurología', peso: 3 },
      { nombre: 'Geriatría', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'cancer',
    nombre: 'cáncer o tumor',
    sinonimos: [
      'cancer',
      'tumor',
      'quimioterapia',
      'radioterapia',
      'me detectaron un tumor',
      'bulto que crece',
    ],
    especialidades: [
      { nombre: 'Oncología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'enfermedad-renal',
    nombre: 'enfermedad de los riñones',
    sinonimos: [
      'insuficiencia renal',
      'dialisis',
      'rinones enfermos',
      'enfermedad renal',
      'proteinuria',
    ],
    especialidades: [
      { nombre: 'Nefrología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'golpe-de-calor',
    nombre: 'golpe de calor o deshidratación',
    sinonimos: [
      'insolacion',
      'golpe de calor',
      'deshidratacion',
      'me deshidrate',
      'me dio un golpe de calor',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
    ],
  },
  {
    id: 'lactancia-posparto',
    nombre: 'lactancia o posparto',
    sinonimos: [
      'lactancia',
      'mastitis',
      'no tengo leche',
      'dar de lactar',
      'posparto',
      'puerperio',
      'cesarea',
      'sangrado despues del parto',
    ],
    soloParaSexo: 'FEMALE',
    especialidades: [
      { nombre: 'Obstetricia', peso: 3 },
      { nombre: 'Ginecología', peso: 2 },
      { nombre: 'Pediatría', peso: 1 },
    ],
  },
  {
    id: 'fimosis',
    nombre: 'fimosis',
    sinonimos: [
      'fimosis',
      'prepucio apretado',
      'circuncision',
      'no baja el prepucio',
    ],
    soloParaSexo: 'MALE',
    especialidades: [
      { nombre: 'Urología', peso: 3 },
    ],
  },
  {
    id: 'resaca',
    nombre: 'resaca',
    // «Cruda» (México), «guayabo» (Colombia), «chak'i» (Bolivia): hangover. Fuente de chak'i: psicologiaymente.com «125 palabras bolivianas».
    sinonimos: [
      'resaca',
      'cruda',
      'guayabo',
      'chaqui',
      'tengo chaqui',
      'guayaba por tomar',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Gastroenterología', peso: 1 },
    ],
  },
  {
    id: 'dificultad-para-caminar',
    nombre: 'dificultad para caminar',
    sinonimos: [
      'dificultad para caminar',
      'camina con dificultad',
      'le cuesta caminar',
      'arrastra los pies',
      'se cae seguido',
      'camina muy despacio',
    ],
    especialidades: [
      { nombre: 'Traumatología', peso: 2 },
      { nombre: 'Neurología', peso: 2 },
      { nombre: 'Geriatría', peso: 2 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'alergia',
    nombre: 'alergia',
    sinonimos: [
      'soy alergico',
      'rinitis alergica',
      'estornudos alergicos',
      'alergia a la penicilina',
      'alergia a un medicamento',
      'alergia a la comida',
    ],
    especialidades: [
      { nombre: 'Alergología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Dermatología', peso: 1 },
    ],
  },
];
