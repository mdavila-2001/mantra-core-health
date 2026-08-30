/* ============================================================================
    Cómo se lee el castellano que se escribe en un teléfono.

    ## Por qué existe este archivo

    El reconocimiento de síntomas buscaba cada sinónimo con `indexOf` sobre el
    texto. Eso obliga a que la tabla contenga **la forma exacta** en que la
    persona escribió, y la gente no escribe formas exactas: escribe «me duelen
    las rodillas» (plural, verbo conjugado), «me duele la caveza» (con falta),
    «tengo un dolor muy fuerte en la cabeza» (con un adjetivo en el medio) y
    «no tengo fiebre» (negando). Ninguno de esos cuatro casos lo encontraba una
    subcadena, y los cuatro son la forma normal de contarlo.

    Acá vive lo que hace falta para que sí los encuentre, y **nada de dominio
    médico**: normalizar, partir en palabras, reducir cada palabra a una forma
    comparable y saber cuándo dos palabras distintas son la misma palabra mal
    escrita. La tabla de síntomas vive en `sintomas.datos.ts` y el motor que las
    cruza en `motor.ts`.

    ## Las tres capas de comparación, y por qué tres

    1. **Lema** — «duelen», «duele», «dolor» y «dolores» son la misma palabra.
       Resuelve la variación gramatical, que es la mitad de los fallos.
    2. **Clave fonética** — «caveza», «cabesa» y «cabeza» suenan igual. En
       castellano casi toda falta de ortografía es homófona (b/v, c/s/z, h muda,
       ll/y, g/j), así que una clave fonética barata cubre la mayoría sin
       inventar coincidencias.
    3. **Distancia de edición** — lo que queda: dedos gordos y letras cambiadas
       de lugar («dolro», «fiebe»). Es la más cara y la más riesgosa, así que se
       usa último y con tope.

    Están en ese orden a propósito: cada una es más barata y más segura que la
    siguiente.
    ========================================================================== */

/** Los diacríticos que deja sueltos `normalize('NFD')`. */
const DIACRITICOS = /[̀-ͯ]/g;

/** Palabras y números. Un número puede llevar decimal: «38.5», «37,8». */
const PALABRAS = /[a-z]+|\d+(?:[.,]\d+)?/g;

/** Puntuación que corta una frase de veras: lo de después es otro asunto. */
const CORTE_DURO = /[.;!?¡¿\n]/;

/** Puntuación y conjunciones que separan dos cosas dentro de la misma frase. */
const CORTE_BLANDO = /[,:]/;

/**
 * Texto comparable: sin mayúsculas ni tildes, y con los espacios colapsados.
 *
 * Sin esto, «migraña» no encuentra «migrana» y media tabla queda inalcanzable
 * para quien no pone el acento — que es casi todo el mundo escribiendo en un
 * teléfono. Es la misma función que ya usa el directorio de médicos, con el
 * agregado de colapsar espacios: en un texto libre la gente escribe «dolor  de
 * cabeza» y eso no debería fallar.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Las palabras que no dicen nada por sí solas.
 *
 * No es una lista de «palabras vacías» de buscador: es la lista de lo que en
 * **este** dominio no aporta. «Tengo», «me», «hace», «muy» aparecen en casi
 * todos los textos y en casi todos los sinónimos, así que sacarlas de los dos
 * lados hace que «me duele la cabeza», «dolor de cabeza» y «tengo un dolor muy
 * fuerte en la cabeza» se reduzcan al mismo par de palabras: *dolor* y
 * *cabeza*. Ahí es donde el motor deja de necesitar que la tabla adivine cómo
 * se escribió la frase.
 *
 * **Las negaciones no están acá** aunque sean palabras funcionales: «no» y
 * «sin» cambian el sentido de lo que sigue y el motor las necesita enteras.
 */
