import type {
  GlossaryNeighbor,
  GlossaryNeighborGroup,
  GlossaryNeighborhood,
  GlossaryRelationType,
} from '../../core/data-access/terminology/terminology.types';

/* ============================================================================
    La ruta clínica: cómo se reparte el vecindario de un término en columnas.

    El mapa anterior ponía todos los vecinos en un solo anillo y se volvía
    ilegible pasados los quince. Acá cada vecino va a una columna según QUÉ ES
    (su categoría: síntoma, enfermedad, estudio, tratamiento…), no según el
    tipo de relación: el corpus guarda muchas relaciones dos veces, una por
    sentido y con tipos distintos («Tos → enfermedad» y «neumonía → síntoma →
    Tos»), y lo que el lector quiere ver es «qué enfermedades», una sola vez.

    Las columnas se ordenan como razona un médico y se reparten en tres zonas:
    lo que se observa (a la izquierda del término), lo que sigue —diagnóstico,
    estudio, tratamiento, derivación— (a la derecha) y el resto (abajo).
    ========================================================================== */

export type RouteColumnKey =
  | 'symptoms'
  | 'anatomy'
  | 'diseases'
  | 'tests'
  | 'treatments'
  | 'procedures'
  | 'specialties'
  | 'equipment'
  | 'related';

export type RouteZone = 'findings' | 'next' | 'context';

/** De dónde sale una columna: los grupos que hay que pedir enteros para completarla. */
export interface RouteGroupRef {
  readonly type: GlossaryRelationType;
  readonly direction: GlossaryNeighborGroup['direction'];
}

export interface RouteColumn {
  readonly key: RouteColumnKey;
  readonly title: string;
  readonly zone: RouteZone;
  /** Vecinos sin repetir, en orden alfabético. */
  readonly items: readonly GlossaryNeighbor[];
  /** Si ya vinieron todos los vecinos de sus grupos (no hay «Ver todos»). */
  readonly complete: boolean;
  readonly sources: readonly RouteGroupRef[];
}

export interface ClinicalRoute {
  readonly findings: readonly RouteColumn[];
  readonly next: readonly RouteColumn[];
  readonly context: readonly RouteColumn[];
  /** Vecinos distintos en todo el mapa. */
  readonly neighborCount: number;
}

/** El orden clínico de las columnas dentro de su zona. */
const COLUMN_ORDER: readonly RouteColumnKey[] = [
  'symptoms',
  'anatomy',
  'diseases',
  'tests',
  'treatments',
  'procedures',
  'specialties',
  'equipment',
  'related',
];

/** La columna de un vecino por su categoría del glosario (`glossary-category-<key>`). */
const COLUMN_BY_CATEGORY: Readonly<Record<string, RouteColumnKey>> = {
  'glossary-category-signs-symptoms': 'symptoms',
  'glossary-category-anatomy': 'anatomy',
  'glossary-category-disease': 'diseases',
  'glossary-category-diagnostic-test': 'tests',
  'glossary-category-lab': 'tests',
  'glossary-category-imaging': 'tests',
  'glossary-category-treatment': 'treatments',
  'glossary-category-pharmacology': 'treatments',
  'glossary-category-procedure': 'procedures',
  'glossary-category-care': 'procedures',
  'glossary-category-specialty': 'specialties',
  'glossary-category-equipment': 'equipment',
};

/**
 * Sin categoría útil («Otro» o ninguna), el tipo de relación decide. Una
 * relación entrante habla del origen: «X → síntoma → foco» hace de X una
 * enfermedad.
 */
function columnByRelation(type: GlossaryRelationType, direction: RouteGroupRef['direction']): RouteColumnKey {
  const outgoing = direction === 'outgoing';
  switch (type) {
    case 'SYMPTOM':
      return outgoing ? 'symptoms' : 'diseases';
    case 'DIAGNOSTIC_TEST':
      return outgoing ? 'tests' : 'diseases';
    case 'TREATMENT':
      return outgoing ? 'treatments' : 'diseases';
    case 'PROCEDURE':
      return outgoing ? 'procedures' : 'diseases';
    case 'ANATOMY':
      return outgoing ? 'anatomy' : 'diseases';
    case 'SPECIALTY':
      return outgoing ? 'specialties' : 'diseases';
    case 'DISEASE':
      return 'diseases';
    case 'INCLUDES':
    case 'PERFORMS':
    case 'SENDS_DATA_TO':
      return 'equipment';
    case 'RELATED_TERM':
      return 'related';
  }
}

function columnOf(neighbor: GlossaryNeighbor, group: RouteGroupRef): RouteColumnKey {
  // «Término relacionado» es la relación más débil del corpus: va aparte
  // aunque el vecino sea una enfermedad, para no mezclarla con las tipadas.
  if (group.type === 'RELATED_TERM') return 'related';
  const byCategory = neighbor.category && COLUMN_BY_CATEGORY[neighbor.category.internalCode];
  return byCategory || columnByRelation(group.type, group.direction);
}

