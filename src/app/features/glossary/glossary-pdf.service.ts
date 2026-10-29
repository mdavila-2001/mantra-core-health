import { Injectable } from '@angular/core';

import type { GlossaryArticle } from '../../core/data-access/terminology/glossary-article.types';
import type { GlossaryTermDetail } from '../../core/data-access/terminology/terminology.types';
import { valorDeTexto } from '../../core/data-access/terminology/terminology.types';
import type { PdfBlock } from '../../shared/utils/pdf-export/pdf-export';
import type { PdfLogo } from '../../core/pdf-branding/pdf-logo';
import {
  fechaLegible,
  imagenesVisibles,
  nombreDeFuente,
  seccionesPintables,
} from './glossary-article.logic';
import { imagenAprobadaDelTermino } from './glossary-image.logic';

interface PreparedImage {
  readonly image: PdfLogo;
  readonly caption: string;
  readonly credit: string;
  readonly sourceUrl: string;
}

function appendParagraphs(blocks: PdfBlock[], text: string): void {
  for (const paragraph of text.split(/\n\s*\n/u)) {
    const value = paragraph.trim();
    if (value !== '') blocks.push({ kind: 'paragraph', text: value });
  }
}

function safeImageUrl(value: string): string | null {
  if (/^\/glossary-images\/[a-z0-9-]+\.(?:svg|webp|png)$/u.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

async function readImage(url: string): Promise<PdfLogo> {
  const safeUrl = safeImageUrl(url);
  if (safeUrl === null) throw new Error('La imagen no tiene una URL segura.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(safeUrl, { credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error('La imagen no respondió.');
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') || blob.size > 20_000_000) {
      throw new Error('La imagen no tiene un formato o tamaño admitido.');
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(blob);
    });
    const { prepararImagenPdf } = await import('../../core/pdf-branding/pdf-logo');
    const image = await prepararImagenPdf(dataUrl);
    if (image === null) throw new Error('No se pudo preparar la imagen para PDF.');
    return image;
  } finally {
    clearTimeout(timeout);
  }
}

async function prepareImages(
  term: GlossaryTermDetail,
  article: GlossaryArticle | null,
): Promise<readonly PreparedImage[]> {
  const result: PreparedImage[] = [];
  const termImage = imagenAprobadaDelTermino(term);
  if (termImage !== undefined) {
    let prepared: PdfLogo;
    try {
      prepared = await readImage(termImage.source);
    } catch {
      if (termImage.thumbnailSource === undefined) throw new Error('No se pudo incluir la imagen.');
      prepared = await readImage(termImage.thumbnailSource);
    }
    result.push({
      image: prepared,
      caption: termImage.alt,
      credit: `${termImage.attribution} · ${termImage.license}`,
      sourceUrl: termImage.sourcePage ?? termImage.source,
    });
  }
  if (article !== null) {
    for (const image of imagenesVisibles(article.images)) {
      let prepared: PdfLogo;
      try {
        prepared = await readImage(image.url);
      } catch {
        prepared = await readImage(image.thumbUrl);
      }
      result.push({
        image: prepared,
        caption: image.caption || image.altText,
        credit: [image.author, image.license, image.licenseUrl].filter(Boolean).join(' · '),
        sourceUrl: image.sourcePage || image.url,
      });
    }
  }
  return result;
}

