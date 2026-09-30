/* ============================================================================
    El formato de un artículo médico: markdown ACOTADO dentro de `bodyText`.

    Un artículo es un `post` de la vitrina con la etiqueta `articulo-medico`, y
    el post sólo tiene una columna de texto (`body_text : text`). El formato
    vive ahí adentro como marcas legibles, no como HTML:

    - un post viejo, de texto plano, sigue siendo un artículo válido;
    - guardar HTML que después leen terceros es superficie de inyección;
    - el índice de búsqueda, las notificaciones y los recortes siguen leyendo
      texto que se entiende.

    Lo que se reconoce —y NADA más—:

        ## Título                ### Subtítulo
        - ítem   /   1. ítem     **negrita**   *cursiva*   URLs → enlace
        ![texto alternativo](imagen:N)   ← N = posición en `media[]` del post

    Los emojis son Unicode: no necesitan marca.
    ========================================================================== */

/** Un tramo de texto dentro de un renglón, con sus marcas. */
export interface ArticleRun {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  /** Destino si el tramo es un enlace; siempre `http(s)`. */
  readonly href: string | null;
}

/** Un renglón: una sucesión de tramos. */
export type ArticleLine = readonly ArticleRun[];

/** Un bloque del artículo, en el orden en que aparece. */
export type ArticleBlock =
  | { readonly kind: 'heading'; readonly level: 2 | 3; readonly text: string }
  | { readonly kind: 'paragraph'; readonly lines: readonly ArticleLine[] }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly ArticleLine[] }
  | { readonly kind: 'image'; readonly index: number; readonly alt: string };

/** Un subtítulo con lo que cuelga de él. */
export interface ArticleSubsection {
  readonly heading: string;
  readonly blocks: readonly ArticleBlock[];
}

/** Un título con lo que cuelga de él, subtítulos incluidos. */
export interface ArticleSection {
  readonly heading: string;
  readonly blocks: readonly ArticleBlock[];
  readonly subsections: readonly ArticleSubsection[];
}

/** El artículo agrupado para leer: lo que va antes del primer título, y las secciones. */
export interface ArticleOutline {
  readonly intro: readonly ArticleBlock[];
  readonly sections: readonly ArticleSection[];
}

/** Etiquetas que abren un bloque propio al convertir desde el editor. */
const BLOCK_TAGS: ReadonlySet<string> = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'UL', 'OL']);

/** Marca interna de `htmlToArticle`: no puede aparecer en texto escrito. */
const SEPARATOR = '\u0000';

/** El esquema de la referencia a una imagen del propio post. */
const IMAGE_SCHEME = 'imagen';

const HEADING = /^(#{1,3})\s+(.+)$/;
const UNORDERED_ITEM = /^[-*]\s+(.*)$/;
const ORDERED_ITEM = /^\d+[.)]\s+(.*)$/;
const IMAGE = /^!\[([^\]]*)\]\(imagen:(\d+)\)$/;
const INLINE = /(\*\*[^*\n]+?\*\*)|(\*[^*\s][^*\n]*?\*)|(https?:\/\/[^\s]+|www\.[^\s]+)/g;

/**
 * Parte el cuerpo de un artículo en bloques.
 *
 * Tolerante por diseño: lo que no es marca es texto. Un `#etiqueta` sin espacio
 * no es un título, un asterisco suelto no abre cursiva, y una imagen que apunta
 * a una posición que no existe se descarta en el render, no acá.
 *
 * @param body - El `bodyText` tal como lo guarda el servidor.
 * @returns Los bloques, en orden.
 */
export function parseArticle(body: string): readonly ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let paragraph: ArticleLine[] = [];
  let list: { ordered: boolean; items: ArticleLine[] } | null = null;

  const flush = (): void => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', lines: paragraph });
    if (list !== null) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items });
    paragraph = [];
    list = null;
  };

  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line === '') {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      // `#` a secas se lee como título: el artículo no tiene otro nivel más
      // alto que ofrecer, y la página ya tiene su propio encabezado principal.
      blocks.push({ kind: 'heading', level: heading[1] === '###' ? 3 : 2, text: heading[2]!.trim() });
      continue;
    }

    const image = IMAGE.exec(line);
    if (image) {
      flush();
      blocks.push({ kind: 'image', index: Number(image[2]), alt: image[1]!.trim() });
      continue;
    }

    const unordered = UNORDERED_ITEM.exec(line);
    const ordered = unordered ? null : ORDERED_ITEM.exec(line);
    const item = unordered ?? ordered;
    if (item) {
      const isOrdered = ordered !== null;
      if (paragraph.length > 0 || (list !== null && list.ordered !== isOrdered)) flush();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push(parseInline(item[1]!));
      continue;
    }

    if (list !== null) flush();
    paragraph.push(parseInline(line));
  }
  flush();
  return blocks;
}

