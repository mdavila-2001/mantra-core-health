import { ACCESS_ERROR_TEXTS } from '../../../core/data-access/access-governance/access-errors';
import type { ValidationIssue } from '../../../core/data-access/access-governance/access-explain.types';
import { SUPPORT_ATOM_CODES } from '../../../core/data-access/support-access/support-atoms';
import { sectionOfKey, type ConditionSection } from './condition-editor/condition-form';

/* ============================================================================
    Dónde va un error del servidor. `simulate` (y los 422 de guardar) traen una ruta al control del editor:
    `grants[0].actions[3]`, `grants[0].condition.time.windows[0]`, `grants[1].actionConditions.<átomo>.limits[0]`.
    Acá se lee esa ruta para poner el mensaje junto al campo y no solo en una lista aparte.
   ========================================================================== */

export type IssueSeverity = 'error' | 'warning';

export interface PlacedIssue {
  readonly severity: IssueSeverity;
  readonly code: string;
  /** Texto en lenguaje simple: el del servidor si lo mandó, si no el de la tabla de motivos. */
  readonly message: string;
  /** El permiso del borrador (`grants[i]`) al que se refiere, o `null` si la ruta no lo dice. */
  readonly writeIndex: number | null;
  /** Posición en `actions` cuando el error es de una acción concreta. */
  readonly actionIndex?: number;
  /** El átomo de un `actionConditions.<átomo>…`. */
  readonly atom?: string;
  /** La clave de la condición (`time`, `appointment`, …) y su sección en el editor. */
  readonly conditionKey?: string;
  readonly section?: ConditionSection;
  /** `true` si el error es de la condición del permiso entero. */
  readonly wholePermission?: boolean;
  readonly path: string;
}

const GRANT_PREFIX = /^grants\[(\d+)\]/;

function messageOf(issue: ValidationIssue): string {
  const text = issue.message.trim();
  return text !== '' ? text : (ACCESS_ERROR_TEXTS[issue.code] ?? 'Revise este dato.');
}

/** Lee la ruta de un error y dice a qué parte del editor corresponde. */
export function placeIssue(
  issue: ValidationIssue,
  severity: IssueSeverity,
  isDenyAt: (writeIndex: number) => boolean = () => false,
): PlacedIssue {
  const base = { severity, code: issue.code, message: messageOf(issue), path: issue.path };
  const head = GRANT_PREFIX.exec(issue.path);
  if (head === null) return { ...base, writeIndex: null };
  const writeIndex = Number(head[1]);
  const rest = issue.path.slice(head[0].length).replace(/^\./, '');

  const action = /^actions\[(\d+)\]/.exec(rest);
  if (action !== null) return { ...base, writeIndex, actionIndex: Number(action[1]) };

  if (rest.startsWith('condition.') || rest === 'condition') {
    const key = rest.split('.')[1];
    const section =
      key === undefined ? undefined : sectionOfKey(key.replace(/\[.*$/, ''), isDenyAt(writeIndex));
    return {
      ...base,
      writeIndex,
      wholePermission: true,
      ...(key === undefined ? {} : { conditionKey: key.replace(/\[.*$/, '') }),
      ...(section === undefined ? {} : { section }),
    };
  }

  if (rest.startsWith('actionConditions.')) {
    const tail = rest.slice('actionConditions.'.length);
    // Los átomos llevan puntos: se busca el más largo que abra la ruta.
    const atom = [...SUPPORT_ATOM_CODES]
      .filter((code) => tail === code || tail.startsWith(`${code}.`))
      .sort((a, b) => b.length - a.length)[0];
    if (atom !== undefined) {
      const key = tail
        .slice(atom.length + 1)
        .split('.')[0]
        ?.replace(/\[.*$/, '');
      const section =
        key === undefined || key === '' ? undefined : sectionOfKey(key, isDenyAt(writeIndex));
      return {
        ...base,
        writeIndex,
        atom,
        ...(key === undefined || key === '' ? {} : { conditionKey: key }),
        ...(section === undefined ? {} : { section }),
      };
    }
  }

  if (rest === 'validTo') return { ...base, writeIndex };
  // Las razones de condiciones sin una clave concreta (`CONDITION_TOO_LARGE`, o `CONDITION_NOT_APPLICABLE_TO_ATOM` de un
  // permiso con códigos antiguos o con una clave de `actionConditions` que no es un permiso) hablan de las condiciones del
  // permiso: van a esa zona del editor y no solo a la lista general.
  if (issue.code.startsWith('CONDITION_')) return { ...base, writeIndex, wholePermission: true };
  return { ...base, writeIndex };
}

/** Las listas de errores y avisos del servidor, ya ubicadas. */
export function placeIssues(
  validation: {
    readonly errors: readonly ValidationIssue[];
    readonly warnings: readonly ValidationIssue[];
  },
  isDenyAt?: (writeIndex: number) => boolean,
): readonly PlacedIssue[] {
  return [
    ...validation.errors.map((i) => placeIssue(i, 'error', isDenyAt)),
    ...validation.warnings.map((i) => placeIssue(i, 'warning', isDenyAt)),
  ];
}

/** Un error de guardar (422/409 con `reason`) como si fuera uno del simulador, para marcarlo en el mismo sitio. */
export function issueFromFailure(
  writeIndex: number,
  reason: string,
  message: string,
  detailsPath: unknown,
): ValidationIssue {
  const tail =
    typeof detailsPath === 'string' && detailsPath !== ''
      ? `.${detailsPath.replace(/^grants\[\d+\]\.?/, '')}`
      : '';
  return { code: reason, path: `grants[${writeIndex}]${tail}`, message };
}
