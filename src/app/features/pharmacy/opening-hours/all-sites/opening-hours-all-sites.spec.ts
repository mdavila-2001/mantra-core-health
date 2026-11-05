import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SiteOpeningHours } from '../../../../core/data-access/pharmacy/opening-hours.types';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import { OpeningHoursAllSites } from './opening-hours-all-sites';

/**
 * "All branches": the same 24 h declaration or shift on every checked site,
 * one request per site, reporting each outcome.
 */
function sede(siteId: string, siteName: string): SiteOpeningHours {
  return { siteId, siteName, timeZone: 'America/La_Paz', open24h: null, shifts: [] };
}

const SEDES = [sede('s-1', 'Centro'), sede('s-2', 'Norte'), sede('s-3', 'Sur')];

interface Internal {
  declaracion: { set: (v: 'si' | 'no' | 'sin-declarar' | null) => void };
  aplicar24h: () => void;
  escribir: (campo: string, valor: string) => void;
  cargarTurno: () => void;
  marcar: (siteId: string, marcada: boolean) => void;
  marcarTodas: (marcadas: boolean) => void;
  borrador: () => Record<string, string>;
  errores: () => { desde?: string; hasta?: string };
  resumen: () => { guardadas: number; fallidas: { siteName: string; motivo: string }[] } | null;
}

describe('OpeningHoursAllSites', () => {
  let fixture: ComponentFixture<OpeningHoursAllSites>;
  let client: { setOpen24h: ReturnType<typeof vi.fn>; createOnCallShift: ReturnType<typeof vi.fn> };
  let aplicados: number;
  const internal = (): Internal => fixture.componentInstance as unknown as Internal;

  function turnoValido(): void {
    internal().escribir('desdeFecha', '2026-11-10');
    internal().escribir('desdeHora', '20:00');
    internal().escribir('hastaFecha', '2026-11-11');
    internal().escribir('hastaHora', '08:00');
  }

  beforeEach(() => {
    client = {
      setOpen24h: vi.fn((_p: string, siteId: string, open24h: boolean | null) =>
        of({ ...sede(siteId, siteId), open24h }),
      ),
      createOnCallShift: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({ providers: [{ provide: PharmacyClient, useValue: client }] });
    fixture = TestBed.createComponent(OpeningHoursAllSites);
    fixture.componentRef.setInput('pharmacyId', 'f-1');
    fixture.componentRef.setInput('sedes', SEDES);
    aplicados = 0;
    fixture.componentInstance.aplicado.subscribe(() => aplicados++);
    fixture.detectChanges();
  });

  it('declara 24 h en todas las sedes, una por una, y avisa para recargar', () => {
    internal().declaracion.set('si');
    internal().aplicar24h();

    expect(client.setOpen24h.mock.calls).toEqual([
      ['f-1', 's-1', true],
      ['f-1', 's-2', true],
      ['f-1', 's-3', true],
    ]);
    expect(internal().resumen()?.guardadas).toBe(3);
    expect(aplicados).toBe(1);
  });

  it('respeta las sedes desmarcadas', () => {
    internal().marcar('s-2', false);
    internal().declaracion.set('no');
    internal().aplicar24h();

    expect(client.setOpen24h.mock.calls.map((c) => c[1])).toEqual(['s-1', 's-3']);
  });

  it('sin ninguna sede marcada no manda nada', () => {
    internal().marcarTodas(false);
    internal().declaracion.set('si');
    internal().aplicar24h();
    turnoValido();
    internal().cargarTurno();

    expect(client.setOpen24h).not.toHaveBeenCalled();
    expect(client.createOnCallShift).not.toHaveBeenCalled();
  });

  it('carga el mismo turno en hora de Bolivia en cada sede y limpia lo tipeado', () => {
    turnoValido();
    internal().cargarTurno();

    expect(client.createOnCallShift).toHaveBeenCalledTimes(3);
    expect(client.createOnCallShift).toHaveBeenCalledWith('f-1', 's-2', {
      startsAt: '2026-11-10T20:00:00-04:00',
      endsAt: '2026-11-11T08:00:00-04:00',
    });
    expect(internal().borrador()['desdeFecha']).toBe('');
  });

  it('un solape en una sede no frena a las demás: dice cuál y conserva lo tipeado', () => {
    client.createOnCallShift.mockImplementation((_p: string, siteId: string) =>
      siteId === 's-2'
        ? throwError(
            () =>
              new HttpErrorResponse({
                status: 409,
                error: { message: 'La sede ya tiene un turno activo en ese horario' },
              }),
          )
        : of({}),
    );
    turnoValido();
    internal().cargarTurno();
    fixture.detectChanges();

    expect(client.createOnCallShift).toHaveBeenCalledTimes(3);
    expect(internal().resumen()?.guardadas).toBe(2);
    expect(internal().resumen()?.fallidas).toEqual([
      {
        siteId: 's-2',
        siteName: 'Norte',
        motivo: 'La sede ya tiene un turno activo en ese horario',
      },
    ]);
    expect(internal().borrador()['desdeHora']).toBe('20:00');
    const alerta = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="todas-fallidas"]',
    );
    expect(alerta?.textContent).toContain('Norte');
    expect(aplicados).toBe(1);
  });

  it('sin fechas no manda nada y marca los campos', () => {
    internal().cargarTurno();
    expect(client.createOnCallShift).not.toHaveBeenCalled();
    expect(internal().errores().desde).toContain('inicio');
    expect(internal().errores().hasta).toContain('fin');
  });
});
