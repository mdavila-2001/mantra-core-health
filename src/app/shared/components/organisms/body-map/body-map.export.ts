import type { ShareService } from '../../../utils/share/share.service';
import type { ShareFormat } from '../../molecules/share-menu/share-menu';

/* ============================================================================
    Las salidas del maniquí para compartir: imagen, vector y documento.

    Las tres parten de la misma foto fija (`BodyMapSnapshot`): la vista que se
    ve, la zona elegida y los colores de marca ya resueltos. Así lo que llega
    por mensaje o al papel es lo que la persona tenía en pantalla.

    **No lleva datos de la persona.** El archivo trae la figura, el nombre de la
    zona elegida y la marca; quién es el paciente no entra: el mismo archivo
    sirve para mostrarle a cualquiera «es acá».
   ========================================================================== */

/** Lo mínimo para dibujar la vista elegida fuera de la pantalla. */
export interface BodyMapSnapshot {
  /** Ruta del render del maniquí (WebP del mismo origen). */
  readonly image: string;
  /** Ancho y alto del `viewBox` base de la vista, en unidades del dibujo. */
  readonly box: readonly [number, number];
  /** Nombre de la vista («Frente», «Espalda», «Cara»). */
  readonly viewName: string;
  /** El nombre de la zona elegida, o `null` si no hay ninguna. */
  readonly zoneName: string | null;
  /** El contorno de la zona elegida (`d` de un `<path>`), o `null`. */
  readonly zonePath: string | null;
  /** Un punto por cada parte de la zona elegida. */
  readonly zoneCenters: readonly (readonly [number, number])[];
  readonly colors: BodyMapColors;
}

/** Los colores ya resueltos de los tokens, porque un archivo suelto no tiene hoja de estilos. */
export interface BodyMapColors {
  readonly surface: string;
  readonly ink: string;
  readonly inkMuted: string;
  readonly brand: string;
  readonly brandStrong: string;
}

/** Banda inferior del archivo: nombre de la zona y marca. */
const CAPTION_RATIO = 0.075;
const BRAND_NAME = 'AloVida';
const PDF_JPEG_QUALITY = 0.9;
const SVG_IMAGE_QUALITY = 0.92;
const DEFAULT_COLORS: BodyMapColors = {
  surface: '#ffffff',
  ink: '#16323a',
  inkMuted: '#4a6068',
  brand: '#1f6f78',
  brandStrong: '#14515a',
};

/** Lee los tokens vigentes del elemento; si alguno no está, queda el de respaldo. */
export function readBodyMapColors(host: Element): BodyMapColors {
  const style = getComputedStyle(host);
  const read = (token: string, fallback: string): string => {
    const value = style.getPropertyValue(token).trim();
    return value === '' ? fallback : value;
  };
  return {
    surface: read('--bg-surface', DEFAULT_COLORS.surface),
    ink: read('--text-primary', DEFAULT_COLORS.ink),
    inkMuted: read('--text-secondary', DEFAULT_COLORS.inkMuted),
    brand: read('--brand-primary', DEFAULT_COLORS.brand),
    brandStrong: read('--brand-primary-active', DEFAULT_COLORS.brandStrong),
  };
}

/** El texto de la banda: «Zona: Pecho · Frente», o sólo la vista si no hay zona. */
export function bodyMapCaption(snapshot: BodyMapSnapshot): string {
  return snapshot.zoneName === null
    ? snapshot.viewName
    : `Zona: ${snapshot.zoneName} · ${snapshot.viewName}`;
}

