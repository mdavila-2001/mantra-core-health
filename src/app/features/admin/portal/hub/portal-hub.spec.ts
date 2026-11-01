import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { PortalHub } from './portal-hub';

/**
 * El centro del portal de administración: las cifras del inventario que genera
 * la API, de dónde salió (hash y origen) y los accesos a cada área. Un error
 * no se pinta como un inventario en cero.
 */
describe('PortalHub', () => {
  let fixture: ComponentFixture<PortalHub>;
  let version: ReturnType<typeof vi.fn>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function pintar(): void {
    fixture = TestBed.createComponent(PortalHub);
    fixture.detectChanges();
  }

  beforeEach(() => {
    version = vi.fn(() => of({ hash: 'abc123', operaciones: 412, procesos: 38, tablas: 220, columnas: 3100, origen: 'inventory.json' }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PortalClient, useValue: { version } },
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
      ],
    });
  });

  it('muestra las cuatro cifras del inventario con su rótulo', () => {
    pintar();
    const cifras = Array.from(root().querySelectorAll('[data-testid="portal-cifras"] app-metric-card')).map((c) => [
      c.querySelector('.metric-card__label')?.textContent?.trim(),
      c.querySelector('.metric-card__value')?.textContent?.trim(),
    ]);
    expect(cifras.map(([label]) => label)).toEqual(['Operaciones', 'Procesos', 'Tablas', 'Columnas']);
    expect(cifras[0]![1]).toContain('412');
  });

  it('dice de dónde salió el inventario', () => {
    pintar();
    expect(root().querySelector('.hub__origen')?.textContent).toContain('abc123');
    expect(root().querySelector('.hub__origen')?.textContent).toContain('inventory.json');
  });

  it('los accesos llevan a cada área del portal', () => {
    pintar();
    expect(Array.from(root().querySelectorAll('a.hub__acceso')).map((a) => a.getAttribute('href'))).toEqual([
      '/superadmin/portal/systems/operations',
      '/superadmin/portal/systems/flows',
      '/superadmin/portal/catalog/tables',
      '/superadmin/portal/lineage',
    ]);
  });

  it('un error no pinta cifras', () => {
    version.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    pintar();
    expect(root().querySelector('[data-testid="portal-cifras"]')).toBeNull();
    expect(root().querySelector('a.hub__acceso')).toBeNull();
  });
});
