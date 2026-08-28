/* ============================================================================
    El motor que cruza lo que alguien escribió con la tabla de síntomas.

    ## Qué hacía antes y por qué no alcanzaba

    Buscaba cada sinónimo con `indexOf` sobre el texto normalizado. Eso funciona
    exactamente para las frases que la tabla adivinó y para ninguna otra:

    - «me duelen las rodillas» no encuentra «me duele la rodilla» (plural),
    - «me duele la caveza» no encuentra nada (una letra),
    - «tengo un dolor muy fuerte en la cabeza» no encuentra «dolor de cabeza»
      (hay dos palabras en el medio),
    - «no tengo fiebre» encuentra fiebre (la niega, y el motor no lo lee),
    - «tengo ataques de pánico» encuentra «ataque» dentro de la lista de
      **alarma** y manda a urgencias a alguien con ansiedad.

    Los cinco son la forma normal de contar un síntoma, y los cinco fallaban.

    ## Cómo decide ahora

    1. Parte el texto en palabras y reduce cada una a su lema (`texto.ts`).
    2. Hace lo mismo con cada sinónimo de la tabla, **una sola vez**, al armar
       el índice: «dolor de cabeza» y «me duele la cabeza» quedan los dos en
       `dolor` + `cabeza`, así que la tabla deja de tener que enumerar cada
       manera de decirlo.
    3. Un síntoma coincide si todas las palabras de alguno de sus patrones
       aparecen **cerca** en la misma frase, en cualquier orden. El orden libre
       es lo que hace que «la cabeza me duele» valga tanto como «me duele la
       cabeza»; la cercanía es lo que evita que valga «me duele la rodilla y la
       cabeza la tengo dura».
    4. Cada palabra puede coincidir exacta, por cómo suena o por parecido
       tipográfico, y eso da una confianza. Poca confianza no entra.
    5. Lo negado se descarta y lo que queda tapado por una coincidencia más
       específica también: «vomité sangre» es una urgencia, no un vómito.

    ## Lo que este archivo NO decide

    Qué especialidad corresponde: eso es dato y vive en `sintomas.datos.ts`.
    Acá no hay una sola palabra de medicina, y es a propósito — el equipo médico
    revisa una tabla, no un algoritmo.
    ========================================================================== */

import {
  clave,
  distancia,
  lema,
  normalizar,
  tokenizar,
  tramosNegados,
  type Token,
} from './texto';
import type { Sintoma } from './sintomas.datos';

/**
 * Un síntoma reconocido, con de dónde salió.
 *
 * La `evidencia` y la `confianza` no las usa la pantalla hoy: existen porque
 * sin ellas es imposible entender por qué el motor entendió lo que entendió, y
 * un motor de salud que no se puede auditar no se puede corregir.
 */
export interface Coincidencia {
  readonly sintoma: Sintoma;
  /** 0 a 1. Exacta vale 1; por sonido, 0,9; por parecido, menos. */
  readonly confianza: number;
  /** Dónde empieza en el texto normalizado. Ordena los chips. */
  readonly desde: number;
  /** El trozo de texto que lo trajo. Para depurar y para explicar. */
  readonly evidencia: string;
  /** Si el texto lo **niega** («no tengo fiebre»). */
  readonly negado: boolean;
}

/** Lo que el motor entendió de un texto. */
export interface Analisis {
  /** Los síntomas corrientes, en orden de aparición. */
  readonly sintomas: readonly Coincidencia[];
  /** Los de alarma. Vacío es lo normal. */
  readonly alarmas: readonly Coincidencia[];
  /** Los que el texto nombró para negarlos. No se muestran; se explican. */
  readonly negados: readonly Coincidencia[];
}

/* --- Los números que gobiernan el motor ---------------------------------- */

/**
 * Cuántas palabras con contenido pueden meterse entre las de un patrón.
 *
 * Con 0, «dolor fuerte de cabeza» no coincidiría con `dolor` + `cabeza`. Con
 * muchas, «me duele la rodilla y la cabeza la tengo dura» sí coincidiría. Dos
 * es lo que deja pasar los adjetivos y las precisiones —«dolor muy fuerte de
 * cabeza», «dolor en la parte de atrás de la cabeza»— sin cruzar de tema.
 */