/** El nombre de archivo sin acentos ni espacios: `mapa-corporal-pecho-frente.png`. */
export function bodyMapFileName(snapshot: BodyMapSnapshot, extension: 'png' | 'svg' | 'pdf'): string {
  const slug = (text: string): string =>
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const parts = ['mapa-corporal', snapshot.zoneName === null ? null : slug(snapshot.zoneName), slug(snapshot.viewName)];
  return `${parts.filter((part): part is string => part !== null && part !== '').join('-')}.${extension}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * El SVG del archivo. La imagen va **incrustada** (data URI): un SVG que apunta
 * a `/body-map/…` se ve en blanco en cuanto sale del sitio.
 */
export function buildBodyMapSvg(snapshot: BodyMapSnapshot, imageDataUri: string): string {
  const [width, height] = snapshot.box;
  const band = height * CAPTION_RATIO;
  const total = height + band;
  const { colors } = snapshot;
  const caption = escapeXml(bodyMapCaption(snapshot));

  const zone =
    snapshot.zonePath === null
      ? ''
      : `<path d="${escapeXml(snapshot.zonePath)}" fill="${colors.brand}" fill-opacity="0.45" ` +
        `stroke="${colors.brandStrong}" stroke-width="1.2" fill-rule="evenodd"/>` +
        snapshot.zoneCenters
          .map(
            ([x, y]) =>
              `<circle cx="${x}" cy="${y}" r="5" fill="${colors.surface}" stroke="${colors.brandStrong}" stroke-width="1.2"/>` +
              `<circle cx="${x}" cy="${y}" r="2.6" fill="${colors.brandStrong}"/>`,
          )
          .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${total}" role="img" aria-label="${caption}">`,
    `<title>${caption}</title>`,
    `<rect width="${width}" height="${total}" fill="${colors.surface}"/>`,
    `<image href="${imageDataUri}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`,
    zone,
    `<text x="${width / 2}" y="${height + band * 0.62}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${band * 0.42}" font-weight="600" fill="${colors.ink}">${caption}</text>`,
    `<text x="${width - 4}" y="${total - 3}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="${band * 0.26}" fill="${colors.inkMuted}">${BRAND_NAME}</text>`,
    `</svg>`,
  ].join('');
}

/**
 * La imagen del render como `data:` URI, para incrustarla en el SVG.
 *
 * Se decodifica y se vuelve a codificar desde un lienzo en vez de pedirla con
 * `fetch`: las peticiones del front viven en `core/data-access` (el chequeo de
 * arquitectura lo exige) y esto es sólo un archivo estático del mismo origen.
 */
export async function imageToDataUri(url: string): Promise<string> {
  const image = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('El navegador no dejó leer la imagen');
  context.drawImage(image, 0, 0);
  // WebP si el navegador sabe codificarlo (poco peso); si no, PNG sin pérdida.
  return canvas.toDataURL('image/webp', SVG_IMAGE_QUALITY);
}

/** Carga una imagen ya decodificada, lista para dibujar en un canvas. */
async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

/**
 * Dibuja el archivo en un lienzo, a la resolución **natural** del render: lo que
 * se baja tiene los mismos píxeles que el WebP publicado, sin reducirlo ni
 * estirarlo.
 */
