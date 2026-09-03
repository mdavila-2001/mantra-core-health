/* ============================================================================
    La cara pública del reconocimiento de síntomas.

    Lo que la pantalla llama. El trabajo está repartido en tres archivos y este
    es el único que hace falta conocer para usarlo:

    - `texto.ts`  — cómo se lee el castellano escrito a las apuradas.
    - `motor.ts`  — cómo se cruza ese texto con la tabla.
    - `sintomas.datos.ts` — la tabla, que es lo único que revisa el equipo
      médico.
    ========================================================================== */

import { analizar, sugerirDe, type Analisis, type Coincidencia } from './motor';
import { SINTOMAS, SINTOMAS_DE_ALARMA, type Sintoma } from './sintomas.datos';
import { distancia, normalizar } from './texto';

export type { EspecialidadSugerida, Sintoma } from './sintomas.datos';
export type { Analisis, Coincidencia } from './motor';
export { SINTOMAS, SINTOMAS_DE_ALARMA } from './sintomas.datos';
export { normalizar } from './texto';

/**
 * Las dos tablas juntas.
 *
 * El motor tiene que verlas a la vez o no puede decidir entre dos lecturas de
 * la misma frase: «vomité sangre» es una urgencia y también contiene un
 * vómito, y sólo mirando las dos listas al mismo tiempo se sabe que gana la
 * primera. Analizarlas por separado devolvía las dos cosas y la pantalla
 * mostraba un chip de vómito debajo del aviso de urgencias.
 */
export const TODOS_LOS_SINTOMAS: readonly Sintoma[] = [...SINTOMAS_DE_ALARMA, ...SINTOMAS];

/**
 * El último análisis, guardado.
 *
 * La pantalla pide los síntomas y las alarmas por separado —son dos `computed`
 * distintos— y las dos preguntas se contestan con el mismo trabajo. Sin esta
 * memoria se analizaba el texto dos veces por tecla.
 */
let ultimoTexto: string | null = null;
let ultimoAnalisis: Analisis | null = null;

function analisisCompleto(texto: string): Analisis {
  if (ultimoTexto === texto && ultimoAnalisis !== null) {
    return ultimoAnalisis;
  }
  const analisis = analizar(texto, TODOS_LOS_SINTOMAS);
  ultimoTexto = texto;
  ultimoAnalisis = analisis;
  return analisis;
}

/**
 * Deja el motor listo antes de que haga falta.
 *
 * Armar el índice —seiscientos patrones sacados de la tabla— cuesta unas
 * decenas de milisegundos, y se hace la primera vez que alguien lo usa. Si esa
 * primera vez es la primera tecla, se siente. Llamando a esto cuando la
 * pantalla ya está pintada, no se siente nunca.
 */
export function precalentar(): void {
  analizar('fiebre', TODOS_LOS_SINTOMAS);
}

/**
 * Una especialidad recomendada, con **por qué**.
 *
 * El «por qué» no es decoración: es lo que hace que la recomendación no se
 * sienta una caja negra, que es el síntoma 1 del plan de UX —«la aplicación no
 * se explica sola»— aplicado al lugar donde más importa.
 */
export interface Recomendacion {
  readonly nombre: string;
  /** Suma de los pesos de los síntomas que la sostienen. Ordena la lista. */
  readonly peso: number;
  /** Los síntomas que la trajeron, en el orden en que se reconocieron. */
  readonly porque: readonly string[];
}

/**
 * Las especialidades **generalistas**: siempre correctas y casi nunca la
 * respuesta que alguien vino a buscar.
 *
 * Ordenando sólo por peso, «Medicina general» encabezaba casi toda la lista —y
 * con razón clínica: aparece en la mitad de las filas de la tabla porque casi
 * cualquier cosa se puede empezar por ahí—. El problema es de producto, no de
 * medicina: una pantalla que a todo el mundo le contesta «andá a un médico
 * general» no orienta a nadie, que es exactamente lo que este flujo vino a
 * hacer.
 *
 * Así que **van al final, no se sacan**. Cuando la tabla no encuentra ninguna
 * especialidad específica —«tengo fiebre» a secas— la generalista queda
 * primera porque es la única, y ahí sí es la respuesta correcta.
 */
const GENERALISTAS: ReadonlySet<string> = new Set(['medicina general', 'medicina familiar']);

/**
 * Reconoce síntomas dentro de un texto libre.
 *
 * Devuelve lo reconocido **en orden de aparición**, sin repetir y sin lo que el
 * texto niega. El orden es el de aparición y no el de la tabla porque los chips
 * se pintan mientras se escribe: verlos aparecer en el orden en que uno los
 * escribió es lo que produce el efecto de «me está entendiendo», y si saltaran
 * de lugar al agregar el segundo síntoma se leería como que la pantalla cambió
 * de opinión.
 *
 * @param texto - Lo que la persona escribió, tal cual.
 * @param tabla - La tabla contra la que se busca. Se inyecta para poder probar.
 */
export function reconocer(texto: string, tabla: readonly Sintoma[] = SINTOMAS): readonly Sintoma[] {
  return coincidencias(texto, tabla).map((coincidencia) => coincidencia.sintoma);
}

/** Lo mismo que {@link reconocer}, sin tirar la confianza ni la evidencia. */
export function coincidencias(
  texto: string,
  tabla: readonly Sintoma[] = SINTOMAS,
): readonly Coincidencia[] {
  const analisis =
    tabla === SINTOMAS || tabla === SINTOMAS_DE_ALARMA || tabla === TODOS_LOS_SINTOMAS
      ? analisisCompleto(texto)
      : analizar(texto, tabla);
  const cuales = new Set(tabla.map((sintoma) => sintoma.id));
  return [...analisis.sintomas, ...analisis.alarmas]
    .filter((coincidencia) => cuales.has(coincidencia.sintoma.id))
    .sort((a, b) => a.desde - b.desde);
}

