import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Los artículos importados de Wikipedia en español (`scripts/glossary-ingest-wikipedia.mjs`).
 *
 * Es texto ajeno publicado bajo CC BY-SA 4.0: sin su procedencia completa no
 * se puede mostrar. Estas pruebas leen **la semilla commiteada** —lo mismo que
 * baja el navegador— y fallan si algún artículo importado pierde la fuente, el
 * enlace a la revisión, la licencia o la fecha, o si trae restos de wikitexto.
 */
const CARPETA = join(process.cwd(), 'public', 'glossary-seed', 'mock', 'articles');

interface Seccion {
  readonly kind: string;
  readonly text: string;
  readonly source?: string;
  readonly sourceUrl?: string;
  readonly license?: string;
  readonly retrievedAt?: string;
  readonly sourceVersion?: string;
  readonly locator?: string;
}
interface Articulo {
  readonly conceptRef: { readonly slug: string };
  readonly sections: readonly Seccion[];
  readonly references: readonly { readonly url: string; readonly source: string }[];
}

function importados(): readonly Articulo[] {
  return readdirSync(CARPETA).flatMap((archivo) =>
    Object.values(
      JSON.parse(readFileSync(join(CARPETA, archivo), 'utf8')) as Record<string, Articulo>,
    ).filter((a) => a.sections.some((s) => s.source === 'Wikipedia en español')),
  );
}

/** Espacios de ancho cero y marca de orden de bytes, armados por código para no escribirlos literales. */
const CARACTERES_INVISIBLES = new RegExp(
  [0x200b, 0x200c, 0x200d, 0xfeff].map((c) => String.fromCharCode(c)).join('|'),
);

describe('artículos importados de Wikipedia en español (semilla commiteada)', () => {
  const articulos = importados();

  it('hay artículos importados', () => {
    expect(articulos.length).toBeGreaterThan(1500);
  });

  it('cada sección importada lleva fuente, enlace permanente, licencia, fecha y revisión', () => {
    for (const articulo of articulos) {
      const s = articulo.sections.find((x) => x.source === 'Wikipedia en español')!;
      expect(s.kind).toBe('definition');
      expect(s.license).toBe('CC BY-SA 4.0');
      expect(s.sourceUrl).toMatch(/^https:\/\/es\.wikipedia\.org\/w\/index\.php\?title=.+&oldid=\d+$/);
      expect(s.sourceVersion).toMatch(/^\d+$/);
      expect(s.sourceUrl).toContain(`oldid=${s.sourceVersion}`);
      expect(Number.isNaN(Date.parse(s.retrievedAt ?? ''))).toBe(false);
      expect(s.locator).toBe('introducción');
    }
  });

  it('el texto es largo, sin restos de wikitexto ni caracteres invisibles', () => {
    for (const articulo of articulos) {
      const { text } = articulo.sections[0];
      expect(text.length).toBeGreaterThanOrEqual(120);
      expect(CARACTERES_INVISIBLES.test(text)).toBe(false);
      expect(text).not.toMatch(/​|‌|‍|﻿/);
    }
  });

  it('cita la revisión leída y el Q-id de Wikidata del que salió el vínculo', () => {
    for (const articulo of articulos) {
      const fuentes = articulo.references.map((r) => r.source);
      expect(fuentes).toContain('Wikipedia en español');
      expect(fuentes).toContain('Wikidata');
      expect(articulo.references.some((r) => /^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/.test(r.url))).toBe(true);
    }
  });
});