const HUECO = 2;

/** Confianza mínima para creerle a una coincidencia de varias palabras. */
const UMBRAL = 0.72;

/**
 * Confianza mínima para una coincidencia de **una sola palabra**.
 *
 * Es más alta porque una sola palabra no tiene con qué corroborarse: si «tos»
 * coincidiera por parecido, «dos» y «vos» serían tos. Una palabra sola entra
 * exacta o por cómo suena; por parecido tipográfico sólo si es larga, donde el
 * azar de que dos palabras del vocabulario se parezcan es mucho menor.
 */
const UMBRAL_UNICO = 0.8;

/** Largo mínimo del patrón para admitir parecido tipográfico en una palabra sola. */
const LARGO_PARA_DIFUSO_UNICO = 6;

/** Confianza mínima para derivar a urgencias. Un error acá no es gratis. */
const UMBRAL_ALARMA = 0.8;

/**
 * Palabras que pueden sostener **dos** síntomas a la vez.
 *
 * «Me duele la cabeza y la garganta» tiene un solo «duele» para dos síntomas.
 * Sin esta lista, el primero se queda con la palabra y el segundo se pierde —y
 * enumerar síntomas colgados de un solo verbo es exactamente cómo habla la
 * gente.
 */
const COMPARTIDAS: ReadonlySet<string> = new Set([
  'ardor', 'bulto', 'control', 'dolor', 'hinchazon', 'mal', 'molestia', 'mover',
  'no', 'poder', 'problema', 'receta', 'sangre',
]);

/**
 * Parecidos que **no** son faltas de ortografía.
 *
 * «Alegría» y «alergia» están a una transposición de distancia y significan
 * cosas opuestas. Son pocos casos, pero el que los sufre ve un disparate.
 */
const NO_CONFUNDIR: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['alegria', new Set(['alergia'])],
  ['alegre', new Set(['alergia'])],
  ['liebre', new Set(['fiebre'])],
  ['fiesta', new Set(['fiebre'])],
  ['sano', new Set(['mano'])],
  ['casa', new Set(['caida', 'cara'])],
  ['modelo', new Set(['mareo'])],
]);

/* --- El índice ------------------------------------------------------------ */

/**
 * Una manera de decir un síntoma, ya reducida a lemas.
 *
 * Varios sinónimos caen en el mismo patrón —«dolor de cabeza» y «me duele la
 * cabeza» son los dos `dolor cabeza`— y se guarda uno solo. Esa colisión es la
 * que hace que agregar sinónimos a la tabla siga siendo barato.
 */
interface Patron {
  readonly sintoma: Sintoma;
  readonly lemas: readonly string[];
  readonly claves: readonly string[];
  /** De qué frase de la tabla salió. Sólo para depurar. */
  readonly fuente: string;
}

interface Indice {
  readonly patrones: readonly Patron[];
  readonly porLema: ReadonlyMap<string, readonly number[]>;
  readonly porClave: ReadonlyMap<string, readonly number[]>;
  /** Todo el vocabulario de la tabla, para buscar parecidos. */
  readonly vocabulario: readonly string[];
  /** Cómo suena cada palabra del vocabulario, en el mismo orden. */
  readonly clavesDelVocabulario: readonly string[];
  /** Los parecidos ya calculados. Se escribe mientras se usa. */
  readonly parecidos: Map<string, readonly string[]>;
}

/** Un índice por tabla. Se arma una vez y se reusa en cada tecla. */
const INDICES = new WeakMap<readonly Sintoma[], Indice>();

function indiceDe(tabla: readonly Sintoma[]): Indice {
  const cacheado = INDICES.get(tabla);
  if (cacheado !== undefined) {
    return cacheado;
  }
  const armado = armarIndice(tabla);
  INDICES.set(tabla, armado);
  return armado;
}