export const VACIAS: ReadonlySet<string> = new Set([
  // Artículos y preposiciones.
  'a', 'al', 'ante', 'con', 'contra', 'de', 'del', 'e', 'el', 'en', 'entre',
  'hacia', 'hasta', 'la', 'las', 'lo', 'los', 'o', 'para', 'por', 'segun',
  'sobre', 'tras', 'u', 'un', 'una', 'unas', 'unos', 'y',
  // Pronombres y posesivos.
  'ella', 'ellos', 'le', 'les', 'me', 'mi', 'mis', 'nos', 'nuestra', 'nuestro',
  'se', 'su', 'sus', 'te', 'tu', 'tus', 'yo',
  // Los verbos que sólo sostienen la frase.
  'era', 'es', 'esta', 'estaba', 'estamos', 'estan', 'estar', 'estas', 'estoy',
  'estuve', 'fue', 'hay', 'sea', 'ser', 'son', 'tenemos', 'tener', 'tenia',
  'tengo', 'tiene', 'tienen', 'tienes', 'tuve',
  // Tiempo y cantidad: «hace tres días», «desde el lunes», «muy fuerte».
  'ahora', 'algo', 'algun', 'alguna', 'algunas', 'alguno', 'algunos', 'anoche',
  'ano', 'anos', 'antes', 'aun', 'bastante', 'bien', 'casi', 'cuando', 'cuanto',
  'dia', 'dias', 'demasiado', 'desde', 'despues', 'dos', 'hace', 'hora',
  'horas', 'luego', 'manana', 'mes', 'meses', 'mientras', 'mucha', 'muchas',
  'mucho', 'muchos', 'muy', 'poca', 'poco', 'pocos', 'semana', 'semanas',
  'siempre', 'solamente', 'solo', 'tambien', 'varias', 'varios', 'veces',
  'vez', 'tanta', 'tantas', 'tanto',
  'tantos', 'tarde', 'toda', 'todas', 'todavia', 'todo', 'todos', 'tres', 'ya',
  // Demostrativos y muletillas.
  'aquel', 'asi', 'cada', 'como', 'cosa', 'ese', 'eso', 'esos', 'este', 'esto',
  'estos', 'medio', 'otra', 'otro', 'pues', 'que', 'si',
  // «quiero» NO está, y no es un olvido: es lo único que separa «quiero bajar
  // de peso» de «bajé de peso», y «me quiero morir» de «se murió mi papá».
]);

/**
 * Lo que niega lo que viene después.
 *
 * «No tengo fiebre» tiene que **no** reconocer fiebre. Con la búsqueda por
 * subcadena la reconocía, que es el peor tipo de error de esta pantalla: la
 * persona escribió justamente lo contrario y el sistema le contesta como si no
 * la hubiera leído.
 */
export const NEGACIONES: ReadonlySet<string> = new Set([
  'jamas', 'nada', 'ni', 'ninguna', 'ninguno', 'ningun', 'no', 'nunca',
  'sin', 'tampoco',
]);

/**
 * Dónde termina lo que una negación alcanza.
 *
 * «No tengo fiebre **pero** me duele la garganta»: la garganta duele. Sin este
 * corte, una sola negación al principio del texto apagaría todo lo que viene
 * detrás.
 */
const FIN_DE_NEGACION: ReadonlySet<string> = new Set([
  'ahora', 'aunque', 'excepto', 'pero', 'porque', 'salvo', 'sino', 'solamente',
  'solo', 'y',
]);

/**
 * Las frases que **empiezan con una negación pero afirman el síntoma**.
 *
 * «No se me quita el dolor de cabeza» y «no aguanto el dolor» dicen que el
 * dolor está, no que falta. Tomar el «no» al pie de la letra ahí borraría
 * justo los casos en que la persona está peor.
 */
const NEGACIONES_FALSAS: readonly (readonly string[])[] = [
  ['se', 'me'],
  ['se', 'va'],
  ['se', 'quita'],
  ['se', 'pasa'],
  ['se', 'calma'],
  ['se', 'si'],
  ['se', 'que'],
  ['para', 'de'],
  ['deja', 'de'],
  ['me', 'deja'],
  ['aguanto'],
  ['soporto'],
  ['resisto'],
];

/**
 * Una palabra del texto, ya masticada.
 *
 * Guarda las tres formas —tal cual, lema y clave fonética— porque las tres se
 * comparan, y el `indice` en caracteres porque el orden en que aparecen los
 * síntomas es el orden en que se pintan los chips.
 */
