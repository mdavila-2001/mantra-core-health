import { uuid } from '../mock-store';
import {
  DEFINICIONES_DE_TIPO,
  ENTRADAS_ANATOMICAS,
  LAMINAS_ANATOMICAS,
  NOTAS_CLINICAS_ANATOMICAS,
  REGIONES_ANATOMICAS,
  SUBREGIONES_ANATOMICAS,
  type EntradaAnatomica,
} from './anatomia.generated';
import { CATEGORIAS, PARAGUAS, type ConjuntoDeGlosario } from './glosario';

/* ============================================================================
    La taxonomía de Netter, con la forma con la que el glosario sale por la API.

    Indexa `anatomia.generated.ts` —8 regiones, 65 subregiones, 548 láminas y
    3 161 entradas del índice— y la publica como miembros de la categoría
    «Anatomía», que ya existía en la grilla con tres términos curados.

    ## Por qué no se mezclan con el catálogo curado

    `glosario.ts` sirve 69 términos escritos por alguien: bilingües, con
    definición clínica y resumen llano. Una entrada del índice de Netter tiene
    nombre, tipo y láminas. Son dos cosas distintas y se mantienen separadas;
    lo único que comparten es el conjunto de valores por el que se las busca.

    ## La regla que gobierna este archivo

    El corpus **no publica una definición por entrada**: publica una por tipo.
    Así que el texto que viaja como definición se rotula a sí mismo —«Qué es un
    músculo», y la aclaración de que no es la definición de *ese* músculo—.
    Ninguna pantalla puede mostrarlo como si fuera otra cosa, ni aunque cambie.

    Nada de lo que el Atlas no dice se completa acá: no hay origen, inserción,
    inervación, irrigación, función ni patología.
    ========================================================================== */

/** La categoría «Anatomía», que ya estaba en la grilla del glosario. */
const CATEGORIA_ANATOMIA: ConjuntoDeGlosario = (() => {
  const categoria = CATEGORIAS.find((c) => c.key === 'anatomy');
  if (categoria === undefined) {
    throw new Error('El glosario no declara la categoría «anatomy».');
  }
  return categoria;
})();

const prosaPorTipo = new Map(DEFINICIONES_DE_TIPO.map((d) => [d.type, d.definition]));
const notaClinicaPorLamina = new Map(NOTAS_CLINICAS_ANATOMICAS.map((n) => [n.plate, n]));
const laminaPorNumero = new Map(LAMINAS_ANATOMICAS.map((l) => [l.plate, l]));

/** El nombre legible de un tipo: `conducto_canal` → «conducto canal». */
function tipoLegible(tipo: string): string {
  return tipo.replace(/_/g, ' ');
}

/** Una entrada del índice, ya con su identidad derivada. */
export interface ConceptoAnatomico extends EntradaAnatomica {
  readonly id: string;
  /** `NETTER_<id de la entrada>` — no colisiona con los `GLOSSARY_*` curados. */
  readonly code: string;
}

export const ENTRADAS: readonly ConceptoAnatomico[] = ENTRADAS_ANATOMICAS.map((entrada) => ({
  ...entrada,
  id: uuid(`concept-anatomy-${entrada.slug}`),
  code: `NETTER_${entrada.id.toUpperCase()}`,
})).sort((a, b) => a.name.localeCompare(b.name, 'es'));

const porId = new Map(ENTRADAS.map((e) => [e.id, e]));
const porSlug = new Map(ENTRADAS.map((e) => [e.slug, e]));

/** Una entrada anatómica por su identificador de concepto, o `undefined`. */
export function entradaPorId(id: string): ConceptoAnatomico | undefined {
  return porId.get(id);
}

/** Una entrada anatómica por su slug, o `undefined`. */
export function entradaPorSlug(slug: string): ConceptoAnatomico | undefined {
  return porSlug.get(slug);
}

/** Si un conjunto de valores es el que contiene las entradas anatómicas. */
export function esConjuntoConAnatomia(conjunto: ConjuntoDeGlosario): boolean {
  return (
    conjunto.internalCode === PARAGUAS.internalCode ||
    conjunto.internalCode === CATEGORIA_ANATOMIA.internalCode
  );
}

/**
 * Dónde está la entrada, dicho con los datos que el Atlas sí publica.
 *
 * Es la línea que acompaña al nombre en el listado. No afirma nada sobre la
 * estructura: enumera su tipo, su bloque editorial y las láminas del índice.
 */
function ubicacionDe(entrada: ConceptoAnatomico): string {
  const partes = [tipoLegible(entrada.type)];
  if (entrada.region !== null) {
    partes.push(entrada.subregion === null
      ? entrada.region
      : `${entrada.region} › ${entrada.subregion}`);
  }
  if (entrada.plates.length > 0) {
    partes.push(entrada.plates.length === 1
      ? `lámina ${entrada.plates[0]}`
      : `láminas ${entrada.plates.join(', ')}`);
  }
  return partes.join(' · ');
}

/**
 * La prosa del tipo, rotulada como lo que es.
 *
 * El rótulo va **dentro** del texto y no en la plantilla a propósito: así
 * ninguna pantalla —ni una futura— puede presentarlo como la definición de esta
 * estructura en particular. El corpus no la tiene.
 */