function armarIndice(tabla: readonly Sintoma[]): Indice {
  const patrones: Patron[] = [];
  const vistos = new Set<string>();
  const porLema = new Map<string, number[]>();
  const porClave = new Map<string, number[]>();
  const vocabulario = new Set<string>();

  for (const sintoma of tabla) {
    for (const frase of frasesDe(sintoma)) {
      const lemas = lemasDe(frase);
      if (lemas.length === 0) {
        continue;
      }
      const huella = `${sintoma.id}|${lemas.join(' ')}`;
      if (vistos.has(huella)) {
        continue;
      }
      vistos.add(huella);

      const cual = patrones.length;
      patrones.push({
        sintoma,
        lemas,
        claves: lemas.map((palabra) => clave(palabra)),
        fuente: frase,
      });
      for (const palabra of lemas) {
        vocabulario.add(palabra);
        agregar(porLema, palabra, cual);
        agregar(porClave, clave(palabra), cual);
      }
    }
  }

  const palabras = [...vocabulario];
  return {
    patrones,
    porLema,
    porClave,
    vocabulario: palabras,
    clavesDelVocabulario: palabras.map((palabra) => clave(palabra)),
    parecidos: new Map<string, readonly string[]>(),
  };
}

/**
 * Todas las maneras de decir un síntoma que la tabla declara.
 *
 * Incluye el nombre del chip —que a veces es la forma más natural de
 * escribirlo— y **genera** las combinaciones de dolor con cada parte del cuerpo
 * que la fila declare: escribir a mano «dolor de rodilla», «me duele la
 * rodilla», «molestia en la rodilla» y «dolor en las rodillas» era el trabajo
 * que hacía crecer la tabla sin que creciera lo que reconoce.
 */
function frasesDe(sintoma: Sintoma): readonly string[] {
  const frases = [sintoma.nombre, ...sintoma.sinonimos];
  for (const parte of sintoma.partes ?? []) {
    for (const gatillo of sintoma.gatillos ?? ['dolor', 'molestia']) {
      frases.push(`${gatillo} ${parte}`);
    }
  }
  return frases;
}

/** Las palabras con contenido de una frase, en lemas y sin repetir. */
function lemasDe(frase: string): readonly string[] {
  const lemas: string[] = [];
  for (const token of tokenizar(normalizar(frase))) {
    if (token.contenido && !lemas.includes(token.lema)) {
      lemas.push(token.lema);
    }
  }
  return lemas;
}

function agregar(mapa: Map<string, number[]>, llave: string, valor: number): void {
  const previos = mapa.get(llave);
  if (previos === undefined) {
    mapa.set(llave, [valor]);
  } else if (previos[previos.length - 1] !== valor) {
    previos.push(valor);
  }
}

/* --- La comparación de una palabra --------------------------------------- */

/**
 * Cuánto se parece una palabra del texto a una palabra de un patrón.
 *
 * Devuelve 0 si no se parecen. Las capas están en orden de confianza
 * decreciente —la misma palabra, el mismo sonido, el sonido de la palabra sin
 * reducir, y por último el parecido a una letra— y sólo las dos últimas pueden
 * equivocarse, así que son las únicas con condiciones de largo.
 */
function parecido(patron: string, claveDelPatron: string, token: Token): number {
  if (token.lema === patron) {
    return 1;
  }
  if (patron.length >= 4 && claveDelPatron !== '' && token.clave === claveDelPatron) {
    return 0.9;
  }
  if (patron.length >= 5 && claveDelPatron !== '' && token.claveCruda === claveDelPatron) {
    return 0.88;
  }
  if (token.lema.length < 4 || patron.length < 5) {
    return 0;
  }
  if (NO_CONFUNDIR.get(token.lema)?.has(patron) === true) {
    return 0;
  }
  const tope = patron.length >= 8 ? 2 : 1;
  // `distancia` devuelve `tope + 1` cuando se pasa del tope: es un centinela,
  // no una distancia. Leerlo como si lo fuera daba por parecidas dos palabras
  // que no se parecen en nada.
  const cuanto = distancia(token.lema, patron, tope);
  let porLetras = 0;
  if (cuanto === 1) {
    porLetras = 0.82;
  } else if (cuanto === 2 && cuanto <= tope) {
    porLetras = 0.68;
  }

  // Una letra de más sobre el sonido: «kbeza» y «estomajo» no están a una
  // letra de «cabeza» ni de «estómago», pero sí de cómo suenan. Es la falta de
  // ortografía típica —una fonética con un dedo de más— y sin esta capa se
  // pierde entera. Cuando las dos señales coinciden vale más que cualquiera
  // por separado: son independientes.
  const porSonido =
    claveDelPatron.length >= 5 &&
    token.clave.length >= 5 &&
    distancia(token.clave, claveDelPatron, 1) <= 1
      ? 0.85
      : 0;

  return Math.max(porLetras, porSonido);
}

