import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ATLAS_META,
  ETIQUETAS_DE_REGION,
  LAMINAS_ANATOMICAS,
  REGIONES_ANATOMICAS,
  TERMINOS_DE_LAMINA,
} from './anatomia-atlas';
import { CATEGORIAS, ETIQUETAS, TERMINOS } from './glosario';

/* ============================================================================
    El atlas anatómico del glosario sale de `data/anatomy-atlas/`, y esto
    impide que se separen.

    Además fija dos decisiones que no se leen en el código y que costaría
    revertir por accidente: que las 548 láminas llegan al glosario de verdad
    —no a una lista paralela que nadie mira— y que las 3 161 entidades del
    índice **no** llegan, porque sus etiquetas están mal cortadas.
    ========================================================================== */

const CORPUS = join(process.cwd(), 'data', 'anatomy-atlas');

describe('el atlas portado desde el corpus', () => {
  it('trae las láminas que declara su manifiesto', () => {
    const manifiesto = readFileSync(join(CORPUS, '00_MANIFEST.md'), 'utf8');
    const declaradas = Number(/Láminas:\s*(\d+)/.exec(manifiesto)?.[1]);

    expect(LAMINAS_ANATOMICAS).toHaveLength(declaradas);
    expect(ATLAS_META.plates).toBe(declaradas);
  });

  it('trae una región por archivo de región', () => {
    const archivos = readdirSync(join(CORPUS, '03_regiones')).filter((n) => n.endsWith('.md'));

    expect(REGIONES_ANATOMICAS).toHaveLength(archivos.length);
  });

  it('ningún título arrastra restos del escaneo', () => {
    // El defecto se vio en pantalla antes que acá: la lista mostraba «a
    // Dientes», «A Nariz», «d E Vértebras cervicales» y colas como «… visión
    // superior La». Son 146 de 548; esta prueba impide que vuelvan.
    for (const lamina of LAMINAS_ANATOMICAS) {
      expect(lamina.title).not.toBe('');
      // Una letra suelta al principio o al final nunca es parte del título.
      expect(lamina.title).not.toMatch(/^[A-Za-zÁÉÍÓÚáéíóúÑñ]\s/);
      expect(lamina.title).not.toMatch(/\s[A-Za-zÁÉÍÓÚáéíóúÑñ]$/);
      expect(lamina.title).not.toMatch(/\s(al|ES|EN|El|La|la|Ei|Es|en|el)$/);
      expect(lamina.title).not.toMatch(/^[/|·—-]/);
    }
  });

  it('no se come las abreviaturas anatómicas, que sí son parte del título', () => {
    // `Aa.`, `Nn.`, `Mm.` y `Vv.` son arterias, nervios, músculos y venas, y
    // abren decenas de láminas. Una regla que borre «token corto inicial» se
    // las lleva puestas y nadie lo nota hasta buscar «Nn. craneales».
    const titulos = LAMINAS_ANATOMICAS.map((l) => l.title);

    expect(titulos.filter((t) => /^(Aa\.|Nn\.|Mm\.|Vv\.)\s/.test(t)).length).toBeGreaterThan(5);
    // Y tampoco se come una sigla del final ni un título corto de verdad.
    expect(titulos.some((t) => /\bTC$/.test(t))).toBe(true);
    expect(titulos).toContain('Bazo');
  });

  it('ningún título queda ilegible', () => {
    // Las dos láminas cuyo encabezado el OCR no leyó se nombran por su bloque.
    for (const lamina of LAMINAS_ANATOMICAS) {
      expect(lamina.title).toMatch(/[A-Za-zÁÉÍÓÚáéíóúÑñ]{4,}/);
      expect(lamina.title).toMatch(/^[A-ZÁÉÍÓÚÑ0-9]/);
    }
  });

  it('cada lámina dice de dónde salió su título', () => {
    const origenes = ['gold_manual', 'gold_ocr_title', 'derived_from_toc'];

    for (const lamina of LAMINAS_ANATOMICAS) {
      expect(origenes).toContain(lamina.titleConfidence);
    }
  });

  it('el número de lámina es el identificador, no la página del PDF', () => {
    // El corpus corrigió esta ambigüedad a propósito: `PLATE_001` es canónico y
    // la página física es otro dato. Confundirlos rompe toda referencia.
    for (const lamina of LAMINAS_ANATOMICAS.slice(0, 50)) {
      expect(lamina.id).toBe(`PLATE_${String(lamina.plate).padStart(3, '0')}`);
      expect(lamina.pdfPage).not.toBe(lamina.plate);
    }
  });
});

describe('lo que el atlas NO trae, y no es un olvido', () => {
  it('no trae prosa sobre cómo entrenar una inteligencia artificial', () => {
    // Los archivos de origen mezclan la descripción anatómica con párrafos
    // dirigidos a quien entrena un modelo. Eso no se le muestra a un médico.
    const sospechosas = /entrenamiento de IA|para RAG|debe enseñar|modelo de IA/i;

    for (const lamina of LAMINAS_ANATOMICAS) {
      expect(lamina.regionalContext).not.toMatch(sospechosas);
    }
  });

  it('conserva la advertencia de qué no puede concluirse de una lámina', () => {
    // Es la mitad honesta del dato: un atlas dice dónde está algo, no qué hace.
    const conAdvertencia = LAMINAS_ANATOMICAS.filter((l) => l.doNotInfer !== '');

    expect(conAdvertencia.length).toBe(LAMINAS_ANATOMICAS.length);
  });
});

describe('las láminas dentro del glosario', () => {
  it('están todas, y en la categoría Anatomía', () => {
    const slugs = new Set(TERMINOS.map((t) => t.slug));

    expect(TERMINOS_DE_LAMINA).toHaveLength(LAMINAS_ANATOMICAS.length);
    for (const termino of TERMINOS_DE_LAMINA) {
      expect(slugs.has(termino.slug)).toBe(true);
      expect(termino.categoryKey).toBe('anatomy');
    }
  });

  it('la categoría Anatomía existía ya, no se inventó una', () => {
    expect(CATEGORIAS.some((c) => c.key === 'anatomy')).toBe(true);
  });

  it('cada región es una etiqueta con la que el glosario filtra', () => {
    const claves = new Set(ETIQUETAS.map((e) => e.key));

    expect(ETIQUETAS_DE_REGION).toHaveLength(REGIONES_ANATOMICAS.length);
    for (const etiqueta of ETIQUETAS_DE_REGION) {
      expect(claves.has(etiqueta.key)).toBe(true);
    }
  });

  it('ninguna lámina pisa el slug de un término curado', () => {
    // 69 términos escritos a mano y 548 generados en el mismo espacio de
    // nombres: una colisión haría desaparecer uno de los dos en silencio.
    const slugs = TERMINOS.map((t) => t.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('la ficha dice de dónde salió el título, en castellano', () => {
    for (const termino of TERMINOS_DE_LAMINA.slice(0, 40)) {
      expect(termino.plainSummaryEs).toMatch(/Procedencia del título: /);
      expect(termino.plainSummaryEs).toContain('Netter');
    }
  });
});
