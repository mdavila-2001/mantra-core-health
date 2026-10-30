import { HttpErrorResponse } from '@angular/common/http';

import type {
  BlockerNextAction,
  CareSpaceNode,
  FunctionProfile,
  ImportRow,
  InfrastructureCatalog,
  RetireBlocker,
  RetireBlockerKind,
} from './infrastructure.types';

/* ============================================================================
    Reglas de la infraestructura que la pantalla necesita **antes** de
    preguntarle a la API.

    Ninguna de estas funciones autoriza ni decide: la API vuelve a validar cada
    una (§3 del contrato). Existen para no ofrecer lo imposible —una cama
    colgando de un edificio, un quirófano en un Puesto de Salud— y para que
    quien arma una planilla vea sus errores antes de mandarla.

    Las reglas son **datos del catálogo**, nunca `if` en el código (§2: «Umbrales
    y reglas son datos»). Acá sólo se recorren.
    ========================================================================== */

/** Tope del alta masiva y de la importación, el mismo que declara la API. */
export const MAX_ALTA_MASIVA = 200;

/** Estado de ciclo de vida que cuenta como «vivo» para reglas de padre. */
const ESTADOS_QUE_ADMITEN_HIJOS: ReadonlySet<string> = new Set(['SPACE_ACTIVE', 'SPACE_PLANNED']);

/* ---- formas y funciones --------------------------------------------------- */

/**
 * Formas que pueden colgar de un padre de la forma dada.
 *
 * @param catalogo - Catálogo de la API.
 * @param formaDelPadre - `LOC_FORM_*` del padre, o `null` para la raíz.
 * @returns Los códigos de forma permitidos, en el orden del catálogo.
 */
export function formasHijasPermitidas(
  catalogo: InfrastructureCatalog,
  formaDelPadre: string | null,
): readonly string[] {
  const permitidas = new Set(
    catalogo.parentRules.filter((r) => r.parent === formaDelPadre).map((r) => r.child),
  );
  return catalogo.forms.map((f) => f.code).filter((code) => permitidas.has(code));
}

/** ¿Puede un hijo de forma `hija` colgar de un padre de forma `padre`? */
export function admiteHijo(
  catalogo: InfrastructureCatalog,
  formaDelPadre: string | null,
  formaHija: string,
): boolean {
  return catalogo.parentRules.some((r) => r.parent === formaDelPadre && r.child === formaHija);
}

/** Las funciones que el perfil admite para una forma. */
export function funcionesParaForma(
  catalogo: InfrastructureCatalog,
  forma: string,
): readonly FunctionProfile[] {
  return catalogo.functions.filter((f) => f.forms.includes(forma));
}

/** El perfil de una función, o `null` si el catálogo no la conoce. */
export function perfilDe(
  catalogo: InfrastructureCatalog,
  funcion: string | null | undefined,
): FunctionProfile | null {
  if (!funcion) return null;
  return catalogo.functions.find((f) => f.code === funcion) ?? null;
}

/**
 * ¿La tipología del establecimiento admite esta función?
 *
 * Una tipología **sin** reglas `TYPO_ALLOWED` no restringe. Con al menos una,
 * sólo se admite lo que figura como permitido u obligatorio. Es la lectura de
 * la lista blanca que siembra la API (§2, «Reglas de tipología»).
 */
export function tipologiaAdmite(
  catalogo: InfrastructureCatalog,
  tipologia: string | null | undefined,
  funcion: string,
): boolean {
  if (!tipologia) return true;
  const reglas = catalogo.typologyRules.filter((r) => r.typology === tipologia);
  const conListaBlanca = reglas.some((r) => r.rule === 'TYPO_ALLOWED');
  if (!conListaBlanca) return true;
  return reglas.some((r) => r.function === funcion);
}

/** Funciones obligatorias de la tipología que todavía no tiene ningún espacio activo. */
export function funcionesObligatoriasFaltantes(
  catalogo: InfrastructureCatalog,
  tipologia: string | null | undefined,
  espacios: readonly CareSpaceNode[],
): readonly string[] {
  if (!tipologia) return [];
  const presentes = new Set(
    espacios.filter((e) => e.status.code === 'SPACE_ACTIVE').map((e) => e.function.code),
  );
  return catalogo.typologyRules
    .filter((r) => r.typology === tipologia && r.rule === 'TYPO_REQUIRED')
    .map((r) => r.function)
    .filter((f) => !presentes.has(f));
}

/* ---- árbol ----------------------------------------------------------------- */

