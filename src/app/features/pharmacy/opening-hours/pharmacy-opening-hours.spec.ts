import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type {
  OnCallShift,
  PharmacyOpeningHours,
  SiteOpeningHours,
} from '../../../core/data-access/pharmacy/opening-hours.types';
import { PharmacyOpeningHoursPage } from './pharmacy-opening-hours';

/**
 * «Horario y turnos» (P34): la sede declara su 24 h y carga sus turnos; la
 * pantalla manda la hora de Bolivia con su desplazamiento, muestra el motivo del
 * servidor junto al campo, conserva lo tipeado y recarga desde el servidor.
 */
const PHARMACY = 'f-1';

const TURNO: OnCallShift = {
  id: 'sh-1',
  siteId: 's-1',
  startsAt: '2026-10-26T00:00:00Z',
  endsAt: '2026-10-26T12:00:00Z',
  startsAtLocal: '2026-10-25T20:00:00-04:00',
  endsAtLocal: '2026-10-26T08:00:00-04:00',
  timeZone: 'America/La_Paz',
  source: 'PHARMACY',
  status: 'ACTIVE',
  current: true,
};

function sede(partial: Partial<SiteOpeningHours> = {}): SiteOpeningHours {
  return {
    siteId: 's-1',
    siteName: 'Sucursal Centro',
    timeZone: 'America/La_Paz',
    open24h: null,
    shifts: [],
    ...partial,
  };
}

interface Internal {
  cambiar24h: (s: SiteOpeningHours, v: 'si' | 'no' | 'sin-declarar' | null) => void;
  escribir: (siteId: string, campo: string, valor: string) => void;
  agregarTurno: (s: SiteOpeningHours) => void;
  cancelarTurno: (s: SiteOpeningHours, t: OnCallShift) => void;
  borrador: (siteId: string) => Record<string, string>;
  errorDe: (siteId: string, campo: 'desde' | 'hasta') => string;
  guardando: () => string | null;
}

describe('PharmacyOpeningHoursPage', () => {
  let fixture: ComponentFixture<PharmacyOpeningHoursPage>;
  let respuesta: PharmacyOpeningHours;
  let client: {
    listPharmacies: ReturnType<typeof vi.fn>;
    getOpeningHours: ReturnType<typeof vi.fn>;
    setOpen24h: ReturnType<typeof vi.fn>;
    createOnCallShift: ReturnType<typeof vi.fn>;
    cancelOnCallShift: ReturnType<typeof vi.fn>;
  };
  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    respuesta = { pharmacyId: PHARMACY, asOf: '2026-10-26T07:00:00Z', sites: [sede()] };
    client = {
      listPharmacies: vi.fn(() =>
        of({ items: [{ id: PHARMACY, name: 'Farmacia Central' }], count: 1 }),
      ),
      getOpeningHours: vi.fn(() => of(respuesta)),
      setOpen24h: vi.fn((_p: string, siteId: string, open24h: boolean | null) =>
        of(sede({ siteId, open24h })),
      ),
      createOnCallShift: vi.fn(() => of(TURNO)),
      cancelOnCallShift: vi.fn(() => of({ ...TURNO, status: 'CANCELLED', current: false })),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PharmacyClient, useValue: client }],
    });
    fixture = TestBed.createComponent(PharmacyOpeningHoursPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('lee el horario de la farmacia elegida y dice cuando no hay turnos', () => {
    expect(client.getOpeningHours).toHaveBeenCalledWith(PHARMACY);
    expect(raiz().textContent).toContain('Sucursal Centro');
    expect(raiz().querySelector('[data-testid="horario-sin-turnos"]')).not.toBeNull();
  });

  it('declarar 24 h manda true, y «sin declarar» manda null (no false)', () => {
    internal().cambiar24h(sede(), 'si');
    expect(client.setOpen24h).toHaveBeenLastCalledWith(PHARMACY, 's-1', true);
    internal().cambiar24h(sede({ open24h: true }), 'sin-declarar');
    expect(client.setOpen24h).toHaveBeenLastCalledWith(PHARMACY, 's-1', null);
  });

  it('carga el turno en hora de Bolivia con su desplazamiento y recarga desde el servidor', () => {
    internal().escribir('s-1', 'desdeFecha', '2026-10-26');
    internal().escribir('s-1', 'desdeHora', '20:00');
    internal().escribir('s-1', 'hastaFecha', '2026-10-27');
    internal().escribir('s-1', 'hastaHora', '08:00');
    internal().agregarTurno(sede());

    expect(client.createOnCallShift).toHaveBeenCalledWith(PHARMACY, 's-1', {
      startsAt: '2026-10-26T20:00:00-04:00',
      endsAt: '2026-10-27T08:00:00-04:00',
    });
    expect(client.getOpeningHours).toHaveBeenCalledTimes(2);
    expect(internal().borrador('s-1')['desdeFecha']).toBe('');
  });

  it('sin fechas no manda nada y marca los campos', () => {
    internal().agregarTurno(sede());
    expect(client.createOnCallShift).not.toHaveBeenCalled();
    expect(internal().errorDe('s-1', 'desde')).toContain('inicio');
    expect(internal().errorDe('s-1', 'hasta')).toContain('fin');
  });

  it('un 409 del servidor va al campo y conserva lo tipeado', () => {
    client.createOnCallShift.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'CONFLICT', message: 'La sede ya tiene un turno activo en ese horario' },
          }),
      ),
    );
    internal().escribir('s-1', 'desdeFecha', '2026-10-26');
    internal().escribir('s-1', 'desdeHora', '20:00');
    internal().escribir('s-1', 'hastaFecha', '2026-10-27');
    internal().escribir('s-1', 'hastaHora', '08:00');
    internal().agregarTurno(sede());

    expect(internal().errorDe('s-1', 'desde')).toBe(
      'La sede ya tiene un turno activo en ese horario',
    );
    expect(internal().borrador('s-1')['desdeHora']).toBe('20:00');
    expect(internal().guardando()).toBeNull();
  });

  it('lista el turno vigente y lo cancela', async () => {
    respuesta = { ...respuesta, sites: [sede({ shifts: [TURNO] })] };
    client.getOpeningHours.mockReturnValue(of(respuesta));
    internal().cancelarTurno(sede({ shifts: [TURNO] }), TURNO);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(client.cancelOnCallShift).toHaveBeenCalledWith(PHARMACY, 'sh-1');
    expect(raiz().querySelector('[data-testid="horario-turnos"]')?.textContent).toContain(
      'De turno ahora',
    );
  });
});