export interface Token {
  /** Tal cual salió del texto normalizado. */
  readonly texto: string;
  /** La forma comparable: sin plural, sin conjugar. Ver {@link lema}. */
  readonly lema: string;
  /** Cómo suena. Ver {@link clave}. */
  readonly clave: string;
  /**
   * Cómo suena **sin reducir**.
   *
   * El reductor de plurales acierta casi siempre y cuando falla se lleva
   * letras de más: «acides» —así, mal escrito— queda en `acid`, que ya no se
   * parece a `acidez`. La palabra entera sigue sonando igual, así que se
   * guarda también, y es la que salva ese caso.
   */
  readonly claveCruda: string;
  /** Dónde empieza, en caracteres del texto normalizado. */
  readonly desde: number;
  /** Dónde termina, sin incluir. */
  readonly hasta: number;
  /** En qué frase cae. Un síntoma no se arma con palabras de dos frases. */
  readonly frase: number;
  /**
   * Si viene después de una coma o de un punto.
   *
   * Es donde termina lo que una negación alcanza: «no tengo tos, solo dolor de
   * garganta» dice que la garganta duele, y sin este corte la coma no separaba
   * nada y el «no» apagaba las dos cosas.
   */
  readonly corte: boolean;
  /** Si la palabra dice algo por sí sola. Ver {@link VACIAS}. */
  readonly contenido: boolean;
}

/**
 * Parte el texto normalizado en palabras comparables.
 *
 * Se trabaja sobre **palabras completas** y no sobre subcadenas: es lo que
 * hace que «tos» deje de encontrarse dentro de «estos» y que «ataque» deje de
 * encontrarse dentro de «ataques de pánico» — dos falsos positivos que el
 * motor viejo tenía, y el segundo mandaba a urgencias a alguien con ansiedad.
 */
export function tokenizar(normalizado: string): readonly Token[] {
  const tokens: Token[] = [];
  let frase = 0;
  let anterior = 0;

  PALABRAS.lastIndex = 0;
  let encontrado = PALABRAS.exec(normalizado);
  while (encontrado !== null) {
    const texto = encontrado[0];
    const desde = encontrado.index;
    // Lo que quedó entre la palabra anterior y ésta decide si cambió la frase.
    const separador = normalizado.slice(anterior, desde);
    if (CORTE_DURO.test(separador)) {
      frase += 1;
    }
    const suLema = lema(texto);
    tokens.push({
      texto,
      lema: suLema,
      clave: clave(suLema),
      claveCruda: clave(texto),
      desde,
      hasta: desde + texto.length,
      frase,
      corte: CORTE_DURO.test(separador) || CORTE_BLANDO.test(separador),
      contenido: !VACIAS.has(texto),
    });
    anterior = desde + texto.length;
    encontrado = PALABRAS.exec(normalizado);
  }

  return tokens;
}

/**
 * El tramo de texto que una negación alcanza, en índices de token.
 *
 * Devuelve pares `[desde, hasta]` inclusivos. El primero es la propia palabra
 * que niega: un síntoma que la contiene —«**no** puedo respirar»— no está
 * negado, está dicho, y el motor necesita poder distinguirlo.
 */
export function tramosNegados(tokens: readonly Token[]): readonly (readonly [number, number])[] {
  const tramos: (readonly [number, number])[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    if (!NEGACIONES.has(tokens[i].texto)) {
      continue;
    }
    if (esNegacionFalsa(tokens, i)) {
      continue;
    }
    let hasta = i;
    for (let j = i + 1; j < tokens.length && j <= i + 6; j += 1) {
      if (tokens[j].corte || FIN_DE_NEGACION.has(tokens[j].texto)) {
        break;
      }
      hasta = j;
    }
    tramos.push([i, hasta]);
  }

  return tramos;
}

function esNegacionFalsa(tokens: readonly Token[], desde: number): boolean {
  return NEGACIONES_FALSAS.some((frase) =>
    frase.every((palabra, paso) => tokens[desde + 1 + paso]?.texto === palabra),
  );
}

/**
 * Las palabras irregulares, dichas a mano.
 *
 * Un reductor de sufijos no llega nunca de «duele» a «dolor» —cambia la raíz—,
 * y justo esa familia es la que aparece en la mitad de los textos de esta
 * pantalla. Son pocas y son las que importan: escribirlas es más barato y mucho
 * más predecible que un lematizador de propósito general.
 *
 * ## Acá va morfología, NO sinónimos
 *
 * «Duele», «duelen» y «dolores» son **la misma palabra** y por eso están. Que
 * «guata» y «panza» sean lo mismo es vocabulario, y va en la tabla de síntomas.
 * La diferencia no es de estilo: una palabra reducida acá deja de ser
 * comparable por parecido, así que cuando «estómago» se reducía a `panza`,
 * escribir «estomajo» no encontraba nada — la falta de ortografía se comparaba
 * contra una palabra que ya no estaba en ningún lado.
 */