async function drawBodyMap(snapshot: BodyMapSnapshot): Promise<HTMLCanvasElement> {
  const image = await loadImage(snapshot.image);
  const [boxWidth, boxHeight] = snapshot.box;
  const scale = image.naturalWidth / boxWidth;
  const width = Math.round(image.naturalWidth);
  const figureHeight = Math.round(boxHeight * scale);
  const band = Math.round(figureHeight * CAPTION_RATIO);
  const { colors } = snapshot;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = figureHeight + band;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('El navegador no dejó crear la imagen');

  context.fillStyle = colors.surface;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, width, figureHeight);

  if (snapshot.zonePath !== null) {
    context.save();
    context.scale(scale, scale);
    const path = new Path2D(snapshot.zonePath);
    context.globalAlpha = 0.45;
    context.fillStyle = colors.brand;
    context.fill(path, 'evenodd');
    context.globalAlpha = 1;
    context.lineWidth = 1.2;
    context.strokeStyle = colors.brandStrong;
    context.stroke(path);
    for (const [x, y] of snapshot.zoneCenters) {
      context.beginPath();
      context.arc(x, y, 5, 0, Math.PI * 2);
      context.fillStyle = colors.surface;
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(x, y, 2.6, 0, Math.PI * 2);
      context.fillStyle = colors.brandStrong;
      context.fill();
    }
    context.restore();
  }

  context.fillStyle = colors.ink;
  context.font = `600 ${Math.round(band * 0.42)}px Inter, Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(bodyMapCaption(snapshot), width / 2, figureHeight + band * 0.5);
  context.fillStyle = colors.inkMuted;
  context.font = `${Math.round(band * 0.26)}px Inter, Arial, sans-serif`;
  context.textAlign = 'right';
  context.fillText(BRAND_NAME, width - band * 0.3, figureHeight + band * 0.86);
  return canvas;
}

/** El PNG del archivo: sin pérdida, para mandar por mensaje. */
export async function renderBodyMapPng(snapshot: BodyMapSnapshot): Promise<Blob> {
  const canvas = await drawBodyMap(snapshot);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob === null ? reject(new Error('No se pudo generar la imagen')) : resolve(blob)),
      'image/png',
    );
  });
}

/**
 * Una hoja A4 vertical con la figura al centro, el nombre de la zona y la marca.
 *
 * La figura entra como **JPEG** y el documento va comprimido: con el PNG sin
 * pérdida el PDF pesaba 21 MB, que no se manda por mensaje. El fondo es liso,
 * así que la compresión no se nota.
 */
export async function renderBodyMapPdf(snapshot: BodyMapSnapshot): Promise<Blob> {
  const [{ jsPDF }, canvas] = await Promise.all([import('jspdf'), drawBodyMap(snapshot)]);
  const dataUri = canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY);

  const document_ = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const pageWidth = document_.internal.pageSize.getWidth();
  const pageHeight = document_.internal.pageSize.getHeight();
  const margin = 14;
  const titleBlock = 22;
  const footerBlock = 10;

  document_.setFont('helvetica', 'bold');
  document_.setFontSize(16);
  document_.text('Mapa corporal', margin, margin + 6);
  document_.setFont('helvetica', 'normal');
  document_.setFontSize(10);
  document_.text(bodyMapCaption(snapshot), margin, margin + 12);

  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin - titleBlock - footerBlock - margin;
  const ratio = canvas.width / canvas.height;
  const drawWidth = Math.min(availableWidth, availableHeight * ratio);
  const drawHeight = drawWidth / ratio;
  document_.addImage(dataUri, 'JPEG', (pageWidth - drawWidth) / 2, margin + titleBlock, drawWidth, drawHeight);

  document_.setFontSize(8);
  document_.setTextColor(110);
  document_.text(
    `${BRAND_NAME} · ${new Date().toLocaleDateString('es-BO')} · Esta figura es un esquema de apoyo, no un diagnóstico.`,
    margin,
    pageHeight - margin,
  );
  return document_.output('blob');
}

/**
 * Arma el archivo pedido y lo entrega: el PNG y el PDF por la hoja de compartir
 * en el celular (descarga en escritorio), el SVG siempre como descarga.
 */
export async function deliverBodyMap(
  format: ShareFormat,
  snapshot: BodyMapSnapshot,
  share: ShareService,
): Promise<void> {
  const name = bodyMapFileName(snapshot, format);
  const title = bodyMapCaption(snapshot);
  switch (format) {
    case 'png':
      await share.shareFile(await renderBodyMapPng(snapshot), name, title);
      break;
    case 'pdf':
      await share.shareFile(await renderBodyMapPdf(snapshot), name, title);
      break;
    case 'svg': {
      const svg = buildBodyMapSvg(snapshot, await imageToDataUri(snapshot.image));
      share.save(new Blob([svg], { type: 'image/svg+xml' }), name);
      break;
    }
  }
}