/**
 * Agrupa los bloques por título, para pintar secciones desplegables.
 *
 * Un subtítulo que aparece antes de cualquier título se promueve a título: no
 * hay sección que lo contenga, y dejarlo suelto en la introducción lo volvería
 * un encabezado que no se puede plegar.
 *
 * @param blocks - Lo que devolvió {@link parseArticle}.
 */
export function outlineArticle(blocks: readonly ArticleBlock[]): ArticleOutline {
  const intro: ArticleBlock[] = [];
  const sections: { heading: string; blocks: ArticleBlock[]; subsections: { heading: string; blocks: ArticleBlock[] }[] }[] = [];

  for (const block of blocks) {
    const current = sections.at(-1);
    if (block.kind === 'heading') {
      if (block.level === 2 || current === undefined) {
        sections.push({ heading: block.text, blocks: [], subsections: [] });
      } else {
        current.subsections.push({ heading: block.text, blocks: [] });
      }
      continue;
    }
    if (current === undefined) {
      intro.push(block);
    } else {
      (current.subsections.at(-1)?.blocks ?? current.blocks).push(block);
    }
  }
  return { intro, sections };
}

/**
 * El artículo sin marcas, para un resumen o una vista previa.
 *
 * @param body - El `bodyText`.
 * @returns Texto corrido: sin `##`, sin `**`, sin referencias a imágenes.
 */