/** Un nodo con sus hijos ya armados. */
export interface NodoArmado<T> {
  readonly item: T;
  readonly children: readonly NodoArmado<T>[];
}

/**
 * Arma el árbol a partir de la lista plana con `parentId`.
 *
 * Un nodo cuyo padre no vino en la lista sube a la raíz: no se pierde de vista
 * por un recorte de la respuesta. Los hermanos se ordenan por código, que es
 * lo que la persona espera leer («301, 302, 303»).
 */
export function armarArbol<T extends { readonly id: string; readonly parentId: string | null; readonly code: string }>(
  items: readonly T[],
): readonly NodoArmado<T>[] {
  const ids = new Set(items.map((i) => i.id));
  const hijos = new Map<string | null, T[]>();
  for (const item of items) {
    const padre = item.parentId !== null && ids.has(item.parentId) ? item.parentId : null;
    const lista = hijos.get(padre) ?? [];
    lista.push(item);
    hijos.set(padre, lista);
  }
  const visitados = new Set<string>();
  const armar = (padre: string | null): NodoArmado<T>[] =>
    [...(hijos.get(padre) ?? [])]
      .sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }))
      .filter((item) => {
        // Defensa ante un ciclo en datos ajenos: un nodo se arma una sola vez.
        if (visitados.has(item.id)) return false;
        visitados.add(item.id);
        return true;
      })
      .map((item) => ({ item, children: armar(item.id) }));
  const raices = armar(null);
  // Lo que quedó sin visitar está en un ciclo (dato ajeno roto): se muestra
  // en la raíz en vez de desaparecer, para que alguien lo pueda corregir.
  const sueltos = items
    .filter((item) => !visitados.has(item.id))
    .map((item) => {
      visitados.add(item.id);
      return { item, children: [] as NodoArmado<T>[] };
    });
  return [...raices, ...sueltos];
}

/** Los ids de todos los descendientes de un nodo (sin incluirlo). */
export function descendientesDe(
  items: readonly { readonly id: string; readonly parentId: string | null }[],
  id: string,
): ReadonlySet<string> {
  const resultado = new Set<string>();
  const pendientes = [id];
  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    for (const item of items) {
      if (item.parentId === actual && !resultado.has(item.id)) {
        resultado.add(item.id);
        pendientes.push(item.id);
      }
    }
  }
  return resultado;
}

/**
 * Los padres a los que se puede mover un espacio.
 *
 * Fuera quedan él mismo, sus descendientes (sería un ciclo, 422 `SPACE_CYCLE`),
 * los retirados o suspendidos y los que la regla de formas no admite.
 * `incluyeRaiz` dice si la forma puede vivir sin padre.
 */
export function padresValidos(
  catalogo: InfrastructureCatalog,
  espacios: readonly CareSpaceNode[],
  forma: string,
  excluir: string | null = null,
): { readonly incluyeRaiz: boolean; readonly padres: readonly CareSpaceNode[] } {
  const prohibidos = excluir === null ? new Set<string>() : new Set([excluir, ...descendientesDe(espacios, excluir)]);
  return {
    incluyeRaiz: admiteHijo(catalogo, null, forma),
    padres: espacios
      .filter((e) => !prohibidos.has(e.id))
      .filter((e) => ESTADOS_QUE_ADMITEN_HIJOS.has(e.status.code))
      .filter((e) => admiteHijo(catalogo, e.form.code, forma))
      .sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true })),
  };
}

/* ---- alta masiva ---------------------------------------------------------- */

export type ResultadoDePatron =
  | { readonly ok: true; readonly valores: readonly string[] }
  | { readonly ok: false; readonly error: string };

const RANGO = /\{([A-Za-z]|\d+)\.\.([A-Za-z]|\d+)\}/;

/**
 * Expande un patrón de alta masiva: `"301-{A..H}"` → `301-A … 301-H`,
 * `"CAMA-{1..12}"` → `CAMA-1 … CAMA-12`, `"CAMA-{01..12}"` con ceros.
 *
 * Un solo rango por patrón; letras con letras y números con números; nunca más
 * de {@link MAX_ALTA_MASIVA}. Es la misma regla que aplica la API: acá se
 * aplica para mostrar la vista previa y el error antes de enviar.
 */