const IRREGULARES: ReadonlyMap<string, string> = new Map([
  // Dolor: la familia más numerosa del dominio.
  ['duele', 'dolor'], ['duelen', 'dolor'], ['dolia', 'dolor'], ['dolian', 'dolor'],
  // «duelo» NO está: es mucho más frecuente el sustantivo —estar de duelo— que
  // la primera persona de doler, y confundirlos mandaba a psicología a
  // cualquiera que dijera que le duele algo.
  ['doler', 'dolor'], ['doliendo', 'dolor'], ['dolido', 'dolor'], ['dolores', 'dolor'],
  ['adolorido', 'dolor'], ['dolorido', 'dolor'], ['dolencia', 'dolor'],
  ['punzada', 'dolor'], ['pinchazo', 'dolor'], ['puntada', 'dolor'],
  ['molesta', 'molestia'], ['molestan', 'molestia'], ['molestar', 'molestia'],
  // Ardor.
  ['arde', 'ardor'], ['arden', 'ardor'], ['ardiendo', 'ardor'], ['ardia', 'ardor'],
  ['quema', 'ardor'], ['quemazon', 'ardor'], ['escozor', 'ardor'],
  // Picazón.
  ['pica', 'picazon'], ['pican', 'picazon'], ['picar', 'picazon'], ['picor', 'picazon'],
  ['comezon', 'picazon'], ['rasquina', 'picazon'], ['rasca', 'picazon'],
  ['prurito', 'picazon'], ['pico', 'picazon'],
  // Hinchazón. «Edema» no está: es otra palabra, y comparable por parecido.
  ['hinchado', 'hinchazon'], ['hincha', 'hinchazon'], ['hinchan', 'hinchazon'],
  ['inflamado', 'hinchazon'], ['inflamacion', 'hinchazon'],
  ['inflama', 'hinchazon'], ['hinchar', 'hinchazon'], ['hincho', 'hinchazon'],
  ['hinche', 'hinchazon'], ['hinchando', 'hinchazon'], ['inflamo', 'hinchazon'],
  // Sangre.
  ['sangra', 'sangre'], ['sangran', 'sangre'], ['sangro', 'sangre'],
  ['sangrando', 'sangre'], ['sangrado', 'sangre'], ['sangrar', 'sangre'],
  ['sangriento', 'sangre'], ['sangrantes', 'sangre'], ['sangrante', 'sangre'],
  // Vómito y náusea.
  ['vomite', 'vomito'], ['vomitando', 'vomito'],
  ['vomitar', 'vomito'], ['vomita', 'vomito'], ['devolvi', 'vomito'],
  ['nauseoso', 'nausea'],
  // Mareo.
  ['mareado', 'mareo'], ['marea', 'mareo'], ['marear', 'mareo'],
  ['mareando', 'mareo'], ['vertigo', 'mareo'],
  // Respirar y toser.
  ['toso', 'tos'], ['tose', 'tos'], ['tosiendo', 'tos'], ['toser', 'tos'],
  ['tosia', 'tos'], ['tosedera', 'tos'],
  ['respiro', 'respirar'], ['respira', 'respirar'], ['respiracion', 'respirar'],
  ['respirando', 'respirar'],
  ['ahoga', 'ahogo'], ['ahogando', 'ahogo'], ['asfixia', 'ahogo'],
  ['silba', 'silbido'], ['pitido', 'silbido'], ['pito', 'silbido'],
  // Dormir y cansancio.
  ['duermo', 'dormir'], ['duerme', 'dormir'], ['duermen', 'dormir'],
  ['durmiendo', 'dormir'], ['dormido', 'dormir'], ['dormirme', 'dormir'],
  ['durmio', 'dormir'],
  ['cansado', 'cansancio'], ['canso', 'cansancio'], ['cansa', 'cansancio'],
  ['agotado', 'cansancio'], ['agotamiento', 'cansancio'],
  ['fatiga', 'cansancio'], ['fatigado', 'cansancio'], ['decaido', 'cansancio'],
  ['exhausto', 'cansancio'],
  // Fiebre.
  ['febril', 'fiebre'], ['calentura', 'fiebre'],
  ['destemplado', 'fiebre'], ['decima', 'fiebre'], ['temperatura', 'fiebre'],
  // Orinar y obrar.
  ['orino', 'orinar'], ['orina', 'orinar'],
  ['miccion', 'orinar'], ['pis', 'orinar'], ['pipi', 'orinar'], ['mear', 'orinar'],
  ['obrar', 'deposicion'], ['obro', 'deposicion'], ['caca', 'deposicion'],
  ['popo', 'deposicion'], ['heces', 'deposicion'],
  ['excremento', 'deposicion'], ['defecar', 'deposicion'], ['evacuar', 'deposicion'],
  // Ver y oír.
  ['veo', 'vision'], ['ver', 'vision'], ['vista', 'vision'],
  ['viendo', 'vision'], ['visto', 'vision'],
  ['oigo', 'escuchar'], ['oir', 'escuchar'], ['escucho', 'escuchar'],
  ['escuchar', 'escuchar'], ['audicion', 'escuchar'], ['oye', 'escuchar'],
  // Movimiento y habla.
  ['muevo', 'mover'], ['mueve', 'mover'], ['moverme', 'mover'],
  ['hablo', 'hablar'], ['habla', 'hablar'],
  ['trago', 'tragar'], ['deglutir', 'tragar'],
  ['camina', 'caminar'], ['camino', 'caminar'],
  ['cepillo', 'cepillar'], ['cepillarme', 'cepillar'], ['cepillando', 'cepillar'],
  // Poder, subir, bajar, perder, caer: sostienen medio catálogo de frases.
  ['puedo', 'poder'], ['puede', 'poder'], ['pueden', 'poder'], ['podia', 'poder'],
  ['logro', 'poder'], ['consigo', 'poder'],
  ['subio', 'subir'], ['sube', 'subir'], ['subiendo', 'subir'], ['subi', 'subir'],
  ['baje', 'bajar'], ['bajo', 'bajar'], ['baja', 'bajar'],
  ['bajando', 'bajar'], ['adelgace', 'bajar'], ['adelgazando', 'bajar'],
  ['perdi', 'perdida'], ['pierdo', 'perdida'],
  ['perder', 'perdida'], ['perdiendo', 'perdida'],
  ['cae', 'caida'], ['caen', 'caida'], ['caer', 'caida'],
  ['cayendo', 'caida'], ['cai', 'caida'],
  // Morir: la misma raíz sostiene el duelo de alguien y la urgencia de otro, y
  // lo que los separa es quién es el sujeto —«se murió mi papá» contra «me
  // quiero morir»—, así que las formas se juntan acá y la tabla las distingue.
  ['muero', 'morir'], ['morirme', 'morir'], ['murio', 'morir'],
  ['fallecio', 'morir'], ['fallecer', 'morir'], ['fallecimiento', 'morir'],
  ['muerte', 'morir'], ['moria', 'morir'], ['muriendo', 'morir'],
  // Vacunas: la consulta llega conjugada más veces que en sustantivo.
  ['vacunar', 'vacuna'], ['vacunarme', 'vacuna'], ['vacunado', 'vacuna'],
  ['vacunacion', 'vacuna'],
  // Temblor, hormigueo, calambre.
  ['tiembla', 'temblor'], ['tiemblo', 'temblor'],
  ['temblando', 'temblor'], ['tembloroso', 'temblor'], ['tiemblan', 'temblor'],
  ['hormiguea', 'hormigueo'], ['adormecido', 'hormigueo'],
  ['adormecimiento', 'hormigueo'], ['entumecido', 'hormigueo'],
  ['entumecimiento', 'hormigueo'],
  // Ánimo.
  ['triste', 'tristeza'], ['deprimido', 'tristeza'],
  ['depresion', 'tristeza'], ['bajoneado', 'tristeza'], ['desanimo', 'tristeza'],
  ['desanimado', 'tristeza'], ['llorando', 'llanto'], ['lloro', 'llanto'],
  ['ansioso', 'ansiedad'], ['angustia', 'ansiedad'],
  ['angustiado', 'ansiedad'], ['nervioso', 'ansiedad'], ['nervio', 'ansiedad'],
  ['estres', 'ansiedad'], ['estresado', 'ansiedad'],
  // Cuerpo: sólo lo que las reglas generales no acertarían.
  ['muelita', 'muela'], ['pies', 'pie'], ['pancita', 'panza'],
  ['abdominal', 'abdomen'], ['boquita', 'boca'], ['cabecita', 'cabeza'],
  ['gargantita', 'garganta'], ['rodillita', 'rodilla'], ['ojito', 'ojo'],
  ['narices', 'nariz'], ['pechito', 'pecho'], ['toracico', 'torax'],
  ['articular', 'articulacion'], ['muscular', 'musculo'],
  // Sin esto la regla del plural deja «varic», que queda a una letra de
  // «varias» y convertía «varias veces» en várices.
  ['varices', 'varice'], ['variz', 'varice'],
  ['vaginal', 'vagina'], ['menstrual', 'menstruacion'], ['cervicales', 'cervical'],
]);

