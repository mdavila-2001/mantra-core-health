import { reservas } from '../fixtures/agenda';
import { ESTADO_RESERVA } from '../fixtures/conceptos';
import { conflict, noContent, notFound, validation, type MockRouter } from '../mock-router';
import { Coleccion, cuerpo, hoy, isoDia, nuevoId, texto, uuid } from '../mock-store';
import { consultasPagadas } from './finance.handlers';
import { pendienteDeAseguradoras } from './insurance.handlers';
import { PRACTICAS } from './practice.handlers';

/* ============================================================================
    La contabilidad simple del doctor (P49, 28/09/2026).

    Gasto, activo y deuda con su tipo; transacción debe/haber; cuentas con
    modal y tabla. El tipo de un registro ES una cuenta de su clase, así que
    las cuentas generales de abajo son también los tipos de siempre.

    Todo persiste en `sessionStorage` como el resto de la maqueta: lo que se
    carga en pantalla sobrevive a la recarga (y se descarta con un build nuevo).
    ========================================================================== */

type Clase = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
type ClaseDeRegistro = 'EXPENSE' | 'ASSET' | 'DEBT';

interface CuentaSimulada {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly accountClass: Clase;
  readonly seeded: boolean;
  /** `null` en las generales: son de toda práctica. */
  readonly practiceId: string | null;
}

interface RegistroSimulado {
  readonly id: string;
  readonly practiceId: string;
  readonly kind: ClaseDeRegistro;
  readonly date: string;
  readonly accountId: string;
  readonly description: string;
  readonly amount: string;
}

interface TransaccionSimulada {
  readonly id: string;
  readonly practiceId: string;
  readonly date: string;
  readonly description: string;
  readonly debitAccountId: string;
  readonly creditAccountId: string;
  readonly amount: string;
}

const CLASE_DEL_REGISTRO: Readonly<Record<ClaseDeRegistro, Clase>> = {
  EXPENSE: 'EXPENSE',
  ASSET: 'ASSET',
  DEBT: 'LIABILITY',
};

/** El primer dígito del código de cada clase. */
const PREFIJO: Readonly<Record<Clase, string>> = {
  ASSET: '1',
  LIABILITY: '2',
  EQUITY: '3',
  INCOME: '4',
  EXPENSE: '5',
};

/**
 * Las cuentas generales: las que tiene cualquier consultorio, y nada más. Un
 * doctor suma las suyas con el modal; éstas se pueden renombrar, no borrar.
 */
const GENERALES: readonly (readonly [code: string, name: string, clase: Clase])[] = [
  ['1.1', 'Caja', 'ASSET'],
  ['1.2', 'Banco', 'ASSET'],
  ['1.3', 'Por cobrar a aseguradoras', 'ASSET'],
  ['1.4', 'Equipo médico', 'ASSET'],
  ['1.5', 'Mobiliario del consultorio', 'ASSET'],
  ['1.6', 'Equipo de computación', 'ASSET'],
  ['1.7', 'Vehículo', 'ASSET'],
  ['2.1', 'Préstamo bancario', 'LIABILITY'],
  ['2.2', 'Proveedores por pagar', 'LIABILITY'],
  ['2.3', 'Tarjeta de crédito', 'LIABILITY'],
  ['2.4', 'Impuestos por pagar', 'LIABILITY'],
  ['2.5', 'Sueldos por pagar', 'LIABILITY'],
  ['3.1', 'Capital del profesional', 'EQUITY'],
  ['4.1', 'Honorarios por consultas', 'INCOME'],
  ['4.2', 'Pagos de aseguradoras', 'INCOME'],
  ['4.3', 'Procedimientos', 'INCOME'],
  ['4.4', 'Otros ingresos', 'INCOME'],
  ['5.1', 'Alquiler del consultorio', 'EXPENSE'],
  ['5.2', 'Sueldos del personal', 'EXPENSE'],
  ['5.3', 'Insumos médicos', 'EXPENSE'],
  ['5.4', 'Servicios básicos (luz, agua, internet)', 'EXPENSE'],
  ['5.5', 'Mantenimiento de equipos', 'EXPENSE'],
  ['5.6', 'Impuestos y patentes', 'EXPENSE'],
  ['5.7', 'Seguros y colegiatura', 'EXPENSE'],
  ['5.8', 'Publicidad', 'EXPENSE'],
  ['5.9', 'Otros gastos', 'EXPENSE'],
];

const idDeCuenta = (code: string) => uuid(`simple-account-${code}`);

const cuentas = new Coleccion<CuentaSimulada>(
  GENERALES.map(([code, name, accountClass]) => ({
    id: idDeCuenta(code),
    code,
    name,
    accountClass,
    seeded: true,
    practiceId: null,
  })),
  'mock-simple-accounts',
);

