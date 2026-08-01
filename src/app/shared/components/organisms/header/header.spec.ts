import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Header } from './header';
import type { HeaderUser } from './header.types';
import type { TenantOption } from '../tenant-switcher/tenant-switcher.types';

const USUARIO: HeaderUser = {
  displayName: 'Andrea Peña',
  roles: ['Médica', 'Jefa de servicio'],
};

const DOS_TENANTS: readonly TenantOption[] = [
  { id: 'hosp-central', name: 'Hospital Central', role: 'Médica' },
  { id: 'clinica-sur', name: 'Clínica Sur', role: 'Médica' },
];

@Component({
  imports: [Header],
  template: `
    <header
      app-header
      [user]="usuario()"
      [tenants]="tenants()"
      [activeTenantId]="activo()"
      [showMenuButton]="conMenu()"
      [menuOpen]="menuAbierto()"
      navPanelId="nav-principal"
      (menuToggled)="alternancias.push(1)"
      (logoutRequested)="salidas.push(1)"
      (tenantChanged)="cambios.push($event)"
    ></header>
  `,
})
class HostComponent {
  readonly usuario = signal<HeaderUser | null>(USUARIO);
  readonly tenants = signal<readonly TenantOption[]>([]);
  readonly activo = signal<string | null>(null);
  readonly conMenu = signal(false);
  readonly menuAbierto = signal(false);
  readonly alternancias: number[] = [];
  readonly salidas: number[] = [];
  readonly cambios: string[] = [];
}

describe('Header', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botonMenu(): HTMLButtonElement | null {
    return root().querySelector('.app-header__menu-button');
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

  describe('landmark', () => {
    it('el host ES un <header>: landmark de banner sin envoltorios', () => {
      const banner = root().querySelector('header');

      expect(banner).not.toBeNull();
      expect(banner?.classList.contains('app-header')).toBe(true);
    });
  });

  describe('selector de organización', () => {
    it('con una sola organización no aparece', async () => {
      host.tenants.set([DOS_TENANTS[0]]);
      await fixture.whenStable();

      expect(root().querySelector('app-tenant-switcher')).toBeNull();
    });

    it('sin organizaciones tampoco', () => {
      expect(root().querySelector('app-tenant-switcher')).toBeNull();
    });

    it('con más de una aparece y reenvía el cambio', async () => {
      host.tenants.set(DOS_TENANTS);
      host.activo.set('hosp-central');
      await fixture.whenStable();

      expect(root().querySelector('app-tenant-switcher')).not.toBeNull();

      root().querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.click();
      await fixture.whenStable();
      document.querySelectorAll<HTMLElement>('[role="menuitem"]')[1].click();
      await fixture.whenStable();

      expect(host.cambios).toEqual(['clinica-sur']);
    });
  });

  describe('botón de menú', () => {
    it('no existe cuando el nav es fijo', () => {
      expect(botonMenu()).toBeNull();
    });

    it('declara qué panel controla y si está abierto', async () => {
      host.conMenu.set(true);
      await fixture.whenStable();

      expect(botonMenu()?.getAttribute('aria-controls')).toBe('nav-principal');
      expect(botonMenu()?.getAttribute('aria-expanded')).toBe('false');

      host.menuAbierto.set(true);
      await fixture.whenStable();
      expect(botonMenu()?.getAttribute('aria-expanded')).toBe('true');
    });

    it('emite al pulsarse', async () => {
      host.conMenu.set(true);
      await fixture.whenStable();

      botonMenu()?.click();
      await fixture.whenStable();

      expect(host.alternancias).toHaveLength(1);
    });
  });

  describe('cuenta', () => {
    it('muestra el nombre y el rol legible sin tocar ningún token', async () => {
      root().querySelector<HTMLButtonElement>('.app-header__account')?.click();
      await fixture.whenStable();

      const resumen = document.querySelector('.app-header__account-summary');
      expect(resumen?.textContent).toContain('Andrea Peña');
      expect(resumen?.textContent).toContain('Médica · Jefa de servicio');
    });

    it('cerrar sesión emite y no hace nada más', async () => {
      root().querySelector<HTMLButtonElement>('.app-header__account')?.click();
      await fixture.whenStable();

      const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
      const salir = items.find((item) => item.textContent?.includes('Cerrar sesión'));
      salir?.click();
      await fixture.whenStable();

      expect(host.salidas).toHaveLength(1);
    });

    it('sin usuario no hay menú de cuenta', async () => {
      host.usuario.set(null);
      await fixture.whenStable();

      expect(root().querySelector('.app-header__account')).toBeNull();
    });
  });

  describe('tema', () => {
    it('ofrece cambiar el tema diciendo cuál está activo', () => {
      const boton = [...root().querySelectorAll('button')].find((candidato) =>
        candidato.getAttribute('aria-label')?.startsWith('Cambiar tema'),
      );

      expect(boton).toBeDefined();
      expect(boton?.getAttribute('aria-label')).toContain('Actual:');
    });
  });
});
