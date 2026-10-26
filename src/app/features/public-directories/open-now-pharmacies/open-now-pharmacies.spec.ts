import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type {
  OpenNowPage,
  OpenNowSite,
} from '../../../core/data-access/pharmacy/opening-hours.types';
import { OpenNowPharmacies } from './open-now-pharmacies';

function sitio(id: string, partial: Partial<OpenNowSite> = {}): OpenNowSite {
  return {
    siteId: id,
    siteName: `Sede ${id}`,
    pharmacyName: `Farmacia ${id}`,
    pharmacySlug: `farmacia-${id}`,
    addressText: null,
    city: null,
    latitude: null,
    longitude: null,
    distanceKm: null,
    open24h: false,
    onCall: null,
    timeZone: 'America/La_Paz',
    ...partial,
  };
}

function pagina(items: readonly OpenNowSite[], nextCursor: string | null): OpenNowPage {
  return {
    items,
    nextCursor,
    asOf: '2026-10-26T07:00:00.000Z',
    asOfLocal: '2026-10-26T03:00:00-04:00',
    timeZone: 'America/La_Paz',
  };
}

describe('OpenNowPharmacies (P34)', () => {
  let fixture: ComponentFixture<OpenNowPharmacies>;
  let openNow: ReturnType<typeof vi.fn>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  async function montar(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PharmacyClient, useValue: { openNow } }],
    });
    fixture = TestBed.createComponent(OpenNowPharmacies);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    openNow = vi.fn();
  });

  it('muestra 24 h y de turno con la hora de Bolivia, y pagina con el cursor del servidor', async () => {
    openNow
      .mockReturnValueOnce(
        of(
          pagina(
            [
              sitio('a', { open24h: true }),
              sitio('b', {
                onCall: {
                  startsAt: '2026-10-26T00:00:00Z',
                  endsAt: '2026-10-26T12:00:00Z',
                  endsAtLocal: '2026-10-26T08:00:00-04:00',
                  source: 'PHARMACY',
                },
              }),
            ],
            'c1',
          ),
        ),
      )
      .mockReturnValueOnce(of(pagina([sitio('c', { open24h: true })], null)));
    await montar();

    expect(raiz().querySelector('[data-testid="abiertas-hora"]')?.textContent).toContain('03:00');
    const rotulos = [...raiz().querySelectorAll('[data-testid="abiertas-rotulo"]')].map((e) =>
      e.textContent?.trim(),
    );
    expect(rotulos[0]).toBe('Abierta 24 h');
    expect(rotulos[1]).toContain('De turno hasta el');
    expect(rotulos[1]).toContain('08:00');

    raiz().querySelector<HTMLButtonElement>('[data-testid="abiertas-ver-mas"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(openNow).toHaveBeenLastCalledWith({ mode: 'any', limit: 6, cursor: 'c1' });
    expect(raiz().querySelectorAll('[data-testid="abiertas-rotulo"]').length).toBe(3);
    expect(raiz().querySelector('[data-testid="abiertas-ver-mas"]')).toBeNull();
  });

  it('sin abiertas lo dice, en vez de una lista muda', async () => {
    openNow.mockReturnValue(of(pagina([], null)));
    await montar();
    expect(raiz().textContent).toContain('Ninguna farmacia de la red declaró estar abierta');
  });

  it('si falla la página siguiente, lo ya mostrado se queda', async () => {
    openNow
      .mockReturnValueOnce(of(pagina([sitio('a', { open24h: true })], 'c1')))
      .mockReturnValueOnce(throwError(() => new Error('red')));
    await montar();
    raiz().querySelector<HTMLButtonElement>('[data-testid="abiertas-ver-mas"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(raiz().querySelectorAll('[data-testid="abiertas-rotulo"]').length).toBe(1);
    expect(raiz().textContent).toContain('No se pudieron traer más');
  });
});
