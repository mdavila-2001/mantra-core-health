import { HttpHeaders } from '@angular/common/http';

import { isMockReply, MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { registrarContabilidadSimple } from './simple-accounting.handlers';

/**
 * El simulador de la contabilidad simple del doctor (P47).
 *
 * 1. **Las cuentas generales vienen sembradas** y no se borran.
 * 2. **El tipo de un registro es una cuenta de su clase**: un gasto con una
 *    cuenta de activo se rechaza.
 * 3. **La transacción es debe/haber** y las dos cuentas tienen que ser
 *    distintas.
 * 4. **Una cuenta en uso no se borra**; una propia sin uso, sí.
 * 5. **Los tres números** salen de la agenda, de lo cobrado y de las
 *    solicitudes a aseguradoras.
 */
describe('handlers de la contabilidad simple', () => {
  const router = new MockRouter();
  registrarContabilidadSimple(router);

  function call(method: MockMethod, path: string, body: unknown = null, query = ''): unknown {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body,
      headers: new HttpHeaders(),
      user: null,
    });
  }

  function estado(respuesta: unknown): number {
    return isMockReply(respuesta) ? respuesta.status : 200;
  }

  function cuerpo<T>(respuesta: unknown): T {
    return (isMockReply(respuesta) ? (respuesta as MockReply).body : respuesta) as T;
  }

  interface Cuenta {
    id: string;
    code: string;
    name: string;
    accountClass: string;
    seeded: boolean;
  }

  const cuentas = () =>
    cuerpo<{ items: Cuenta[] }>(call('GET', '/accounting/practitioner/simple/accounts')).items;
  const cuenta = (code: string) => cuentas().find((c) => c.code === code)!;

  beforeEach(() => sessionStorage.clear());

  it('siembra las cuentas generales de un consultorio, de las cinco clases', () => {
    const todas = cuentas();
    expect(todas.every((c) => c.seeded)).toBe(true);
    expect(new Set(todas.map((c) => c.accountClass))).toEqual(
      new Set(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
    );
    expect(todas.map((c) => c.name)).toContain('Insumos médicos');
    // Y una general no se borra.
    expect(
      estado(call('DELETE', `/accounting/practitioner/simple/accounts/${cuenta('5.3').id}`)),
    ).toBe(409);
  });

  it('un gasto sólo acepta como tipo una cuenta de gasto, y normaliza el monto', () => {
    const conActivo = call('POST', '/accounting/practitioner/simple/records', {
      kind: 'EXPENSE',
      date: '2026-09-28',
      accountId: cuenta('1.1').id,
      description: 'Mal clasificado',
      amount: '10',
    });
    expect(estado(conActivo)).toBe(422);

    const creado = call('POST', '/accounting/practitioner/simple/records', {
      kind: 'EXPENSE',
      date: '2026-09-28',
      accountId: cuenta('5.3').id,
      description: 'Gasas',
      amount: '12.5',
    });
    expect(estado(creado)).toBe(201);
    expect(cuerpo<{ amount: string }>(creado).amount).toBe('12.50');
  });

  it('un monto en cero o una fecha vacía se rechazan', () => {
    const base = { kind: 'DEBT', accountId: cuenta('2.1').id, description: 'Préstamo' };
    expect(
      estado(
        call('POST', '/accounting/practitioner/simple/records', {
          ...base,
          date: '2026-09-28',
          amount: '0',
        }),
      ),
    ).toBe(422);
    expect(
      estado(
        call('POST', '/accounting/practitioner/simple/records', {
          ...base,
          date: '',
          amount: '100',
        }),
      ),
    ).toBe(422);
  });

  it('la transacción exige debe y haber distintos', () => {
    const misma = call('POST', '/accounting/practitioner/simple/transactions', {
      date: '2026-09-28',
      description: 'A sí misma',
      debitAccountId: cuenta('1.1').id,
      creditAccountId: cuenta('1.1').id,
      amount: '100',
    });
    expect(estado(misma)).toBe(422);

    const bien = call('POST', '/accounting/practitioner/simple/transactions', {
      date: '2026-09-28',
      description: 'Depósito',
      debitAccountId: cuenta('1.2').id,
      creditAccountId: cuenta('1.1').id,
      amount: '100',
    });
    expect(estado(bien)).toBe(201);
  });

  it('una cuenta propia se crea con el código siguiente, y sin uso se borra', () => {
    const creada = cuerpo<Cuenta>(
      call('POST', '/accounting/practitioner/simple/accounts', {
        name: 'Laboratorio de referencia',
        accountClass: 'EXPENSE',
      }),
    );
    expect(creada.seeded).toBe(false);
    expect(creada.code.startsWith('5.')).toBe(true);

    // El mismo nombre en la misma clase no se repite, tildes aparte.
    const repetida = call('POST', '/accounting/practitioner/simple/accounts', {
      name: 'laboratorio de referéncia',
      accountClass: 'EXPENSE',
    });
    expect(estado(repetida)).toBe(409);

    expect(estado(call('DELETE', `/accounting/practitioner/simple/accounts/${creada.id}`))).toBe(
      204,
    );
  });

  it('una cuenta propia en uso no se borra', () => {
    const creada = cuerpo<Cuenta>(
      call('POST', '/accounting/practitioner/simple/accounts', {
        name: 'Esterilización tercerizada',
        accountClass: 'EXPENSE',
      }),
    );
    call('POST', '/accounting/practitioner/simple/records', {
      kind: 'EXPENSE',
      date: '2026-09-28',
      accountId: creada.id,
      description: 'Autoclave del mes',
      amount: '300',
    });
    expect(estado(call('DELETE', `/accounting/practitioner/simple/accounts/${creada.id}`))).toBe(
      409,
    );
  });

  it('los tres números: pacientes distintos, lo cobrado y lo esperado de aseguradoras', () => {
    const numeros = cuerpo<{
      period: string;
      patientsSeen: number;
      consultations: number;
      collected: string;
      expectedFromInsurers: string;
      pendingClaims: number;
    }>(call('GET', '/accounting/practitioner/simple/summary', null, 'period=month'));

    expect(numeros.period).toBe('month');
    // Una persona puede venir dos veces: nunca hay más pacientes que consultas.
    expect(numeros.patientsSeen).toBeLessThanOrEqual(numeros.consultations);
    expect(numeros.collected).toMatch(/^\d+\.\d{2}$/u);
    // Las solicitudes sembradas incluyen enviadas y aprobadas sin pagar.
    expect(numeros.pendingClaims).toBeGreaterThan(0);
    expect(Number(numeros.expectedFromInsurers)).toBeGreaterThan(0);
  });
});
