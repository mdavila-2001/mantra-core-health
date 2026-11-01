import { type GraphNode, type GraphTone, type PlacedNode, type PlacedTree } from './glossary-graph.layout';
import { termsOf } from './glossary-graph.tree';

/* ============================================================================
    El árbol de términos como archivo: SVG suelto, imagen y documento.

    Un archivo no tiene hoja de estilos, así que los colores se resuelven de los
    tokens al exportar (`readGraphColors`) y el dibujo usa las mismas posiciones
    que la pantalla (`layoutTree`). El PDF agrega, después del dibujo, la lista
    de definiciones: el árbol es el mapa y la lista es la leyenda.
   ========================================================================== */

export interface GraphExportColors {
  readonly surface: string;
  readonly ink: string;
  readonly inkMuted: string;
  readonly line: string;
  readonly tones: Readonly<Record<GraphTone, string>>;
}

const FALLBACK: GraphExportColors = {
  surface: '#ffffff',
  ink: '#16323a',
  inkMuted: '#4a6068',
  line: '#9fb1b6',
  tones: { aqua: '#1f8a8a', petrol: '#1f5f78', mint: '#2e8b6a', sage: '#6f8a62', neutral: '#5b6b70' },
};

const TONE_TOKEN: Readonly<Record<GraphTone, string>> = {
  aqua: '--c-aqua-600',
  petrol: '--c-petrol-600',
  mint: '--c-mint-600',
  sage: '--c-sage-600',
  neutral: '--c-neutral-600',
};

const BRAND = 'AloVida';
const HEADER_HEIGHT = 56;
const FONT = 'Inter, Arial, sans-serif';

export function readGraphColors(host: Element): GraphExportColors {
  const style = getComputedStyle(host);
  const read = (token: string, fallback: string): string => {
    const value = style.getPropertyValue(token).trim();
    return value === '' ? fallback : value;
  };
  const tones = Object.fromEntries(
    (Object.keys(TONE_TOKEN) as GraphTone[]).map((tone) => [tone, read(TONE_TOKEN[tone], FALLBACK.tones[tone])]),
  ) as Record<GraphTone, string>;
  return {
    surface: read('--bg-surface', FALLBACK.surface),
    ink: read('--text-primary', FALLBACK.ink),
    inkMuted: read('--text-secondary', FALLBACK.inkMuted),
    line: read('--border-default', FALLBACK.line),
    tones,
  };
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function nodeSvg(entry: PlacedNode, colors: GraphExportColors): string {
  const { node } = entry;
  const tone = colors.tones[node.tone];
  const radius = node.kind === 'term' ? 10 : entry.height / 2;
  const dash = node.kind === 'more' ? ' stroke-dasharray="4 3"' : '';
  const fillOpacity = node.kind === 'term' ? 0.1 : node.kind === 'group' ? 0.22 : 0.04;
  const parts = [
    `<rect x="${entry.x}" y="${entry.y}" width="${entry.width}" height="${entry.height}" rx="${radius}" fill="${colors.surface}"/>`,
    `<rect x="${entry.x}" y="${entry.y}" width="${entry.width}" height="${entry.height}" rx="${radius}" fill="${tone}" fill-opacity="${fillOpacity}" stroke="${tone}" stroke-width="1.4"${dash}/>`,
  ];
  const textX = node.kind === 'term' ? entry.x + 14 : entry.x + entry.width / 2;
  const anchor = node.kind === 'term' ? 'start' : 'middle';
  for (const line of entry.lines) {
    const size = line.role === 'label' ? 12 : 10.5;
    const weight = line.role === 'label' ? 600 : 400;
    const fill = line.role === 'sub' ? colors.inkMuted : colors.ink;
    parts.push(
      `<text x="${textX}" y="${entry.y + line.dy}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line.text)}</text>`,
    );
  }
  if (entry.separatorDy !== null) {
    const y = entry.y + entry.separatorDy;
    parts.push(
      `<line x1="${entry.x + 14}" x2="${entry.x + entry.width - 14}" y1="${y}" y2="${y}" stroke="${tone}" stroke-opacity="0.45"/>`,
    );
  }
  return `<g>${parts.join('')}</g>`;
}

/** El árbol completo como un SVG autónomo (sin hojas de estilo ni fuentes externas). */
export function buildGraphSvg(tree: PlacedTree, title: string, colors: GraphExportColors): string {
  const width = Math.max(tree.width, 360);
  const height = tree.height + HEADER_HEIGHT;
  const links = tree.links
    .map((link) => `<path d="${link.d}" fill="none" stroke="${colors.line}" stroke-width="1.5"/>`)
    .join('');
  const nodes = tree.nodes.map((entry) => nodeSvg(entry, colors)).join('');
  const date = new Date().toLocaleDateString('es-BO');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)}">`,
    `<title>${escapeXml(title)}</title>`,
    `<rect width="${width}" height="${height}" fill="${colors.surface}"/>`,
    `<text x="24" y="30" font-family="${FONT}" font-size="18" font-weight="700" fill="${colors.ink}">${escapeXml(title)}</text>`,
    `<text x="24" y="47" font-family="${FONT}" font-size="10.5" fill="${colors.inkMuted}">${BRAND} · ${date} · Esquema de apoyo, no un diagnóstico</text>`,
    `<g transform="translate(0 ${HEADER_HEIGHT})">${links}${nodes}</g>`,
    `</svg>`,
  ].join('');
}