export function expandirPatron(patron: string): ResultadoDePatron {
  const limpio = patron.trim();
  if (limpio === '') return { ok: false, error: 'Escribí un patrón, por ejemplo 301-{A..H}.' };
  const coincidencia = RANGO.exec(limpio);
  if (coincidencia === null) {
    return { ok: false, error: 'El patrón necesita un rango entre llaves: {A..H} o {1..12}.' };
  }
  const resto = limpio.slice(0, coincidencia.index) + limpio.slice(coincidencia.index + coincidencia[0].length);
  if (RANGO.test(resto)) return { ok: false, error: 'Usá un solo rango por patrón.' };
  if (/[{}]/.test(resto)) return { ok: false, error: 'Hay llaves sueltas fuera del rango.' };

  const [, desde, hasta] = coincidencia as unknown as [string, string, string];
  const antes = limpio.slice(0, coincidencia.index);
  const despues = limpio.slice(coincidencia.index + coincidencia[0].length);
  const numerico = /^\d+$/.test(desde);
  if (numerico !== /^\d+$/.test(hasta)) {
    return { ok: false, error: 'El rango mezcla letras y números.' };
  }

  let valores: string[];
  if (numerico) {
    const a = Number(desde);
    const b = Number(hasta);
    if (b < a) return { ok: false, error: 'El rango va de menor a mayor.' };
    if (b - a + 1 > MAX_ALTA_MASIVA) {
      return { ok: false, error: `El rango genera ${b - a + 1} espacios; el tope es ${MAX_ALTA_MASIVA}.` };
    }
    const ancho = desde.startsWith('0') && desde.length > 1 ? desde.length : 0;
    valores = Array.from({ length: b - a + 1 }, (_, i) => String(a + i).padStart(ancho, '0'));
  } else {
    if ((desde === desde.toUpperCase()) !== (hasta === hasta.toUpperCase())) {
      return { ok: false, error: 'El rango mezcla mayúsculas y minúsculas.' };
    }
    const a = desde.charCodeAt(0);
    const b = hasta.charCodeAt(0);
    if (b < a) return { ok: false, error: 'El rango va de menor a mayor.' };
    valores = Array.from({ length: b - a + 1 }, (_, i) => String.fromCharCode(a + i));
  }
  return { ok: true, valores: valores.map((v) => `${antes}${v}${despues}`) };
}

/**
 * Los nombres del alta masiva.
 *
 * Si el patrón de nombre trae su propio rango, se expande y tiene que generar
 * la misma cantidad que el de código. Si no lo trae, se le agrega el valor del
 * rango del código al final: «Cama» → «Cama A», «Cama B»…
 */
export function nombresDelAltaMasiva(
  patronDeCodigo: string,
  patronDeNombre: string,
): ResultadoDePatron {
  const codigos = expandirPatron(patronDeCodigo);
  if (!codigos.ok) return codigos;
  const nombre = patronDeNombre.trim();
  if (nombre === '') return { ok: false, error: 'Escribí un nombre base, por ejemplo «Cama {A..H}».' };
  if (RANGO.test(nombre)) {
    const nombres = expandirPatron(nombre);
    if (!nombres.ok) return nombres;
    if (nombres.valores.length !== codigos.valores.length) {
      return {
        ok: false,
        error: `El nombre genera ${nombres.valores.length} y el código ${codigos.valores.length}: tienen que coincidir.`,
      };
    }
    return nombres;
  }
  const coincidencia = RANGO.exec(patronDeCodigo.trim())!;
  const valores = expandirPatron(coincidencia[0]);
  return valores.ok ? { ok: true, valores: valores.valores.map((v) => `${nombre} ${v}`) } : valores;
}

/* ---- importación CSV ------------------------------------------------------ */

export interface ErrorDeParseo {
  readonly line: number;
  readonly field: string;
  readonly reason: string;
}

export interface ResultadoDeParseo {
  readonly rows: readonly ImportRow[];
  readonly errors: readonly ErrorDeParseo[];
}

/** Columnas del CSV → campo de `ImportRow`. Encabezado en español o en inglés. */
const COLUMNAS: Readonly<Record<string, keyof ImportRow>> = {
  code: 'code', codigo: 'code',
  name: 'name', nombre: 'name',
  form: 'formCode', formcode: 'formCode', forma: 'formCode',
  function: 'functionCode', functioncode: 'functionCode', funcion: 'functionCode',
  parent: 'parentCode', parentcode: 'parentCode', padre: 'parentCode',
  description: 'description', descripcion: 'description',
  capacity: 'capacity', capacidad: 'capacity',
  floor: 'floorNumber', floornumber: 'floorNumber', piso: 'floorNumber',
  aream2: 'areaM2', area: 'areaM2', superficie: 'areaM2',
  asepsis: 'asepsisCode', asepsiscode: 'asepsisCode',
  pressure: 'pressureCode', pressurecode: 'pressureCode', presion: 'pressureCode',
  airchangesperhour: 'airChangesPerHour', ach: 'airChangesPerHour', renovaciones: 'airChangesPerHour',
  sex: 'sexRestrictionCode', sexo: 'sexRestrictionCode',
  agegroup: 'ageGroupCode', edad: 'ageGroupCode',
  bedcategory: 'bedCategoryCode', categoria: 'bedCategoryCode',
  censable: 'censable',
  gln: 'gln',
};

