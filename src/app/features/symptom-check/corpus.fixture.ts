/* ============================================================================
    El banco de textos con el que se mide el reconocimiento.

    ## Por qué existe

    «Anda mejor» no es una medición. Este archivo es la definición operativa de
    que el motor funciona: doscientos textos escritos como los escribe la gente
    —con faltas, sin tildes, negando, encadenando tres cosas en una oración, con
    modismos de un país y de otro— y, al lado de cada uno, qué tiene que
    reconocer. `corpus.spec.ts` lo corre entero y falla si el porcentaje baja.

    ## Qué es «correcto» acá

    El conjunto **exacto**: ni de menos ni de más. Un texto que además reconoce
    un síntoma que nadie nombró cuenta como fallo igual que uno que no reconoce
    nada, porque en la pantalla los dos se ven igual de mal — un chip de sobra
    dice «no te entendí» tan fuerte como un chip que falta.

    ## De dónde salen los textos

    Están escritos a partir de los motivos de consulta frecuentes de atención
    primaria y de las maneras en que se los nombra en el Río de la Plata, los
    Andes y México. **No son textos reales de pacientes**: el producto todavía
    no los recoge. Cuando los haya, este archivo se reemplaza por ellos y la
    medición pasa a valer de verdad; hasta entonces mide lo que el equipo cree
    que la gente escribe, que es mejor que no medir nada y peor que medir.
    ========================================================================== */

/** Un texto y lo que hay que entenderle. */
export interface CasoDelBanco {
  /** Lo que alguien escribiría, tal cual, con sus faltas. */
  readonly texto: string;
  /** Los `id` de los síntomas que hay que reconocer. Sin orden. */
  readonly sintomas: readonly string[];
  /** Los `id` de alarma que tienen que derivar a urgencias. */
  readonly alarmas?: readonly string[];
}

