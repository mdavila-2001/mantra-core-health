/* ============================================================================
    La cara pública del reconocimiento de síntomas.

    Lo que la pantalla llama. El trabajo está repartido en tres archivos y este
    es el único que hace falta conocer para usarlo:

    - `text.ts`  — cómo se lee el castellano escrito a las apuradas.
    - `engine.ts`  — cómo se cruza ese texto con la tabla.
    - `symptoms.data.ts` — la tabla, que es lo único que revisa el equipo
      médico.
    ========================================================================== */

import { analyze, suggestOf, type Analysis, type Match } from './engine';
import { SYMPTOMS, ALARM_SYMPTOMS, type Symptom } from './symptoms.data';
import { distance, normalizar } from './text';
import { GLOSARIO_DE_SINTOMAS } from './symptom-glossary.generated';

export type { SuggestedSpecialty as EspecialidadSugerida, Symptom as Sintoma } from './symptoms.data';
export type { Analysis as Analisis, Match as Coincidencia } from './engine';
export { SYMPTOMS as SINTOMAS, ALARM_SYMPTOMS as SINTOMAS_DE_ALARMA } from './symptoms.data';
export { normalizar } from './text';

/**
 * Las dos tablas juntas.
 *
 * El motor tiene que verlas a la vez o no puede decidir entre dos lecturas de
 * la misma frase: «vomité sangre» es una urgencia y también contiene un
 * vómito, y sólo mirando las dos listas al mismo tiempo se sabe que gana la
 * primera. Analizarlas por separado devolvía las dos cosas y la pantalla
 * mostraba un chip de vómito debajo del aviso de urgencias.
 */
export const SYMPTOMS_ALL: readonly Symptom[] = [...ALARM_SYMPTOMS, ...SYMPTOMS];

/**
 * El último análisis, guardado.
 *
 * La pantalla pide los síntomas y las alarmas por separado —son dos `computed`
 * distintos— y las dos preguntas se contestan con el mismo trabajo. Sin esta
 * memoria se analizaba el texto dos veces por tecla.
 */
let lastText: string | null = null;
let lastAnalysis: Analysis | null = null;

