import { computed, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';

import { SiteContextStore } from '../../../core/data-access/operating-rooms/site-context.store';
import { chooseSelectOption, selectOptionLabels } from '../../../../testing/select';
import { SiteSwitch } from './site-switch';

/**
 * El establecimiento activo de quirófanos: con varios, un selector que se lo
 * dice al store; con uno, sólo el nombre (nadie elige entre una opción); sin
 * ninguno, nada.
 */
describe('SiteSwitch', () => {
  let fixture: ComponentFixture<SiteSwitch>;
  const sites = signal<readonly { id: string; code: string; name: string }[]>([]);
  const elegido = signal<string | null>(null);
  let select: ReturnType<typeof vi.fn>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    sites.set([]);
    elegido.set(null);
    select = vi.fn((id: string) => elegido.set(id));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SiteContextStore,
          useValue: {
            sites,
            siteId: computed(() => elegido() ?? sites()[0]?.id ?? null),
            site: computed(() => sites().find((s) => s.id === elegido()) ?? sites()[0] ?? null),
            select,
          },
        },
      ],
    });
  });

  function pintar(): void {
    fixture = TestBed.createComponent(SiteSwitch);
    fixture.detectChanges();
  }

  it('sin establecimientos no pinta nada', () => {
    pintar();
    expect(root().textContent?.trim()).toBe('');
  });

  it('con uno solo muestra código y nombre, sin selector', () => {
    sites.set([{ id: 's-1', code: 'HSJ', name: 'Hospital San Juan' }]);
    pintar();
    expect(root().querySelector('[data-testid="site-switch-single"]')?.textContent).toBe('HSJ · Hospital San Juan');
    expect(root().querySelector('app-select')).toBeNull();
  });

  it('con varios, elegir uno se lo dice al store', async () => {
    sites.set([
      { id: 's-1', code: 'HSJ', name: 'Hospital San Juan' },
      { id: 's-2', code: 'CNO', name: 'Clínica Norte' },
    ]);
    pintar();
    const host = root().querySelector('[data-testid="site-switch"]')!;
    expect(await selectOptionLabels(fixture, host)).toEqual(['HSJ · Hospital San Juan', 'CNO · Clínica Norte']);

    await chooseSelectOption(fixture, host, 'CNO · Clínica Norte');
    expect(select).toHaveBeenCalledWith('s-2');
  });
});
