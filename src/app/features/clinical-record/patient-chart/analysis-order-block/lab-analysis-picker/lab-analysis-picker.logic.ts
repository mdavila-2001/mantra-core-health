/**
 * Lógica pura del selector de análisis de laboratorio: sin Angular, sin DOM.
 *
 * Modelo mental
 * -------------
 * - Un análisis **con panel** tiene componentes (hemograma: hemoglobina,
 *   hematocrito…). Se pide eligiendo cuáles; un panel sin ningún componente
 *   marcado NO es un pedido (la API lo rechaza con `COMPONENTS_EMPTY`) y la
 *   pantalla lo avisa.
 * - Un análisis **simple** (sin componentes) es una sola casilla: estar en la
 *   selección ya es pedirlo. Cuenta como un componente en el resumen.
 * - Al marcar un análisis entran sus componentes `defaultSelected` (decisión D3
 *   del plan). Si el catálogo no marcara ninguno por defecto, entran todos:
 *   así un panel recién marcado nunca nace «vacío».
 *
 * Todas las funciones devuelven mapas y conjuntos NUEVOS; la selección es
 * inmutable porque viaja por un `model()` y se compara por referencia.
 */

export interface LabComponentOption {
  readonly conceptId: string;
  readonly code: string;
  readonly label: string;
  readonly defaultSelected: boolean;
  readonly unit?: string;
}

export interface LabSpecimenRef {
  readonly conceptId: string;
  readonly label: string;
}

export interface LabAnalysisOption {
  readonly conceptId: string;
  readonly code: string;
  readonly label: string;
  readonly synonyms?: readonly string[];
  /** Código de la sección del catálogo (p. ej. `HEMATO`). */
  readonly section: string;
  /** Muestra sugerida por el catálogo; el médico puede cambiarla. */
  readonly specimen?: LabSpecimenRef;
  readonly components: readonly LabComponentOption[];
}

export interface LabSectionOption {
  readonly code: string;
  readonly label: string;
}

export interface LabSelectionEntry {
  readonly components: ReadonlySet<string>;
  readonly specimenConceptId: string | null;
}

/** Análisis (conceptId) → lo elegido de él. */
export type LabSelection = ReadonlyMap<string, LabSelectionEntry>;

/** Un renglón del pedido, tal como lo espera la requisición. */
export interface LabOrderLine {
  readonly analysisConceptId: string;
  readonly componentConceptIds: readonly string[];
  readonly specimenConceptId: string | null;
}

export type ParentState = 'none' | 'some' | 'all';

export interface LabSelectionSummary {
  /** Análisis que SÍ son pedido (simples elegidos + paneles con ≥ 1 componente). */
  readonly analysisCount: number;
  /** Componentes marcados; un análisis simple cuenta como uno. */
  readonly componentCount: number;
  /** Paneles elegidos pero sin ningún componente marcado: no cuentan. */
  readonly incompleteAnalysisIds: readonly string[];
}

export interface LabFilterHit {
  readonly analysis: LabAnalysisOption;
  /** Componentes que coinciden con la búsqueda (vacío si no hay búsqueda). */
  readonly matchedComponentIds: ReadonlySet<string>;
  /** `true` si lo que coincide es el análisis mismo (nombre, código o sinónimo). */
  readonly matchedAnalysis: boolean;
}

export interface HighlightSegment {
  readonly text: string;
  readonly match: boolean;
}

/* ---------------------------------------------------------------------------
   Texto
   ------------------------------------------------------------------------- */

const COMBINING_MARKS = /\p{M}/gu;

/** Minúsculas y sin tildes: «Biometría» y «biometria» son lo mismo. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();
}

/** Palabras de la búsqueda, normalizadas; vacío si no hay nada que buscar. */
export function queryTokens(query: string): readonly string[] {
  const normalized = normalizeText(query);
  return normalized === '' ? [] : normalized.split(/\s+/u);
}