/**
 * Las palabras del vocabulario que se parecen a una que no está en él.
 *
 * Sólo se llama cuando el lema **no** coincide con nada exacto ni por sonido,
 * que es el caso raro. El resultado se guarda porque el texto se reanaliza en
 * cada tecla y las palabras se repiten.
 */
function parecidasA(indice: Indice, palabra: string): readonly string[] {
  const cacheado = indice.parecidos.get(palabra);
  if (cacheado !== undefined) {
    return cacheado;
  }
  const encontradas: string[] = [];
  if (palabra.length >= 4) {
    const prohibidas = NO_CONFUNDIR.get(palabra);
    const claveBuscada = clave(palabra);
    for (let cual = 0; cual < indice.vocabulario.length; cual += 1) {
      const candidata = indice.vocabulario[cual];
      if (candidata.length < 5 || Math.abs(candidata.length - palabra.length) > 2) {
        continue;
      }
      if (prohibidas?.has(candidata) === true) {
        continue;
      }
      const tope = candidata.length >= 8 ? 2 : 1;
      if (distancia(palabra, candidata, tope) <= tope) {
        encontradas.push(candidata);
        continue;
      }
      // El mismo criterio que usa `parecido` para el sonido: si no se busca
      // también por acá, la palabra ni siquiera llega a compararse.
      const claveCandidata = indice.clavesDelVocabulario[cual];
      if (
        claveBuscada.length >= 5 &&
        claveCandidata.length >= 5 &&
        distancia(claveBuscada, claveCandidata, 1) <= 1
      ) {
        encontradas.push(candidata);
      }
    }
  }
  // El texto es de una persona, no de un diccionario: la memoria no crece sola
  // más allá de lo que esa persona escribió en la sesión.
  if (indice.parecidos.size > 500) {
    indice.parecidos.clear();
  }
  indice.parecidos.set(palabra, encontradas);
  return encontradas;
}

/* --- El análisis ---------------------------------------------------------- */

/** Una coincidencia todavía sin decidir, con las palabras que la sostienen. */
interface Candidata {
  readonly patron: Patron;
  readonly confianza: number;
  /** Índices dentro de la lista de palabras con contenido. */
  readonly posiciones: readonly number[];
  /** Qué lema del patrón cubre cada posición, en el mismo orden. */
  readonly cubiertos: readonly string[];
  readonly desde: number;
  readonly hasta: number;
  readonly negada: boolean;
}

/**
 * Lo que el motor entiende de un texto.
 *
 * @param texto - Lo que la persona escribió, tal cual.
 * @param tabla - Contra qué tabla. Se inyecta para poder probar el motor
 *   aislado de los datos, que es lo que permite que el equipo médico cambie la
 *   tabla sin tocar una prueba del motor.
 */