/** Contenido de la ficha en orden de lectura, incluidos origen y crédito de cada imagen. */
export function glossaryPdfBlocks(
  term: GlossaryTermDetail,
  article: GlossaryArticle | null,
  images: readonly PreparedImage[],
): readonly PdfBlock[] {
  const blocks: PdfBlock[] = [];
  if (term.code !== '')
    blocks.push({ kind: 'field', text: `Código: ${term.code}`, label: 'Código', value: term.code });
  if (term.category !== null) {
    blocks.push({
      kind: 'field',
      text: `Categoría: ${term.category.name}`,
      label: 'Categoría',
      value: term.category.name,
    });
  }
  if (term.synonyms.length > 0) {
    blocks.push({
      kind: 'paragraph',
      text: `También se le dice: ${term.synonyms.map((item) => item.value).join(', ')}.`,
    });
  }
  if (term.plainSummary?.text.trim()) {
    blocks.push({ kind: 'heading', text: 'Explicado simple', level: 2 });
    appendParagraphs(blocks, term.plainSummary.text);
  }
  if (term.clinicalDefinition?.text.trim()) {
    blocks.push({ kind: 'heading', text: 'Definición clínica', level: 2 });
    appendParagraphs(blocks, term.clinicalDefinition.text);
    const definitionSource: unknown = term.properties['definition_source'];
    if (
      typeof definitionSource === 'object' &&
      definitionSource !== null &&
      !Array.isArray(definitionSource)
    ) {
      const record = definitionSource as Record<string, unknown>;
      const name = record['name'];
      const url = record['url'];
      if (typeof name === 'string') {
        appendParagraphs(
          blocks,
          `Fuente de la definición: ${name}${typeof url === 'string' ? ` · ${url}` : ''}`,
        );
      }
    }
  }
  const termSource =
    valorDeTexto(term.properties, 'source_name') ?? valorDeTexto(term.properties, 'source');
  const termSourceUrl = valorDeTexto(term.properties, 'source_url');
  if (termSource)
    appendParagraphs(
      blocks,
      `Fuente del término: ${termSource}${termSourceUrl ? ` · ${termSourceUrl}` : ''}`,
    );

  if (article !== null) {
    for (const item of seccionesPintables(article)) {
      blocks.push({ kind: 'heading', text: item.titulo, level: 2 });
      if (item.encabezadoDeLaFuente)
        appendParagraphs(blocks, `En la fuente: ${item.encabezadoDeLaFuente}`);
      if (item.extracto) appendParagraphs(blocks, item.extracto);
      if (item.sinTraduccion) appendParagraphs(blocks, 'Texto en inglés: sin traducción oficial.');
      for (const content of item.bloques) {
        if (content.tipo === 'parrafo') appendParagraphs(blocks, content.texto);
        if (content.tipo === 'lista') {
          for (const entry of content.elementos) appendParagraphs(blocks, `• ${entry}`);
        }
        if (content.tipo === 'tabla') {
          for (const row of content.filas) {
            blocks.push({ kind: 'row', text: row.join(' · '), cells: row });
          }
        }
      }
      const section = item.seccion;
      appendParagraphs(
        blocks,
        `Fuente: ${nombreDeFuente(section.source)} · ${section.sourceUrl} · ${section.license} · versión ${section.sourceVersion}${section.nregistro ? ` · ficha técnica del producto con registro ${section.nregistro}` : ''} · consultado el ${fechaLegible(section.retrievedAt)} · ${section.locator}`,
      );
    }
    if (article.facts.length > 0) {
      blocks.push({ kind: 'heading', text: 'Datos', level: 2 });
      for (const fact of article.facts) {
        blocks.push({
          kind: 'field',
          text: `${fact.label}: ${fact.value}`,
          label: fact.label,
          value: fact.value,
        });
        appendParagraphs(blocks, `Fuente: ${nombreDeFuente(fact.source)} · ${fact.sourceUrl}`);
      }
    }
    if (article.references.length > 0) {
      blocks.push({ kind: 'heading', text: 'Referencias', level: 2 });
      for (const reference of article.references) {
        appendParagraphs(blocks, `${reference.title} · ${reference.url}`);
      }
    }
  } else if (!term.clinicalDefinition?.text.trim()) {
    blocks.push({ kind: 'heading', text: 'Definición', level: 2 });
    appendParagraphs(blocks, 'Este término todavía no tiene una definición con fuente cargada.');
  }

  if (images.length > 0) {
    blocks.push({ kind: 'heading', text: 'Imágenes', level: 2 });
    for (const [index, item] of images.entries()) {
      blocks.push({ kind: 'heading', text: `Imagen ${index + 1}: ${item.caption}`, level: 3 });
      blocks.push({ kind: 'image', text: item.caption, image: item.image });
      appendParagraphs(blocks, `${item.credit} · página de origen: ${item.sourceUrl}`);
    }
  }
  return blocks;
}

@Injectable({ providedIn: 'root' })
export class GlossaryPdfService {
  async download(term: GlossaryTermDetail, article: GlossaryArticle | null): Promise<void> {
    const images = await prepareImages(term, article);
    const blocks = glossaryPdfBlocks(term, article, images);
    const { buildBlocksPdf } = await import('../../shared/utils/pdf-export/pdf-export');
    const document = buildBlocksPdf(blocks, {
      title: term.display,
      subtitle: term.code,
      kind: 'GLOSARIO MÉDICO',
      footerNote: 'AloVida · Glosario médico · Fuentes y licencias incluidas',
      plainPaper: true,
      logo: null,
      firma: null,
    });
    const slug = (article?.conceptRef.slug || term.code || term.conceptId)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/gu, '-');
    document.save(`glosario-${slug}.pdf`);
  }
}