const PRACTICA = PRACTICAS[0]!.id;

const registros = new Coleccion<RegistroSimulado>(
  (
    [
      ['EXPENSE', -25, '5.1', 'Alquiler de septiembre', '2800.00'],
      ['EXPENSE', -18, '5.3', 'Guantes, jeringas y gasas', '640.50'],
      ['EXPENSE', -10, '5.4', 'Luz e internet del consultorio', '385.00'],
      ['EXPENSE', -3, '5.2', 'Sueldo de la asistente', '3200.00'],
      ['ASSET', -300, '1.4', 'Electrocardiógrafo de 12 canales', '18500.00'],
      ['ASSET', -200, '1.5', 'Camilla y escritorio', '4200.00'],
      ['ASSET', -1, '1.2', 'Saldo de la cuenta del consultorio', '12640.00'],
      ['DEBT', -120, '2.1', 'Crédito del electrocardiógrafo', '9800.00'],
      ['DEBT', -12, '2.2', 'Farmacia del proveedor, a 30 días', '1150.00'],
    ] as const
  ).map(([kind, dias, code, description, amount], i) => ({
    id: uuid(`simple-record-${i}`),
    practiceId: PRACTICA,
    kind,
    date: isoDia(dias),
    accountId: idDeCuenta(code),
    description,
    amount,
  })),
  'mock-simple-records',
);

const transacciones = new Coleccion<TransaccionSimulada>(
  (
    [
      [-20, 'Depósito de la caja al banco', '1.2', '1.1', '2500.00'],
      [-8, 'Cuota del crédito del electrocardiógrafo', '2.1', '1.2', '950.00'],
      [-2, 'Pago de la aseguradora por consultas', '1.2', '1.3', '1000.00'],
    ] as const
  ).map(([dias, description, debe, haber, amount], i) => ({
    id: uuid(`simple-transaction-${i}`),
    practiceId: PRACTICA,
    date: isoDia(dias),
    description,
    debitAccountId: idDeCuenta(debe),
    creditAccountId: idDeCuenta(haber),
    amount,
  })),
  'mock-simple-transactions',
);

/* ---- validación ---------------------------------------------------------- */

const IMPORTE = /^\d{1,12}(?:\.\d{1,2})?$/u;
const FECHA = /^\d{4}-\d{2}-\d{2}$/u;

function problemaDeImporte(amount: string | undefined): string | null {
  if (amount === undefined || !IMPORTE.test(amount))
    return 'Escribí un monto, con hasta dos decimales.';
  if (Number(amount) <= 0) return 'El monto tiene que ser mayor a cero.';
  return null;
}

function problemaDeFecha(date: string | undefined): string | null {
  return date === undefined || !FECHA.test(date) ? 'Elegí la fecha.' : null;
}

function cuentasDe(practiceId: string | null): CuentaSimulada[] {
  return cuentas.filtrar((c) => c.practiceId === null || c.practiceId === practiceId);
}

function sinTilde(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/gu, '');
}

function aCuenta(c: CuentaSimulada) {
  return { id: c.id, code: c.code, name: c.name, accountClass: c.accountClass, seeded: c.seeded };
}

function siguienteCodigo(clase: Clase): string {
  const prefijo = PREFIJO[clase];
  const usados = cuentas
    .filtrar((c) => c.accountClass === clase)
    .map((c) => Number(c.code.split('.')[1] ?? 0));
  return `${prefijo}.${Math.max(0, ...usados) + 1}`;
}

/** Cuántos registros y transacciones cuelgan de una cuenta. */
function usos(accountId: string): number {
  return (
    registros.filtrar((r) => r.accountId === accountId).length +
    transacciones.filtrar((t) => t.debitAccountId === accountId || t.creditAccountId === accountId)
      .length
  );
}

function aRegistro(r: RegistroSimulado) {
  const { practiceId: _practica, ...resto } = r;
  return resto;
}

function aTransaccion(t: TransaccionSimulada) {
  const { practiceId: _practica, ...resto } = t;
  return resto;
}

/* ---- el período de los tres números ------------------------------------- */

function periodo(clave: string | null): { period: 'month' | 'year'; from: string; to: string } {
  const dia = hoy();
  const anio = dia.getFullYear();
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  if (clave === 'year') {
    return { period: 'year', from: `${anio}-01-01`, to: `${anio}-12-31` };
  }
  const mes = dia.getMonth() + 1;
  const ultimo = new Date(anio, mes, 0).getDate();
  return {
    period: 'month',
    from: `${anio}-${dosDigitos(mes)}-01`,
    to: `${anio}-${dosDigitos(mes)}-${dosDigitos(ultimo)}`,
  };
}

