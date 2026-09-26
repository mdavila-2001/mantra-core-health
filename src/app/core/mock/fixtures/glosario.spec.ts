import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CATEGORIAS,
  TERMINOS,
  categoriaDeTermino,
  conjuntoEnLinea,
  fichaEnLinea,
  terminoEnLinea,
  terminoPorSlug,
  type ConceptoDeGlosario,
} from './glosario';
import { CONTEO_DE_CAPAS, TERMINOS_DE_GLOSARIO } from './glosario.generated';

/* ============================================================================
    El glosario generado sale del seed del backend y de `data/glossary/`, y
    esto impide que se separen.

    Fija además lo que el servicio de IA da por sentado cuando copia el archivo
    (`catalog:sync`): que todo `symptomId` existe en el motor de síntomas, que
    toda relación resuelve y que ningún término en inglés trae una definición
    —porque no hay fuente para ella y no se fabrica.
    ========================================================================== */

const CORPUS = join(process.cwd(), 'data', 'glossary');
const CAPAS = [
  'enfermedades-atencion-primaria.ndjson',
  'analisis-frecuentes.ndjson',
  'cie10cm-categorias.generated.ndjson',
] as const;

function slugsDelArchivo(archivo: string): readonly string[] {
  return readFileSync(join(CORPUS, archivo), 'utf8')
    .split(/\r?\n/)
    .filter((linea) => linea.trim() !== '')
    .map((linea) => (JSON.parse(linea) as { slug: string }).slug);
}

/** Los curados van primero en el archivo generado, en el orden del catálogo. */
const CURADOS = new Set(
  TERMINOS_DE_GLOSARIO.slice(0, CONTEO_DE_CAPAS['curados']).map((t) => t.slug),
);
/* Se leen del archivo fuente, como hace `check-glossary-corpus.mjs`: core/ no
   importa de features/ (regla de arquitectura). */
const IDS_DE_SINTOMAS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), 'src', 'app', 'features', 'symptom-check', 'sintomas.datos.ts'),
      'utf8',
    ).matchAll(/^\s*id: '([^']+)'/gm),
  ].map((m) => m[1]),
);

const termino = (slug: string): ConceptoDeGlosario => {
  const encontrado = terminoPorSlug(slug);
  if (encontrado === undefined) throw new Error(`no existe el término «${slug}»`);
  return encontrado;
};