/** El título de una columna, que depende de qué es el término central. */
function titleOf(key: RouteColumnKey, focusColumn: RouteColumnKey | null): string {
  switch (key) {
    case 'symptoms':
      return focusColumn === 'symptoms' ? 'Síntomas relacionados' : 'Síntomas y signos';
    case 'anatomy':
      return focusColumn === 'diseases' ? 'Localización' : 'Anatomía';
    case 'diseases':
      switch (focusColumn) {
        case 'symptoms':
          return 'Enfermedades que lo presentan';
        case 'specialties':
          return 'Enfermedades que atiende';
        case 'treatments':
          return 'Se usa en';
        case 'tests':
          return 'Enfermedades que estudia';
        case 'anatomy':
          return 'Enfermedades de esta zona';
        case 'diseases':
          return 'Enfermedades relacionadas';
        default:
          return 'Enfermedades';
      }
    case 'tests':
      return 'Estudios';
    case 'treatments':
      return 'Tratamientos';
    case 'procedures':
      return 'Procedimientos';
    case 'specialties':
      return 'Especialidades';
    case 'equipment':
      return 'Equipos y flujo de datos';
    case 'related':
      return 'Términos relacionados';
  }
}

/**
 * La zona de una columna. Lo que es del mismo tipo que el término central
 * (los síntomas de un síntoma, las enfermedades de una enfermedad) no es ni
 * «lo que se observa» ni «lo que sigue»: va al contexto.
 */
function zoneOf(key: RouteColumnKey, focusColumn: RouteColumnKey | null): RouteZone {
  if (key === 'related' || key === focusColumn) return 'context';
  return key === 'symptoms' || key === 'anatomy' ? 'findings' : 'next';
}

/**
 * Reparte el vecindario en la ruta clínica.
 *
 * @param neighborhood - Lo que devolvió la API (muestras o grupos enteros).
 * @returns Las columnas no vacías, en orden clínico, por zona.
 */
export function buildClinicalRoute(neighborhood: GlossaryNeighborhood): ClinicalRoute {
  const focusCode = neighborhood.focus.category?.internalCode;
  const focusColumn = (focusCode && COLUMN_BY_CATEGORY[focusCode]) || null;

  const byColumn = new Map<
    RouteColumnKey,
    { items: Map<string, GlossaryNeighbor>; sources: Map<string, RouteGroupRef>; complete: boolean }
  >();
  const typed = new Set<string>();
  const all = new Set<string>();

  // Las tipadas primero: si un vecino también es «término relacionado», ya
  // quedó en su columna de verdad y no se repite abajo.
  const ordered = [...neighborhood.groups].sort(
    (a, b) => Number(a.type === 'RELATED_TERM') - Number(b.type === 'RELATED_TERM'),
  );
  for (const group of ordered) {
    const ref: RouteGroupRef = { type: group.type, direction: group.direction };
    const groupComplete = group.items.length >= group.total;
    for (const neighbor of group.items) {
      if (neighbor.conceptId === neighborhood.focus.conceptId) continue;
      if (group.type === 'RELATED_TERM' && typed.has(neighbor.conceptId)) continue;
      if (group.type !== 'RELATED_TERM') typed.add(neighbor.conceptId);
      all.add(neighbor.conceptId);
      const key = columnOf(neighbor, ref);
      let column = byColumn.get(key);
      if (column === undefined) {
        column = { items: new Map(), sources: new Map(), complete: true };
        byColumn.set(key, column);
      }
      column.items.set(neighbor.conceptId, neighbor);
      column.sources.set(`${ref.type}|${ref.direction}`, ref);
      column.complete &&= groupComplete;
    }
  }

  const columns = COLUMN_ORDER.flatMap((key): RouteColumn[] => {
    const column = byColumn.get(key);
    if (column === undefined || column.items.size === 0) return [];
    return [
      {
        key,
        title: titleOf(key, focusColumn),
        zone: zoneOf(key, focusColumn),
        items: [...column.items.values()].sort((a, b) => a.display.localeCompare(b.display, 'es')),
        complete: column.complete,
        sources: [...column.sources.values()],
      },
    ];
  });

  return {
    findings: columns.filter((c) => c.zone === 'findings'),
    next: columns.filter((c) => c.zone === 'next'),
    context: columns.filter((c) => c.zone === 'context'),
    neighborCount: all.size,
  };
}

/**
 * Reemplaza en el vecindario los grupos que llegaron enteros (al pedir «Ver
 * todos»). Un grupo entero pisa a su muestra; los demás quedan como estaban.
 */
export function mergeFullGroups(
  neighborhood: GlossaryNeighborhood,
  fullGroups: readonly GlossaryNeighborGroup[],
): GlossaryNeighborhood {
  if (fullGroups.length === 0) return neighborhood;
  const key = (g: RouteGroupRef) => `${g.type}|${g.direction}`;
  const full = new Map(fullGroups.map((g) => [key(g), g]));
  return {
    ...neighborhood,
    groups: neighborhood.groups.map((g) => full.get(key(g)) ?? g),
  };
}