/**
 * La forma comparable de una palabra: sin plural, sin conjugar, sin repetir.
 *
 * Primero mira las irregulares —donde está toda la familia de «doler»— y sólo
 * después aplica las reglas generales. El resultado **no pretende ser la
 * palabra real**: pretende ser la misma etiqueta a los dos lados de la
 * comparación, que es lo único que un motor de coincidencias necesita.
 */
export function lema(palabra: string): string {
  const recordado = MEMORIA_LEMA.get(palabra);
  if (recordado !== undefined) {
    return recordado;
  }
  const resultado = calcularLema(palabra);
  recordar(MEMORIA_LEMA, palabra, resultado);
  return resultado;
}

/**
 * Lo ya calculado.
 *
 * Las mismas palabras vuelven todo el tiempo: «dolor» aparece en cuarenta filas
 * de la tabla y en cada tecla que alguien escribe. Recordarlas bajó el armado
 * del índice de sesenta milisegundos a menos de veinte, que es la diferencia
 * entre un tirón visible en la primera letra y ninguno.
 *
 * Se vacían enteras al llegar al tope: el texto lo escribe una persona, no un
 * diccionario, y una sesión no llega ni cerca.
 */
const MEMORIA_LEMA = new Map<string, string>();
const MEMORIA_CLAVE = new Map<string, string>();
const TOPE_DE_MEMORIA = 4000;