export function registrarContabilidadSimple(router: MockRouter): void {
  router.get('/accounting/practitioner/simple/summary', ({ query }) => {
    const rango = periodo(texto(query, 'period'));
    const enRango = (instante: string) => {
      const dia = instante.slice(0, 10);
      return dia >= rango.from && dia <= rango.to;
    };
    const atendidas = reservas.filtrar(
      (r) => r.statusConceptId === ESTADO_RESERVA['BK-COMPLETED'] && enRango(r.startAt),
    );
    const cobradoCentavos = consultasPagadas()
      .filter(({ reserva }) => enRango(reserva.startAt))
      .reduce((total, { paidTotal }) => total + Math.round(Number(paidTotal) * 100), 0);
    const pendiente = pendienteDeAseguradoras();
    return {
      ...rango,
      patientsSeen: new Set(atendidas.map((r) => r.patientProfileId)).size,
      consultations: atendidas.length,
      collected: (cobradoCentavos / 100).toFixed(2),
      expectedFromInsurers: pendiente.monto,
      pendingClaims: pendiente.solicitudes,
    };
  });

  /* ---- cuentas ---------------------------------------------------------- */

  router.get('/accounting/practitioner/simple/accounts', ({ query }) => ({
    items: cuentasDe(texto(query, 'practiceId'))
      .sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }))
      .map(aCuenta),
  }));

  router.post('/accounting/practitioner/simple/accounts', (request) => {
    const datos = cuerpo<{ practiceId: string; name: string; accountClass: Clase }>(request);
    const nombre = datos.name?.trim() ?? '';
    const clase = datos.accountClass;
    if (nombre === '' || nombre.length > 80)
      return validation('Escribí un nombre de hasta 80 caracteres.');
    if (clase === undefined || !(clase in PREFIJO))
      return validation('Elegí la clase de la cuenta.');
    const practica = datos.practiceId ?? PRACTICA;
    const repetida = cuentasDe(practica).some(
      (c) => c.accountClass === clase && sinTilde(c.name) === sinTilde(nombre),
    );
    if (repetida) return conflict('Ya tenés una cuenta con ese nombre en esa clase.');
    const nueva = cuentas.agregar({
      id: nuevoId('simple-account'),
      code: siguienteCodigo(clase),
      name: nombre,
      accountClass: clase,
      seeded: false,
      practiceId: practica,
    });
    return { status: 201, body: aCuenta(nueva) };
  });

  router.put('/accounting/practitioner/simple/accounts/:id', (request) => {
    const actual = cuentas.get(request.params['id']!);
    if (actual === undefined) return notFound('Cuenta no encontrada');
    const datos = cuerpo<{ name: string; accountClass: Clase }>(request);
    const nombre = datos.name?.trim() ?? '';
    if (nombre === '' || nombre.length > 80)
      return validation('Escribí un nombre de hasta 80 caracteres.');
    const clase = datos.accountClass ?? actual.accountClass;
    if (clase !== actual.accountClass && (actual.seeded || usos(actual.id) > 0)) {
      return conflict('No se puede cambiar la clase de una cuenta general o que ya se usa.');
    }
    const repetida = cuentasDe(actual.practiceId ?? PRACTICA).some(
      (c) =>
        c.id !== actual.id && c.accountClass === clase && sinTilde(c.name) === sinTilde(nombre),
    );
    if (repetida) return conflict('Ya tenés una cuenta con ese nombre en esa clase.');
    return aCuenta(cuentas.actualizar(actual.id, { name: nombre, accountClass: clase })!);
  });

  router.delete('/accounting/practitioner/simple/accounts/:id', ({ params }) => {
    const actual = cuentas.get(params['id']!);
    if (actual === undefined) return notFound('Cuenta no encontrada');
    if (actual.seeded) return conflict('Es una cuenta general: se puede renombrar, no borrar.');
    const cuantos = usos(actual.id);
    if (cuantos > 0) {
      return conflict(
        `La usa${cuantos === 1 ? '' : 'n'} ${cuantos} registro${cuantos === 1 ? '' : 's'}: cambiales la cuenta antes de borrarla.`,
      );
    }
    cuentas.borrar(actual.id);
    return noContent();
  });

  /* ---- gastos, activos y deudas ----------------------------------------- */

  function problemaDeRegistro(datos: Partial<Omit<RegistroSimulado, 'id'>>): string | null {
    if (datos.kind === undefined || !(datos.kind in CLASE_DEL_REGISTRO))
      return 'Falta qué es: gasto, activo o deuda.';
    const cuenta = datos.accountId === undefined ? undefined : cuentas.get(datos.accountId);
    if (cuenta === undefined) return 'Elegí el tipo.';
    if (cuenta.accountClass !== CLASE_DEL_REGISTRO[datos.kind]) return 'Ese tipo no corresponde.';
    const descripcion = datos.description?.trim() ?? '';
    if (descripcion === '' || descripcion.length > 160)
      return 'Escribí una descripción de hasta 160 caracteres.';
    return problemaDeFecha(datos.date) ?? problemaDeImporte(datos.amount);
  }

  router.get('/accounting/practitioner/simple/records', ({ query }) => {
    const practica = texto(query, 'practiceId') ?? PRACTICA;
    const clase = texto(query, 'kind');
    return {
      items: registros
        .filtrar((r) => r.practiceId === practica && (clase === null || r.kind === clase))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(aRegistro),
    };
  });

  router.post('/accounting/practitioner/simple/records', (request) => {
    const datos = cuerpo<Omit<RegistroSimulado, 'id'>>(request);
    const problema = problemaDeRegistro(datos);
    if (problema !== null) return validation(problema);
    const nuevo = registros.agregar({
      id: nuevoId('simple-record'),
      practiceId: datos.practiceId ?? PRACTICA,
      kind: datos.kind!,
      date: datos.date!,
      accountId: datos.accountId!,
      description: datos.description!.trim(),
      amount: Number(datos.amount).toFixed(2),
    });
    return { status: 201, body: aRegistro(nuevo) };
  });

  router.put('/accounting/practitioner/simple/records/:id', (request) => {
    const actual = registros.get(request.params['id']!);
    if (actual === undefined) return notFound('Registro no encontrado');
    const datos = cuerpo<Omit<RegistroSimulado, 'id' | 'practiceId'>>(request);
    const problema = problemaDeRegistro({ ...datos, kind: actual.kind });
    if (problema !== null) return validation(problema);
    return aRegistro(
      registros.actualizar(actual.id, {
        date: datos.date!,
        accountId: datos.accountId!,
        description: datos.description!.trim(),
        amount: Number(datos.amount).toFixed(2),
      })!,
    );
  });

  router.delete('/accounting/practitioner/simple/records/:id', ({ params }) =>
    registros.borrar(params['id']!) ? noContent() : notFound('Registro no encontrado'),
  );

  /* ---- transacciones debe/haber ----------------------------------------- */

  function problemaDeTransaccion(datos: Partial<Omit<TransaccionSimulada, 'id'>>): string | null {
    const descripcion = datos.description?.trim() ?? '';
    if (descripcion === '' || descripcion.length > 160)
      return 'Escribí una descripción de hasta 160 caracteres.';
    if (datos.debitAccountId === undefined || !cuentas.has(datos.debitAccountId))
      return 'Elegí la cuenta del debe.';
    if (datos.creditAccountId === undefined || !cuentas.has(datos.creditAccountId))
      return 'Elegí la cuenta del haber.';
    if (datos.debitAccountId === datos.creditAccountId)
      return 'El debe y el haber tienen que ser cuentas distintas.';
    return problemaDeFecha(datos.date) ?? problemaDeImporte(datos.amount);
  }

  router.get('/accounting/practitioner/simple/transactions', ({ query }) => {
    const practica = texto(query, 'practiceId') ?? PRACTICA;
    return {
      items: transacciones
        .filtrar((t) => t.practiceId === practica)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(aTransaccion),
    };
  });

  router.post('/accounting/practitioner/simple/transactions', (request) => {
    const datos = cuerpo<Omit<TransaccionSimulada, 'id'>>(request);
    const problema = problemaDeTransaccion(datos);
    if (problema !== null) return validation(problema);
    const nueva = transacciones.agregar({
      id: nuevoId('simple-transaction'),
      practiceId: datos.practiceId ?? PRACTICA,
      date: datos.date!,
      description: datos.description!.trim(),
      debitAccountId: datos.debitAccountId!,
      creditAccountId: datos.creditAccountId!,
      amount: Number(datos.amount).toFixed(2),
    });
    return { status: 201, body: aTransaccion(nueva) };
  });

  router.put('/accounting/practitioner/simple/transactions/:id', (request) => {
    const actual = transacciones.get(request.params['id']!);
    if (actual === undefined) return notFound('Transacción no encontrada');
    const datos = cuerpo<Omit<TransaccionSimulada, 'id' | 'practiceId'>>(request);
    const problema = problemaDeTransaccion(datos);
    if (problema !== null) return validation(problema);
    return aTransaccion(
      transacciones.actualizar(actual.id, {
        date: datos.date!,
        description: datos.description!.trim(),
        debitAccountId: datos.debitAccountId!,
        creditAccountId: datos.creditAccountId!,
        amount: Number(datos.amount).toFixed(2),
      })!,
    );
  });

  router.delete('/accounting/practitioner/simple/transactions/:id', ({ params }) =>
    transacciones.borrar(params['id']!) ? noContent() : notFound('Transacción no encontrada'),
  );
}
