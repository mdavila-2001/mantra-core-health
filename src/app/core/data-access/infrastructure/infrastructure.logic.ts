import type {
  CareSpaceNode,
  FunctionProfile,
  InfrastructureCatalog,
} from './infrastructure.types';

/* ============================================================================
    Lógica pura de la infraestructura: árbol, patrones y ayudas de formulario.

    Sin Angular, sin red y sin estado, para poder probarla de a una función. La
    comparten la pantalla y el backend simulado: por eso vive junto al cliente y
    no dentro de una feature.

    Nada de esto autoriza ni valida con valor de verdad. La API vuelve a validar
    cada regla (INV-03…INV-17); acá sólo se evita ofrecer lo que ya se sabe
    inválido y se muestra de antemano lo que la API va a crear.
    ========================================================================== */

/** Tope de espacios de una alta masiva (INV-17). */
export const MAX_ALTA_MASIVA = 200;

/**
 * Formas que pueden existir sin padre (§2). El catálogo las trae como reglas con
 * `parent: null`; esta lista es la ayuda de reserva si no vinieran.
 */
export const FORMAS_DE_RAIZ: readonly string[] = [
  'LOC_FORM_BUILDING',
  'LOC_FORM_AREA',
  'LOC_FORM_ROOM',
  'LOC_FORM_VIRTUAL',
];

export const ESTADO = {
  planificado: 'SPACE_PLANNED',
  activo: 'SPACE_ACTIVE',
  suspendido: 'SPACE_SUSPENDED',
  clausurado: 'SPACE_RETIRED',
} as const;

/* ---- árbol ------------------------------------------------------------------- */

/** Un espacio con sus hijos ya armados. */
export interface SpaceTreeItem {
  readonly space: CareSpaceNode;
  readonly children: readonly SpaceTreeItem[];
}

const COLLATOR = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/** Orden de hermanos: por código, con los números en su orden natural (301 antes de 1001). */
export function bySpaceCode(a: CareSpaceNode, b: CareSpaceNode): number {
  return COLLATOR.compare(a.code, b.code);
}

/**
 * Arma el árbol desde la lista plana con `parentId` que devuelve la API.
 *
 * Un nodo cuyo padre no está en la lista (filtrado, o datos a medias) se cuelga
 * de la raíz en vez de perderse: un espacio que desaparece del árbol es peor que
 * uno mal ubicado, y la ficha dice dónde está de verdad.
 */
export function buildSpaceTree(
  spaces: readonly CareSpaceNode[],
  visible: (space: CareSpaceNode) => boolean = () => true,
): readonly SpaceTreeItem[] {
  const presentes = new Map(spaces.filter(visible).map((s) => [s.id, s]));
  const hijos = new Map<string | null, CareSpaceNode[]>();
  for (const espacio of presentes.values()) {
    const padre = espacio.parentId !== null && presentes.has(espacio.parentId) ? espacio.parentId : null;
    const lista = hijos.get(padre) ?? [];
    lista.push(espacio);
    hijos.set(padre, lista);
  }
  const armar = (padre: string | null, visitados: ReadonlySet<string>): readonly SpaceTreeItem[] =>
    (hijos.get(padre) ?? [])
      .filter((s) => !visitados.has(s.id))
      .sort(bySpaceCode)
      .map((space) => ({ space, children: armar(space.id, new Set([...visitados, space.id])) }));
  return armar(null, new Set());
}

/** Los ids de un nodo y todos sus descendientes (incluye el propio). */
export function subtreeIds(spaces: readonly CareSpaceNode[], rootId: string): ReadonlySet<string> {
  const hijos = new Map<string, string[]>();
  for (const s of spaces) {
    if (s.parentId !== null) hijos.set(s.parentId, [...(hijos.get(s.parentId) ?? []), s.id]);
  }
  const salida = new Set<string>();
  const pendientes = [rootId];
  while (pendientes.length > 0) {
    const id = pendientes.pop()!;
    if (salida.has(id)) continue;
    salida.add(id);
    pendientes.push(...(hijos.get(id) ?? []));
  }
  return salida;
}

/** Los ancestros de un nodo, del más cercano a la raíz hacia él (sin incluirlo). */
export function ancestorsOf(spaces: readonly CareSpaceNode[], id: string): readonly CareSpaceNode[] {
  const porId = new Map(spaces.map((s) => [s.id, s]));
  const cadena: CareSpaceNode[] = [];
  let actual = porId.get(id);
  const vistos = new Set<string>();
  while (actual?.parentId != null && !vistos.has(actual.id)) {
    vistos.add(actual.id);
    const padre = porId.get(actual.parentId);
    if (padre === undefined) break;
    cadena.unshift(padre);
    actual = padre;
  }
  return cadena;
}

/* ---- reglas del catálogo (ayuda de formulario) ------------------------------- */

/** Formas que pueden colgar de `parentForm` (`null` = sin padre). */
export function allowedChildForms(catalog: InfrastructureCatalog, parentForm: string | null): readonly string[] {
  const reglas = catalog.parentRules.filter((r) => r.parent === parentForm).map((r) => r.child);
  if (reglas.length > 0 || parentForm !== null) return reglas;
  return FORMAS_DE_RAIZ;
}

/**
 * Funciones que se pueden ofrecer para una forma, dada la tipología del
 * establecimiento.
 *
 * La tipología filtra sólo si el catálogo le declara una lista de funciones
 * permitidas u obligatorias (`TYPO_ALLOWED` / `TYPO_REQUIRED`): una tipología sin
 * reglas no restringe nada. Es la lectura del modelo UPSS del plan; la API
 * decide (INV-06) y devuelve 422 si discrepa.
 */
