import { Injectable } from '@angular/core';

import { readImageAsDataUrl } from '../../core/data-access/glossary/glossary-image.reader';
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
  /** `null` si no se pudo descargar (otro origen sin permiso, caída, formato): el PDF lo dice y lleva el crédito. */
  readonly image: PdfLogo | null;
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

async function readImage(url: string): Promise<PdfLogo> {
  const dataUrl = await readImageAsDataUrl(url);
  const { prepararImagenPdf } = await import('../../core/pdf-branding/pdf-logo');
  const image = await prepararImagenPdf(dataUrl);
  if (image === null) throw new Error('No se pudo preparar la imagen para PDF.');
  return image;
}

/**
 * Lee la imagen entera y, si no, su miniatura. Las imágenes de otro origen las
 * puede bloquear la política de seguridad de la página (`connect-src`): en ese
 * caso devuelve `null` en vez de tumbar la descarga, y el PDF conserva el
 * crédito y la página de origen para que la imagen se pueda ver ahí.
 */
async function readImageOrNull(url: string, thumbUrl?: string): Promise<PdfLogo | null> {
  try {
    return await readImage(url);
  } catch {
    if (thumbUrl === undefined) return null;
    try {
      return await readImage(thumbUrl);
    } catch {
      return null;
    }
  }
}

async function prepareImages(
  term: GlossaryTermDetail,
  article: GlossaryArticle | null,
): Promise<readonly PreparedImage[]> {
  const result: PreparedImage[] = [];
  const termImage = imagenAprobadaDelTermino(term);
  if (termImage !== undefined) {
    result.push({
      image: await readImageOrNull(termImage.source, termImage.thumbnailSource),
      caption: termImage.alt,
      credit: `${termImage.attribution} · ${termImage.license}`,
      sourceUrl: termImage.sourcePage ?? termImage.source,
    });
  }
  if (article !== null) {
    for (const image of imagenesVisibles(article.images)) {
      result.push({
        image: await readImageOrNull(image.url, image.thumbUrl),
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
      if (item.image !== null) {
        blocks.push({ kind: 'image', text: item.caption, image: item.image });
      } else {
        appendParagraphs(
          blocks,
          'Esta imagen no se pudo incluir en el PDF; puede verla en su página de origen.',
        );
      }
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