export function analizar(texto: string, tabla: readonly Sintoma[]): Analisis {
  const normalizado = normalizar(texto);
  if (normalizado === '') {
    return { sintomas: [], alarmas: [], negados: [] };
  }

  const indice = indiceDe(tabla);
  const tokens = tokenizar(normalizado);
  const contenido = tokens.filter((token) => token.contenido);
  const negados = tramosNegados(tokens);

  const candidatas = mejoresPorSintoma(buscarCandidatas(indice, tokens, contenido, negados));
  const aceptadas = resolverConflictos(candidatas);

  const numeros = porNumeros(normalizado, tabla);
  const porPalabras = aceptadas
    .map((candidata) => aCoincidencia(candidata, normalizado))
    .filter((c) => !numeros.quita.has(c.sintoma.id));
  const yaEstan = new Set(porPalabras.map((coincidencia) => coincidencia.sintoma.id));
  const coincidencias = sinGenericosDeMas(
    porPalabras
      .concat(numeros.agrega.filter((c) => !yaEstan.has(c.sintoma.id)))
      .sort((a, b) => a.desde - b.desde),
  );

  return {
    sintomas: coincidencias.filter((c) => !c.negado && c.sintoma.alarma !== true),
    alarmas: coincidencias.filter(
      (c) => !c.negado && c.sintoma.alarma === true && c.confianza >= UMBRAL_ALARMA,
    ),
    negados: coincidencias.filter((c) => c.negado),
  };
}

/** Los patrones que vale la pena mirar, y cómo le fue a cada uno. */
function buscarCandidatas(
  indice: Indice,
  tokens: readonly Token[],
  contenido: readonly Token[],
  negados: readonly (readonly [number, number])[],
): readonly Candidata[] {
  const aMirar = new Set<number>();
  for (const token of contenido) {
    sumar(aMirar, indice.porLema.get(token.lema));
    sumar(aMirar, indice.porClave.get(token.clave));
    sumar(aMirar, indice.porClave.get(token.claveCruda));
    if (
      indice.porLema.has(token.lema) ||
      indice.porClave.has(token.clave) ||
      indice.porClave.has(token.claveCruda)
    ) {
      continue;
    }
    for (const parecida of parecidasA(indice, token.lema)) {
      sumar(aMirar, indice.porLema.get(parecida));
    }
  }

  const candidatas: Candidata[] = [];
  for (const cual of aMirar) {
    const candidata = evaluar(indice.patrones[cual], tokens, contenido, negados);
    if (candidata !== null) {
      candidatas.push(candidata);
    }
  }
  return candidatas;
}

function sumar(destino: Set<number>, cuales: readonly number[] | undefined): void {
  if (cuales === undefined) {
    return;
  }
  for (const cual of cuales) {
    destino.add(cual);
  }
}

/**
 * Si un patrón entra en el texto, y con cuánta confianza.
 *
 * Prueba cada aparición de la primera palabra como ancla y busca las demás lo
 * más cerca posible. No hace falta más: los patrones tienen dos o tres palabras
 * y los textos, veinte.
 */
function evaluar(
  patron: Patron,
  tokens: readonly Token[],
  contenido: readonly Token[],
  negados: readonly (readonly [number, number])[],
): Candidata | null {
  const apariciones = patron.lemas.map((palabra, cual) =>
    contenido
      .map((token, donde) => ({ donde, puntaje: parecido(palabra, patron.claves[cual], token) }))
      .filter((intento) => intento.puntaje > 0),
  );
  if (apariciones.some((lista) => lista.length === 0)) {
    return null;
  }

  let mejor: Candidata | null = null;
  for (const ancla of apariciones[0]) {
    const elegidas = [{ ...ancla, lema: patron.lemas[0] }];
    let posible = true;
    for (let i = 1; i < apariciones.length && posible; i += 1) {
      const libre = apariciones[i]
        .filter((intento) => !elegidas.some((puesta) => puesta.donde === intento.donde))
        .sort(
          (a, b) =>
            Math.abs(a.donde - ancla.donde) - Math.abs(b.donde - ancla.donde) ||
            b.puntaje - a.puntaje,
        )[0];
      if (libre === undefined) {
        posible = false;
      } else {
        elegidas.push({ ...libre, lema: patron.lemas[i] });
      }
    }
    if (!posible) {
      continue;
    }

    const ordenadas = [...elegidas].sort((a, b) => a.donde - b.donde);
    const primera = ordenadas[0].donde;
    const ultima = ordenadas[ordenadas.length - 1].donde;
    if (ultima - primera > patron.lemas.length - 1 + HUECO) {
      continue;
    }
    if (contenido[primera].frase !== contenido[ultima].frase) {
      continue;
    }

    const suma = elegidas.reduce((total, elegida) => total + elegida.puntaje, 0);
    const hueco = ultima - primera - (patron.lemas.length - 1);
    const confianza = suma / elegidas.length - hueco * 0.04;
    const minima = patron.lemas.length === 1 ? UMBRAL_UNICO : UMBRAL;
    if (confianza < minima) {
      continue;
    }
    if (
      patron.lemas.length === 1 &&
      elegidas[0].puntaje < 0.85 &&
      patron.lemas[0].length < LARGO_PARA_DIFUSO_UNICO
    ) {
      continue;
    }
    if (mejor !== null && confianza <= mejor.confianza) {
      continue;
    }

    const posiciones = ordenadas.map((elegida) => elegida.donde);
    const cubiertos = ordenadas.map((elegida) => elegida.lema);
    mejor = {
      patron,
      confianza,
      posiciones,
      cubiertos,
      desde: contenido[primera].desde,
      hasta: contenido[ultima].hasta,
      negada: estaNegada(contenido, posiciones, cubiertos, tokens, negados),
    };
  }

  return mejor;
}

