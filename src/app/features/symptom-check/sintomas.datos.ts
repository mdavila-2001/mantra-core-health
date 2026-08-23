/* ============================================================================
    La tabla de síntomas y a qué especialidad orientan.

    ## Por qué es una tabla curada y no un modelo

    C1 del plan de UX del 22/08/2026. El efecto que el flujo tiene que producir
    es «me entendió»: que quien escribe «me duele la cabeza hace tres días y
    veo borroso» vea aparecer *dolor de cabeza* y *visión borrosa* mientras
    escribe. Eso lo consigue una tabla de sinónimos normalizados; un modelo
    agregaría latencia, coste, una dependencia y —lo peor— respuestas que nadie
    puede explicar en una pantalla de salud.

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

    ## Cómo se amplía

    Agregando filas. Cada una necesita: el nombre en castellano llano, los
    sinónimos coloquiales con los que la gente lo escribe —incluidos los que se
    escriben mal a propósito, «dolor de panza»— y una o más especialidades con
    su peso. Los pesos son relativos dentro de la fila: 3 es «es lo primero que
    uno pensaría», 1 es «también podría ser».

    Las filas de esta primera versión salen de los motivos de consulta más
    frecuentes de atención primaria. **Falta que el equipo médico las revise**:
    hasta entonces son una orientación razonable, no una lista validada.
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
   * Con qué palabras lo escribe la gente.
   *
   * Se comparan **normalizadas** —sin tildes, en minúsculas—, así que no hace
   * falta repetir «cabeza» y «cabéza». Sí hace falta repetir las formas
   * coloquiales: «panza» y «barriga» no se derivan de «abdomen».
   */
  readonly sinonimos: readonly string[];
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
      'dolor de pecho',
      'dolor en el pecho',
      'me duele el pecho',
      'opresion en el pecho',
      'presion en el pecho',
      'dolor toracico',
      'aprieta el pecho',
    ],
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
    ],
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
    ],
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
    ],
    especialidades: [],
  },
  {
    id: 'sangrado-abundante',
    nombre: 'sangrado que no para',
    sinonimos: [
      'sangrado abundante',
      'no para de sangrar',
      'hemorragia',
      'sangro mucho',
      'vomito sangre',
      'sangre en el vomito',
    ],
    especialidades: [],
  },
  {
    id: 'convulsion',
    nombre: 'convulsión',
    sinonimos: [
      'convulsion',
      'convulsiones',
      'ataque',
      'me convulsione',
    ],
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
  {
    id: 'fiebre',
    nombre: 'fiebre',
    sinonimos: [
      'fiebre',
      'tengo fiebre',
      'temperatura',
      'calentura',
      'febril',
      '38 grados',
      '39 grados',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Infectología', peso: 2 },
      { nombre: 'Pediatría', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-cabeza',
    nombre: 'dolor de cabeza',
    sinonimos: [
      'dolor de cabeza',
      'me duele la cabeza',
      'cefalea',
      'jaqueca',
      'migrana',
      'migrana',
    ],
    especialidades: [
      { nombre: 'Neurología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Oftalmología', peso: 1 },
    ],
  },
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
    ],
    especialidades: [
      { nombre: 'Oftalmología', peso: 3 },
      { nombre: 'Neurología', peso: 2 },
    ],
  },
  {
    id: 'dolor-de-garganta',
    nombre: 'dolor de garganta',
    sinonimos: [
      'dolor de garganta',
      'me duele la garganta',
      'garganta inflamada',
      'anginas',
      'me arde la garganta',
      'dolor al tragar',
    ],
    especialidades: [
      { nombre: 'Otorrinolaringología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'tos',
    nombre: 'tos',
    sinonimos: [
      'tos',
      'toso',
      'tos seca',
      'tos con flema',
      'tosiendo',
    ],
    especialidades: [
      { nombre: 'Neumología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Otorrinolaringología', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-panza',
    nombre: 'dolor de panza',
    sinonimos: [
      'dolor de panza',
      'me duele la panza',
      'dolor abdominal',
      'dolor de barriga',
      'me duele el estomago',
      'dolor de estomago',
      'retorcijones',
      'colicos',
    ],
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
    ],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Infectología', peso: 1 },
    ],
  },
  {
    id: 'nauseas',
    nombre: 'náuseas o vómitos',
    sinonimos: [
      'nauseas',
      'ganas de vomitar',
      'vomito',
      'vomitos',
      'asco',
      'descompostura',
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
    ],
    especialidades: [
      { nombre: 'Gastroenterología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-espalda',
    nombre: 'dolor de espalda',
    sinonimos: [
      'dolor de espalda',
      'me duele la espalda',
      'lumbago',
      'dolor lumbar',
      'dolor de cintura',
      'me duele la cintura',
    ],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Medicina general', peso: 2 },
      { nombre: 'Fisioterapia', peso: 2 },
    ],
  },
  {
    id: 'dolor-de-rodilla',
    nombre: 'dolor de rodilla',
    sinonimos: [
      'dolor de rodilla',
      'me duele la rodilla',
      'rodilla hinchada',
      'rodillas',
    ],
    especialidades: [
      { nombre: 'Traumatología', peso: 3 },
      { nombre: 'Reumatología', peso: 2 },
      { nombre: 'Fisioterapia', peso: 2 },
    ],
  },
  {
    id: 'dolor-articular',
    nombre: 'dolor en las articulaciones',
    sinonimos: [
      'dolor en las articulaciones',
      'dolor articular',
      'me duelen las articulaciones',
      'dolor de huesos',
      'artritis',
      'articulaciones hinchadas',
    ],
    especialidades: [
      { nombre: 'Reumatología', peso: 3 },
      { nombre: 'Traumatología', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'erupcion',
    nombre: 'manchas o ronchas en la piel',
    sinonimos: [
      'ronchas',
      'sarpullido',
      'erupcion',
      'manchas en la piel',
      'granos',
      'urticaria',
      'me pica la piel',
      'picazon',
    ],
    especialidades: [
      { nombre: 'Dermatología', peso: 3 },
      { nombre: 'Alergología', peso: 2 },
    ],
  },
  {
    id: 'caida-de-pelo',
    nombre: 'caída del pelo',
    sinonimos: [
      'se me cae el pelo',
      'caida del pelo',
      'caida de cabello',
      'calvicie',
      'alopecia',
    ],
    especialidades: [
      { nombre: 'Dermatología', peso: 3 },
    ],
  },
  {
    id: 'mareo',
    nombre: 'mareo',
    sinonimos: [
      'mareo',
      'mareos',
      'me mareo',
      'vertigo',
      'todo me da vueltas',
    ],
    especialidades: [
      { nombre: 'Otorrinolaringología', peso: 3 },
      { nombre: 'Neurología', peso: 2 },
      { nombre: 'Cardiología', peso: 1 },
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
      'tengo la presion alta',
      'me subio la presion',
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
    id: 'ardor-al-orinar',
    nombre: 'ardor al orinar',
    sinonimos: [
      'ardor al orinar',
      'me arde al orinar',
      'duele orinar',
      'infeccion urinaria',
      'voy seguido al bano',
      'orino seguido',
    ],
    especialidades: [
      { nombre: 'Urología', peso: 3 },
      { nombre: 'Ginecología', peso: 2 },
      { nombre: 'Medicina general', peso: 2 },
    ],
  },
  {
    id: 'dolor-menstrual',
    nombre: 'dolor menstrual',
    sinonimos: [
      'dolor menstrual',
      'colicos menstruales',
      'me duele la regla',
      'dolor de ovarios',
      'menstruacion dolorosa',
      'regla dolorosa',
    ],
    especialidades: [
      { nombre: 'Ginecología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'atraso-menstrual',
    nombre: 'atraso menstrual',
    sinonimos: [
      'atraso menstrual',
      'no me vino',
      'se me atraso la regla',
      'creo que estoy embarazada',
      'prueba de embarazo',
    ],
    especialidades: [
      { nombre: 'Ginecología', peso: 3 },
      { nombre: 'Obstetricia', peso: 3 },
    ],
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
    id: 'ansiedad',
    nombre: 'ansiedad',
    sinonimos: [
      'ansiedad',
      'estoy ansioso',
      'estoy ansiosa',
      'ataques de panico',
      'angustia',
      'nervios',
      'estres',
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
      'tristeza',
      'depresion',
      'no tengo ganas de nada',
      'me siento mal animicamente',
      'desanimo',
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
    ],
    especialidades: [
      { nombre: 'Psiquiatría', peso: 2 },
      { nombre: 'Psicología', peso: 2 },
      { nombre: 'Neurología', peso: 2 },
      { nombre: 'Medicina general', peso: 1 },
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
      'agotada',
      'debilidad',
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
      'baje de peso',
      'perdida de peso',
      'adelgace sin querer',
      'estoy bajando de peso',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Endocrinología', peso: 2 },
      { nombre: 'Oncología', peso: 1 },
    ],
  },
  {
    id: 'azucar-alta',
    nombre: 'azúcar alta',
    sinonimos: [
      'azucar alta',
      'diabetes',
      'glucosa alta',
      'me sube el azucar',
      'tengo azucar',
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
    ],
    especialidades: [
      { nombre: 'Endocrinología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-oido',
    nombre: 'dolor de oído',
    sinonimos: [
      'dolor de oido',
      'me duele el oido',
      'oido tapado',
      'zumbido en el oido',
      'no escucho bien',
      'otitis',
    ],
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
    ],
    especialidades: [
      { nombre: 'Otorrinolaringología', peso: 3 },
      { nombre: 'Alergología', peso: 3 },
      { nombre: 'Medicina general', peso: 1 },
    ],
  },
  {
    id: 'dolor-de-muelas',
    nombre: 'dolor de muelas',
    sinonimos: [
      'dolor de muelas',
      'me duele una muela',
      'dolor dental',
      'caries',
      'encias sangrantes',
      'me duele un diente',
    ],
    especialidades: [
      { nombre: 'Odontología', peso: 3 },
    ],
  },
  {
    id: 'lunar-que-cambio',
    nombre: 'un lunar que cambió',
    sinonimos: [
      'lunar',
      'me cambio un lunar',
      'mancha que crece',
      'lunar raro',
      'verruga',
    ],
    especialidades: [
      { nombre: 'Dermatología', peso: 3 },
      { nombre: 'Oncología', peso: 1 },
    ],
  },
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
    ],
    especialidades: [
      { nombre: 'Pediatría', peso: 3 },
    ],
  },
  {
    id: 'dolor-al-tener-relaciones',
    nombre: 'dolor en las relaciones',
    sinonimos: [
      'dolor al tener relaciones',
      'dolor en las relaciones',
      'dispareunia',
    ],
    especialidades: [
      { nombre: 'Ginecología', peso: 3 },
      { nombre: 'Urología', peso: 2 },
    ],
  },
  {
    id: 'problemas-de-ereccion',
    nombre: 'problemas de erección',
    sinonimos: [
      'problemas de ereccion',
      'disfuncion erectil',
      'no puedo tener ereccion',
    ],
    especialidades: [
      { nombre: 'Urología', peso: 3 },
      { nombre: 'Endocrinología', peso: 1 },
    ],
  },
  {
    id: 'chequeo',
    nombre: 'un chequeo general',
    sinonimos: [
      'chequeo',
      'control general',
      'chequeo general',
      'examenes de rutina',
      'control anual',
      'chequeo de rutina',
      'analisis de rutina',
    ],
    especialidades: [
      { nombre: 'Medicina general', peso: 3 },
      { nombre: 'Nutrición', peso: 1 },
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
    ],
    especialidades: [
      { nombre: 'Nutrición', peso: 3 },
      { nombre: 'Endocrinología', peso: 2 },
    ],
  },
];
