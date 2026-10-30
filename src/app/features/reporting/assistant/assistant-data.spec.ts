import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ReportingClient } from '@core/data-access/reporting/reporting.client';
import type { PestanaReporte, VerticalReporte } from '@core/data-access/reporting/reporting.types';

import { ReportAssistantData } from './assistant-data';
import { CONTEXTO_BASE, PESTANAS } from './assistant.fixtures';

describe('ReportAssistantData', () => {
  const byName = new Map<VerticalReporte, PestanaReporte>(PESTANAS.map((p) => [p.pestana, p]));
  let pedir: ReturnType<typeof vi.fn>;
  let datos: ReportAssistantData;

  function montar(impl?: (v: VerticalReporte) => ReturnType<ReportingClient['pestana']>): void {
    pedir = vi.fn((v: VerticalReporte) => (impl ? impl(v) : of(byName.get(v) as PestanaReporte)));
    TestBed.configureTestingModule({ providers: [{ provide: ReportingClient, useValue: { pestana: pedir } }] });
    datos = TestBed.inject(ReportAssistantData);
  }

  it('pide las siete pestañas con el contexto recibido', async () => {
    montar();
    const r = await datos.todas(CONTEXTO_BASE);
    expect(r.pestanas).toHaveLength(7);
    expect(r.faltantes).toEqual([]);
    expect(pedir).toHaveBeenCalledTimes(7);
    expect(pedir).toHaveBeenCalledWith('suscripciones', CONTEXTO_BASE);
  });

  it('no repite peticiones para el mismo contexto', async () => {
    montar();
    await datos.todas(CONTEXTO_BASE);
    await datos.todas({ ...CONTEXTO_BASE });
    expect(pedir).toHaveBeenCalledTimes(7);
  });

  it('un contexto distinto (moneda, filtros) sí vuelve a pedir', async () => {
    montar();
    await datos.todas(CONTEXTO_BASE);
    await datos.todas({ ...CONTEXTO_BASE, moneda: 'USD' });
    await datos.todas({ ...CONTEXTO_BASE, filtros: [{ dimension: 'plan', valor: 'Pro' }] });
    expect(pedir).toHaveBeenCalledTimes(21);
  });

  it('si solo algunas fallan, devuelve las que llegaron y dice cuáles faltan', async () => {
    montar((v) => (v === 'cobros' ? throwError(() => new Error('caída')) : of(byName.get(v) as PestanaReporte)));
    const r = await datos.todas(CONTEXTO_BASE);
    expect(r.pestanas).toHaveLength(6);
    expect(r.faltantes).toEqual(['cobros']);
  });

  it('si fallan todas, relanza el error', async () => {
    montar(() => throwError(() => new Error('sin servidor')));
    await expect(datos.todas(CONTEXTO_BASE)).rejects.toThrow('sin servidor');
  });

  it('un fallo no se guarda: reintentar vuelve a pedir', async () => {
    let falla = true;
    montar((v) => (falla ? throwError(() => new Error('caída')) : of(byName.get(v) as PestanaReporte)));
    await expect(datos.todas(CONTEXTO_BASE)).rejects.toThrow();
    falla = false;
    const r = await datos.todas(CONTEXTO_BASE);
    expect(r.pestanas).toHaveLength(7);
  });
});