/**
 * Si el texto niega esta coincidencia.
 *
 * La palabra que niega **puede ser parte del síntoma**: «no puedo respirar» se
 * dice con un «no» que no niega nada, lo constituye. Por eso una coincidencia
 * que se apoya en la propia negación nunca queda negada — sin esa distinción,
 * el síntoma de alarma más frecuente del flujo se apagaría solo.
 */
function estaNegada(
  contenido: readonly Token[],
  posiciones: readonly number[],
  cubiertos: readonly string[],
  tokens: readonly Token[],
  negados: readonly (readonly [number, number])[],
): boolean {
  if (negados.length === 0) {
    return false;
  }
  const usados = posiciones.map((donde) => tokens.indexOf(contenido[donde]));

  // Lo que decide son las palabras que **nombran** el síntoma, no el verbo que
  // comparte con los demás. «Ya no me duele la cabeza, ahora es la panza»
  // tiene un solo "duele" para los dos, y ese "duele" cae dentro de la
  // negación: mirándolo a él, la panza también quedaba negada.
  const propios = usados.filter((_, cual) => !COMPARTIDAS.has(cubiertos[cual]));
  const decisivos = propios.length > 0 ? propios : usados;

  // Y las tiene que alcanzar a **todas**: «ronco tanto que mi esposa no
  // duerme» habla de ronquidos, aunque la mitad de la frase esté negada. Lo
  // negado ahí es el sueño de otra persona.
  return negados.some(
    ([desde, hasta]) =>
      !usados.includes(desde) && decisivos.every((cual) => cual > desde && cual <= hasta),
  );
}

/** Un síntoma se reconoce una vez, por su mejor patrón. */
function mejoresPorSintoma(candidatas: readonly Candidata[]): readonly Candidata[] {
  const mejores = new Map<string, Candidata>();
  for (const candidata of candidatas) {
    const previa = mejores.get(candidata.patron.sintoma.id);
    if (
      previa === undefined ||
      candidata.patron.lemas.length > previa.patron.lemas.length ||
      (candidata.patron.lemas.length === previa.patron.lemas.length &&
        candidata.confianza > previa.confianza)
    ) {
      mejores.set(candidata.patron.sintoma.id, candidata);
    }
  }
  return [...mejores.values()];
}

/**
 * Qué hacer cuando dos síntomas se disputan las mismas palabras.
 *
 * Gana el más específico: «vomité sangre» es la urgencia, no el vómito; «ataque
 * de pánico» es ansiedad, no una convulsión. Las palabras que ya usó una
 * coincidencia no las puede usar otra —salvo las de {@link COMPARTIDAS}, que
 * son las que la gente encadena: «me duele la cabeza y la garganta».
 */