function completeAnalysis(texto: string): Analysis {
  if (lastText === texto && lastAnalysis !== null) {
    return lastAnalysis;
  }
  const analisis = analyze(texto, SYMPTOMS_ALL);
  lastText = texto;
  lastAnalysis = analisis;
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
export function preheat(): void {
  analyze('fiebre', SYMPTOMS_ALL);
}

/**
 * Una especialidad recomendada, con **por qué**.
 *
 * El «por qué» no es decoración: es lo que hace que la recomendación no se
 * sienta una caja negra, que es el síntoma 1 del plan de UX —«la aplicación no
 * se explica sola»— aplicado al lugar donde más importa.
 */
export interface Recommendation {
  readonly nombre: string;
  /** Suma de los pesos de los síntomas que la sostienen. Ordena la lista. */
  readonly peso: number;
  /** Los síntomas que la trajeron, en el orden en que se reconocieron. */
  readonly porque: readonly string[];
  /** Cuando no la trajo un síntoma sino la falta de certeza: qué decirle a la persona. */
  readonly motivo?: string;
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
const GENERALISTS: ReadonlySet<string> = new Set(['medicina general', 'medicina familiar']);

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
export function recognize(texto: string, tabla: readonly Symptom[] = SYMPTOMS): readonly Symptom[] {
  return matches(texto, tabla).map((coincidencia) => coincidencia.sintoma);
}

/** Lo mismo que {@link recognize}, sin tirar la confianza ni la evidencia. */
export function matches(
  texto: string,
  tabla: readonly Symptom[] = SYMPTOMS,
): readonly Match[] {
  const analisis =
    tabla === SYMPTOMS || tabla === ALARM_SYMPTOMS || tabla === SYMPTOMS_ALL
      ? completeAnalysis(texto)
      : analyze(texto, tabla);
  const cuales = new Set(tabla.map((sintoma) => sintoma.id));
  return [...analisis.sintomas, ...analisis.alarmas]
    .filter((coincidencia) => cuales.has(coincidencia.sintoma.id))
    .sort((a, b) => a.desde - b.desde);
}

/** Los síntomas de alarma que aparecen en el texto. Vacío es lo normal. */
export function recognizeAlarms(texto: string): readonly Symptom[] {
  return completeAnalysis(texto).alarmas.map((coincidencia) => coincidencia.sintoma);
}

/**
 * Los síntomas que el texto **nombró para negarlos**.
 *
 * «No tengo fiebre pero me duele la garganta» no reconoce fiebre, y eso está
 * bien; poder decir *por qué* no la reconoció es lo que evita que se lea como
 * que la pantalla no leyó.
 */
export function recognizeNegated(texto: string): readonly Symptom[] {
  return completeAnalysis(texto).negados.map((coincidencia) => coincidencia.sintoma);
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
 *   probar la ordenación aislada). Ver el porqué en `symptoms.data.ts`.
 */
export function recommend(
  sintomas: readonly Symptom[],
  disponibles: ReadonlySet<string> = new Set(),
): readonly Recommendation[] {
  const porNombre = new Map<string, { peso: number; porque: string[] }>();

  for (const sintoma of sintomas) {
    for (const especialidad of sintoma.especialidades) {
      if (disponibles.size > 0 && !isAvailable(especialidad.nombre, disponibles)) {
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
      const generalA = GENERALISTS.has(normalizar(a.nombre)) ? 1 : 0;
      const generalB = GENERALISTS.has(normalizar(b.nombre)) ? 1 : 0;
      if (generalA !== generalB) {
        return generalA - generalB;
      }
      return b.peso - a.peso || a.nombre.localeCompare(b.nombre, 'es');
    });
}

/** La especialidad a la que se manda cuando no hay certeza. */
export const MEDICINE_GENERAL = 'Medicina general';

/**
 * Por qué Medicina general va primero aunque el síntoma se haya reconocido con certeza (decisión del
 * propietario, 2026-10-08: «siempre que ponga de primero al médico de medicina general»).
 */
export const FIRST_GENERAL = 'Primero lo evalúa un médico general y, si hace falta, lo deriva al especialista.';

/**
 * Sin certeza, Medicina general **primero** (decisión del propietario, 2026-10-04: «cuando no
 * sepas a ciencia cierta, mandalo a medicina general»). Un médico general evalúa y deriva; un
 * especialista elegido a partir de una lectura dudosa puede ser el equivocado.
 *
 * Es la excepción a {@link GENERALISTS}, que la deja última cuando el síntoma SÍ se reconoció. Si
 * ya venía en la lista, se sube; si no, se agrega con su `motivo`. Si el directorio no la ofrece,
 * no se inventa: la lista queda como estaba.
 */
export function withMedicineFirstGeneral(
  recomendaciones: readonly Recommendation[],
  motivo: string,
  disponibles: ReadonlySet<string> = new Set(),
): readonly Recommendation[] {
  const existente = recomendaciones.find((r) => normalizar(r.nombre) === normalizar(MEDICINE_GENERAL));
  if (!existente && disponibles.size > 0 && !isAvailable(MEDICINE_GENERAL, disponibles)) {
    return recomendaciones;
  }
  const general: Recommendation = { ...(existente ?? { nombre: MEDICINE_GENERAL, peso: 0, porque: [] }), motivo };
  return [general, ...recomendaciones.filter((r) => r !== existente)];
}

/**
 * Busca en `disponibles` la clave que corresponde a `nombre`.
 *
 * No se compara con `=`. Los nombres del directorio son los que cada
 * profesional o cada catálogo escribió —«Otorrinolaringología y Cirugía de
 * Cabeza y Cuello», «Cardióloga»— y con igualdad exacta ninguno de los dos
 * coincidía con «Otorrinolaringología» ni con «Cardiología». El filtro que
 * existe para no mandar a un directorio vacío terminaba vaciando la
 * recomendación entera.
 *
 * La usan tanto `estaDisponible` (¿se recomienda?) como {@link conceptIdOf}
 * (¿a qué especialidad del directorio salto al tocarla?): antes cada una
 * tenía su propio criterio —uno tolerante, el otro exacto— y una especialidad
 * podía pasar el primero y fallar el segundo. El síntoma era «me recomienda
 * Traumatología pero al tocarla no me lleva a la lista de traumatólogos, me
 * deja en el directorio por categoría»: `verProfesionales` no encontraba el
 * `conceptId`, caía al buscador por texto (`q`), y esa ruta nunca pone el
 * parámetro `especialidad` que saca de la portada agrupada.
 */
function searchAvailableKey(
  nombre: string,
  disponibles: ReadonlySet<string>,
): string | undefined {
  const buscada = normalizar(nombre);
  if (disponibles.has(buscada)) {
    return buscada;
  }
  for (const ofrecida of disponibles) {
    if (ofrecida.length < 6) {
      continue;
    }
    if (ofrecida.includes(buscada) || buscada.includes(ofrecida)) {
      return ofrecida;
    }
    // «Cardióloga» y «Cardiología»: la misma especialidad dicha de dos maneras.
    if (distance(buscada, ofrecida, 2) <= 2) {
      return ofrecida;
    }
  }
  return undefined;
}

/** Si el directorio tiene a alguien de esta especialidad. Ver {@link searchAvailableKey}. */
function isAvailable(nombre: string, disponibles: ReadonlySet<string>): boolean {
  return searchAvailableKey(nombre, disponibles) !== undefined;
}

/**
 * El `conceptId` de una especialidad recomendada, con la misma tolerancia que
 * decidió recomendarla (ver {@link searchAvailableKey}).
 *
 * `undefined` cuando no hay coincidencia: quien llama cae al buscador por
 * texto, que es el destino que ya existía para una especialidad sin
 * identificador.
 */
export function conceptIdOf(
  nombre: string,
  disponibles: ReadonlyMap<string, string>,
): string | undefined {
  const clave = searchAvailableKey(nombre, new Set(disponibles.keys()));
  return clave === undefined ? undefined : disponibles.get(clave);
}

/**
 * El «por qué» de una recomendación, dicho en una frase.
 *
 * «Por fiebre y dolor de garganta» — la conjunción va en castellano, no con
 * comas hasta el final, porque se lee dentro de un renglón de la pantalla.
 */
export function explain(recomendacion: Recommendation): string {
  if (recomendacion.motivo) {
    return recomendacion.motivo;
  }
  const cuales = enumerate(recomendacion.porque);
  return cuales === '' ? '' : `Por ${cuales}`;
}

/**
 * Una lista dicha en castellano: «fiebre, tos y dolor de garganta».
 *
 * Con la conjunción al final y no con comas hasta el final, porque se lee
 * dentro de un renglón de la pantalla y no en una tabla.
 */
export function enumerate(cosas: readonly string[]): string {
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
export function suggest(
  parcial: string,
  yaPuestos: readonly Symptom[],
  tope = 6,
): readonly Symptom[] {
  return suggestOf(parcial, SYMPTOMS, new Set(yaPuestos.map((sintoma) => sintoma.id)), tope);
}

/**
 * Cómo se muestra un síntoma reconocido: con su término del **glosario médico oficial** (pedido del
 * propietario, 2026-10-08) y, si se llama distinto, la forma llana entre paréntesis — «Hematospermia
 * (sangre en el semen)» —, porque quien escribió «eyaculo sangre» tiene que reconocer lo que dijo.
 * Sin término exacto en el glosario (o en los sensibles, que no lo tienen a propósito) queda el
 * nombre del catálogo. El mapa sale de `scripts/export-symptom-glossary.mjs` del AI service.
 */
export function nameForShow(sintoma: Pick<Symptom, 'id' | 'nombre'>): string {
  const termino = GLOSARIO_DE_SINTOMAS[sintoma.id];
  if (!termino) {
    return sintoma.nombre;
  }
  return normalizar(termino.name) === normalizar(sintoma.nombre) ? termino.name : `${termino.name} (${sintoma.nombre})`;
}

/** El código del término del glosario (CIE-10-ES, MedlinePlus…), para el lector y el tooltip. */
export function glossaryCode(id: string): string | null {
  const termino = GLOSARIO_DE_SINTOMAS[id];
  return termino?.code ? `${termino.system === 'cie10es' ? 'CIE-10' : (termino.system ?? '')} ${termino.code}`.trim() : null;
}
