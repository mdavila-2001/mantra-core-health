import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import {
  empty,
  forbidden,
  loading,
  notFound,
  offline,
  ready,
  routeAuthPending,
  stale,
  unexpectedError,
  validation,
} from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { ViewStateHost } from './view-state-host';

@Component({
  imports: [ViewStateHost],
  template: `
    <app-view-state-host
      [state]="state()"
      (retry)="retries.push(1)"
      (refresh)="refreshes.push(1)"
    >
      <div vsh-skeleton class="esqueleto-real">forma real del contenido</div>
      <p class="contenido">Listado de pacientes</p>
    </app-view-state-host>
  `,
})
class HostComponent {
  readonly state = signal<ViewState<string[]>>(loading());
  readonly retries: number[] = [];
  readonly refreshes: number[] = [];
}

describe('ViewStateHost', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function conEstado(state: ViewState<string[]>): Promise<void> {
    host.state.set(state);
    await fixture.whenStable();
  }

  function textoVisible(): string {
    return (root().textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('S1 · autorización pendiente', () => {
    it('muestra el spinner de permisos y NO un esqueleto de contenido', async () => {
      await conEstado(routeAuthPending());

      expect(root().querySelector('app-spinner')).not.toBeNull();
      expect(textoVisible()).toContain('Verificando permisos');
      // la regla dura: la forma del contenido no se insinúa antes de autorizar
      expect(root().querySelector('.esqueleto-real')).toBeNull();
      expect(root().querySelector('app-skeleton')).toBeNull();
    });
  });

  describe('S2 · cargando', () => {
    it('muestra el esqueleto del slot con la forma real', async () => {
      await conEstado(loading());

      expect(root().querySelector('.esqueleto-real')).not.toBeNull();
      expect(root().querySelector('app-spinner')).toBeNull();
    });

    it('no roba el foco: cargar no es un error que corregir', async () => {
      const focoAntes = document.activeElement;
      await conEstado(loading());

      expect(document.activeElement).toBe(focoAntes);
    });
  });

  describe('S3 · vacío con próxima acción', () => {
    it('muestra el vacío y la acción como enlace cuando trae ruta', async () => {
      await conEstado(empty({ label: 'Registrar el primer paciente', route: '/pacientes/alta' }));

      expect(root().querySelector('app-empty-state')).not.toBeNull();
      const accion = root().querySelector<HTMLAnchorElement>('a[app-link]');
      expect(accion?.textContent?.trim()).toBe('Registrar el primer paciente');
      expect(accion?.getAttribute('href')).toBe('/pacientes/alta');
    });
  });

  describe('S4 · validación', () => {
    it('lista los problemas por campo', async () => {
      await conEstado(
        validation([
          { field: 'documento', message: 'El documento ya está registrado.' },
          { message: 'Revisá los datos e intentá de nuevo.' },
        ]),
      );

      const items = [...root().querySelectorAll('.view-state-host__issues li')];
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toContain('documento');
    });

    it('mueve el foco al mensaje: hay algo que corregir', async () => {
      await conEstado(validation([{ message: 'Dato inválido' }]));
      // el foco viaja en un microtask posterior al render
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

      const alerta = root().querySelector('.view-state-host__validation');
      expect(document.activeElement).toBe(alerta);
    });

    it('informa la espera de un 429', async () => {
      await conEstado(validation([{ message: 'Demasiados intentos' }], 30));

      expect(textoVisible()).toContain('Reintentá en 30 segundos');
    });
  });

  describe('S5 · prohibido', () => {
    it('el 403 de identidad es una puerta: muestra la acción', async () => {
      await conEstado(
        forbidden({
          message: 'Tu identidad todavía no está verificada.',
          nextAction: { label: 'Verificar mi identidad', route: '/identity/me/verification' },
        }),
      );

      const accion = root().querySelector<HTMLAnchorElement>('a[app-link]');
      expect(accion?.getAttribute('href')).toBe('/identity/me/verification');
      expect(accion?.textContent?.trim()).toBe('Verificar mi identidad');
    });

    it('el 403 común es un muro: sin acción', async () => {
      await conEstado(forbidden());

      expect(root().querySelector('app-alert')).not.toBeNull();
      expect(root().querySelector('a[app-link]')).toBeNull();
    });
  });

  describe('S6 · no encontrado sin filtrar existencia', () => {
    it('es idéntico exista o no el recurso: mismo DOM', async () => {
      await conEstado(notFound());
      const inexistente = root().innerHTML;

      // el «existe pero está oculto» construye EXACTAMENTE el mismo estado
      await conEstado(loading());
      await conEstado(notFound());
      const oculto = root().innerHTML;

      expect(oculto).toBe(inexistente);
    });

    it('no es el mismo tratamiento que S5: no habla de permisos', async () => {
      await conEstado(notFound());

      expect(textoVisible()).not.toContain('acceso');
      expect(textoVisible()).not.toContain('permiso');
      expect(textoVisible()).toContain('No encontramos lo que buscás');
    });
  });

  describe('S7 · dato viejo', () => {
    it('muestra el contenido Y la antigüedad siempre visible', async () => {
      await conEstado(stale(['fila'], new Date(2026, 6, 31, 9, 30)));

      expect(root().querySelector('.contenido')).not.toBeNull();
      expect(textoVisible()).toContain('31/07/2026 09:30');
    });

    it('el botón actualizar emite refresh, no retry', async () => {
      await conEstado(stale(['fila'], new Date()));

      const boton = [...root().querySelectorAll('button')].find((candidato) =>
        candidato.textContent?.includes('Actualizar'),
      );
      boton?.click();
      await fixture.whenStable();

      expect(host.refreshes).toHaveLength(1);
      expect(host.retries).toHaveLength(0);
    });

    it('no roba el foco: el dato viejo no es un error que corregir', async () => {
      const focoAntes = document.activeElement;
      await conEstado(stale(['fila'], new Date()));

      expect(document.activeElement).toBe(focoAntes);
    });
  });

  describe('S8 · sin conexión', () => {
    it('ofrece reintentar y emite retry', async () => {
      await conEstado(offline());

      const boton = [...root().querySelectorAll('button')].find((candidato) =>
        candidato.textContent?.includes('Reintentar'),
      );
      expect(boton).toBeDefined();
      boton?.click();
      await fixture.whenStable();

      expect(host.retries).toHaveLength(1);
    });
  });

  describe('S9 · error inesperado', () => {
    it('el requestId está visible y es seleccionable', async () => {
      await conEstado(unexpectedError('req-7f3a-0042'));

      const codigo = root().querySelector('.view-state-host__request-id code');
      expect(codigo?.textContent?.trim()).toBe('req-7f3a-0042');
    });

    it('ofrece copiarlo', async () => {
      const escribir = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: escribir },
      });
      await conEstado(unexpectedError('req-7f3a-0042'));

      const boton = [...root().querySelectorAll('button')].find((candidato) =>
        candidato.textContent?.includes('Copiar código'),
      );
      boton?.click();
      await fixture.whenStable();

      expect(escribir).toHaveBeenCalledWith('req-7f3a-0042');
    });
  });

  describe('camino feliz', () => {
    it('ready proyecta el contenido sin envoltorios', async () => {
      await conEstado(ready(['fila']));

      expect(root().querySelector('.contenido')).not.toBeNull();
      expect(root().querySelector('app-alert')).toBeNull();
      expect(root().querySelector('app-empty-state')).toBeNull();
    });

    it('el contenido NO se muestra en los estados sin datos', async () => {
      for (const estado of [routeAuthPending(), loading(), offline()] as const) {
        await conEstado(estado);
        const contenido = root().querySelector('.contenido');
        // proyectado pero no adjunto: no está en el árbol visible
        expect(contenido).toBeNull();
      }
    });
  });
});
