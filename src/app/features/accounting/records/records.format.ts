import type {
  AccountClass,
  RecordKind,
  SimpleAccount,
} from '../../../core/data-access/simple-accounting/simple-accounting.types';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';

/** Cómo se dice cada clase de cuenta, para el doctor y no para el contador. */
export const CLASS_NAME: Readonly<Record<AccountClass, string>> = {
  ASSET: 'Activo',
  LIABILITY: 'Deuda',
  EQUITY: 'Capital propio',
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
};

export const CLASS_OPTIONS: readonly SelectOption<AccountClass>[] = (
  ['EXPENSE', 'ASSET', 'LIABILITY', 'INCOME', 'EQUITY'] as const
).map((clase) => ({ value: clase, label: CLASS_NAME[clase] }));

/** Lo que cambia entre gasto, activo y deuda: los rótulos. El resto es igual. */
export interface RecordTexts {
  readonly singular: string;
  readonly plural: string;
  /** Qué está viendo en la pestaña, dicho para un médico. */
  readonly explicacion: string;
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

export const TEXTS: Readonly<Record<RecordKind, RecordTexts>> = {
  EXPENSE: {
    singular: 'gasto',
    plural: 'gastos',
    explicacion:
      'Lo que paga para que el consultorio funcione: alquiler, insumos, luz, internet, sueldos. Cada gasto resta de su ganancia del mes.',
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
    plural: 'activos',
    explicacion:
      'Lo que el consultorio tiene y le sirve por años: equipos médicos, muebles, computadoras. No es un gasto del mes; es parte de lo que vale su consultorio.',
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
    plural: 'deudas',
    explicacion:
      'Lo que usted debe pagar a otros: un préstamo del banco, una cuenta con un proveedor, impuestos por pagar.',
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
export function toDay(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** La fecha local de un `YYYY-MM-DD`. */
export function fromDay(dia: string): Date {
  const [anio, mes, dd] = dia.split('-').map(Number);
  return new Date(anio!, (mes ?? 1) - 1, dd ?? 1);
}

/** `28/09/2026`. */
export function readableDay(dia: string): string {
  const [anio, mes, dd] = dia.split('-');
  return `${dd}/${mes}/${anio}`;
}

/** «5.3 · Insumos médicos», como se elige y como se lee en la tabla. */
export function accountLabel(cuenta: SimpleAccount): string {
  return `${cuenta.code} · ${cuenta.name}`;
}

export function accountsOptions(
  cuentas: readonly SimpleAccount[],
  clase: AccountClass | null = null,
): readonly SelectOption<string>[] {
  return cuentas
    .filter((cuenta) => clase === null || cuenta.accountClass === clase)
    .map((cuenta) => ({ value: cuenta.id, label: accountLabel(cuenta) }));
}

/** Un monto escrito por una persona: `1.250,50`, `1250.5` o `1250` → `'1250.50'`. */
export function normalizedAmount(escrito: string): string | null {
  const limpio = escrito.trim().replace(/\s/gu, '');
  if (limpio === '') return null;
  // Con coma decimal (es-BO): los puntos son de miles.
  const conPunto = limpio.includes(',') ? limpio.replace(/\./gu, '').replace(',', '.') : limpio;
  if (!/^\d{1,12}(?:\.\d{1,2})?$/u.test(conPunto)) return null;
  const valor = Number(conPunto);
  return valor > 0 ? valor.toFixed(2) : null;
}

/** `'1250.50'` → `'1250,50'`, para volver a mostrarlo en el campo al editar. */
export function editableAmount(monto: string): string {
  return monto.replace('.', ',');
}

/** Una palabra del glosario. `soloContador`: sólo se explica en la versión Contador. */
export interface TerminoDelGlosario {
  readonly termino: string;
  readonly significado: string;
  readonly soloContador?: true;
}

/** «¿Qué significa cada cosa?», arriba de los registros. */
export const GLOSARIO: readonly TerminoDelGlosario[] = [
  { termino: 'Gasto', significado: 'Dinero que paga para que el consultorio funcione. Resta de su ganancia.' },
  { termino: 'Activo', significado: 'Algo que el consultorio tiene y usa por años, como un equipo. Suma a lo que vale su consultorio.' },
  { termino: 'Deuda', significado: 'Dinero que usted debe pagar a otros, como un préstamo o un proveedor.' },
  {
    termino: 'Transacción',
    significado: 'Dinero que pasa de una cuenta a otra, por ejemplo de la caja al banco.',
    soloContador: true,
  },
  { termino: 'Debe', significado: 'La cuenta a la que llega el dinero.', soloContador: true },
  { termino: 'Haber', significado: 'La cuenta de la que sale el dinero.', soloContador: true },
  {
    termino: 'Cuenta',
    significado: 'Una categoría para ordenar el dinero: Caja, Banco, Alquiler, Insumos. Cada registro va a una cuenta.',
    soloContador: true,
  },
];

/** Lo que se explica en cada versión: la del doctor sólo trae las tres palabras que usa. */
export function glosarioDe(esContador: boolean): readonly TerminoDelGlosario[] {
  return esContador ? GLOSARIO : GLOSARIO.filter((item) => item.soloContador !== true);
}

export const EXPLICACION_DE_TRANSACCIONES =
  'Movimientos de dinero entre dos de sus cuentas; por ejemplo, depositar en el banco el efectivo de la caja. «Debe» es la cuenta a la que llega el dinero y «Haber», la cuenta de la que sale.';

export const EXPLICACION_DE_CUENTAS =
  'Las categorías con las que se ordena todo lo anterior. Las del sistema ya vienen creadas y se pueden renombrar; las que cree usted también se pueden borrar.';