/**
 * Trozos de `text` marcando dónde coincide algún token. Respeta el texto
 * original (con tildes y mayúsculas): sólo busca sobre la versión normalizada.
 */
export function highlightSegments(text: string, tokens: readonly string[]): readonly HighlightSegment[] {
  if (tokens.length === 0 || text === '') return [{ text, match: false }];

  let normalized = '';
  const origin: number[] = []; // índice normalizado → índice original
  for (let i = 0; i < text.length; i++) {
    const piece = (text[i] as string).normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
    normalized += piece;
    origin.push(...new Array<number>(piece.length).fill(i));
  }

  const marked = new Array<boolean>(text.length).fill(false);
  let any = false;
  for (const token of tokens) {
    if (token === '') continue;
    let from = normalized.indexOf(token);
    while (from !== -1) {
      for (let k = from; k < from + token.length; k++) {
        marked[origin[k] as number] = true;
      }
      any = true;
      from = normalized.indexOf(token, from + 1);
    }
  }
  if (!any) return [{ text, match: false }];

  const segments: HighlightSegment[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marked[i] !== marked[start]) {
      segments.push({ text: text.slice(start, i), match: marked[start] as boolean });
      start = i;
    }
  }
  return segments;
}

/* ---------------------------------------------------------------------------
   Índice y filtro
   ------------------------------------------------------------------------- */

export interface LabSearchIndex {
  /** conceptId del análisis → texto normalizado (nombre, código, sinónimos). */
  readonly analysisText: ReadonlyMap<string, string>;
  /** conceptId del componente → texto normalizado (nombre y código). */
  readonly componentText: ReadonlyMap<string, string>;
}

/** Se arma una vez por catálogo; filtrar después es sólo `includes`. */
export function buildSearchIndex(analyses: readonly LabAnalysisOption[]): LabSearchIndex {
  const analysisText = new Map<string, string>();
  const componentText = new Map<string, string>();
  for (const analysis of analyses) {
    analysisText.set(
      analysis.conceptId,
      normalizeText([analysis.label, analysis.code, ...(analysis.synonyms ?? [])].join(' ')),
    );
    for (const component of analysis.components) {
      componentText.set(component.conceptId, normalizeText(`${component.label} ${component.code}`));
    }
  }
  return { analysisText, componentText };
}

const NO_MATCHES: ReadonlySet<string> = new Set();

/**
 * Análisis visibles para una búsqueda y una sección.
 *
 * Cada palabra de la búsqueda debe aparecer en el análisis **o** en alguno de
 * sus componentes (el hemograma aparece al escribir «hemoglobina»). Orden del
 * catálogo; sin búsqueda ni sección devuelve todo.
 */
export function filterAnalyses(
  analyses: readonly LabAnalysisOption[],
  index: LabSearchIndex,
  query: string,
  section: string | null,
): readonly LabFilterHit[] {
  const tokens = queryTokens(query);
  const hits: LabFilterHit[] = [];

  for (const analysis of analyses) {
    if (section !== null && analysis.section !== section) continue;
    if (tokens.length === 0) {
      hits.push({ analysis, matchedComponentIds: NO_MATCHES, matchedAnalysis: false });
      continue;
    }

    const ownText = index.analysisText.get(analysis.conceptId) ?? '';
    const matchedComponents = new Set<string>();
    let everyTokenFound = true;
    let ownMatches = false;

    for (const token of tokens) {
      const inOwn = ownText.includes(token);
      let inComponent = false;
      for (const component of analysis.components) {
        if ((index.componentText.get(component.conceptId) ?? '').includes(token)) {
          matchedComponents.add(component.conceptId);
          inComponent = true;
        }
      }
      if (inOwn) ownMatches = true;
      if (!inOwn && !inComponent) {
        everyTokenFound = false;
        break;
      }
    }

    if (everyTokenFound) {
      hits.push({ analysis, matchedComponentIds: matchedComponents, matchedAnalysis: ownMatches });
    }
  }
  return hits;
}

