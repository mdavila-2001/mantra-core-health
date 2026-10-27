import type { SegmentedOption } from '../../shared/components/molecules/segmented-control/segmented-control.types';

/**
 * Las dos maneras de leer la pantalla de Contabilidad (propietario, 26/10/2026):
 * «Doctor», en palabras de consultorio, y «Contador», con el vocabulario y las
 * herramientas de los libros. Es **una** llave y no dos pantallas: lo que cambia
 * es qué se muestra, no qué dato es cada cosa.
 *
 * Es una comodidad de lectura, no un permiso. Quién puede registrar o aprobar
 * algo lo decide la API; esta llave no abre ni cierra nada que el servidor no
 * haya resuelto ya.
 */
export type AccountingVersion = 'doctor' | 'contador';

export const DEFAULT_VERSION: AccountingVersion = 'doctor';

export const VERSION_OPTIONS: readonly SegmentedOption<AccountingVersion>[] = [
  {
    value: 'doctor',
    label: 'Doctor',
    icon: 'stethoscope',
    description: 'Versión Doctor: sus cifras y registros en palabras de consultorio',
  },
  {
    value: 'contador',
    label: 'Contador',
    icon: 'book',
    description: 'Versión Contador: agrega transacciones, plan de cuentas y los libros',
  },
];

/** Lo que dice la línea de ayuda de debajo de la llave, para cada versión. */
export const VERSION_HELP: Readonly<Record<AccountingVersion, string>> = {
  doctor: 'Sus cifras y sus registros, en palabras de consultorio.',
  contador: 'Suma transacciones, plan de cuentas, vista contable y libros.',
};

export const VERSION_STORAGE_KEY = 'mantra.contabilidad.version';

function isVersion(value: unknown): value is AccountingVersion {
  return value === 'doctor' || value === 'contador';
}

/** La versión que la persona dejó puesta la última vez, o la de por omisión. */
export function savedVersion(): AccountingVersion {
  try {
    const saved = globalThis.localStorage?.getItem(VERSION_STORAGE_KEY);
    return isVersion(saved) ? saved : DEFAULT_VERSION;
  } catch {
    // Almacenamiento bloqueado (modo privado, SSR): vale la de por omisión.
    return DEFAULT_VERSION;
  }
}

export function saveVersion(version: AccountingVersion): void {
  try {
    globalThis.localStorage?.setItem(VERSION_STORAGE_KEY, version);
  } catch {
    // Sin almacenamiento la elección vale sólo para esta pantalla.
  }
}
