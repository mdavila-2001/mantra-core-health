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
export type VersionContable = 'doctor' | 'contador';

export const VERSION_POR_OMISION: VersionContable = 'doctor';

export const OPCIONES_DE_VERSION: readonly SegmentedOption<VersionContable>[] = [
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
export const AYUDA_DE_VERSION: Readonly<Record<VersionContable, string>> = {
  doctor: 'Sus cifras y sus registros, en palabras de consultorio.',
  contador: 'Suma transacciones, plan de cuentas, vista contable y libros.',
};

export const CLAVE_DE_VERSION = 'mantra.contabilidad.version';

function esVersion(valor: unknown): valor is VersionContable {
  return valor === 'doctor' || valor === 'contador';
}

/** La versión que la persona dejó puesta la última vez, o la de por omisión. */
export function versionGuardada(): VersionContable {
  try {
    const guardada = globalThis.localStorage?.getItem(CLAVE_DE_VERSION);
    return esVersion(guardada) ? guardada : VERSION_POR_OMISION;
  } catch {
    // Almacenamiento bloqueado (modo privado, SSR): vale la de por omisión.
    return VERSION_POR_OMISION;
  }
}

export function guardarVersion(version: VersionContable): void {
  try {
    globalThis.localStorage?.setItem(CLAVE_DE_VERSION, version);
  } catch {
    // Sin almacenamiento la elección vale sólo para esta pantalla.
  }
}