/** Cuántos análisis hay por sección (sin filtrar por búsqueda). */
export function countBySection(analyses: readonly LabAnalysisOption[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const analysis of analyses) {
    counts.set(analysis.section, (counts.get(analysis.section) ?? 0) + 1);
  }
  return counts;
}

/* ---------------------------------------------------------------------------
   Selección
   ------------------------------------------------------------------------- */

export function isSimpleAnalysis(analysis: LabAnalysisOption): boolean {
  return analysis.components.length === 0;
}

/** Componentes que entran al marcar el análisis (D3). */
export function defaultComponentIds(analysis: LabAnalysisOption): ReadonlySet<string> {
  const flagged = analysis.components.filter((c) => c.defaultSelected);
  const chosen = flagged.length > 0 ? flagged : analysis.components;
  return new Set(chosen.map((c) => c.conceptId));
}

function entryFor(analysis: LabAnalysisOption, components: ReadonlySet<string>): LabSelectionEntry {
  return { components, specimenConceptId: analysis.specimen?.conceptId ?? null };
}

function withEntry(selection: LabSelection, analysisId: string, entry: LabSelectionEntry): LabSelection {
  const next = new Map(selection);
  next.set(analysisId, entry);
  return next;
}

/** Tri-estado de la casilla del análisis. */
export function parentState(analysis: LabAnalysisOption, entry: LabSelectionEntry | undefined): ParentState {
  if (entry === undefined) return 'none';
  if (isSimpleAnalysis(analysis)) return 'all';
  const marked = analysis.components.reduce((n, c) => n + (entry.components.has(c.conceptId) ? 1 : 0), 0);
  if (marked === 0) return 'none';
  return marked === analysis.components.length ? 'all' : 'some';
}

/**
 * Click en la casilla del análisis.
 * - nada marcado → entran los componentes por defecto;
 * - algunos → se completan todos;
 * - todos → se quita el análisis.
 * Un análisis simple alterna presente/ausente.
 */
export function toggleAnalysis(selection: LabSelection, analysis: LabAnalysisOption): LabSelection {
  const entry = selection.get(analysis.conceptId);
  if (isSimpleAnalysis(analysis)) {
    return entry === undefined
      ? withEntry(selection, analysis.conceptId, entryFor(analysis, new Set()))
      : removeAnalysis(selection, analysis.conceptId);
  }
  switch (parentState(analysis, entry)) {
    case 'all':
      return removeAnalysis(selection, analysis.conceptId);
    case 'some':
      return withEntry(selection, analysis.conceptId, {
        components: new Set(analysis.components.map((c) => c.conceptId)),
        specimenConceptId: entry?.specimenConceptId ?? analysis.specimen?.conceptId ?? null,
      });
    default:
      return withEntry(selection, analysis.conceptId, {
        components: defaultComponentIds(analysis),
        specimenConceptId: entry?.specimenConceptId ?? analysis.specimen?.conceptId ?? null,
      });
  }
}

/**
 * Marca o desmarca UN componente. Marcar un componente de un análisis que no
 * estaba elegido lo elige con sólo ese componente. Desmarcar el último deja el
 * análisis en la selección con 0 componentes (se avisa; no cuenta).
 */
export function toggleComponent(
  selection: LabSelection,
  analysis: LabAnalysisOption,
  componentId: string,
  checked: boolean,
): LabSelection {
  if (!analysis.components.some((c) => c.conceptId === componentId)) return selection;
  const entry = selection.get(analysis.conceptId);
  const components = new Set(entry?.components ?? []);
  if (checked) components.add(componentId);
  else components.delete(componentId);
  if (entry === undefined && !checked) return selection;
  return withEntry(selection, analysis.conceptId, {
    components,
    specimenConceptId: entry?.specimenConceptId ?? analysis.specimen?.conceptId ?? null,
  });
}

export function removeAnalysis(selection: LabSelection, analysisId: string): LabSelection {
  if (!selection.has(analysisId)) return selection;
  const next = new Map(selection);
  next.delete(analysisId);
  return next;
}

