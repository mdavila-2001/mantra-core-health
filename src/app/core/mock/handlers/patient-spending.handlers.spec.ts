import { HttpHeaders } from '@angular/common/http';

import type { PatientSpendingResponseDto } from '../../data-access/patient-spending/patient-spending.dto';
import { isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { crearRouterSimulado } from './index';
import { spendingMovementsFor } from './patient-spending.handlers';

/** `GET /patient-spending/me` del backend simulado (P43). */
describe('handlers de gastos del paciente: GET /patient-spending/me', () => {
  const router = crearRouterSimulado();
  const paciente = buscarUsuario('paciente')!;
  const TODAY = new Date(2026, 8, 27, 12);

  function pedir(user: MockRequest['user'], query: Record<string, string>) {
    const match = router.match('GET', '/patient-spending/me');
    if (match === null) throw new Error('No existe GET /patient-spending/me');
    return match.handler({
      method: 'GET',
      path: '/patient-spending/me',
      params: match.params,
      query: new URLSearchParams(query),
      body: {},
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest);
  }

  it('correcto — el paciente recibe sus movimientos, del más reciente al más antiguo', () => {
    const page = pedir(paciente, { from: '2025-01-01', to: '2026-12-31' }) as PatientSpendingResponseDto;

    expect(page.currency).toBe('BOB');
    expect(page.items.length).toBeGreaterThan(24);
    const fechas = page.items.map((item) => item.occurredAt);
    expect([...fechas].sort().reverse()).toEqual(fechas);
    // Nada en el futuro: lo que no pasó no se gastó.
    for (const item of page.items) {
      expect(new Date(item.occurredAt).getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  it('cada importe cuadra: lo pagado es el costo menos cobertura y descuento', () => {
    const items = spendingMovementsFor(paciente.patientProfileId!, '2025-01-01', '2026-09-27', TODAY);

    for (const item of items) {
      const cents = (value: string) => Math.round(Number(value) * 100);
      expect(cents(item.paidAmount)).toBe(
        cents(item.grossAmount) - cents(item.coveredAmount) - cents(item.discountAmount),
      );
      expect(Number(item.paidAmount)).toBeGreaterThanOrEqual(0);
    }
  });

  it('no muestra un gasto de hoy hasta que llega su hora', () => {
    const id = paciente.patientProfileId!;
    const from = '2026-10-01';
    const to = '2026-10-01';
    const early = new Date(2026, 9, 1, 0, 0);
    const late = new Date(2026, 9, 1, 23, 59);
    const before = spendingMovementsFor(id, from, to, early);
    const after = spendingMovementsFor(id, from, to, late);

    expect(before).toEqual([]);
    expect(after.length).toBeGreaterThan(0);
    for (const item of after) {
      expect(new Date(item.occurredAt).getTime()).toBeLessThanOrEqual(late.getTime());
    }
  });

  it('determinista — el mes no cambia según el rango que se pida', () => {
    const id = paciente.patientProfileId!;
    const soloMarzo = spendingMovementsFor(id, '2026-03-01', '2026-03-31', TODAY);
    const todoElAnio = spendingMovementsFor(id, '2026-01-01', '2026-09-27', TODAY).filter((item) =>
      soloMarzo.some((m) => m.id === item.id),
    );

    expect(soloMarzo.length).toBeGreaterThan(0);
    expect(todoElAnio).toEqual(soloMarzo);
  });

  it('límite — otro paciente tiene otra historia', () => {
    const mia = spendingMovementsFor(paciente.patientProfileId!, '2026-01-01', '2026-06-30', TODAY);
    const suya = spendingMovementsFor('11111111-2222-4333-8444-555555555555', '2026-01-01', '2026-06-30', TODAY);

    expect(mia.map((m) => m.paidAmount)).not.toEqual(suya.map((m) => m.paidAmount));
  });

  it('error — sin rango, o con un rango al revés, es 400', () => {
    const invalidos: readonly { query: Record<string, string>; violation: string }[] = [
      { query: {}, violation: '`from` y `to` son obligatorios, con formato YYYY-MM-DD' },
      { query: { from: '2026-01-01' }, violation: '`from` y `to` son obligatorios, con formato YYYY-MM-DD' },
      { query: { from: '2026-09-01', to: '2026-01-01' }, violation: '`from` no puede ser posterior a `to`' },
    ];
    for (const { query, violation } of invalidos) {
      const reply = pedir(paciente, query);
      expect(isMockReply(reply) && reply.status).toBe(400);
      expect(reply).toMatchObject({
        body: { statusCode: 400, code: 'VALIDATION_FAILED', details: { violations: [violation] } },
      });
    }
  });

  it('error — una cuenta sin perfil de paciente recibe la precondición (422)', () => {
    const medico = buscarUsuario('medica')!;
    const reply = pedir({ ...medico, patientProfileId: undefined }, {
      from: '2026-01-01',
      to: '2026-09-27',
    });

    expect(isMockReply(reply) && reply.status).toBe(422);
    expect(reply).toMatchObject({
      body: { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'La cuenta no tiene perfil de paciente' },
    });
  });
});