function resolverConflictos(candidatas: readonly Candidata[]): readonly Candidata[] {
  const ordenadas = [...candidatas].sort(
    (a, b) =>
      b.patron.lemas.length - a.patron.lemas.length ||
      b.confianza - a.confianza ||
      a.desde - b.desde,
  );

  const usadas = new Set<number>();
  const aceptadas: Candidata[] = [];
  for (const candidata of ordenadas) {
    const propias = candidata.posiciones.filter(
      (_, cual) => !COMPARTIDAS.has(candidata.cubiertos[cual]),
    );
    if (propias.some((donde) => usadas.has(donde))) {
      continue;
    }
    for (const donde of propias) {
      usadas.add(donde);
    }
    aceptadas.push(candidata);
  }
  return aceptadas;
}

/**
 * Saca los motivos de reserva cuando hay uno concreto.
 *
 * «Me diagnosticaron hipotiroidismo y quiero un control» tiene las dos cosas
 * escritas, pero el chip de «un chequeo general» al lado del de tiroides no
 * agrega nada: la persona ya dijo qué se quiere controlar. Ver `generico` en
 * `sintomas.datos.ts`.
 */
function sinGenericosDeMas(coincidencias: readonly Coincidencia[]): readonly Coincidencia[] {
  const hayConcreto = coincidencias.some(
    (c) => !c.negado && c.sintoma.generico !== true && c.sintoma.alarma !== true,
  );
  if (!hayConcreto) {
    return coincidencias;
  }
  return coincidencias.filter((c) => c.sintoma.generico !== true);
}

function aCoincidencia(candidata: Candidata, normalizado: string): Coincidencia {
  return {
    sintoma: candidata.patron.sintoma,
    confianza: Math.min(1, Math.round(candidata.confianza * 100) / 100),
    desde: candidata.desde,
    evidencia: normalizado.slice(candidata.desde, candidata.hasta),
    negado: candidata.negada,
  };
}

/* --- Lo que se dice con números ------------------------------------------ */

/**
 * Los síntomas que la gente escribe como una medición.
 *
 * «Tengo 38.5», «la presión me dio 160/100», «la glucosa en 280». No hay
 * sinónimo que los cubra —el dato es el número— y son de los textos más
 * frecuentes de una consulta. Cada regla exige una palabra que le dé contexto:
 * sin eso, «hace 38 días» sería fiebre.
 */
const REGLAS_NUMERICAS: readonly {
  readonly sintoma: string;
  readonly patron: RegExp;
  readonly vale: (numeros: readonly number[]) => boolean;
  /**
   * Cuando el número dice lo contrario de la palabra.
   *
   * «Tengo 36 de temperatura» nombra la temperatura y niega la fiebre. Quien
   * escribe el número está siendo preciso a propósito, y contestarle con un
   * chip de fiebre es no haberlo leído.
   */
  readonly desmiente?: (numeros: readonly number[]) => boolean;
}[] = [
  {
    sintoma: 'fiebre',
    // La medición se escribe en los dos órdenes: «fiebre de 38.5» y «38.5 de
    // fiebre». La segunda rama es la que atrapa «tengo 36 de temperatura», que
    // es la forma de decir que fiebre no hay.
    patron:
      /(?:fiebre|temperatura|termometro|decimas?)[^.;!?]{0,20}?(\d{2}(?:[.,]\d)?)|(\d{2}(?:[.,]\d)?)\s*(?:grados|°|º|de (?:temperatura|fiebre))/,
    vale: ([grados]) => grados >= 37.4 && grados <= 43,
    desmiente: ([grados]) => grados >= 34 && grados < 37.4,
  },
  {
    sintoma: 'presion-alta',
    patron: /(?:presion|tension)[^.;!?]{0,20}?(\d{2,3})\s*(?:[/x-]|sobre)\s*(\d{1,3})/,
    vale: ([alta, baja]) =>
      (alta >= 140 && alta <= 260) || (alta >= 14 && alta <= 26 && baja <= 20) || baja >= 90,
  },
  {
    sintoma: 'azucar-alta',
    patron: /(?:azucar|glucosa|glicemia|glucemia)[^.;!?]{0,20}?(\d{2,3})/,
    vale: ([valor]) => valor >= 126,
  },
];

