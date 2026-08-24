import { SINTOMAS, SINTOMAS_DE_ALARMA, type Sintoma } from './sintomas.datos';

export type { EspecialidadSugerida, Sintoma } from './sintomas.datos';
export { SINTOMAS, SINTOMAS_DE_ALARMA } from './sintomas.datos';

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
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
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
 * Reconoce síntomas dentro de un texto libre.
 *
 * ## Cómo decide
 *
 * Busca cada sinónimo **como subcadena del texto normalizado**. Es
 * deliberadamente simple: quien escribe «me duele la cabeza hace tres días»
 * contiene «dolor de cabeza»… no, no lo contiene — y por eso la tabla lleva
 * también «me duele la cabeza». Los sinónimos son la inteligencia de esto, no
 * el algoritmo.
 *
 * ## Por qué el orden de aparición y no el de la tabla
 *
 * Porque los chips se pintan mientras se escribe, y verlos aparecer en el orden
 * en que uno los escribió es lo que produce el efecto de «me está entendiendo».
 * Si saltaran de lugar al agregar el segundo síntoma, se leería como que la
 * pantalla cambió de opinión.
 *
 * @param texto - Lo que la persona escribió, tal cual.
 * @param tabla - La tabla contra la que se busca. Se inyecta para poder probar.
 * @returns Los síntomas reconocidos, sin repetir, en orden de aparición.
 */
export function reconocer(
  texto: string,
  tabla: readonly Sintoma[] = SINTOMAS,
): readonly Sintoma[] {
  const normalizado = normalizar(texto);
  if (normalizado === '') {
    return [];
  }

  const encontrados: { sintoma: Sintoma; donde: number }[] = [];
  for (const sintoma of tabla) {
    // La posición más temprana de cualquiera de sus sinónimos: un síntoma se
    // reconoce una sola vez aunque el texto lo nombre de tres maneras.
    let donde = -1;
    for (const sinonimo of sintoma.sinonimos) {
      const indice = normalizado.indexOf(sinonimo);
      if (indice !== -1 && (donde === -1 || indice < donde)) {
        donde = indice;
      }
    }
    if (donde !== -1) {
      encontrados.push({ sintoma, donde });
    }
  }

  return encontrados.sort((a, b) => a.donde - b.donde).map((e) => e.sintoma);
}

/** Los síntomas de alarma que aparecen en el texto. Vacío es lo normal. */
export function reconocerAlarmas(texto: string): readonly Sintoma[] {
  return reconocer(texto, SINTOMAS_DE_ALARMA);
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
      if (disponibles.size > 0 && !disponibles.has(normalizar(especialidad.nombre))) {
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
 * El «por qué» de una recomendación, dicho en una frase.
 *
 * «Por fiebre y dolor de garganta» — la conjunción va en castellano, no con
 * comas hasta el final, porque se lee dentro de un renglón de la pantalla.
 */
export function explicar(recomendacion: Recomendacion): string {
  const cuales = recomendacion.porque;
  if (cuales.length === 0) {
    return '';
  }
  if (cuales.length === 1) {
    return `Por ${cuales[0]}`;
  }
  return `Por ${cuales.slice(0, -1).join(', ')} y ${cuales[cuales.length - 1]}`;
}

/**
 * Sugerencias de autocompletado mientras se escribe.
 *
 * Busca por el **comienzo de cualquier sinónimo**, no por subcadena: quien
 * escribió «dol» espera ver «dolor de cabeza», no «me duele la cabeza» — y con
 * subcadena aparecerían las dos y la lista se volvería ruido.
 *
 * Los ya reconocidos no se sugieren: ya están puestos como chip.
 */
export function sugerir(
  parcial: string,
  yaPuestos: readonly Sintoma[],
  tope = 6,
): readonly Sintoma[] {
  const texto = normalizar(parcial);
  if (texto.length < 3) {
    return [];
  }
  const puestos = new Set(yaPuestos.map((s) => s.id));
  return SINTOMAS.filter(
    (sintoma) =>
      !puestos.has(sintoma.id) &&
      (normalizar(sintoma.nombre).startsWith(texto) ||
        sintoma.sinonimos.some((sinonimo) => sinonimo.startsWith(texto))),
  ).slice(0, tope);
}