function definicionDeTipo(entrada: ConceptoAnatomico): string {
  const prosa = prosaPorTipo.get(entrada.type);
  const nombre = tipoLegible(entrada.type);
  if (prosa === undefined) {
    return `El índice del Atlas clasifica esta entrada como «${nombre}».`;
  }
  return (
    `Qué es un «${nombre}»: ${prosa} — Esta descripción es del tipo de estructura, ` +
    `no de «${entrada.name}» en particular: el índice del Atlas no publica una ` +
    `definición por entrada.`
  );
}

/** De dónde salió el nombre, y con cuánto acuerdo entre las dos pasadas de OCR. */
function procedenciaDe(entrada: ConceptoAnatomico): string {
  const acuerdo = {
    consensus_high: 'Dos extracciones OCR independientes coinciden en el término y sus láminas.',
    consensus_medium: 'Las dos extracciones OCR difieren: el término está pendiente de revisión.',
    new_ocr_only: 'Sólo una extracción OCR reconoció este término.',
  }[entrada.confidence] ?? 'Nivel de acuerdo no declarado.';
  return (
    `${acuerdo} La forma se conserva tal como aparece en el índice del Atlas, sin ` +
    `corregir: normalizarla contra Terminologia Anatomica (FIPAT) exige cotejarla ` +
    `con la lámina original. Ningún nivel equivale a revisión humana término por término.`
  );
}

/** Las láminas de una entrada, con su título y la nota clínica si la hubiera. */
function laminasDe(entrada: ConceptoAnatomico) {
  return entrada.plates.flatMap((numero) => {
    const lamina = laminaPorNumero.get(numero);
    if (lamina === undefined) return [];
    const clinica = notaClinicaPorLamina.get(numero);
    return [{
      plate: numero,
      title: lamina.title,
      ...(clinica === undefined ? {} : { clinicalTitle: clinica.title }),
    }];
  });
}

/* ---- las dos formas con las que la anatomía viaja por la API -------------- */

/** Una entrada anatómica como la devuelve la búsqueda de términos. */
export function entradaEnLinea(entrada: ConceptoAnatomico) {
  return {
    conceptId: entrada.id,
    code: entrada.code,
    display: entrada.name,
    slug: entrada.slug,
    // El Atlas del que sale este índice es la edición en castellano.
    translated: true,
    category: {
      internalCode: CATEGORIA_ANATOMIA.internalCode,
      name: CATEGORIA_ANATOMIA.name,
    },
    shortDefinition: ubicacionDe(entrada),
    tags: [] as readonly string[],
    relationsCount: 0,
    status: 'active' as const,
    valueSets: [PARAGUAS, CATEGORIA_ANATOMIA].map((conjunto) => ({
      id: conjunto.id,
      internalCode: conjunto.internalCode,
      name: conjunto.name,
    })),
  };
}

/** La ficha completa de una entrada anatómica. */
export function fichaAnatomicaEnLinea(entrada: ConceptoAnatomico) {
  const referencia = (conjunto: ConjuntoDeGlosario) => ({
    valueSetId: conjunto.id,
    internalCode: conjunto.internalCode,
    name: conjunto.name,
  });

  return {
    conceptId: entrada.id,
    code: entrada.code,
    display: entrada.name,
    slug: entrada.slug,
    translated: true,
    valueSets: [PARAGUAS, CATEGORIA_ANATOMIA].map((conjunto) => ({
      id: conjunto.id,
      internalCode: conjunto.internalCode,
      name: conjunto.name,
    })),
    // El índice no publica sinónimos: publica formas fuente. No se inventan.
    synonyms: [] as readonly { value: string; language: string; preferred: boolean }[],
    category: referencia(CATEGORIA_ANATOMIA),
    tags: [] as readonly ReturnType<typeof referencia>[],
    clinicalDefinition: { text: definicionDeTipo(entrada), translated: true },
    plainSummary: { text: ubicacionDe(entrada), translated: true },
    // El corpus prohíbe inferir relaciones entre estructuras: que dos términos
    // compartan lámina es representación, no causalidad.
    relations: [] as readonly { type: string; conceptId: string; slug: string; display: string }[],
    properties: {
      source_form: entrada.name,
      structure_type: tipoLegible(entrada.type),
      ...(entrada.region === null ? {} : { region: entrada.region }),
      ...(entrada.subregion === null ? {} : { subregion: entrada.subregion }),
      plates: laminasDe(entrada),
      provenance: procedenciaDe(entrada),
    },
  };
}

/** Una entrada coincide por nombre, tipo, región o código. */
export function coincideAnatomia(entrada: ConceptoAnatomico, q: string | null): boolean {
  if (q === null || q === '') return true;
  const aguja = q.toLocaleLowerCase('es');
  return (
    entrada.name.toLocaleLowerCase('es').includes(aguja) ||
    tipoLegible(entrada.type).includes(aguja) ||
    (entrada.region ?? '').toLocaleLowerCase('es').includes(aguja) ||
    (entrada.subregion ?? '').toLocaleLowerCase('es').includes(aguja) ||
    entrada.code.toLocaleLowerCase('es').includes(aguja)
  );
}

/** Las regiones y subregiones, para quien quiera navegar la taxonomía. */
export const TAXONOMIA_ANATOMICA = {
  regions: REGIONES_ANATOMICAS,
  subregions: SUBREGIONES_ANATOMICAS,
} as const;