interface LoQueDicenLosNumeros {
  /** Lo que el número trae por sí solo. */
  readonly agrega: readonly Coincidencia[];
  /** Lo que el número **desmiente**, aunque la palabra esté escrita. */
  readonly quita: ReadonlySet<string>;
}

function porNumeros(normalizado: string, tabla: readonly Sintoma[]): LoQueDicenLosNumeros {
  const agrega: Coincidencia[] = [];
  const quita = new Set<string>();

  for (const regla of REGLAS_NUMERICAS) {
    const sintoma = tabla.find((fila) => fila.id === regla.sintoma);
    if (sintoma === undefined) {
      continue;
    }
    const hallazgo = regla.patron.exec(normalizado);
    if (hallazgo === null) {
      continue;
    }
    const numeros = hallazgo
      .slice(1)
      .filter((parte): parte is string => parte !== undefined)
      .map((parte) => Number.parseFloat(parte.replace(',', '.')));
    if (numeros.length === 0) {
      continue;
    }
    if (regla.desmiente?.(numeros) === true) {
      quita.add(sintoma.id);
      continue;
    }
    if (!regla.vale(numeros)) {
      continue;
    }
    agrega.push({
      sintoma,
      confianza: 1,
      desde: hallazgo.index,
      evidencia: hallazgo[0],
      negado: false,
    });
  }

  return { agrega, quita };
}

/* --- Autocompletado ------------------------------------------------------- */

/**
 * Qué síntomas empiezan como lo que se está escribiendo.
 *
 * Busca por el comienzo de **cualquier palabra** de cualquier sinónimo, no por
 * el comienzo de la frase entera: quien escribió «cabe» espera ver «dolor de
 * cabeza», y con la búsqueda vieja —que exigía que el sinónimo empezara con lo
 * tecleado— no lo veía nunca.
 *
 * Lo que empieza igual pesa más que lo que sólo suena parecido, y una falta de
 * ortografía todavía puntúa: quien escribe «caveza» también tiene que ver algo.
 */
export function sugerirDe(
  parcial: string,
  tabla: readonly Sintoma[],
  excluidos: ReadonlySet<string>,
  tope: number,
): readonly Sintoma[] {
  const texto = normalizar(parcial);
  if (texto.length < 3) {
    return [];
  }
  const buscadaClave = clave(lema(texto));

  const puntuados: { sintoma: Sintoma; puntaje: number }[] = [];
  for (const sintoma of tabla) {
    if (excluidos.has(sintoma.id) || sintoma.alarma === true) {
      continue;
    }
    let puntaje = 0;
    for (const frase of [sintoma.nombre, ...sintoma.sinonimos]) {
      // Coincidir en el **nombre** pesa más que coincidir en un sinónimo:
      // «cabe» tiene que traer «dolor de cabeza» antes que «fiebre», que
      // también nombra la cabeza en «me hierve la cabeza».
      const enElNombre = frase === sintoma.nombre ? 2 : 0;
      const normalizada = normalizar(frase);
      if (normalizada.startsWith(texto)) {
        puntaje = Math.max(puntaje, 4 + enElNombre);
        continue;
      }
      for (const palabra of normalizada.split(' ')) {
        if (palabra.startsWith(texto)) {
          puntaje = Math.max(puntaje, 3 + enElNombre);
        } else if (palabra.length >= 4 && clave(lema(palabra)) === buscadaClave) {
          puntaje = Math.max(puntaje, 2);
        } else if (texto.length >= 5 && palabra.length >= 5 && distancia(palabra, texto, 1) <= 1) {
          puntaje = Math.max(puntaje, 1);
        }
      }
    }
    if (puntaje > 0) {
      puntuados.push({ sintoma, puntaje });
    }
  }

  return puntuados
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, tope)
    .map((puntuado) => puntuado.sintoma);
}
