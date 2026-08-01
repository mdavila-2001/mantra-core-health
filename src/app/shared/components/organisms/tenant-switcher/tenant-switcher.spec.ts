import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { TenantSwitcher } from './tenant-switcher';
import type { TenantOption, TenantSwitcherVariant } from './tenant-switcher.types';

const TENANTS: readonly TenantOption[] = [
  { id: 'hosp-central', name: 'Hospital Central', role: 'Médico' },
  { id: 'clinica-sur', name: 'Clínica Sur', role: 'Administrativo' },
];

@Component({
  imports: [TenantSwitcher],
  template: `
    <app-tenant-switcher
      [tenants]="tenants()"
      [activeTenantId]="activo()"
      [variant]="variant()"
      (tenantChanged)="cambios.push($event)"
    />
  `,
})
class HostComponent {
  readonly tenants = signal<readonly TenantOption[]>(TENANTS);
  readonly activo = signal<string | null>('hosp-central');
  readonly variant = signal<TenantSwitcherVariant>('compact');
  readonly cambios: string[] = [];
}

describe('TenantSwitcher', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function abrirMenu(): Promise<void> {
    root().querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('variante compacta', () => {
    it('muestra la organización activa en el disparador', () => {
      expect(root().querySelector('.tenant-switcher__trigger-label')?.textContent?.trim()).toBe(
        'Hospital Central',
      );
    });

    it('el disparador se nombra con la organización y con qué hace', () => {
      const boton = root().querySelector('[aria-haspopup="menu"]');

      expect(boton?.getAttribute('aria-label')).toBe(
        'Organización activa: Hospital Central. Cambiar de organización',
      );
    });

    it('lista todas las organizaciones en el menú', async () => {
      await abrirMenu();

      const items = [...document.querySelectorAll('[role="menuitem"]')];
      expect(items).toHaveLength(2);
      expect(items[1].textContent).toContain('Clínica Sur');
    });
  });

  describe('emisión', () => {
    it('emite solo el id, sin validar nada', async () => {
      await abrirMenu();
      document.querySelectorAll<HTMLElement>('[role="menuitem"]')[1].click();
      await fixture.whenStable();

      expect(host.cambios).toEqual(['clinica-sur']);
    });

    it('elegir la que ya está activa no emite', async () => {
      await abrirMenu();
      document.querySelectorAll<HTMLElement>('[role="menuitem"]')[0].click();
      await fixture.whenStable();

      expect(host.cambios).toEqual([]);
    });

    it('anuncia el cambio por región viva', async () => {
      await abrirMenu();
      document.querySelectorAll<HTMLElement>('[role="menuitem"]')[1].click();
      await fixture.whenStable();

      const region = root().querySelector('[role="status"][aria-live="polite"]');
      expect(region?.textContent?.trim()).toBe('Organización activa: Clínica Sur');
    });
  });

  describe('id activo fuera de la lista', () => {
    it('queda indeterminado y NO se autocorrige', async () => {
      host.activo.set('tenant-que-no-esta');
      await fixture.whenStable();

      const componente = fixture.debugElement.children[0].componentInstance as TenantSwitcher;
      expect(componente.isIndeterminate()).toBe(true);
      expect(root().querySelector('.tenant-switcher__trigger-label')?.textContent?.trim()).toBe(
        'Elegí una organización',
      );
      // no eligió ninguna por su cuenta
      expect(host.cambios).toEqual([]);
    });

    it('avisa en desarrollo', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const otro = TestBed.createComponent(HostComponent);
      otro.componentInstance.activo.set('tenant-que-no-esta');
      await otro.whenStable();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('no está entre los tenants recibidos'),
        'tenant-que-no-esta',
      );
      warn.mockRestore();
      otro.destroy();
    });
  });

  describe('variante de página', () => {
    beforeEach(async () => {
      host.variant.set('page');
      await fixture.whenStable();
    });

    it('dibuja una tarjeta por organización con nombre y rol', () => {
      const tarjetas = root().querySelectorAll('app-card');

      expect(tarjetas).toHaveLength(2);
      expect(tarjetas[0].textContent).toContain('Hospital Central');
      expect(tarjetas[0].textContent).toContain('Médico');
    });

    it('la activa se marca con aria-current, no solo con color', () => {
      const activa = root().querySelector('app-card[aria-current="true"]');

      expect(activa?.textContent).toContain('Hospital Central');
      expect(root().querySelectorAll('app-card[aria-current="true"]')).toHaveLength(1);
    });

    it('cada tarjeta es alcanzable por teclado y emite al activarse', async () => {
      const segunda = root().querySelectorAll<HTMLElement>('app-card')[1];
      expect(segunda.getAttribute('tabindex')).toBe('0');

      segunda.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await fixture.whenStable();

      expect(host.cambios).toEqual(['clinica-sur']);
    });
  });
});