const OBLIGATORIAS: readonly (keyof ImportRow)[] = ['code', 'name', 'formCode', 'functionCode'];
const NUMERICAS: ReadonlySet<keyof ImportRow> = new Set(['capacity', 'floorNumber', 'areaM2', 'airChangesPerHour']);

/** Prefijo de cada familia de códigos: se acepta `ROOM` por `LOC_FORM_ROOM`. */
const PREFIJOS: Partial<Record<keyof ImportRow, string>> = {
  formCode: 'LOC_FORM_',
  functionCode: 'SPACE_FN_',
  asepsisCode: 'ASEPSIS_',
  pressureCode: 'PRESSURE_',
  sexRestrictionCode: 'SEX_',
  ageGroupCode: 'AGE_',
  bedCategoryCode: 'BED_CAT_',
};

function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Parte una línea respetando comillas dobles y `""` como comilla escapada. */
export function partirLineaCsv(linea: string, separador: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]!;
    if (entreComillas) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        actual += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === separador) {
      campos.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos.map((c) => c.trim());
}

/**
 * Parsea el CSV de importación **en el cliente** (§3: «el cliente parsea el CSV»).
 *
 * - Separador `,` o `;` —el Excel en español exporta con punto y coma—, elegido
 *   por el que más aparece en el encabezado.
 * - La primera línea es el encabezado; columnas desconocidas se informan, no se
 *   descartan en silencio.
 * - `line` es la línea **del archivo** (la 1 es el encabezado), que es lo que
 *   la persona busca en su planilla.
 * - Los códigos cortos (`ROOM`, `BED`) se completan con su prefijo.
 *
 * Lo que valida acá es forma, no negocio: que estén las obligatorias y que lo
 * numérico sea número. Padres, reglas y unicidad los valida el dry-run.
 */
export function parsearCsv(texto: string): ResultadoDeParseo {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/);
  const errores: ErrorDeParseo[] = [];
  const filas: ImportRow[] = [];
  const indiceEncabezado = lineas.findIndex((l) => l.trim() !== '');
  if (indiceEncabezado === -1) {
    return { rows: [], errors: [{ line: 1, field: 'archivo', reason: 'El archivo está vacío.' }] };
  }
  const encabezadoCrudo = lineas[indiceEncabezado]!;
  const separador =
    (encabezadoCrudo.match(/;/g)?.length ?? 0) > (encabezadoCrudo.match(/,/g)?.length ?? 0) ? ';' : ',';
  const encabezado = partirLineaCsv(encabezadoCrudo, separador).map((h) =>
    sinAcentos(h).toLowerCase().replace(/[\s_-]/g, ''),
  );
  const campos = encabezado.map((h) => COLUMNAS[h] ?? null);
  encabezado.forEach((h, i) => {
    if (campos[i] === null && h !== '') {
      errores.push({ line: indiceEncabezado + 1, field: h, reason: 'Columna desconocida: se ignora.' });
    }
  });
  const faltantes = OBLIGATORIAS.filter((o) => !campos.includes(o));
  if (faltantes.length > 0) {
    errores.push({
      line: indiceEncabezado + 1,
      field: faltantes.join(', '),
      reason: 'Faltan columnas obligatorias en el encabezado.',
    });
    return { rows: [], errors: errores };
  }

  for (let i = indiceEncabezado + 1; i < lineas.length; i++) {
    const cruda = lineas[i]!;
    if (cruda.trim() === '') continue;
    const numero = i + 1;
    const valores = partirLineaCsv(cruda, separador);
    const fila: Record<string, unknown> = { line: numero, parentCode: null };
    let conError = false;
    campos.forEach((campo, j) => {
      if (campo === null) return;
      const valor = valores[j] ?? '';
      if (valor === '') return;
      if (NUMERICAS.has(campo)) {
        const n = Number(valor.replace(',', '.'));
        if (!Number.isFinite(n)) {
          errores.push({ line: numero, field: campo, reason: `«${valor}» no es un número.` });
          conError = true;
          return;
        }
        fila[campo] = n;
      } else if (campo === 'censable') {
        fila[campo] = /^(si|sí|true|1|yes)$/i.test(valor);
      } else {
        const prefijo = PREFIJOS[campo];
        fila[campo] =
          prefijo !== undefined && !valor.toUpperCase().startsWith(prefijo)
            ? `${prefijo}${valor.toUpperCase()}`
            : prefijo !== undefined
              ? valor.toUpperCase()
              : valor;
      }
    });
    for (const obligatoria of OBLIGATORIAS) {
      if (fila[obligatoria] === undefined) {
        errores.push({ line: numero, field: obligatoria, reason: 'Campo obligatorio vacío.' });
        conError = true;
      }
    }
    if (filas.length >= MAX_ALTA_MASIVA) {
      errores.push({ line: numero, field: 'archivo', reason: `Más de ${MAX_ALTA_MASIVA} filas: partí el archivo.` });
      break;
    }
    if (!conError) filas.push(fila as unknown as ImportRow);
  }
  if (filas.length === 0 && errores.length === 0) {
    errores.push({ line: indiceEncabezado + 1, field: 'archivo', reason: 'El archivo no tiene filas de datos.' });
  }
  return { rows: filas, errors: errores };
}