function recordar(memoria: Map<string, string>, llave: string, valor: string): void {
  if (memoria.size >= TOPE_DE_MEMORIA) {
    memoria.clear();
  }
  memoria.set(llave, valor);
}

function calcularLema(palabra: string): string {
  if (palabra === '') {
    return '';
  }
  // «doooolor» y «siiii»: el alargamiento es énfasis, no otra palabra.
  let forma = palabra.replace(/(.)\1{2,}/g, '$1');

  const directo = IRREGULARES.get(forma);
  if (directo !== undefined) {
    return directo;
  }

  forma = singular(forma);
  const singularizado = IRREGULARES.get(forma);
  if (singularizado !== undefined) {
    return singularizado;
  }

  // El género se prueba, no se aplica: «hinchada» encuentra «hinchado» y con él
  // su familia, pero «espada» no se convierte en «espado» —que no es nada— y
  // sigue estando a una letra de «espalda», que es lo que alguien quiso
  // escribir.
  return IRREGULARES.get(masculino(forma)) ?? forma;
}

/**
 * El singular, con la regla que menos se equivoca en castellano.
 *
 * «Dolores» pierde «es» porque «dolor» termina en consonante que lo admite;
 * «dientes» pierde sólo la «s» porque «dient» no es una palabra. Sin esa
 * distinción, la tabla decía «diente» y el texto «dientes» y no se encontraban.
 */
function singular(palabra: string): string {
  if (palabra.length > 4 && palabra.endsWith('es')) {
    const raiz = palabra.slice(0, -2);
    return /[lrndzjsxc]$/.test(raiz) ? raiz : palabra.slice(0, -1);
  }
  if (palabra.length > 3 && palabra.endsWith('s')) {
    return palabra.slice(0, -1);
  }
  return palabra;
}