/** El nombre del archivo: `arbol-de-terminos-neumonia.svg`. */
export function graphFileName(rootLabel: string, extension: 'png' | 'svg' | 'pdf'): string {
  const slug = rootLabel
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `arbol-de-terminos${slug === '' ? '' : `-${slug}`}.${extension}`;
}

/** Cada término del árbol con su categoría y definición, sin repetir, para la leyenda del documento. */
export function graphDefinitions(
  root: GraphNode,
): readonly { readonly term: string; readonly category: string; readonly definition: string }[] {
  const seen = new Set<string>();
  const rows: { term: string; category: string; definition: string }[] = [];
  for (const node of termsOf(root)) {
    if (node.conceptId === undefined || seen.has(node.conceptId)) continue;
    seen.add(node.conceptId);
    rows.push({
      term: node.label,
      category: node.sublabel ?? '',
      definition: node.definition ?? 'Sin definición leída: ábrala desde el árbol o desde la ficha del término.',
    });
  }
  return rows;
}

/** Rasteriza el SVG a PNG. `maxSide` acota el lado mayor para no pedirle al navegador un lienzo imposible. */
export async function renderGraphPng(svg: string, width: number, height: number, maxSide = 7000): Promise<Blob> {
  const scale = Math.min(3, maxSide / Math.max(width, height));
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('El navegador no dejó crear la imagen');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob === null ? reject(new Error('No se pudo generar la imagen')) : resolve(blob)),
        'image/png',
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A3 apaisado con el árbol y, a continuación, las definiciones de cada término. */
export async function renderGraphPdf(
  png: Blob,
  title: string,
  definitions: ReturnType<typeof graphDefinitions>,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Lectura de imagen fallida'));
    reader.readAsDataURL(png);
  });
  const image = new Image();
  image.src = dataUri;
  await image.decode();

  const doc = new jsPDF({ unit: 'mm', format: 'a3', orientation: 'landscape', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const ratio = image.naturalWidth / image.naturalHeight;
  const drawWidth = Math.min(pageWidth - margin * 2, (pageHeight - margin * 2) * ratio);
  doc.addImage(dataUri, 'PNG', margin, margin, drawWidth, drawWidth / ratio, undefined, 'FAST');

  doc.addPage('a4', 'portrait');
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  let y = margin + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Definiciones · ${title}`, margin, y);
  y += 8;
  for (const row of definitions) {
    const head = row.category === '' ? row.term : `${row.term} (${row.category})`;
    const body = doc.splitTextToSize(row.definition, width - margin * 2) as string[];
    const needed = 6 + body.length * 4.6 + 3;
    if (y + needed > height - margin) {
      doc.addPage('a4', 'portrait');
      y = margin + 4;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(head, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(body, margin, y);
    y += body.length * 4.6 + 3;
  }
  return doc.output('blob');
}