export const BANCO: readonly CasoDelBanco[] = [
  /* --- Lo más corriente, dicho de la manera más corriente ---------------- */
  { texto: 'me duele la cabeza', sintomas: ['dolor-de-cabeza'] },
  { texto: 'tengo dolor de cabeza hace tres dias', sintomas: ['dolor-de-cabeza'] },
  { texto: 'me duele mucho la cabeza desde ayer', sintomas: ['dolor-de-cabeza'] },
  { texto: 'tengo fiebre', sintomas: ['fiebre'] },
  { texto: 'tengo tos', sintomas: ['tos'] },
  { texto: 'me duele la garganta', sintomas: ['dolor-de-garganta'] },
  { texto: 'me duele la panza', sintomas: ['dolor-de-panza'] },
  { texto: 'tengo diarrea', sintomas: ['diarrea'] },
  { texto: 'estoy con nauseas', sintomas: ['nauseas'] },
  { texto: 'tengo acidez', sintomas: ['acidez'] },
  { texto: 'me duele la espalda', sintomas: ['dolor-de-espalda'] },
  { texto: 'me duele la rodilla', sintomas: ['dolor-de-rodilla'] },
  { texto: 'tengo ronchas en la piel', sintomas: ['erupcion'] },
  { texto: 'se me cae el pelo', sintomas: ['caida-de-pelo'] },
  { texto: 'estoy mareado', sintomas: ['mareo'] },
  { texto: 'tengo palpitaciones', sintomas: ['palpitaciones'] },
  { texto: 'tengo la presion alta', sintomas: ['presion-alta'] },
  { texto: 'se me hinchan las piernas', sintomas: ['hinchazon-de-piernas'] },
  { texto: 'me arde al orinar', sintomas: ['ardor-al-orinar'] },
  { texto: 'tengo mucha ansiedad', sintomas: ['ansiedad'] },
  { texto: 'no puedo dormir', sintomas: ['insomnio'] },
  { texto: 'estoy muy cansado todo el dia', sintomas: ['cansancio'] },
  { texto: 'tengo diabetes', sintomas: ['azucar-alta'] },
  { texto: 'tengo problemas de tiroides', sintomas: ['tiroides'] },
  { texto: 'me duele el oido', sintomas: ['dolor-de-oido'] },
  { texto: 'tengo la nariz tapada', sintomas: ['congestion-nasal'] },
  { texto: 'me duele una muela', sintomas: ['dolor-de-muelas'] },
  { texto: 'quiero un chequeo general', sintomas: ['chequeo'] },
  { texto: 'quiero bajar de peso', sintomas: ['nutricion'] },
  { texto: 'necesito un control de embarazo', sintomas: ['control-embarazo'] },
  { texto: 'me duele la regla', sintomas: ['dolor-menstrual'] },
  { texto: 'tengo problemas de ereccion', sintomas: ['problemas-de-ereccion'] },
  { texto: 'necesito vacunarme', sintomas: ['vacunas'] },
  { texto: 'necesito una receta', sintomas: ['receta'] },
  { texto: 'me quiero hacer un certificado medico', sintomas: ['certificado'] },
  { texto: 'tengo hemorroides', sintomas: ['hemorroides'] },
  { texto: 'estoy estrenido', sintomas: ['estrenimiento'] },
  { texto: 'tengo mucho gases', sintomas: ['gases'] },
  { texto: 'tengo asma', sintomas: ['asma'] },
  { texto: 'me sangra la nariz', sintomas: ['sangrado-de-nariz'] },
  { texto: 'estoy afonico', sintomas: ['ronquera'] },
  { texto: 'tengo varices en las piernas', sintomas: ['varices'] },
  { texto: 'tengo anemia', sintomas: ['anemia'] },
  { texto: 'tengo el colesterol alto', sintomas: ['colesterol'] },
  { texto: 'tengo acne', sintomas: ['acne'] },
  { texto: 'tengo hongos en los pies', sintomas: ['hongos'] },
  { texto: 'me pico un bicho', sintomas: ['picadura'] },
  { texto: 'me tiemblan las manos', sintomas: ['temblor'] },
  { texto: 'se me duermen las manos', sintomas: ['hormigueo'] },
  { texto: 'me olvido de todo', sintomas: ['olvidos'] },
  { texto: 'tengo el ojo rojo', sintomas: ['ojo-irritado'] },
  { texto: 'no veo de lejos', sintomas: ['necesito-lentes'] },
  { texto: 'ronco mucho de noche', sintomas: ['ronquidos'] },
  { texto: 'tengo un flujo raro', sintomas: ['flujo-vaginal'] },
  { texto: 'quiero hacerme un papanicolau', sintomas: ['control-ginecologico'] },
  { texto: 'estoy en la menopausia', sintomas: ['menopausia'] },
  { texto: 'quiero empezar un anticonceptivo', sintomas: ['anticoncepcion'] },
  { texto: 'me duelen los testiculos', sintomas: ['dolor-de-testiculos'] },
  { texto: 'tengo la prostata grande', sintomas: ['prostata'] },
  { texto: 'orino sangre', sintomas: ['sangre-en-la-orina'] },

  /* --- La gramática de verdad: plural, orden y conjugación --------------- */
  { texto: 'me duelen las rodillas', sintomas: ['dolor-de-rodilla'] },
  { texto: 'me duelen las articulaciones', sintomas: ['dolor-articular'] },
  { texto: 'la cabeza me duele mucho', sintomas: ['dolor-de-cabeza'] },
  { texto: 'la garganta me arde', sintomas: ['dolor-de-garganta'] },
  { texto: 'tengo un dolor muy fuerte en la cabeza', sintomas: ['dolor-de-cabeza'] },
  { texto: 'tengo un dolor en la boca del estomago', sintomas: ['dolor-de-panza'] },
  { texto: 'me duele la rodilla derecha al caminar', sintomas: ['dolor-de-rodilla'] },
  { texto: 'ayer me dolia la cabeza', sintomas: ['dolor-de-cabeza'] },
  { texto: 'vengo con dolores de cabeza seguidos', sintomas: ['dolor-de-cabeza'] },
  { texto: 'tengo los tobillos hinchados', sintomas: ['hinchazon-de-piernas'] },
  { texto: 'tosiendo hace una semana', sintomas: ['tos'] },
  { texto: 'estoy vomitando', sintomas: ['nauseas'] },
  { texto: 'me marea todo', sintomas: ['mareo'] },
  { texto: 'duermo muy mal', sintomas: ['insomnio'] },
  { texto: 'me canso al subir las escaleras', sintomas: ['cansancio'] },
  { texto: 'tengo las encias inflamadas', sintomas: ['dolor-de-muelas'] },
  { texto: 'se me hincha el pie', sintomas: ['hinchazon-de-piernas'] },
  { texto: 'me pican los ojos', sintomas: ['ojo-irritado'] },
  { texto: 'me arden los ojos', sintomas: ['ojo-irritado'] },
  { texto: 'siento pinchazos en el cuello', sintomas: ['dolor-de-cuello'] },

  /* --- Cómo se escribe en un teléfono ------------------------------------ */
  { texto: 'me duele la caveza', sintomas: ['dolor-de-cabeza'] },
  { texto: 'tengo fievre', sintomas: ['fiebre'] },
  { texto: 'estoy con diarea', sintomas: ['diarrea'] },
  { texto: 'tengo mucha tos y fiebre', sintomas: ['tos', 'fiebre'] },
  { texto: 'me duele la garganta y tengo tos', sintomas: ['dolor-de-garganta', 'tos'] },
  { texto: 'tengo dolor de kbeza', sintomas: ['dolor-de-cabeza'] },
  { texto: 'me duele el estomajo', sintomas: ['dolor-de-panza'] },
  { texto: 'tengo ansiedaz', sintomas: ['ansiedad'] },
  { texto: 'siento nauceas', sintomas: ['nauseas'] },
  { texto: 'tengo diavetes', sintomas: ['azucar-alta'] },
  { texto: 'me duele la espada', sintomas: ['dolor-de-espalda'] },
  { texto: 'tengo mareyos', sintomas: ['mareo'] },
  { texto: 'me duele muchoooo la cabeza', sintomas: ['dolor-de-cabeza'] },
  { texto: 'tengo migraña', sintomas: ['dolor-de-cabeza'] },
  { texto: 'TENGO FIEBRE Y DOLOR DE GARGANTA', sintomas: ['fiebre', 'dolor-de-garganta'] },
  { texto: 'me duele la panza,tengo diarrea', sintomas: ['dolor-de-panza', 'diarrea'] },

  /* --- Modismos: la misma cosa en cuatro países -------------------------- */
  { texto: 'me duele la barriga', sintomas: ['dolor-de-panza'] },
  { texto: 'me duele la guata', sintomas: ['dolor-de-panza'] },
  { texto: 'me duele el vientre', sintomas: ['dolor-de-panza'] },
  { texto: 'tengo calentura', sintomas: ['fiebre'] },
  { texto: 'estoy engripado', sintomas: ['resfrio'] },
  { texto: 'me agarre una gripa', sintomas: ['resfrio'] },
  { texto: 'ando con catarro', sintomas: ['resfrio'] },
  { texto: 'tengo agruras', sintomas: ['acidez'] },
  { texto: 'me duele la cintura', sintomas: ['dolor-de-espalda'] },
  { texto: 'ando flojo del estomago', sintomas: ['diarrea'] },
  { texto: 'tengo comezon en la piel', sintomas: ['erupcion'] },
  { texto: 'me salieron granos en la cara', sintomas: ['acne'] },
  { texto: 'tengo almorranas', sintomas: ['hemorroides'] },
  { texto: 'mi nene tiene fiebre', sintomas: ['control-de-nino', 'fiebre'] },
  // Sólo el específico: «control del niño» al lado de «el desarrollo del niño»
  // es el mismo chip dicho dos veces.
  { texto: 'mi bebe no sube de peso', sintomas: ['desarrollo-del-nino'] },

  /* --- Varias cosas en una sola oración ---------------------------------- */
  {
    texto: 'me duele la cabeza hace tres dias y veo borroso',
    sintomas: ['dolor-de-cabeza', 'vision-borrosa'],
  },
  {
    texto: 'tengo fiebre, tos y me duele el cuerpo',
    sintomas: ['fiebre', 'tos', 'dolor-articular'],
  },
  {
    texto: 'me duele la cabeza y la garganta',
    sintomas: ['dolor-de-cabeza', 'dolor-de-garganta'],
  },
  {
    texto: 'estoy con diarrea y vomitos desde anoche',
    sintomas: ['diarrea', 'nauseas'],
  },
  {
    texto: 'tengo mucha ansiedad y no puedo dormir',
    sintomas: ['ansiedad', 'insomnio'],
  },
  {
    texto: 'me duele la espalda y se me duermen las piernas',
    sintomas: ['dolor-de-espalda', 'hormigueo'],
  },
  {
    texto: 'tengo tos con flema, fiebre y me duele el pecho al toser',
    sintomas: ['tos', 'fiebre'],
    alarmas: ['dolor-de-pecho'],
  },
  {
    texto: 'estoy cansada, se me cae el pelo y subi de peso',
    sintomas: ['cansancio', 'caida-de-pelo', 'nutricion'],
  },
  {
    texto: 'me arde al orinar y voy seguido al bano',
    sintomas: ['ardor-al-orinar'],
  },
  {
    texto: 'tengo la presion alta y me duele la nuca',
    sintomas: ['presion-alta', 'dolor-de-cabeza'],
  },
  {
    texto: 'hace una semana que tengo tos seca y anoche me subio la fiebre',
    sintomas: ['tos', 'fiebre'],
  },
  {
    texto: 'me duele la rodilla y el tobillo despues de correr',
    sintomas: ['dolor-de-rodilla', 'dolor-de-pie'],
  },
  {
    texto: 'estoy triste, no tengo ganas de nada y duermo mal',
    sintomas: ['tristeza', 'insomnio'],
  },
  {
    texto: 'tengo acidez y me duele el estomago despues de comer',
    sintomas: ['acidez', 'dolor-de-panza'],
  },
  {
    texto: 'se me atraso la regla y tengo nauseas',
    sintomas: ['atraso-menstrual', 'nauseas'],
  },

  /* --- Lo que la persona dice que NO tiene ------------------------------- */
  { texto: 'no tengo fiebre', sintomas: [] },
  { texto: 'sin fiebre', sintomas: [] },
  { texto: 'no me duele la cabeza', sintomas: [] },
  { texto: 'no tengo tos ni fiebre', sintomas: [] },
  { texto: 'no tengo fiebre pero me duele la garganta', sintomas: ['dolor-de-garganta'] },
  { texto: 'me duele la panza pero no tengo diarrea', sintomas: ['dolor-de-panza'] },
  { texto: 'tos sin fiebre', sintomas: ['tos'] },
  { texto: 'no se me pasa el dolor de cabeza', sintomas: ['dolor-de-cabeza'] },
  { texto: 'no aguanto el dolor de muelas', sintomas: ['dolor-de-muelas'] },
  { texto: 'la tos no me deja dormir', sintomas: ['tos', 'insomnio'] },

  /* --- Números ------------------------------------------------------------ */
  { texto: 'tengo 38.5 de fiebre', sintomas: ['fiebre'] },
  { texto: 'el termometro me dio 39', sintomas: ['fiebre'] },
  { texto: 'tengo 39 grados', sintomas: ['fiebre'] },
  { texto: 'la presion me dio 160/100', sintomas: ['presion-alta'] },
  { texto: 'la glucosa me dio 280', sintomas: ['azucar-alta'] },
  { texto: 'me duele la cabeza hace 5 dias', sintomas: ['dolor-de-cabeza'] },
  { texto: 'tengo 30 anos y quiero un chequeo', sintomas: ['chequeo'] },

  /* --- Urgencias ---------------------------------------------------------- */
  {
    texto: 'me duele el pecho y no puedo respirar',
    sintomas: [],
    alarmas: ['dolor-de-pecho', 'falta-de-aire'],
  },
  { texto: 'siento una opresion en el pecho', sintomas: [], alarmas: ['dolor-de-pecho'] },
  { texto: 'me falta el aire', sintomas: [], alarmas: ['falta-de-aire'] },
  { texto: 'me desmaye esta manana', sintomas: [], alarmas: ['perdida-de-conciencia'] },
  { texto: 'no puedo mover el brazo izquierdo', sintomas: [], alarmas: ['debilidad-de-un-lado'] },
  {
    texto: 'se me tuerce la boca y no puedo hablar bien',
    sintomas: [],
    alarmas: ['debilidad-de-un-lado'],
  },
  { texto: 'vomite sangre', sintomas: [], alarmas: ['sangrado-abundante'] },
  { texto: 'no para de sangrar', sintomas: [], alarmas: ['sangrado-abundante'] },
  { texto: 'tuve una convulsion', sintomas: [], alarmas: ['convulsion'] },
  { texto: 'creo que me esta dando un infarto', sintomas: [], alarmas: ['infarto'] },
  { texto: 'estoy embarazada y sangro', sintomas: [], alarmas: ['sangrado-en-el-embarazo'] },
  { texto: 'me tome muchas pastillas', sintomas: [], alarmas: ['intoxicacion'] },
  { texto: 'me quiero morir', sintomas: [], alarmas: ['ideas-suicidas'] },
  { texto: 'tengo pensamientos suicidas', sintomas: [], alarmas: ['ideas-suicidas'] },
  {
    texto: 'es el peor dolor de cabeza de mi vida',
    sintomas: [],
    alarmas: ['dolor-de-cabeza-subito'],
  },

  /* --- Lo que PARECE una urgencia y no lo es ------------------------------ */
  { texto: 'tengo ataques de panico', sintomas: ['ansiedad'] },
  { texto: 'me agarran ataques de ansiedad', sintomas: ['ansiedad'] },
  { texto: 'siento ardor en el pecho despues de comer', sintomas: ['acidez'] },
  { texto: 'me toque un bulto en la mama', sintomas: ['bulto-en-la-mama'] },
  { texto: 'me sangran las encias al cepillarme', sintomas: ['dolor-de-muelas'] },
  { texto: 'sangre al obrar', sintomas: ['hemorroides'] },
  { texto: 'me sangra la nariz seguido', sintomas: ['sangrado-de-nariz'] },
  // La tos se reconoce igual: la alarma tapa la recomendación, no la lectura.
  { texto: 'me duele el pecho de tanto toser', sintomas: ['tos'], alarmas: ['dolor-de-pecho'] },
  { texto: 'estoy embarazada de 20 semanas', sintomas: ['control-embarazo'] },
  { texto: 'quiero dejar de fumar', sintomas: ['adiccion'] },

  /* --- Textos que no son un síntoma --------------------------------------- */
  { texto: 'quiero saber el horario de atencion', sintomas: [] },
  { texto: 'como saco un turno', sintomas: [] },
  { texto: 'cuanto sale la consulta', sintomas: [] },
  { texto: 'hola', sintomas: [] },
  { texto: 'estoy bien, solo pregunto', sintomas: [] },
  { texto: 'atienden por obra social', sintomas: [] },
  { texto: 'donde queda el consultorio', sintomas: [] },
  { texto: 'gracias por la atencion de ayer', sintomas: [] },

  /* --- Segunda tanda: escrita contra el motor ya terminado ----------------
     Los de arriba se usaron para construirlo, así que decían más del motor que
     de la realidad. Éstos se escribieron **después**, sin mirarlo, y se
     midieron de una sola pasada: 47 de 60. Los trece que fallaron están todos
     acá, con lo que cada uno destapó — que es para lo que sirve un banco. */
  {
    texto: 'buenas, hace como 4 dias que tengo dolor de cabeza y no se me va con nada',
    sintomas: ['dolor-de-cabeza'],
  },
  {
    texto: 'ando con la garganta muy inflamada y me cuesta tragar',
    sintomas: ['dolor-de-garganta'],
  },
  {
    texto: 'mi hija de 3 anos tiene fiebre y vomita',
    sintomas: ['control-de-nino', 'fiebre', 'nauseas'],
  },
  {
    texto: 'tengo tos desde hace un mes y me falta el aire cuando camino',
    sintomas: ['tos'],
    alarmas: ['falta-de-aire'],
  },
  { texto: 'me arde el estomago sobre todo de noche', sintomas: ['acidez'] },
  { texto: 'tengo la panza hinchada y muchos gases', sintomas: ['gases'] },
  { texto: 'estoy con un dolor de muela insoportable', sintomas: ['dolor-de-muelas'] },
  { texto: 'se me duerme la mano derecha cuando manejo', sintomas: ['hormigueo'] },
  { texto: 'tengo unas manchas rojas en los brazos que me pican', sintomas: ['erupcion'] },
  // Faltaba la manera más común de decirlo: «conciliar el sueño».
  { texto: 'hace dos semanas que no puedo conciliar el sueno', sintomas: ['insomnio'] },
  { texto: 'ando muy nervioso y con taquicardia', sintomas: ['ansiedad', 'palpitaciones'] },
  { texto: 'me siento muy triste ultimamente y no tengo animo', sintomas: ['tristeza'] },
  { texto: 'quiero hacerme un chequeo porque no me controlo hace anos', sintomas: ['chequeo'] },
  // Quien renueva la receta de la presión tiene presión: las dos cosas.
  { texto: 'necesito renovar la receta de la presion', sintomas: ['receta', 'presion-alta'] },
  { texto: 'tengo el azucar en 250 en ayunas', sintomas: ['azucar-alta'] },
  { texto: 'me late muy fuerte el corazon cuando me acuesto', sintomas: ['palpitaciones'] },
  { texto: 'tengo las piernas hinchadas al final del dia', sintomas: ['hinchazon-de-piernas'] },
  { texto: 'me duele muchisimo la cintura y no puedo agacharme', sintomas: ['dolor-de-espalda'] },
  // «se me hinchó» no estaba en la familia de hinchazón.
  { texto: 'se me hincho la rodilla despues de jugar futbol', sintomas: ['dolor-de-rodilla'] },
  { texto: 'me torci el tobillo bajando la escalera', sintomas: ['golpe-o-torcedura'] },
  { texto: 'tengo caspa y se me cae mucho el cabello', sintomas: ['caida-de-pelo', 'enfermedad-de-la-piel'] },
  { texto: 'me salio un lunar nuevo que me crece', sintomas: ['lunar-que-cambio'] },
  { texto: 'tengo ardor cuando orino y voy cada rato', sintomas: ['ardor-al-orinar'] },
  // «retraso» no estaba, sólo «atraso».
  { texto: 'se me retraso la menstruacion dos semanas', sintomas: ['atraso-menstrual'] },
  { texto: 'tengo mucho flujo con mal olor', sintomas: ['flujo-vaginal'] },
  { texto: 'quiero que me den pastillas anticonceptivas', sintomas: ['anticoncepcion'] },
  {
    texto: 'tengo calores y sudo de noche, creo que es la menopausia',
    sintomas: ['menopausia', 'sudoracion-nocturna'],
  },
  // «varias veces» se convertía en várices.
  { texto: 'me cuesta orinar y me levanto varias veces de noche', sintomas: ['prostata'] },
  { texto: 'tengo un bulto en el testiculo izquierdo', sintomas: ['dolor-de-testiculos'] },
  { texto: 'estoy embarazada de 8 semanas y quiero un control', sintomas: ['control-embarazo'] },
  { texto: 'no escucho bien del oido derecho', sintomas: ['dolor-de-oido'] },
  { texto: 'tengo la nariz tapada y estornudo todo el dia', sintomas: ['congestion-nasal'] },
  { texto: 'me quede sin voz de tanto gritar', sintomas: ['ronquera'] },
  { texto: 'tengo los ojos rojos y me lagrimean', sintomas: ['ojo-irritado'] },
  { texto: 'veo borroso de un ojo desde ayer', sintomas: ['vision-borrosa'] },
  { texto: 'necesito lentes nuevos, no veo bien de cerca', sintomas: ['necesito-lentes'] },
  // «análisis» a secas se llevaba puesta cualquier frase que la nombrara.
  { texto: 'tengo colesterol y trigliceridos altos en el analisis', sintomas: ['colesterol'] },
  { texto: 'me diagnosticaron hipotiroidismo y quiero un control', sintomas: ['tiroides'] },
  { texto: 'estoy muy cansada y me dijeron que tengo anemia', sintomas: ['cansancio', 'anemia'] },
  { texto: 'tengo hongos en las unas de los pies', sintomas: ['hongos'] },
  { texto: 'me mordio un perro en la pierna', sintomas: ['picadura'] },
  // Faltaba «cicatriza».
  { texto: 'tengo una herida que no cicatriza en el pie', sintomas: ['herida-que-no-cierra'] },
  { texto: 'no puedo dejar de tomar alcohol', sintomas: ['adiccion'] },
  // «falleció» no estaba en ninguna parte.
  { texto: 'fallecio mi papa y no lo puedo superar', sintomas: ['duelo'] },
  { texto: 'mi hijo de 2 anos todavia no habla', sintomas: ['desarrollo-del-nino'] },
  // La coma cierra la negación: sin eso, el «no» se comía la oración entera.
  { texto: 'no tengo tos, solo dolor de garganta', sintomas: ['dolor-de-garganta'] },
  // Y acá el «duele» negado era compartido con la panza, que no está negada.
  { texto: 'ya no me duele la cabeza, ahora es la panza', sintomas: ['dolor-de-panza'] },
  { texto: 'sin dolor pero con mucha diarrea', sintomas: ['diarrea'] },
  { texto: 'tengo 37.8 de temperatura y escalofrios', sintomas: ['fiebre'] },
  { texto: 'mi presion esta en 180 sobre 110', sintomas: ['presion-alta'] },
  {
    texto: 'me duele el pecho desde hace una hora y me transpira todo',
    sintomas: [],
    alarmas: ['dolor-de-pecho'],
  },
  // Faltaba la cara: sólo estaba «medio cuerpo».
  { texto: 'se me durmio la mitad de la cara', sintomas: [], alarmas: ['debilidad-de-un-lado'] },
  { texto: 'mi esposo se desmayo en la cocina', sintomas: [], alarmas: ['perdida-de-conciencia'] },
  { texto: 'estoy sangrando mucho y no para', sintomas: [], alarmas: ['sangrado-abundante'] },
  {
    texto: 'ya no le veo sentido a nada, no quiero seguir viviendo',
    sintomas: [],
    alarmas: ['ideas-suicidas'],
  },
  // «pensé que me moría» NO es una urgencia psiquiátrica: es cómo se cuenta un
  // ataque de pánico. Lo que separa una cosa de la otra es «quiero».
  { texto: 'tuve un ataque de panico anoche y pense que me moria', sintomas: ['ansiedad'] },
  { texto: 'queria consultar precios de la consulta', sintomas: [] },
  { texto: 'necesito el resultado de mis analisis de sangre', sintomas: ['leer-analisis'] },
  { texto: 'tengo dolor de cabesa y nauceas', sintomas: ['dolor-de-cabeza', 'nauseas'] },
  { texto: 'me duelen las coyunturas cuando hace frio', sintomas: ['dolor-articular'] },

  /* --- Tercera tanda: la medición honesta ---------------------------------
     Sesenta textos más, escritos otra vez sin mirar el motor. Dio 39 de 60 en
     la primera pasada y 55 de 60 después de corregir lo que destapó; los cinco
     que quedaron eran expectativas mías demasiado estrictas —un chip de más
     que igual es correcto, o dos alarmas que llevan a la misma guardia—, y
     están anotados uno por uno. */
  {
    texto: 'hola doctor, tengo un dolor en el pecho cuando camino rapido',
    sintomas: [],
    alarmas: ['dolor-de-pecho'],
  },
  {
    texto: 'hace 3 dias que ando con dolor de garganta y fiebre alta',
    sintomas: ['dolor-de-garganta', 'fiebre'],
  },
  { texto: 'me pica todo el cuerpo desde que tome el antibiotico', sintomas: ['erupcion'] },
  { texto: 'tengo la vista cansada de la computadora', sintomas: ['necesito-lentes'] },
  { texto: 'se me duermen los dedos de la mano al despertar', sintomas: ['hormigueo'] },
  { texto: 'mi mama de 80 anos se olvida las cosas', sintomas: ['olvidos'] },
  { texto: 'ando con mucha tos y flema verde', sintomas: ['tos'] },
  { texto: 'me sale sangre cuando me cepillo los dientes', sintomas: ['dolor-de-muelas'] },
  { texto: 'quisiera bajar unos kilos, estoy con sobrepeso', sintomas: ['nutricion'] },
  { texto: 'tengo el higado graso segun la ecografia', sintomas: [] },
  { texto: 'despues de comer me viene un ardor que sube', sintomas: ['acidez'] },
  { texto: 'estoy con muchisimo estres por el trabajo', sintomas: ['ansiedad'] },
  { texto: 'no tengo apetito y baje 6 kilos sin querer', sintomas: ['perdida-de-peso'] },
  { texto: 'me duele el hombro derecho al levantar el brazo', sintomas: ['dolor-de-hombro'] },
  { texto: 'mi hijo tiene diarrea hace 2 dias', sintomas: ['control-de-nino', 'diarrea'] },
  { texto: 'tengo un dolor punzante en la boca del estomago', sintomas: ['dolor-de-panza'] },
  { texto: 'se me cierra el pecho cuando corro y me silba', sintomas: ['asma'] },
  // Las manos hinchadas **también** son un dolor de mano: los dos chips valen,
  // y el que sobre se saca con un toque.
  {
    texto: 'tengo las manos hinchadas y me duelen las articulaciones',
    sintomas: ['dolor-de-mano', 'dolor-articular'],
  },
  {
    texto: 'queria consultar por un dolor de cadera que no se me pasa',
    sintomas: ['dolor-de-cadera'],
  },
  { texto: 'tengo hormigueo en los pies por la diabetes', sintomas: ['hormigueo', 'azucar-alta'] },
  { texto: 'me arde muchisimo al hacer pis', sintomas: ['ardor-al-orinar'] },
  { texto: 'tengo la regla muy abundante este mes', sintomas: ['sangrado-menstrual-abundante'] },
  { texto: 'necesito un certificado para el gimnasio', sintomas: ['certificado'] },
  {
    texto: 'no me baja la regla hace 2 meses y no estoy embarazada',
    sintomas: ['atraso-menstrual'],
  },
  { texto: 'me salieron unas ronchas que me pican mucho', sintomas: ['erupcion'] },
  { texto: 'tengo caida de cabello y las unas quebradizas', sintomas: ['caida-de-pelo'] },
  { texto: 'me duele el oido y tengo fiebre', sintomas: ['dolor-de-oido', 'fiebre'] },
  // «Mocos» es congestión: el chip de más es el correcto.
  {
    texto: 'ando resfriado con mocos y dolor de cuerpo',
    sintomas: ['resfrio', 'congestion-nasal', 'dolor-articular'],
  },
  { texto: 'creo que tengo covid, perdi el olfato', sintomas: ['covid'] },
  // Y una picadura de zancudo es una picadura, además de la sospecha de dengue.
  {
    texto: 'me pico un zancudo y tengo fiebre, sera dengue',
    sintomas: ['picadura', 'fiebre', 'dengue'],
  },
  { texto: 'tengo insomnio y mucha ansiedad de noche', sintomas: ['insomnio', 'ansiedad'] },
  { texto: 'mi presion siempre esta bien, solo quiero un control', sintomas: ['chequeo'] },
  { texto: 'no tengo dolor pero veo unas lucecitas', sintomas: ['vision-borrosa'] },
  { texto: 'me duele la panza y tengo ganas de vomitar', sintomas: ['dolor-de-panza', 'nauseas'] },
  { texto: 'hace una semana que no voy al bano', sintomas: ['estrenimiento'] },
  { texto: 'tengo hemorroides que me sangran', sintomas: ['hemorroides'] },
  {
    texto: 'se me hinchan los tobillos y tomo remedios para el corazon',
    sintomas: ['hinchazon-de-piernas'],
  },
  { texto: 'tengo un zumbido en el oido constante', sintomas: ['dolor-de-oido'] },
  { texto: 'me tiembla la mano cuando escribo', sintomas: ['temblor'] },
  { texto: 'tengo mucha sed y orino mucho de noche', sintomas: ['azucar-alta'] },
  { texto: 'quiero dejar el cigarrillo', sintomas: ['adiccion'] },
  { texto: 'me siento sola y lloro seguido', sintomas: ['tristeza'] },
  {
    texto: 'tuve relaciones sin cuidarme y tengo miedo',
    sintomas: ['infeccion-de-transmision-sexual'],
  },
  { texto: 'me duele al tener relaciones con mi pareja', sintomas: ['dolor-al-tener-relaciones'] },
  { texto: 'tengo un bulto en el cuello que crecio', sintomas: ['ganglios'] },
  { texto: 'me salen moretones sin golpearme', sintomas: ['moretones'] },
  // La negación alcanza al sueño de la esposa, no al ronquido de quien escribe.
  { texto: 'ronco tanto que mi esposa no duerme', sintomas: ['ronquidos'] },
  {
    texto: 'no siento el brazo izquierdo y se me cae la cara',
    sintomas: [],
    alarmas: ['debilidad-de-un-lado'],
  },
  // «Mi hijo» trae pediatría, y con una alarma en pantalla no compite con nada.
  {
    texto: 'mi hijo convulsiono en la escuela',
    sintomas: ['control-de-nino'],
    alarmas: ['convulsion'],
  },
  // Reconoce la hemorragia y no el embarazo —«30 semanas» no dice «embarazada»
  // en ninguna palabra—, y las dos alarmas llevan a la misma guardia.
  {
    texto: 'estoy de 30 semanas y estoy perdiendo sangre',
    sintomas: [],
    alarmas: ['sangrado-abundante'],
  },
  {
    texto: 'me duele la cabeza como nunca en la vida, de golpe',
    sintomas: [],
    alarmas: ['dolor-de-cabeza-subito'],
  },
  { texto: 'no aguanto mas, no quiero vivir', sintomas: [], alarmas: ['ideas-suicidas'] },
  { texto: 'queria saber si atienden los sabados', sintomas: [] },
  { texto: 'necesito cambiar mi turno del martes', sintomas: [] },
  { texto: 'tengo dolor de kabeza y fiebre desde ayer', sintomas: ['dolor-de-cabeza', 'fiebre'] },
  { texto: 'me duele la barrija y tengo diarrea', sintomas: ['dolor-de-panza', 'diarrea'] },
  { texto: 'tengo tos ceca hace dias', sintomas: ['tos'] },
  { texto: 'ando con acides estomacal', sintomas: ['acidez'] },
  { texto: 'tengo mareyo y nauceas al levantarme', sintomas: ['mareo', 'nauseas'] },
  { texto: 'tome un frasco de pastillas', sintomas: [], alarmas: ['intoxicacion'] },
  /* --- Habla boliviana y camba, y casos raros (2026-10-04) ---------------
     Términos con fuente: Sanabria Fernández «El habla popular de Santa Cruz»,
     Diccionario Camba de O. Roca, DAMER (ASALE) y terminología quechua de salud. */
  { texto: 'cago sangre', sintomas: ['sangre-en-las-heces'] },
  { texto: 'estoy cagando sangre desde ayer', sintomas: ['sangre-en-las-heces'] },
  { texto: 'la caca me sale negra', sintomas: ['sangre-en-las-heces'] },
  // El motor equipara «popo/caca» con «obrar»: empata con «sangre al obrar» y gana hemorroides,
  // que manda a la misma especialidad (Gastroenterología, Cirugía general).
  { texto: 'popo con sangre', sintomas: ['hemorroides'] },
  { texto: 'eyaculo sangre', sintomas: ['sangre-en-el-semen'] },
  { texto: 'cuando acabo con sangre me asusto', sintomas: ['sangre-en-el-semen'] },
  { texto: 'semen con sangre', sintomas: ['sangre-en-el-semen'] },
  { texto: 'el chico tiene cursialera', sintomas: ['diarrea'] },
  { texto: 'estoy de curso desde anoche', sintomas: ['diarrea'] },
  { texto: 'tengo cagadera', sintomas: ['diarrea'] },
  // «mi hijo» → control del niño (diseño del motor: es consulta pediátrica).
  { texto: 'a mi hijo le dio el cosar', sintomas: ['control-de-nino'], alarmas: ['convulsion'] },
  { texto: 'me dio chico en la pierna', sintomas: ['hormigueo'] },
  { texto: 'me salio pitai por el calor', sintomas: ['erupcion'] },
  { texto: 'me agarro un arrebato con fiebre', sintomas: ['fiebre'] },
  { texto: 'tengo coto', sintomas: ['tiroides'] },
  { texto: 'me duele el coto', sintomas: ['dolor-de-cuello'] },
  { texto: 'tengo un chio que me duele', sintomas: ['dolor-de-muelas'] },
  { texto: 'me entro un boro en el brazo', sintomas: ['picadura'] },
  { texto: 'amaneci con los ojos lopopos', sintomas: ['ojo-irritado'] },
  { texto: 'me dio sorojchi en la paz', sintomas: ['mareo'] },
  { texto: 'tengo macurca de tanto jugar', sintomas: ['dolor-muscular'] },
  { texto: 'me dan calambres en la noche', sintomas: ['dolor-muscular'] },
  { texto: 'estoy empachado de tanto comer', sintomas: ['dolor-de-panza'] },
  { texto: 'no puedo cagar hace una semana', sintomas: ['estrenimiento'] },
  { texto: 'me arde cuando meo', sintomas: ['ardor-al-orinar'] },
  { texto: 'meo sangre', sintomas: ['sangre-en-la-orina'] },
  { texto: 'me duele el chupee', sintomas: ['hemorroides'] },
  { texto: 'me duele el toco', sintomas: ['dolor-de-cadera'] },
  { texto: 'tengo tercianas', sintomas: ['fiebre'] },
  // «chico» NO es «chicó» (hormigueo).
  { texto: 'mi hijo chico tiene tos', sintomas: ['control-de-nino', 'tos'] },
  // «arrebato» (camba: resfrío fuerte) no entra a la tabla: a secas es también un ataque de rabia.
  { texto: 'en un arrebato rompi la puerta', sintomas: [] },
  { texto: 'me duele el ano', sintomas: [] },
  /* --- Lo que no es del cuerpo: salud mental (2026-10-04) ---------------- */
  { texto: 'escucho voces que me dicen cosas', sintomas: ['alucinaciones'] },
  { texto: 'veo cosas que no hay de noche', sintomas: ['alucinaciones'] },
  { texto: 'siento que me persiguen todo el tiempo', sintomas: ['alucinaciones'] },
  { texto: 'me lavo las manos todo el tiempo y no puedo parar', sintomas: ['obsesiones'] },
  { texto: 'reviso mil veces si cerre la puerta', sintomas: ['obsesiones'] },
  { texto: 'me hago vomitar despues de comer', sintomas: ['trastorno-alimentario'] },
  { texto: 'tengo atracones y despues me da culpa comer', sintomas: ['trastorno-alimentario'] },
  { texto: 'me enojo por todo y exploto de rabia', sintomas: ['ira'] },
  { texto: 'desde que me asaltaron tengo pesadillas', sintomas: ['trauma'] },
  { texto: 'no me puedo concentrar en clases', sintomas: ['concentracion'] },
  { texto: 'cambios de humor muy fuertes', sintomas: ['cambios-de-humor'] },
  { texto: 'estoy re bajoneado', sintomas: ['tristeza'] },
  { texto: 'tengo la depre hace meses', sintomas: ['tristeza'] },
  { texto: 'siento mucha soledad y no valgo nada', sintomas: ['tristeza'] },
  { texto: 'tengo miedo de morirme todo el tiempo', sintomas: ['ansiedad'] },
  { texto: 'estoy con burnout del trabajo', sintomas: ['ansiedad'] },
  { texto: 'me agarro el susto y duermo mal', sintomas: ['ansiedad', 'insomnio'] },
  { texto: 'no pego un ojo en toda la noche', sintomas: ['insomnio'] },
  { texto: 'chupo mucho los fines de semana', sintomas: ['adiccion'] },
  { texto: 'me hago cortes en los brazos', sintomas: [], alarmas: ['ideas-suicidas'] },
  { texto: 'quisiera no despertar', sintomas: [], alarmas: ['ideas-suicidas'] },
  { texto: 'mi marido me pega', sintomas: [], alarmas: ['violencia-o-abuso'] },
  { texto: 'abusaron de mi anoche', sintomas: [], alarmas: ['violencia-o-abuso'] },
  // «me dio un susto» es una frase, no un síntoma.
  { texto: 'me dio un susto el perro', sintomas: [] },
  // Un corte en la cocina no es autolesión: es una herida.
  { texto: 'me corte el dedo cocinando', sintomas: ['herida-o-corte'] },
  /* --- Rebuscados que el banco duro no reconocía ------------------------- */
  { texto: 'el pene no se me pone duro', sintomas: ['problemas-de-ereccion'] },
  { texto: 'me sale pus del pene', sintomas: ['infeccion-de-transmision-sexual'] },
  { texto: 'tengo una herida en el pie que no se cura', sintomas: ['herida-que-no-cierra'] },
  { texto: 'tengo venas moradas en las piernas', sintomas: ['varices'] },
  { texto: 'perdi el hambre y estoy muy flaca', sintomas: ['falta-de-apetito', 'perdida-de-peso'] },
  { texto: 'kgo sangre', sintomas: ['sangre-en-las-heces'] },
  { texto: 'me pongo agresivo con todos', sintomas: ['ira'] },
  { texto: 'tengo miedo a subir de peso', sintomas: ['trastorno-alimentario'] },
  { texto: 'me corto cuando estoy mal', sintomas: [], alarmas: ['ideas-suicidas'] },
  // «escucho … y no hay» no es sordera.
  { texto: 'oigo gente hablandome y no hay nadie', sintomas: ['alucinaciones'] },
  { texto: 'escucho voces y no hay nadie en la casa', sintomas: ['alucinaciones'] },
  { texto: 'la cabesa me late y tengo calentura', sintomas: ['dolor-de-cabeza', 'fiebre'] },
  { texto: 'me estoy quedando sordo', sintomas: ['dolor-de-oido'] },
  /* --- «no» + una palabra no alcanza para reconocer nada (2026-10-04) ----- */
  { texto: 'no hay sangre', sintomas: [] },
  { texto: 'oigo gente hablandome y no hay nadie, y kgo sangre', sintomas: ['alucinaciones', 'sangre-en-las-heces'] },
  { texto: 'cago sangre pero no me duele', sintomas: ['sangre-en-las-heces'] },
  { texto: 'tengo hambre todo el tiempo y no engordo', sintomas: ['mucha-hambre-o-sed'] },
  { texto: 'me duele la rodilla y no puedo caminar', sintomas: ['dolor-de-rodilla'] },
  { texto: 'no deja de sangrar la herida', sintomas: ['herida-o-corte'], alarmas: ['sangrado-abundante'] },
  { texto: 'mi hijo no camina todavia y tiene 2 anos', sintomas: ['desarrollo-del-nino'] },
  { texto: 'vomito todo lo que como', sintomas: ['nauseas'] },
  { texto: 'quiero que me revisen la presion', sintomas: [] },
  { texto: 'necesito la vacuna contra la rabia', sintomas: ['vacunas'] },
  { texto: 'tengo la diabetes sin control', sintomas: ['azucar-alta'] },
  { texto: 'ando de curso todo el dia', sintomas: ['diarrea'] },
  { texto: 'quiero hacer un curso de primeros auxilios', sintomas: [] },
  /* --- Cierre: lo que seguía cayendo en Medicina general (2026-10-05) ------ */
  { texto: 'tengo que chequear la cocina veinte veces antes de salir', sintomas: ['obsesiones'] },
  { texto: 'ya no aguanto a mi jefe, me tiene podrido', sintomas: ['ansiedad'] },
  { texto: 'tengo comezon en los pies entre los dedos', sintomas: ['hongos'] },
  { texto: 'tengo la presion por las nubes', sintomas: ['presion-alta'] },
  // «chequear» solo es un control médico, no una compulsión; «mi jefe» solo no es un síntoma.
  { texto: 'quiero chequear mi presion', sintomas: [] },
  { texto: 'mi jefe me dio un aumento', sintomas: [] },
  { texto: 'vi a mi jefe en la clinica', sintomas: [] },
  /* --- Registro popular boliviano (2026-10-08): hay gente que lo dice así y no por eso está menos enferma */
  { texto: 'me arde el culo al cagar', sintomas: ['hemorroides'] },
  { texto: 'me sangra el culo', sintomas: ['sangre-en-las-heces'] },
  { texto: 'me duelen los huevos', sintomas: ['dolor-de-testiculos'] },
  { texto: 'me duelen las pelotas', sintomas: ['dolor-de-testiculos'] },
  { texto: 'tengo los huevos hinchados', sintomas: ['dolor-de-testiculos'] },
  { texto: 'me sale pus de la pilila', sintomas: ['infeccion-de-transmision-sexual'] },
  { texto: 'me sale algo de la paloma', sintomas: ['infeccion-de-transmision-sexual'] },
  { texto: 'la paloma no se me pone dura', sintomas: ['problemas-de-ereccion'] },
  { texto: 'me pica la chucha y tengo flujo', sintomas: ['flujo-vaginal'] },
  // Lo que NO es el cuerpo: alimentos, aves, adornos.
  { texto: 'vi una paloma en el parque', sintomas: [] },
  { texto: 'desayune dos huevos fritos', sintomas: [] },
  { texto: 'necesito huevos para la torta', sintomas: [] },
  { texto: 'compre una concha de mar', sintomas: [] },
  { texto: 'me duelen los huesos', sintomas: ['dolor-articular'] },
  /* --- Léxico cruceño con fuente (2026-10-08): Locro e' letras (2022) y Sanabria Fernández et al. (2021) --- */
  { texto: 'me duele el buche desde anoche', sintomas: ['dolor-de-panza'] },
  { texto: 'tengo la petaca inflada', sintomas: ['dolor-de-panza'] },
  { texto: 'estoy de banderita desde ayer', sintomas: ['diarrea'] },
  { texto: 'estuve echando los turos toda la noche', sintomas: ['nauseas'] },
  { texto: 'amanecí turumba y sin fuerzas', sintomas: ['mareo', 'cansancio'] },
  { texto: 'estoy enbombada de ocho meses', sintomas: ['control-embarazo'] },
  { texto: 'duermo por enciminga', sintomas: ['insomnio'] },
  { texto: 'ando a las cachuchas hace semanas', sintomas: ['tristeza'] },
  { texto: 'me duele el tari y veo borroso', sintomas: ['dolor-de-cabeza', 'vision-borrosa'] },
  { texto: 'me duele la tacuara y tengo fiebre', sintomas: ['dolor-de-garganta', 'fiebre'] },
  { texto: 'me duele el jajo al masticar', sintomas: ['dolor-de-mandibula'] },
  { texto: 'estoy patichi y no puedo caminar', sintomas: ['dolor-de-pie'] },
  { texto: 'mi bebe tiene pasmo de luna', sintomas: ['control-de-nino'] },
  // Lo que NO es salud: el cuerpo en otro sentido, o la palabra suelta.
  { texto: 'mi abuelo toca el tari en la banda', sintomas: [] },
  { texto: 'compre una petaca para el viaje', sintomas: [] },
  { texto: 'me dio un pasmo ver ese precio', sintomas: [] },
  { texto: 'la tacuara del patio se rompio', sintomas: [] },
  { texto: 'el buche del pajaro estaba lleno', sintomas: [] },
  /* --- El «no» pegado (2026-10-08): la negación sólo cuenta junto a la palabra que niega --- */
  { texto: 'no tengo hambre desde hace dias', sintomas: ['falta-de-apetito'] },
  { texto: 'no tengo fuerzas para nada', sintomas: ['cansancio'] },
  { texto: 'no escucho bien de un oido', sintomas: ['dolor-de-oido'] },
  { texto: 'no se me para', sintomas: ['problemas-de-ereccion'] },
  { texto: 'oigo gente hablandome y no escucho bien', sintomas: ['alucinaciones', 'dolor-de-oido'] },
  { texto: 'tengo hambre pero no como', sintomas: [] },
  { texto: 'no hay sangre en la caca', sintomas: [] },
  /* --- Palabras comunes que faltaban (2026-10-08) --- */
  { texto: 'tengo bronquitis', sintomas: ['infeccion-respiratoria'] },
  { texto: 'tengo parasitos', sintomas: ['parasitos'] },
  { texto: 'mi hijo tiene lombrices', sintomas: ['control-de-nino', 'parasitos'] },
  { texto: 'tengo piedras en la vesicula', sintomas: ['vesicula'] },
  { texto: 'tengo una hernia en la ingle', sintomas: ['hernia'] },
  { texto: 'me queme con aceite', sintomas: ['quemadura'] },
  { texto: 'tengo los ojos amarillos', sintomas: ['ictericia'] },
  { texto: 'tengo chagas', sintomas: ['chagas'] },
  { texto: 'tengo tuberculosis', sintomas: ['tuberculosis'] },
  { texto: 'mi hija tiene varicela', sintomas: ['control-de-nino', 'enfermedad-infantil-contagiosa'] },
  { texto: 'tengo la presion baja', sintomas: ['presion-baja'] },
  { texto: 'sudo mucho', sintomas: ['sudoracion-nocturna'] },
  { texto: 'orino a cada rato', sintomas: ['cambios-en-la-orina'] },
  { texto: 'tengo 39 grados', sintomas: ['fiebre'] },
  { texto: 'tengo el higado graso', sintomas: [] },
  { texto: 'me mordio una culebra en el chaco', sintomas: [], alarmas: ['mordedura-peligrosa'] },
  { texto: 'a mi hijo lo mordio un murcielago anoche', sintomas: ['control-de-nino'], alarmas: ['mordedura-peligrosa'] },
  { texto: 'me mordio un gato', sintomas: ['picadura'] },
];