/* ---- errores de dominio --------------------------------------------------- */

/** Lo que la pantalla necesita de un error de la API de infraestructura. */
export interface ErrorDeInfraestructura {
  readonly status: number;
  readonly code: string | null;
  /** Sub-código de negocio (`SPACE_CODE_TAKEN`, `SPACE_RETIRE_BLOCKED`…). */
  readonly reason: string | null;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
}

/**
 * Lee `reason` y `details` del cuerpo común de `DomainException`.
 *
 * Se ramifica por `reason`, nunca por `message` (ADR-0005): el mensaje es
 * texto humano y puede cambiar de redacción.
 */
export function leerErrorDeInfraestructura(error: unknown): ErrorDeInfraestructura | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const cuerpo: unknown = error.error;
  const registro = typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
  const detalles = registro['details'];
  return {
    status: error.status,
    code: typeof registro['code'] === 'string' ? registro['code'] : null,
    reason:
      typeof registro['reason'] === 'string'
        ? registro['reason']
        : typeof (detalles as Record<string, unknown> | undefined)?.['reason'] === 'string'
          ? ((detalles as Record<string, unknown>)['reason'] as string)
          : null,
    message: typeof registro['message'] === 'string' ? registro['message'] : '',
    details: typeof detalles === 'object' && detalles !== null && !Array.isArray(detalles)
      ? (detalles as Record<string, unknown>)
      : {},
  };
}

const TIPOS_DE_BLOQUEO: ReadonlySet<string> = new Set<RetireBlockerKind>([
  'ACTIVE_CHILDREN',
  'ACTIVE_ENCOUNTER',
  'FUTURE_PROCEDURE',
  'FUTURE_BOOKING',
  'SCHEDULABLE_RESOURCE',
  'INVENTORY_LOCATION',
  'EQUIPMENT',
]);

/**
 * Normaliza la lista de bloqueos que trae la API.
 *
 * `nextAction` puede llegar como texto o como `{label, route}`: el contrato no
 * fija su forma, y la pantalla la necesita siempre como objeto. Un bloqueo de
 * tipo desconocido se conserva —un bloqueo no se esconde— con su próxima acción
 * genérica.
 */
export function normalizarBloqueos(crudo: unknown): readonly RetireBlocker[] {
  if (!Array.isArray(crudo)) return [];
  return crudo
    .filter((b): b is Record<string, unknown> => typeof b === 'object' && b !== null)
    .map((b) => {
      const kind = String(b['kind'] ?? '');
      const accion = b['nextAction'];
      const nextAction: BlockerNextAction =
        typeof accion === 'string'
          ? { label: accion }
          : typeof accion === 'object' && accion !== null && typeof (accion as Record<string, unknown>)['label'] === 'string'
            ? {
                label: (accion as Record<string, string>)['label']!,
                ...(typeof (accion as Record<string, unknown>)['route'] === 'string'
                  ? { route: (accion as Record<string, string>)['route'] }
                  : {}),
              }
            : { label: ETIQUETA_DE_BLOQUEO[kind as RetireBlockerKind]?.accion ?? 'Resolver el bloqueo' };
      return {
        kind: (TIPOS_DE_BLOQUEO.has(kind) ? kind : kind || 'ACTIVE_CHILDREN') as RetireBlockerKind,
        count: typeof b['count'] === 'number' ? b['count'] : 0,
        sampleIds: Array.isArray(b['sampleIds']) ? b['sampleIds'].map(String) : [],
        nextAction,
      };
    });
}