export function articlePlainText(body: string): string {
  return parseArticle(body)
    .flatMap((block): string[] => {
      switch (block.kind) {
        case 'heading':
          return [block.text];
        case 'paragraph':
          return [block.lines.map(lineText).join(' ')];
        case 'list':
          return block.items.map(lineText);
        case 'image':
          return [];
      }
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Si el cuerpo trae alguna marca de artículo (títulos, listas o imágenes). */
export function hasArticleStructure(body: string): boolean {
  return parseArticle(body).some((block) => block.kind !== 'paragraph');
}

/**
 * Convierte lo escrito en el editor a este formato.
 *
 * Recorre el DOM del área editable —ya saneado— y escribe una marca por cada
 * etiqueta que el formato admite. Lo que no tiene marca (el subrayado, por
 * ejemplo) pasa como texto sin perderse.
 *
 * @param root - El contenedor con el HTML del editor.
 * @param imageIndex - Posición en `media[]` de cada imagen, o `null` si no va.
 */
export function htmlToArticle(root: ParentNode, imageIndex: (image: HTMLImageElement) => number | null): string {
  const blocks: string[] = [];
  let pending = '';

  // Una imagen dentro de un párrafo corta el párrafo en dos: el formato sólo
  // admite imágenes como bloque propio. `inline` la deja marcada entre dos
  // SEPARATOR y `flushText` la saca a su propio bloque, en su lugar.
  const flushText = (): void => {
    pending.split(SEPARATOR).forEach((part, i) => {
      if (i % 2 === 1) {
        blocks.push(part);
        return;
      }
      const text = part
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .join('\n');
      if (text !== '') blocks.push(text);
    });
    pending = '';
  };

  const image = (node: HTMLImageElement): string => {
    const index = imageIndex(node);
    return index === null ? '' : `${SEPARATOR}![${cleanAlt(node.alt)}](${IMAGE_SCHEME}:${index})${SEPARATOR}`;
  };

  const inline = (node: Node): string => {
    if (node.nodeType === 3) return (node.textContent ?? '').replace(/\s*\n\s*/g, ' ');
    if (!(node instanceof Element)) return '';
    const tag = node.tagName;
    if (tag === 'BR') return '\n';
    if (tag === 'IMG') return image(node as HTMLImageElement);
    const inner = Array.from(node.childNodes).map(inline).join('');
    if (inner.trim() === '' || inner.includes(SEPARATOR)) return inner;
    if (tag === 'STRONG' || tag === 'B') return wrap(inner, '**');
    if (tag === 'EM' || tag === 'I') return wrap(inner, '*');
    return inner;
  };

  const block = (node: Node): void => {
    if (!(node instanceof Element)) {
      pending += inline(node);
      return;
    }
    switch (node.tagName) {
      case 'H1':
      case 'H2':
      case 'H3': {
        flushText();
        const { text, images } = splitImages(inline(node));
        if (text !== '') blocks.push(`${node.tagName === 'H3' ? '###' : '##'} ${text}`);
        blocks.push(...images);
        return;
      }
      case 'UL':
      case 'OL': {
        flushText();
        const ordered = node.tagName === 'OL';
        // Una imagen puesta dentro de un ítem no se pierde: va después de la
        // lista, que es lo más cerca de donde estaba que el formato admite.
        const parts = Array.from(node.children)
          .filter((child) => child.tagName === 'LI')
          .map((child) => splitImages(inline(child)));
        const items = parts
          .map((part) => part.text)
          .filter((text) => text !== '')
          .map((text, i) => `${ordered ? `${i + 1}.` : '-'} ${text}`);
        if (items.length > 0) blocks.push(items.join('\n'));
        blocks.push(...parts.flatMap((part) => part.images));
        return;
      }
      case 'P':
      case 'DIV': {
        flushText();
        // El editor del navegador anida bloques dentro de un párrafo
        // (`<p><ul>…</ul><h3>…</h3></p>`) al aplicar formato; el parser de HTML
        // no lo haría, pero el DOM editado sí. Un párrafo así es un contenedor.
        if (Array.from(node.children).some((child) => BLOCK_TAGS.has(child.tagName))) {
          node.childNodes.forEach(block);
        } else {
          pending = inline(node);
        }
        flushText();
        return;
      }
      case 'IMG':
        pending += image(node as HTMLImageElement);
        return;
      default:
        pending += inline(node);
    }
  };

  root.childNodes.forEach(block);
  flushText();
  return blocks.join('\n\n');
}

// ─── Internos ────────────────────────────────────────────────────────────────

function parseInline(line: string): ArticleLine {
  const runs: ArticleRun[] = [];
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > last) runs.push(run(line.slice(last, start)));
    const [whole, bold, italic, url] = match;
    if (bold) runs.push(run(bold.slice(2, -2), { bold: true }));
    else if (italic) runs.push(run(italic.slice(1, -1), { italic: true }));
    else if (url) {
      const clean = url.replace(/[.,;:)\]]+$/, '');
      runs.push(run(clean, { href: clean.startsWith('http') ? clean : `https://${clean}` }));
      if (clean.length < url.length) runs.push(run(url.slice(clean.length)));
    }
    last = start + whole.length;
  }
  if (last < line.length) runs.push(run(line.slice(last)));
  return runs;
}

function run(text: string, marks: Partial<Omit<ArticleRun, 'text'>> = {}): ArticleRun {
  return { text, bold: marks.bold ?? false, italic: marks.italic ?? false, href: marks.href ?? null };
}

function lineText(line: ArticleLine): string {
  return line.map((r) => r.text).join('');
}

/** Envuelve respetando los espacios de los bordes: `** hola**` no es negrita. */
function wrap(text: string, mark: string): string {
  const lead = /^\s*/.exec(text)![0];
  const trail = /\s*$/.exec(text)![0];
  return `${lead}${mark}${text.trim()}${mark}${trail}`;
}

/** Separa el texto de un renglón de las imágenes que traía adentro. */
function splitImages(marked: string): { readonly text: string; readonly images: readonly string[] } {
  const parts = marked.split(SEPARATOR);
  return {
    text: oneLine(parts.filter((_, i) => i % 2 === 0).join(' ')),
    images: parts.filter((_, i) => i % 2 === 1),
  };
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** El texto alternativo no puede cerrar la marca de la imagen. */
function cleanAlt(alt: string): string {
  return oneLine(alt.replace(/[[\]]/g, ''));
}
