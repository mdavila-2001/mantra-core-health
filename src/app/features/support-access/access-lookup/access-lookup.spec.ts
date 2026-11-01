import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportCatalog } from '../../../core/data-access/support-access/support-access.types';
import { chooseSelectOption, selectOptionLabels } from '../../../../testing/select';
import { AccessLookup } from './access-lookup';

/**
 * «Quién tiene acceso»: elegir un doctor, un servicio o un lugar y ver quién
 * del personal de apoyo puede actuar sobre él (lo que dice la API, que es la
 * autoridad). No consulta hasta elegir; un lugar se nombra con su camino;
 * nadie con acceso se dice en palabras; un catálogo caído se avisa.
 */

const CATALOGO = {
  doctors: [{ id: 'pra-1', name: 'Dra. Rojas', specialty: 'Pediatría' }],
  services: [{ id: 'sv-1', name: 'Vacunación' }],
  locations: [
    { id: 'site', name: 'Sede Central', parentId: null, kind: 'SITE' },
    { id: 'p2', name: 'Piso 2', parentId: 'site', kind: 'LEVEL' },
  ],
} as unknown as SupportCatalog;

describe('AccessLookup', () => {
  let fixture: ComponentFixture<AccessLookup>;
  let lookupAccess: ReturnType<typeof vi.fn>;
  let getCatalog: ReturnType<typeof vi.fn>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const objetivo = (): Element => root().querySelector('[data-testid="lookup-objetivo"]')!;

  function pintar(): void {
    fixture = TestBed.createComponent(AccessLookup);
    fixture.detectChanges();
  }

  function cambiarTipo(rotulo: string): void {
    Array.from(root().querySelectorAll<HTMLButtonElement>('[data-testid="lookup-tipo"] [role="radio"]'))
      .find((b) => b.textContent?.trim() === rotulo)!
      .click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    getCatalog = vi.fn(() => of(CATALOGO));
    lookupAccess = vi.fn(() =>
      of({ items: [{ engagementId: 'eg-1', personName: 'Luis Vaca', roleTemplate: 'RECEPTIONIST', actions: ['schedule.view', 'schedule.create'] }] }),
    );
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: SupportAccessClient, useValue: { getCatalog, lookupAccess } }] });
  });

  it('antes de elegir no consulta nada y lo dice', () => {
    pintar();
    expect(lookupAccess).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Todavía no consultó nada.');
  });

  it('elegir un doctor consulta su acceso y lista quién puede y qué', async () => {
    pintar();
    await chooseSelectOption(fixture, objetivo(), 'Dra. Rojas · Pediatría');
    expect(lookupAccess).toHaveBeenCalledWith({ kind: 'doctor', id: 'pra-1' });
    const fila = root().querySelector('[data-testid="lookup-eg-1"]')!;
    expect(fila.textContent).toContain('Luis Vaca');
    expect(fila.textContent).toContain('2 acciones');
    expect(fila.querySelector('.lookup__acciones')?.textContent).toMatch(/^Puede .+\.$/);
  });

  it('un lugar se ofrece con su camino completo', async () => {
    pintar();
    cambiarTipo('Un piso o lugar');
    expect(await selectOptionLabels(fixture, objetivo())).toEqual(['Sede Central', 'Sede Central › Piso 2']);
  });

  it('cambiar de tipo descarta la consulta anterior', async () => {
    pintar();
    await chooseSelectOption(fixture, objetivo(), 'Dra. Rojas · Pediatría');
    cambiarTipo('Un servicio');
    expect(root().querySelector('[data-testid="lookup-eg-1"]')).toBeNull();
    expect(root().textContent).toContain('Todavía no consultó nada.');
  });

  it('nadie con acceso se dice; un error no se disfraza de vacío', async () => {
    lookupAccess.mockReturnValueOnce(of({ items: [] }));
    pintar();
    await chooseSelectOption(fixture, objetivo(), 'Dra. Rojas · Pediatría');
    expect(root().textContent).toContain('Nadie del personal de apoyo puede actuar sobre esto.');

    lookupAccess.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    cambiarTipo('Un servicio');
    await chooseSelectOption(fixture, objetivo(), 'Vacunación');
    expect(root().textContent).not.toContain('Nadie del personal de apoyo puede actuar sobre esto.');
  });

  it('si el catálogo no carga, lo avisa', () => {
    getCatalog.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    pintar();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar los doctores');
  });
});