/**
 * El género neutralizado para los participios y adjetivos.
 *
 * «Hinchada» y «hinchado» son lo mismo dicho de una pierna o de un tobillo, y
 * la tabla no puede escribir las dos formas de cada palabra.
 */
function masculino(palabra: string): string {
  if (palabra.length > 4 && (palabra.endsWith('ada') || palabra.endsWith('osa'))) {
    return `${palabra.slice(0, -1)}o`;
  }
  return palabra;
}

/**
 * Cómo suena una palabra, en castellano.
 *
 * Casi toda falta de ortografía del castellano es **homófona**: se escribe
 * distinto y suena igual. «Caveza», «cabesa» y «cabeza»; «aogo» y «ahogo»;
 * «jeneral» y «general». Reduciendo las letras que comparten sonido a una sola,
 * las tres se vuelven la misma clave y se encuentran sin recurrir a la
 * distancia de edición, que es más cara y admite coincidencias que nadie quiso.
 */
export function clave(palabra: string): string {
  const recordada = MEMORIA_CLAVE.get(palabra);
  if (recordada !== undefined) {
    return recordada;
  }
  const resultado = calcularClave(palabra);
  recordar(MEMORIA_CLAVE, palabra, resultado);
  return resultado;
}

function calcularClave(palabra: string): string {
  let s = palabra.replace(/[^a-z0-9]/g, '');
  if (s === '') {
    return '';
  }
  s = s.replace(/qu([ei])/g, 'k$1');
  // La «ch» es un sonido propio: se aparta antes de tocar la «c» y la «h».
  s = s.replace(/ch/g, 'q');
  s = s.replace(/h/g, '');
  s = s.replace(/[cz]([ei])/g, 's$1');
  s = s.replace(/z/g, 's');
  s = s.replace(/c/g, 'k');
  s = s.replace(/g([ei])/g, 'j$1');
  s = s.replace(/x/g, 'ks');
  s = s.replace(/ll/g, 'y');
  s = s.replace(/[vw]/g, 'b');
  s = s.replace(/y/g, 'i');
  s = s.replace(/(.)\1+/g, '$1');
  return s;
}

/**
 * La última frase de lo que se está escribiendo.
 *
 * El autocompletado mira sólo lo último y no el texto entero: quien ya escribió
 * «tengo fiebre y do» está buscando algo que empieza con «do», y buscar sobre
 * la frase completa no encontraría nada.
 *
 * Vive acá y no en el componente porque es lengua, no pantalla: puesta en el
 * componente, probarla obligaba a arrastrar Angular entero a una prueba que
 * mira un `split`.
 */
export function ultimaFrase(texto: string): string {
  const partes = normalizar(texto).split(/[,.;]| y /);
  return (partes[partes.length - 1] ?? '').trim();
}

/**
 * Distancia de edición con transposiciones (Damerau-Levenshtein), con tope.
 *
 * Las transposiciones cuentan como **un** error y no como dos porque en un
 * teclado de teléfono son el error típico: «dolro», «cabzea». Contarlas doble
 * dejaría afuera justamente las faltas más frecuentes.
 *
 * El tope no es una optimización cosmética: esto corre en cada tecla contra
 * todo el vocabulario, y cortar apenas una fila entera supera el tope evita el
 * grueso del trabajo.
 */
export function distancia(a: string, b: string, tope: number): number {
  if (a === b) {
    return 0;
  }
  if (Math.abs(a.length - b.length) > tope) {
    return tope + 1;
  }

  const anterior: number[] = new Array<number>(b.length + 1);
  const previa: number[] = new Array<number>(b.length + 1);
  let fila: number[] = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) {
    anterior[j] = j;
    previa[j] = 0;
  }
  let doble = previa;
  let ultima = anterior;

  for (let i = 1; i <= a.length; i += 1) {
    fila[0] = i;
    let minima = fila[0];
    for (let j = 1; j <= b.length; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let valor = Math.min(ultima[j] + 1, fila[j - 1] + 1, ultima[j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        valor = Math.min(valor, doble[j - 2] + 1);
      }
      fila[j] = valor;
      if (valor < minima) {
        minima = valor;
      }
    }
    if (minima > tope) {
      return tope + 1;
    }
    const rotada = doble;
    doble = ultima;
    ultima = fila;
    fila = rotada;
  }

  return ultima[b.length];
}
