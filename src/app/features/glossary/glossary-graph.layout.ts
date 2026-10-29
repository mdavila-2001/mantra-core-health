/* ============================================================================
    El árbol de términos: cómo se reparte en el plano.

    Un árbol horizontal: el término elegido a la izquierda y, a la derecha, sus
    grupos de relaciones (síntomas, enfermedades, estudios…) y los términos de
    cada grupo. Cada término abierto repite el patrón hacia la derecha.

    Es lógica pura (sin DOM ni Angular): la pantalla la dibuja interactiva y el
    archivo para compartir la dibuja como SVG suelto, con las mismas posiciones.
   ========================================================================== */

export type GraphNodeKind = 'term' | 'group' | 'more';

/** Los colores del árbol. Cada uno se resuelve contra un token en la hoja y en la exportación. */
export type GraphTone = 'aqua' | 'petrol' | 'mint' | 'sage' | 'neutral';

/** Un nodo del árbol antes de ubicarlo: lo que es, no dónde va. */
export interface GraphNode {
  readonly key: string;
  readonly kind: GraphNodeKind;
  readonly label: string;
  /** Segunda línea: la categoría del término o cuántos hay en el grupo. */
  readonly sublabel?: string;
  readonly conceptId?: string;
  readonly tone: GraphTone;
  /** La definición breve, si ya se leyó. */
  readonly definition?: string;
  /** Si tiene (o puede tener) hijos que abrir. */
  readonly expandable: boolean;
  readonly expanded: boolean;
  readonly loading: boolean;
  readonly children: readonly GraphNode[];
}

export interface PlacedNode {
  readonly node: GraphNode;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  /** Los renglones de texto ya partidos y con su posición vertical (línea base, desde el borde de arriba). */
  readonly lines: readonly PlacedLine[];
  /** Dónde va la raya que separa el rótulo de la definición, o `null` si no hay definición. */
  readonly separatorDy: number | null;
}

export type LineRole = 'label' | 'sub' | 'definition';

export interface PlacedLine {
  readonly text: string;
  readonly role: LineRole;
  readonly dy: number;
}

export interface PlacedLink {
  readonly from: string;
  readonly to: string;
  /** Curva de Bézier lista para `d`. */
  readonly d: string;
}

export interface PlacedTree {
  readonly nodes: readonly PlacedNode[];
  readonly links: readonly PlacedLink[];
  readonly width: number;
  readonly height: number;
}

/** Medidas del dibujo, en unidades del lienzo. */
export const GRAPH_METRICS = {
  termWidth: 248,
  groupWidth: 176,
  moreWidth: 132,
  levelGap: 56,
  rowGap: 14,
  padding: 24,
  /** Alto de un renglón de texto y de relleno vertical de un nodo. */
  lineHeight: 15,
  nodePaddingY: 9,
  /** Ancho medio de un carácter a 12 px: alcanza para partir renglones sin medir en el DOM. */
  charWidth: 6.3,
  /** Hasta cuántos renglones de definición se dibujan en el árbol (la ficha lateral la trae entera). */
  maxDefinitionLines: 4,
  maxLabelLines: 2,
} as const;

/** Parte un texto en renglones de a lo sumo `maxChars`, sin cortar palabras; el último termina en «…» si sobra. */
export function wrapText(text: string, maxChars: number, maxLines: number): readonly string[] {
  const words = text.trim().split(/\s+/).filter((word) => word !== '');
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  let index = 0;
  for (; index < words.length; index++) {
    const word = words[index];
    const candidate = current === '' ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current === '') {
      // Una palabra más larga que el renglón: se corta, no se desborda.
      current = word.slice(0, Math.max(1, maxChars - 1)) + '…';
      continue;
    }
    if (lines.length === maxLines - 1) break;
    lines.push(current);
    current = word;
  }
  if (current !== '') lines.push(current);
  if (index < words.length) {
    const last = lines.length - 1;
    const trimmed = lines[last].length >= maxChars ? lines[last].slice(0, maxChars - 1) : lines[last];
    lines[last] = trimmed.endsWith('…') ? trimmed : `${trimmed}…`;
  }
  return lines;
}

function widthOf(kind: GraphNodeKind): number {
  switch (kind) {
    case 'term':
      return GRAPH_METRICS.termWidth;
    case 'group':
      return GRAPH_METRICS.groupWidth;
    case 'more':
      return GRAPH_METRICS.moreWidth;
  }
}