/** Los bloqueos de un 409 `SPACE_RETIRE_BLOCKED`, o `null` si el error es otro. */
export function bloqueosDelError(error: unknown): readonly RetireBlocker[] | null {
  const leido = leerErrorDeInfraestructura(error);
  if (leido === null || leido.reason !== 'SPACE_RETIRE_BLOCKED') return null;
  return normalizarBloqueos(leido.details['blockers']);
}

/** Cómo se dice cada bloqueo, y qué hacer por omisión. */
export const ETIQUETA_DE_BLOQUEO: Readonly<Record<RetireBlockerKind, { readonly titulo: string; readonly accion: string }>> = {
  ACTIVE_CHILDREN: { titulo: 'Espacios hijos activos', accion: 'Retirar o mover los espacios hijos' },
  ACTIVE_ENCOUNTER: { titulo: 'Pacientes internados o en atención', accion: 'Dar el alta o trasladar al paciente' },
  FUTURE_PROCEDURE: { titulo: 'Cirugías o procedimientos programados', accion: 'Reprogramar las intervenciones' },
  FUTURE_BOOKING: { titulo: 'Citas futuras', accion: 'Reubicar las citas' },
  SCHEDULABLE_RESOURCE: { titulo: 'Recurso de agenda vigente', accion: 'Dar de baja el recurso de agenda' },
  INVENTORY_LOCATION: { titulo: 'Stock ubicado en el espacio', accion: 'Trasladar el stock a otro depósito' },
  EQUIPMENT: { titulo: 'Equipos instalados', accion: 'Reubicar los equipos' },
};

/* ---- presentación --------------------------------------------------------- */

/** Variante del badge por **código** de ciclo de vida o disponibilidad. */
export const VARIANTE_DE_ESTADO: Readonly<Record<string, 'success' | 'warning' | 'secondary' | 'error' | 'info'>> = {
  SPACE_PLANNED: 'info',
  SPACE_ACTIVE: 'success',
  SPACE_SUSPENDED: 'warning',
  SPACE_RETIRED: 'secondary',
  UNIT_PLANNED: 'info',
  UNIT_ACTIVE: 'success',
  UNIT_SUSPENDED: 'warning',
  UNIT_RETIRED: 'secondary',
  SPACE_OP_AVAILABLE: 'success',
  SPACE_OP_MAINTENANCE: 'warning',
  SPACE_OP_CLOSED: 'error',
  LIC_VALID: 'success',
  LIC_IN_PROCESS: 'info',
  LIC_EXPIRED: 'error',
  LIC_SUSPENDED: 'warning',
  LIC_REVOKED: 'error',
};

/** Qué acciones de ciclo de vida ofrece cada estado (la API vuelve a decidir). */
export const ACCIONES_POR_ESTADO: Readonly<Record<string, readonly ('activate' | 'suspend' | 'reactivate' | 'retire')[]>> = {
  SPACE_PLANNED: ['activate', 'retire'],
  SPACE_ACTIVE: ['suspend', 'retire'],
  SPACE_SUSPENDED: ['reactivate', 'retire'],
  SPACE_RETIRED: [],
};

/**
 * ¿Le ofrecemos a esta sesión las acciones de escritura de estructura?
 *
 * **Es un reflejo, no una autorización.** La API decide (§3: dueño o admin de
 * la organización, admin de sucursal o `SECURITY_ADMIN`) y responde 403 a quien
 * no corresponde; la pantalla sólo evita ofrecer una puerta que sabe cerrada.
 * Del token sólo se puede probar `SECURITY_ADMIN`: quién es dueño de qué
 * organización lo decía el claim `ownTenantId`, que sólo firmaba el simulador y
 * se retiró (TX-11), y la sesión tampoco trae la membresía por sucursal. Quien
 * administra su organización sin ese rol no ve los botones hasta que la API
 * firme esa pertenencia.
 */
export function ofrecerEscritura(roles: readonly string[]): boolean {
  return roles.includes('SECURITY_ADMIN');
}
