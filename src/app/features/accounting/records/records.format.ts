import type {
  AccountClass,
  RecordKind,
  SimpleAccount,
} from '../../../core/data-access/simple-accounting/simple-accounting.types';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';

/** Cómo se dice cada clase de cuenta, para el doctor y no para el contador. */
export const NOMBRE_DE_CLASE: Readonly<Record<AccountClass, string>> = {
  ASSET: 'Activo',
  LIABILITY: 'Deuda',
  EQUITY: 'Capital',
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
};

export const OPCIONES_DE_CLASE: readonly SelectOption<AccountClass>[] = (
  ['EXPENSE', 'ASSET', 'LIABILITY', 'INCOME', 'EQUITY'] as const
).map((clase) => ({ value: clase, label: NOMBRE_DE_CLASE[clase] }));

/** Lo que cambia entre gasto, activo y deuda: los rótulos. El resto es igual. */
export interface TextosDelRegistro {
  readonly singular: string;
  /** Con su artículo: «la deuda», no «el deuda». */
  readonly conArticulo: string;
  /** «quedó guardado» o «quedó guardada», según el género. */
  readonly guardado: string;
  readonly nuevo: string;
  readonly tipo: string;
  readonly descripcion: string;
  readonly ejemploDescripcion: string;
  readonly monto: string;
}

export const TEXTOS: Readonly<Record<RecordKind, TextosDelRegistro>> = {
  EXPENSE: {
    singular: 'gasto',
    conArticulo: 'el gasto',
    guardado: 'El gasto quedó guardado.',
    nuevo: 'Nuevo gasto',
    tipo: 'Tipo de gasto',
    descripcion: 'En qué se gastó',
    ejemploDescripcion: 'Alquiler de septiembre',
    monto: 'Cuánto se pagó',
  },
  ASSET: {
    singular: 'activo',
    conArticulo: 'el activo',
    guardado: 'El activo quedó guardado.',
    nuevo: 'Nuevo activo',
    tipo: 'Tipo de activo',
    descripcion: 'Qué es',
    ejemploDescripcion: 'Electrocardiógrafo de 12 canales',
    monto: 'Cuánto vale',
  },
  DEBT: {
    singular: 'deuda',
    conArticulo: 'la deuda',
    guardado: 'La deuda quedó guardada.',
    nuevo: 'Nueva deuda',
    tipo: 'Tipo de deuda',
    descripcion: 'Con quién y por qué',
    ejemploDescripcion: 'Crédito del banco por el equipo',
    monto: 'Cuánto se debe',
  },
};

/** `YYYY-MM-DD` de una fecha local, sin pasar por UTC. */
export function aDia(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** La fecha local de un `YYYY-MM-DD`. */
export function deDia(dia: string): Date {
  const [anio, mes, dd] = dia.split('-').map(Number);
  return new Date(anio!, (mes ?? 1) - 1, dd ?? 1);
}

/** `28/09/2026`. */
export function diaLegible(dia: string): string {
  const [anio, mes, dd] = dia.split('-');
  return `${dd}/${mes}/${anio}`;
}

/** «5.3 · Insumos médicos», como se elige y como se lee en la tabla. */
export function rotuloDeCuenta(cuenta: SimpleAccount): string {
  return `${cuenta.code} · ${cuenta.name}`;
}

export function opcionesDeCuentas(
  cuentas: readonly SimpleAccount[],
  clase: AccountClass | null = null,
): readonly SelectOption<string>[] {
  return cuentas
    .filter((cuenta) => clase === null || cuenta.accountClass === clase)
    .map((cuenta) => ({ value: cuenta.id, label: rotuloDeCuenta(cuenta) }));
}

/** Un monto escrito por una persona: `1.250,50`, `1250.5` o `1250` → `'1250.50'`. */
export function montoNormalizado(escrito: string): string | null {
  const limpio = escrito.trim().replace(/\s/gu, '');
  if (limpio === '') return null;
  // Con coma decimal (es-BO): los puntos son de miles.
  const conPunto = limpio.includes(',') ? limpio.replace(/\./gu, '').replace(',', '.') : limpio;
  if (!/^\d{1,12}(?:\.\d{1,2})?$/u.test(conPunto)) return null;
  const valor = Number(conPunto);
  return valor > 0 ? valor.toFixed(2) : null;
}

/** `'1250.50'` → `'1250,50'`, para volver a mostrarlo en el campo al editar. */
export function montoEditable(monto: string): string {
  return monto.replace('.', ',');
}
