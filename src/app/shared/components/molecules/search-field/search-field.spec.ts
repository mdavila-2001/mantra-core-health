import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FormFieldComponent } from '../form-field/form-field';
import { SearchField } from './search-field';
import { SEARCH_DEBOUNCE_MS } from './search-field.types';

@Component({
  imports: [SearchField],
  template: `
    <app-search-field
      [(value)]="valor"
      [loading]="loading()"
      [disabled]="disabled()"
      label="Buscar paciente"
      (searched)="busquedas.push($event)"
    />
  `,
})
class HostComponent {
  readonly valor = signal('');
  readonly loading = signal(false);
  readonly disabled = signal(false);
  readonly busquedas: string[] = [];
}

/** Con campo externo: la molécula debe delegar y no duplicar el nombre. */
@Component({
  imports: [SearchField, FormFieldComponent],
  template: `
    <app-form-field label="Buscar en la agenda">
      <app-search-field [(value)]="valor" />
    </app-form-field>
  `,
})
class HostConCampo {
  readonly valor = signal('');
}

/**
 * Los relojes falsos se instalan **después** de crear el fixture y todo lo que
 * sigue usa `detectChanges()` síncrono: con `vi.useFakeTimers()` puesto antes,
 * `whenStable()` se queda esperando temporizadores que ya nadie va a correr.
 */
describe('SearchField', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function input(root: HTMLElement = fixture.nativeElement): HTMLInputElement {
    const element = root.querySelector('input');
    if (!(element instanceof HTMLInputElement)) {
      throw new Error('el <input> nativo no está en el DOM');
    }
    return element;
  }

  function botonLimpiar(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button[aria-label="Limpiar búsqueda"]');
  }

  /** Escribe como lo haría una persona: el evento nativo, no el signal. */
  function tipear(texto: string): void {
    const control = input();
    control.value = texto;
    control.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function teclear(key: string): KeyboardEvent {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    input().dispatchEvent(evento);
    fixture.detectChanges();
    return evento;
  }

  function esperar(ms: number): void {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('espera antes de buscar', () => {
    it('no avisa mientras la ventana no se cumple', () => {
      tipear('gonz');
      esperar(SEARCH_DEBOUNCE_MS - 1);

      expect(host.busquedas).toEqual([]);
    });

    it('avisa una sola vez cumplida la ventana', () => {
      tipear('gonz');
      esperar(SEARCH_DEBOUNCE_MS);

      expect(host.busquedas).toEqual(['gonz']);
    });

    it('tipear rápido agrupa: una búsqueda con el último valor, no cuatro', () => {
      for (const parcial of ['g', 'go', 'gon', 'gonz']) {
        tipear(parcial);
        esperar(SEARCH_DEBOUNCE_MS / 3);
      }
      esperar(SEARCH_DEBOUNCE_MS);

      expect(host.busquedas).toEqual(['gonz']);
    });

    it('un valor precargado no dispara ninguna búsqueda', () => {
      host.valor.set('cardiología');
      fixture.detectChanges();
      esperar(SEARCH_DEBOUNCE_MS * 2);

      // el efecto ya corrió con '' en la creación; este cambio SÍ es del usuario
      expect(host.busquedas).toEqual(['cardiología']);
    });
  });

  describe('teclado', () => {
    it('Enter avisa al instante, sin esperar la ventana', () => {
      tipear('gonz');
      teclear('Enter');

      expect(host.busquedas).toEqual(['gonz']);
    });

    it('Enter no deja una segunda búsqueda pendiente', () => {
      tipear('gonz');
      teclear('Enter');
      esperar(SEARCH_DEBOUNCE_MS * 2);

      expect(host.busquedas).toEqual(['gonz']);
    });

    it('Escape limpia el campo y avisa con el vacío', () => {
      tipear('gonz');
      esperar(SEARCH_DEBOUNCE_MS);

      const evento = teclear('Escape');

      expect(host.valor()).toBe('');
      expect(host.busquedas).toEqual(['gonz', '']);
      expect(evento.defaultPrevented).toBe(true);
    });

    it('Escape con el campo vacío no se roba el evento', () => {
      const evento = teclear('Escape');

      expect(evento.defaultPrevented).toBe(false);
    });
  });

  describe('botón de limpiar', () => {
    it('aparece solo cuando hay algo escrito', () => {
      expect(botonLimpiar()).toBeNull();

      tipear('gonz');
      expect(botonLimpiar()).not.toBeNull();
    });

    it('limpia y avisa al instante', () => {
      tipear('gonz');
      esperar(SEARCH_DEBOUNCE_MS);

      botonLimpiar()?.click();
      fixture.detectChanges();

      expect(host.valor()).toBe('');
      expect(host.busquedas).toEqual(['gonz', '']);
    });

    it('devuelve el foco al campo: si no, cae al body al desaparecer', () => {
      tipear('gonz');
      botonLimpiar()?.click();
      fixture.detectChanges();

      expect(document.activeElement).toBe(input());
    });

    it('deshabilitado no ofrece limpiar', () => {
      tipear('gonz');
      host.disabled.set(true);
      fixture.detectChanges();

      expect(botonLimpiar()).toBeNull();
    });
  });

  describe('carga', () => {
    it('muestra el spinner con nombre accesible', () => {
      host.loading.set(true);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('app-spinner');
      expect(spinner).not.toBeNull();
      expect(spinner.getAttribute('aria-label')).toBe('Buscando');
    });

    it('en reposo no hay spinner', () => {
      expect(fixture.nativeElement.querySelector('app-spinner')).toBeNull();
    });
  });

  describe('nombre accesible', () => {
    it('suelto se nombra solo: label invisible asociado al input', () => {
      const label = fixture.nativeElement.querySelector('label');

      expect(label.classList.contains('sr-only')).toBe(true);
      expect(label.textContent.trim()).toBe('Buscar paciente');
      expect(label.getAttribute('for')).toBe(input().id);
    });

    it('dentro de un app-form-field delega y no emite un segundo label', async () => {
      vi.useRealTimers();
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HostConCampo] }).compileComponents();

      const conCampo = TestBed.createComponent(HostConCampo);
      await conCampo.whenStable();

      const root = conCampo.nativeElement as HTMLElement;
      const labels = root.querySelectorAll('label');
      expect(labels).toHaveLength(1);
      expect(labels[0].textContent?.trim()).toBe('Buscar en la agenda');
      // el label del campo externo apunta al input real de la molécula
      expect(labels[0].getAttribute('for')).toBe(input(root).id);
      conCampo.destroy();
    });
  });
});