describe('el glosario generado desde el seed y las capas', () => {
  it('trae los curados más cada capa, y los conteos cuadran con el corpus', () => {
    expect(CONTEO_DE_CAPAS['curados']).toBeGreaterThanOrEqual(69);
    expect(CONTEO_DE_CAPAS['enfermedades-atencion-primaria.ndjson']).toBeGreaterThanOrEqual(120);
    expect(CONTEO_DE_CAPAS['analisis-frecuentes.ndjson']).toBeGreaterThanOrEqual(80);
    expect(CONTEO_DE_CAPAS['cie10cm-categorias.generated.ndjson']).toBe(1918);

    // Una fila que enriquece a un curado no es un término nuevo.
    for (const archivo of CAPAS) {
      const nuevas = slugsDelArchivo(archivo).filter((slug) => !CURADOS.has(slug)).length;
      expect(CONTEO_DE_CAPAS[archivo]).toBe(nuevas);
    }
    const total = Object.values(CONTEO_DE_CAPAS).reduce((suma, n) => suma + n, 0);
    expect(TERMINOS_DE_GLOSARIO).toHaveLength(total);
  });

  it('ningún slug se repite, ni entre capas ni con el atlas', () => {
    const slugs = TERMINOS.map((t) => t.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('todo término tiene una categoría de la taxonomía', () => {
    const claves = new Set(CATEGORIAS.map((c) => c.key));

    for (const t of TERMINOS) {
      expect(claves.has(t.categoryKey)).toBe(true);
      expect(() => categoriaDeTermino(t)).not.toThrow();
    }
  });

  it('todo symptomId existe en la tabla del motor de síntomas', () => {
    // Es el puente que usa el servicio de IA para pasar de síntomas a
    // enfermedades: un id inventado sería una relación muerta.
    const conSintomas = TERMINOS_DE_GLOSARIO.filter((t) => (t.symptomIds?.length ?? 0) > 0);

    expect(conSintomas.length).toBeGreaterThanOrEqual(120);
    for (const t of conSintomas) {
      for (const id of t.symptomIds ?? []) {
        expect(IDS_DE_SINTOMAS.has(id)).toBe(true);
      }
    }
  });

  it('toda relación resuelve a un término existente', () => {
    for (const t of TERMINOS_DE_GLOSARIO) {
      for (const relacion of t.relations) {
        expect(terminoPorSlug(relacion.targetSlug)).toBeDefined();
      }
    }
  });

  it('ningún término en inglés trae definición ni resumen: no hay fuente para ellos', () => {
    const enIngles = TERMINOS_DE_GLOSARIO.filter((t) => t.lang === 'en');

    expect(enIngles.length).toBe(CONTEO_DE_CAPAS['cie10cm-categorias.generated.ndjson']);
    for (const t of enIngles) {
      expect(t.clinicalDefinitionEs).toBe('');
      expect(t.plainSummaryEs).toBe('');
      expect(t.externalCode?.system).toBe('icd10cm');
    }
  });

  it('la categoría Enfermedades pasa de 6 términos a cientos', () => {
    const enfermedades = CATEGORIAS.find((c) => c.key === 'disease');

    expect(enfermedades).toBeDefined();
    expect(conjuntoEnLinea(enfermedades!).memberCount).toBeGreaterThan(2000);
  });
});

describe('cómo viaja un término de las capas', () => {
  it('una enfermedad nueva en castellano va traducida, con definición, código y marca de revisión', () => {
    const diabetes = termino('diabetes-mellitus-tipo-1');
    const entrada = terminoEnLinea(diabetes);
    const ficha = fichaEnLinea(diabetes);

    expect(CURADOS.has('diabetes-mellitus-tipo-1')).toBe(false);
    expect(entrada.translated).toBe(true);
    expect(entrada.shortDefinition).not.toBe('');
    expect(ficha.clinicalDefinition.text).not.toBe('');
    expect(ficha.properties['external_code']).toBe('E10.9');
    expect(ficha.properties['code_system']).toBe('icd10cm');
    expect(ficha.properties['review_status']).toBe('pending-medical-review');
    expect(ficha.synonyms.some((s) => s.language === 'EN')).toBe(true);
  });

  it('neumonía lleva los síntomas del motor y la radiografía de tórax como prueba', () => {
    // Es el caso que el servicio de IA usa como prueba de aceptación
    // (fiebre + tos + dolor de pecho → neumonía con radiografía de tórax).
    const ficha = fichaEnLinea(termino('neumonia'));

    expect(ficha.properties['external_code']).toBe('J18.9');
    expect(ficha.properties['symptom_ids']).toEqual(
      expect.arrayContaining(['fiebre', 'tos', 'dolor-de-pecho']),
    );
    expect(ficha.relations.map((r) => r.slug)).toContain('radiografia-de-torax');
  });

  it('un análisis lleva su categoría de orden y su LOINC', () => {
    const ficha = fichaEnLinea(termino('radiografia-de-torax'));

    expect(ficha.properties['analysis_category']).toBe('IMAGING');
    expect(ficha.properties['code_system']).toBe('loinc');
    expect(typeof ficha.properties['external_code']).toBe('string');
  });

  it('una categoría ICD-10-CM va sin traducir y sin inventarle definición', () => {
    const colera = termino('icd10cm-a00');
    const entrada = terminoEnLinea(colera);
    const ficha = fichaEnLinea(colera);

    expect(entrada.translated).toBe(false);
    expect(entrada.display).toBe('Cholera');
    expect(entrada.shortDefinition).toBe('');
    expect(ficha.translated).toBe(false);
    expect(ficha.clinicalDefinition.text).toContain('Sin definición cargada');
    expect(ficha.clinicalDefinition.text).toContain('A00');
    expect(ficha.plainSummary.text).toContain('Cholera');
    // El nombre ya es el inglés: no se repite como sinónimo.
    expect(ficha.synonyms.some((s) => s.language === 'EN')).toBe(false);
    expect(ficha.properties['lang']).toBe('en');
    expect(ficha.properties['review_status']).toBe('external-source');
  });

  it('un curado enriquecido conserva su texto revisado y gana el código externo', () => {
    // `asma-bronquial` existe en el seed; la capa de enfermedades le suma el
    // ICD-10-CM y los síntomas del motor, nunca la definición.
    const asma = termino('asma-bronquial');
    const ficha = fichaEnLinea(asma);

    expect(CURADOS.has('asma-bronquial')).toBe(true);
    expect(ficha.properties['external_code']).toBe('J45.909');
    expect(ficha.properties['symptom_ids']).toContain('asma');
    expect(ficha.properties['review_status']).toBeUndefined();
    expect(ficha.clinicalDefinition.text.length).toBeGreaterThan(40);
  });
});
