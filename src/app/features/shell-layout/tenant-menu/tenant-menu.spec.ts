import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import type { TenantOption } from '../../../shared/components/organisms/tenant-switcher/tenant-switcher.types';
import { TenantMenu } from './tenant-menu';

/**
 * El selector de organización del encabezado. Sólo aparece si hay entre qué
 * elegir (más de una organización, o alcance de plataforma). Marca la activa
 * con `aria-current` y emite la elegida; «Toda la plataforma» sólo existe con
 * alcance de plataforma (que la API concede: el front no lo decide).
 */

const ORGS: readonly TenantOption[] = [
  { id: 't-1', name: 'Clínica Sur' },
  { id: 't-2', name: 'Clínica Norte' },
];

describe('TenantMenu', () => {
  let fixture: ComponentFixture<TenantMenu>;
  const plataforma = signal(false);
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function pintar(tenants: readonly TenantOption[], activo: string | null = 't-1'): void {
    fixture = TestBed.createComponent(TenantMenu);
    fixture.componentRef.setInput('tenants', tenants);
    fixture.componentRef.setInput('activeTenantId', activo);
    fixture.componentRef.setInput('label', 'Clínica Sur');
    fixture.detectChanges();
  }

  const items = (): HTMLButtonElement[] => Array.from(root().querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));

  beforeEach(() => {
    plataforma.set(false);
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { hasPlatformScope: plataforma } }] });
  });

  it('con una sola organización y sin plataforma no se muestra', () => {
    pintar([ORGS[0]!]);
    expect(root().querySelector('[data-testid="header-organization"]')).toBeNull();
  });

  it('con varias, se anuncia con la activa y la marca como actual', () => {
    pintar(ORGS);
    expect(root().querySelector('[data-testid="header-organization"]')?.getAttribute('aria-label')).toBe('Organización activa: Clínica Sur');
    expect(items().map((b) => [b.textContent?.trim(), b.getAttribute('aria-current')])).toEqual([
      ['Clínica Sur', 'true'],
      ['Clínica Norte', null],
    ]);
    expect(root().querySelector('[data-testid="header-organization-platform"]')).toBeNull();
  });

  it('elegir una organización emite su id', () => {
    pintar(ORGS);
    const elegidas: string[] = [];
    fixture.componentInstance.tenantChanged.subscribe((id) => elegidas.push(id));
    items()[1]!.click();
    expect(elegidas).toEqual(['t-2']);
  });

  it('con alcance de plataforma se muestra aun con una sola, y ofrece «Toda la plataforma»', () => {
    plataforma.set(true);
    pintar([ORGS[0]!], null);
    const todo = root().querySelector<HTMLButtonElement>('[data-testid="header-organization-platform"]')!;
    expect(todo.getAttribute('aria-current')).toBe('true');
    let elegida = 0;
    fixture.componentInstance.platformChosen.subscribe(() => (elegida += 1));
    todo.click();
    expect(elegida).toBe(1);
  });
});