export function setSpecimen(
  selection: LabSelection,
  analysisId: string,
  specimenConceptId: string | null,
): LabSelection {
  const entry = selection.get(analysisId);
  if (entry === undefined || entry.specimenConceptId === specimenConceptId) return selection;
  return withEntry(selection, analysisId, { ...entry, specimenConceptId });
}

/**
 * Marca (o quita) de una vez todos los análisis visibles. Los que ya estaban
 * elegidos conservan lo que el médico había marcado.
 */
export function selectMany(
  selection: LabSelection,
  analyses: readonly LabAnalysisOption[],
  checked: boolean,
): LabSelection {
  const next = new Map(selection);
  for (const analysis of analyses) {
    if (!checked) {
      next.delete(analysis.conceptId);
    } else if (!next.has(analysis.conceptId)) {
      next.set(analysis.conceptId, entryFor(analysis, isSimpleAnalysis(analysis) ? new Set() : defaultComponentIds(analysis)));
    }
  }
  return next;
}

/** ¿El análisis elegido es un pedido válido? (simple presente, o panel con ≥ 1 componente) */
export function isOrderable(analysis: LabAnalysisOption, entry: LabSelectionEntry | undefined): boolean {
  if (entry === undefined) return false;
  if (isSimpleAnalysis(analysis)) return true;
  return analysis.components.some((c) => entry.components.has(c.conceptId));
}

/* ---------------------------------------------------------------------------
   Resumen y serialización
   ------------------------------------------------------------------------- */

/** Análisis elegidos (válidos o no), en el orden del catálogo. */
export function chosenAnalyses(
  analyses: readonly LabAnalysisOption[],
  selection: LabSelection,
): readonly LabAnalysisOption[] {
  return analyses.filter((a) => selection.has(a.conceptId));
}

export function summarize(analyses: readonly LabAnalysisOption[], selection: LabSelection): LabSelectionSummary {
  let analysisCount = 0;
  let componentCount = 0;
  const incompleteAnalysisIds: string[] = [];
  for (const analysis of chosenAnalyses(analyses, selection)) {
    const entry = selection.get(analysis.conceptId);
    if (!isOrderable(analysis, entry)) {
      incompleteAnalysisIds.push(analysis.conceptId);
      continue;
    }
    analysisCount += 1;
    componentCount += isSimpleAnalysis(analysis)
      ? 1
      : analysis.components.reduce((n, c) => n + (entry?.components.has(c.conceptId) ? 1 : 0), 0);
  }
  return { analysisCount, componentCount, incompleteAnalysisIds };
}

/**
 * Lo que viaja a la requisición. Sólo análisis que son pedido; orden del
 * catálogo; componentes en el orden del catálogo (nunca el de marcado). Un
 * análisis simple va con `componentConceptIds: []`.
 */
export function serializeSelection(
  analyses: readonly LabAnalysisOption[],
  selection: LabSelection,
): readonly LabOrderLine[] {
  const lines: LabOrderLine[] = [];
  for (const analysis of chosenAnalyses(analyses, selection)) {
    const entry = selection.get(analysis.conceptId);
    if (entry === undefined || !isOrderable(analysis, entry)) continue;
    lines.push({
      analysisConceptId: analysis.conceptId,
      componentConceptIds: isSimpleAnalysis(analysis)
        ? []
        : analysis.components.filter((c) => entry.components.has(c.conceptId)).map((c) => c.conceptId),
      specimenConceptId: entry.specimenConceptId,
    });
  }
  return lines;
}

/** Texto del contador, con plural correcto: «2 análisis · 7 componentes». */
export function summaryText(summary: LabSelectionSummary): string {
  const analyses = `${summary.analysisCount} análisis`;
  const components = `${summary.componentCount} ${summary.componentCount === 1 ? 'componente' : 'componentes'}`;
  return `${analyses} · ${components}`;
}