function measure(node: GraphNode): Omit<PlacedNode, 'x' | 'y' | 'depth'> {
  const width = widthOf(node.kind);
  const usable = width - 28;
  const maxChars = Math.max(8, Math.floor(usable / GRAPH_METRICS.charWidth));
  const labelLines = wrapText(node.label, maxChars, GRAPH_METRICS.maxLabelLines);
  const subLines = node.sublabel === undefined ? [] : wrapText(node.sublabel, maxChars, 1);
  const definitionLines =
    node.kind === 'term' && node.definition !== undefined
      ? wrapText(node.definition, maxChars, GRAPH_METRICS.maxDefinitionLines)
      : [];

  const lines: PlacedLine[] = [];
  let dy: number = GRAPH_METRICS.nodePaddingY;
  const push = (texts: readonly string[], role: LineRole): void => {
    for (const text of texts) {
      dy += GRAPH_METRICS.lineHeight;
      // La línea base queda 4 unidades sobre el fondo del renglón.
      lines.push({ text, role, dy: dy - 4 });
    }
  };
  push(labelLines, 'label');
  push(subLines, 'sub');
  let separatorDy: number | null = null;
  if (definitionLines.length > 0) {
    dy += 6;
    separatorDy = dy - 8;
    push(definitionLines, 'definition');
  }
  const height = dy + GRAPH_METRICS.nodePaddingY;
  return { node, width, height, lines, separatorDy };
}

/**
 * Ubica el árbol: la profundidad fija la columna (x) y el orden de las hojas,
 * la fila (y); cada padre queda centrado sobre sus hijos.
 */
export function layoutTree(root: GraphNode): PlacedTree {
  const measured = new Map<string, Omit<PlacedNode, 'x' | 'y' | 'depth'>>();
  const depthWidth: number[] = [];

  const measureAll = (node: GraphNode, depth: number): void => {
    const size = measure(node);
    measured.set(node.key, size);
    depthWidth[depth] = Math.max(depthWidth[depth] ?? 0, size.width);
    node.children.forEach((child) => measureAll(child, depth + 1));
  };
  measureAll(root, 0);

  const columnX: number[] = [];
  let cursorX: number = GRAPH_METRICS.padding;
  depthWidth.forEach((width, depth) => {
    columnX[depth] = cursorX;
    cursorX += width + GRAPH_METRICS.levelGap;
  });

  const placed: PlacedNode[] = [];
  const links: PlacedLink[] = [];
  let cursorY: number = GRAPH_METRICS.padding;

  /** Devuelve el centro vertical del nodo, para que el padre se alinee con sus hijos. */
  const place = (node: GraphNode, depth: number): number => {
    const size = measured.get(node.key)!;
    const childCenters = node.children.map((child) => place(child, depth + 1));
    let centerY: number;
    if (childCenters.length === 0) {
      centerY = cursorY + size.height / 2;
      cursorY += size.height + GRAPH_METRICS.rowGap;
    } else {
      centerY = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
      // Un padre más alto que el espacio de sus hijos empuja a los siguientes.
      cursorY = Math.max(cursorY, centerY + size.height / 2 + GRAPH_METRICS.rowGap);
    }
    placed.push({ ...size, x: columnX[depth], y: centerY - size.height / 2, depth });
    return centerY;
  };
  place(root, 0);

  const byKey = new Map(placed.map((entry) => [entry.node.key, entry]));
  for (const entry of placed) {
    for (const child of entry.node.children) {
      const target = byKey.get(child.key);
      if (target === undefined) continue;
      const x1 = entry.x + entry.width;
      const y1 = entry.y + entry.height / 2;
      const x2 = target.x;
      const y2 = target.y + target.height / 2;
      const mid = (x1 + x2) / 2;
      links.push({ from: entry.node.key, to: child.key, d: `M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}` });
    }
  }

  const rightEdge = Math.max(...placed.map((entry) => entry.x + entry.width));
  const bottomEdge = Math.max(...placed.map((entry) => entry.y + entry.height));
  return {
    nodes: placed.sort((a, b) => a.depth - b.depth || a.y - b.y),
    links,
    width: rightEdge + GRAPH_METRICS.padding,
    height: bottomEdge + GRAPH_METRICS.padding,
  };
}