export function functionsFor(
  catalog: InfrastructureCatalog,
  formCode: string,
  typologyCode: string | null,
): readonly FunctionProfile[] {
  const delaForma = catalog.functions.filter((f) => f.forms.includes(formCode));
  const reglas = typologyCode === null ? [] : catalog.typologyRules.filter((r) => r.typology === typologyCode);
  if (reglas.length === 0) return delaForma;
  const admitidas = new Set(reglas.map((r) => r.function));
  return delaForma.filter((f) => admitidas.has(f.code));
}

/** Funciones que la tipología exige y todavía no tienen ningún espacio vigente. */
export function missingRequiredFunctions(
  catalog: InfrastructureCatalog,
  typologyCode: string | null,
  spaces: readonly CareSpaceNode[],
): readonly string[] {
  if (typologyCode === null) return [];
  const presentes = new Set(
    spaces.filter((s) => s.status.code !== ESTADO.clausurado).map((s) => s.function.code),
  );
  return catalog.typologyRules
    .filter((r) => r.typology === typologyCode && r.rule === 'TYPO_REQUIRED')
    .map((r) => r.function)
    .filter((f) => !presentes.has(f));
}

/** Qué atributos técnicos pide el perfil de una función. */
export interface AttributeNeeds {
  readonly area: boolean;
  readonly hvac: boolean;
  readonly bed: boolean;
  readonly operatingRoom: boolean;
}

export function attributeNeeds(profile: FunctionProfile | null, formCode: string): AttributeNeeds {
  return {
    area: profile?.requiresArea === true,
    hvac: profile?.requiresHvac === true,
    bed: formCode === 'LOC_FORM_BED',
    operatingRoom: profile?.code === 'SPACE_FN_OPERATING_ROOM',
  };
}

/* ---- patrones de la alta masiva ---------------------------------------------- */

export interface ExpandedItem {
  readonly code: string;
  readonly name: string;
}

export type PatternExpansion =
  | { readonly ok: true; readonly items: readonly ExpandedItem[] }
  | { readonly ok: false; readonly reason: string };

const GRUPO = /\{([^{}]*)\}/g;

/** Los valores de un grupo `{A..H}` / `{1..12}` / `{01..12}`, o el motivo por el que no se pueden. */
function expandGroup(spec: string): { values: readonly string[] } | { error: string } {
  const partes = /^([^.]+)\.\.([^.]+)$/.exec(spec.trim());
  if (partes === null) return { error: `«{${spec}}» no es un rango: use {A..H} o {1..12}.` };
  const [, desde, hasta] = partes;
  if (/^\d+$/.test(desde) && /^\d+$/.test(hasta)) {
    const a = Number(desde);
    const b = Number(hasta);
    if (a > b) return { error: 'El rango debe ir de menor a mayor.' };
    const ancho = desde.length > 1 && desde.startsWith('0') ? desde.length : 0;
    return {
      values: Array.from({ length: b - a + 1 }, (_, i) => String(a + i).padStart(ancho, '0')),
    };
  }
  if (/^[A-Za-z]$/.test(desde) && /^[A-Za-z]$/.test(hasta)) {
    const a = desde.charCodeAt(0);
    const b = hasta.charCodeAt(0);
    if (/[a-z]/.test(desde) !== /[a-z]/.test(hasta)) return { error: 'Las dos letras del rango deben ser del mismo tipo.' };
    if (a > b) return { error: 'El rango debe ir de menor a mayor.' };
    return { values: Array.from({ length: b - a + 1 }, (_, i) => String.fromCharCode(a + i)) };
  }
  return { error: `«{${spec}}» mezcla letras y números o usa más de una letra.` };
}

/**
 * Expande `301-{A..H}` y `Cama 301-{A..H}` en la lista de códigos y nombres que
 * la alta masiva va a crear. Un solo rango por patrón; el nombre usa el mismo
 * valor que el código. Si el patrón del nombre no lleva rango, se le agrega el
 * valor al final (SUPUESTO F1: el contrato no lo precisa; la API manda).
 */
export function expandPattern(codePattern: string, namePattern: string, max = MAX_ALTA_MASIVA): PatternExpansion {
  const codigo = codePattern.trim();
  if (codigo === '') return { ok: false, reason: 'Escriba el patrón del código, por ejemplo 301-{A..H}.' };
  const grupos = [...codigo.matchAll(GRUPO)];
  if (grupos.length !== 1) {
    return { ok: false, reason: 'El patrón del código debe tener exactamente un rango, por ejemplo {A..H} o {1..12}.' };
  }
  const resultado = expandGroup(grupos[0][1]);
  if ('error' in resultado) return { ok: false, reason: resultado.error };
  if (resultado.values.length > max) {
    return { ok: false, reason: `Son ${resultado.values.length} espacios; el máximo por alta masiva es ${max}.` };
  }
  const nombre = namePattern.trim();
  if (nombre === '') return { ok: false, reason: 'Escriba el patrón del nombre, por ejemplo Cama 301-{A..H}.' };
  const gruposNombre = [...nombre.matchAll(GRUPO)];
  if (gruposNombre.length > 1) return { ok: false, reason: 'El patrón del nombre admite a lo sumo un rango.' };
  const items = resultado.values.map((valor) => ({
    code: codigo.replace(GRUPO, valor),
    name: gruposNombre.length === 1 ? nombre.replace(GRUPO, valor) : `${nombre} ${valor}`,
  }));
  return { ok: true, items };
}