/** Los síntomas de alarma que aparecen en el texto. Vacío es lo normal. */
export function reconocerAlarmas(texto: string): readonly Sintoma[] {
  return analisisCompleto(texto).alarmas.map((coincidencia) => coincidencia.sintoma);
}

/**
 * Los síntomas que el texto **nombró para negarlos**.
 *
 * «No tengo fiebre pero me duele la garganta» no reconoce fiebre, y eso está
 * bien; poder decir *por qué* no la reconoció es lo que evita que se lea como
 * que la pantalla no leyó.
 */
export function reconocerNegados(texto: string): readonly Sintoma[] {
  return analisisCompleto(texto).negados.map((coincidencia) => coincidencia.sintoma);
}

/**
 * Ordena las especialidades que sugieren los síntomas reconocidos.
 *
 * ## Por qué suma pesos en vez de contar síntomas
 *
 * Porque un síntoma puede apuntar fuerte a una especialidad y de refilón a
 * otra. Contando síntomas, «fiebre + dolor de garganta» empataría
 * otorrinolaringología con medicina general; con pesos gana la primera, que es
 * la respuesta que alguien espera.
 *
 * Los empates se rompen alfabéticamente y no por el orden de la tabla: así el
 * resultado es estable entre cargas y entre revisiones del dato.
 *
 * @param sintomas - Los reconocidos, en orden de aparición.
 * @param disponibles - Las especialidades que **de verdad** tienen
 *   profesionales publicados, normalizadas. Vacío = no se filtra (sirve para
 *   probar la ordenación aislada). Ver el porqué en `sintomas.datos.ts`.
 */
export function recomendar(
  sintomas: readonly Sintoma[],
  disponibles: ReadonlySet<string> = new Set(),
): readonly Recomendacion[] {
  const porNombre = new Map<string, { peso: number; porque: string[] }>();

  for (const sintoma of sintomas) {
    for (const especialidad of sintoma.especialidades) {
      if (disponibles.size > 0 && !estaDisponible(especialidad.nombre, disponibles)) {
        // Una especialidad que la plataforma no ofrece no se recomienda: el
        // camino terminaría en un directorio vacío.
        continue;
      }
      const previo = porNombre.get(especialidad.nombre) ?? { peso: 0, porque: [] };
      previo.peso += especialidad.peso;
      previo.porque.push(sintoma.nombre);
      porNombre.set(especialidad.nombre, previo);
    }
  }

  return [...porNombre.entries()]
    .map(([nombre, datos]) => ({ nombre, peso: datos.peso, porque: datos.porque }))
    .sort((a, b) => {
      // La generalista va última aunque sume más. Ver {@link GENERALISTAS}.
      const generalA = GENERALISTAS.has(normalizar(a.nombre)) ? 1 : 0;
      const generalB = GENERALISTAS.has(normalizar(b.nombre)) ? 1 : 0;
      if (generalA !== generalB) {
        return generalA - generalB;
      }
      return b.peso - a.peso || a.nombre.localeCompare(b.nombre, 'es');
    });
}

/**
 * Si el directorio tiene a alguien de esta especialidad.
 *
 * No se compara con `=`. Los nombres del directorio son los que cada
 * profesional o cada catálogo escribió —«Otorrinolaringología y Cirugía de
 * Cabeza y Cuello», «Cardióloga»— y con igualdad exacta ninguno de los dos
 * coincidía con «Otorrinolaringología» ni con «Cardiología». El filtro que
 * existe para no mandar a un directorio vacío terminaba vaciando la
 * recomendación entera.
 */
function estaDisponible(nombre: string, disponibles: ReadonlySet<string>): boolean {
  const buscada = normalizar(nombre);
  if (disponibles.has(buscada)) {
    return true;
  }
  for (const ofrecida of disponibles) {
    if (ofrecida.length < 6) {
      continue;
    }
    if (ofrecida.includes(buscada) || buscada.includes(ofrecida)) {
      return true;
    }
    // «Cardióloga» y «Cardiología»: la misma especialidad dicha de dos maneras.
    if (distancia(buscada, ofrecida, 2) <= 2) {
      return true;
    }
  }
  return false;
}

/**
 * El «por qué» de una recomendación, dicho en una frase.
 *
 * «Por fiebre y dolor de garganta» — la conjunción va en castellano, no con
 * comas hasta el final, porque se lee dentro de un renglón de la pantalla.
 */
export function explicar(recomendacion: Recomendacion): string {
  const cuales = enumerar(recomendacion.porque);
  return cuales === '' ? '' : `Por ${cuales}`;
}

/**
 * Una lista dicha en castellano: «fiebre, tos y dolor de garganta».
 *
 * Con la conjunción al final y no con comas hasta el final, porque se lee
 * dentro de un renglón de la pantalla y no en una tabla.
 */
export function enumerar(cosas: readonly string[]): string {
  if (cosas.length === 0) {
    return '';
  }
  if (cosas.length === 1) {
    return cosas[0];
  }
  return `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`;
}

/**
 * Sugerencias de autocompletado mientras se escribe.
 *
 * Los ya reconocidos no se sugieren: ya están puestos como chip. El resto lo
 * decide `sugerirDe`, que busca por el comienzo de cualquier palabra y no sólo
 * por el comienzo de la frase.
 */
export function sugerir(
  parcial: string,
  yaPuestos: readonly Sintoma[],
  tope = 6,
): readonly Sintoma[] {
  return sugerirDe(parcial, SINTOMAS, new Set(yaPuestos.map((sintoma) => sintoma.id)), tope);
}
