import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ReferenceCombobox } from './reference-combobox';
import type { ReferenceOption } from './reference-combobox.types';

const MEDICOS: ReferenceOption[] = [
  { value: 'uuid-1', label: 'Ana Pérez', hint: 'MP 12345' },
  { value: 'uuid-2', label: 'Bruno Salas', hint: 'MP 22222' },
  { value: 'uuid-3', label: 'Carla Vera', disabled: true },
  { value: 'uuid-4', label: 'Diego Ruiz' },
];

@Component({
  imports: [ReferenceCombobox],
  template: `
    <app-reference-combobox
      [(value)]="value"
      [options]="options()"
      [loading]="loading()"
      [disabled]="disabled()"
      [selected]="selected()"
      [debounceMs]="0"
      [minQueryLength]="minQueryLength()"
      label="Médico tratante"
      (searched)="searches.push($event)"
      (selectionChange)="selections.push($event)"
    />
  `,
})
class Host {
  readonly value = signal<string | null>(null);
  readonly options = signal<readonly ReferenceOption[]>([]);
  readonly loading = signal(false);
  readonly disabled = signal(false);
  readonly selected = signal<ReferenceOption | null>(null);
  readonly minQueryLength = signal(1);
  readonly searches: string[] = [];
  readonly selections: (ReferenceOption | null)[] = [];
}

/** El mismo combobox con un glifo proyectado, como lo monta el alta. */
@Component({
  imports: [ReferenceCombobox],
  template: `
    <app-reference-combobox label="Ocupación" [options]="[]">
      <span slot="icon-start" data-testid="glifo">✳</span>
    </app-reference-combobox>
  `,
})
class HostConGlifo {}

describe('ReferenceCombobox', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  function input(): HTMLInputElement {
    const element = fixture.nativeElement.querySelector('input');
    if (!(element instanceof HTMLInputElement)) {
      throw new Error('el <input> del combobox no está en el DOM');
    }
    return element;
  }

  function listbox(): HTMLElement {
    const element = fixture.nativeElement.querySelector('[role="listbox"]');
    if (!(element instanceof HTMLElement)) {
      throw new Error('el listbox no está en el DOM');
    }
    return element;
  }

  function optionElements(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
  }

  /** Escribe en el campo como lo haría una persona y deja correr la espera. */
  async function type(text: string): Promise<void> {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    input().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('semántica ARIA', () => {
    it('declara el control como combobox de una lista', () => {
      expect(input().getAttribute('role')).toBe('combobox');
      expect(input().getAttribute('aria-autocomplete')).toBe('list');
      expect(input().getAttribute('aria-expanded')).toBe('false');
    });

    it('apunta a un listbox que existe de verdad', () => {
      // Un `aria-controls` que no resuelve deja al lector anunciando un control
      // que después no sabe describir.
      const controls = input().getAttribute('aria-controls');

      expect(controls).toBeTruthy();
      expect(fixture.nativeElement.querySelector(`#${controls}`)).toBe(listbox());
    });

    it('anuncia el despliegue', async () => {
      host.options.set(MEDICOS);
      await type('a');

      expect(input().getAttribute('aria-expanded')).toBe('true');
    });

    it('señala la opción activa con aria-activedescendant', async () => {
      host.options.set(MEDICOS);
      await type('a');
      press('ArrowDown');

      const activeId = input().getAttribute('aria-activedescendant');

      expect(activeId).toBe(optionElements()[0].id);
    });

    it('marca como seleccionada sólo la opción elegida', async () => {
      host.options.set(MEDICOS);
      await type('a');
      press('ArrowDown');
      press('Enter');
      host.options.set(MEDICOS);
      fixture.detectChanges();
      press('ArrowDown');

      const seleccionadas = optionElements()
        .filter((element) => element.getAttribute('aria-selected') === 'true')
        .map((element) => element.textContent?.trim());

      expect(seleccionadas).toHaveLength(1);
      expect(seleccionadas[0]).toContain('Ana Pérez');
    });

    it('marca las opciones deshabilitadas', async () => {
      host.options.set(MEDICOS);
      await type('a');

      expect(optionElements()[2].getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('búsqueda', () => {
    it('avisa que hay que buscar tras la espera', async () => {
      await type('pér');

      expect(host.searches).toEqual(['pér']);
    });

    it('no consulta por debajo del largo mínimo', async () => {
      host.minQueryLength.set(3);
      fixture.detectChanges();

      await type('pé');

      expect(host.searches).toEqual([]);
    });

    it('no consulta al hidratar una selección existente', async () => {
      // Abrir un formulario de edición no es buscar.
      host.selected.set(MEDICOS[0]);
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(host.searches).toEqual([]);
      expect(input().value).toBe('Ana Pérez');
    });

    it('no vuelve a consultar por el rótulo de lo que se acaba de elegir', async () => {
      host.options.set(MEDICOS);
      await type('a');
      press('ArrowDown');
      press('Enter');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(host.searches).toEqual(['a']);
    });

    it('muestra el vacío cuando la búsqueda no trae nada', async () => {
      host.options.set([]);
      await type('zzz');

      expect(fixture.nativeElement.textContent).toContain('Sin resultados');
    });

    it('no muestra el vacío mientras la consulta viaja', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await type('zzz');

      expect(fixture.nativeElement.textContent).not.toContain('Sin resultados');
    });

    it('anuncia cuántos resultados hay', async () => {
      host.options.set(MEDICOS);
      await type('a');

      const status = fixture.nativeElement.querySelector('[role="status"]');

      expect(status.textContent.trim()).toBe('4 resultados');
    });

    it('anuncia el singular sin pluralizar mal', async () => {
      host.options.set([MEDICOS[0]]);
      await type('a');

      const status = fixture.nativeElement.querySelector('[role="status"]');

      expect(status.textContent.trim()).toBe('1 resultado');
    });
  });

  describe('teclado', () => {
    beforeEach(async () => {
      host.options.set(MEDICOS);
      await type('a');
    });

    it('recorre hacia abajo saltando lo deshabilitado', () => {
      press('ArrowDown');
      press('ArrowDown');
      press('ArrowDown');

      // 0 → 1 → (2 deshabilitada) → 3
      expect(input().getAttribute('aria-activedescendant')).toBe(optionElements()[3].id);
    });

    it('da la vuelta al llegar al final', () => {
      press('End');
      press('ArrowDown');

      expect(input().getAttribute('aria-activedescendant')).toBe(optionElements()[0].id);
    });

    it('recorre hacia arriba desde el final', () => {
      press('ArrowUp');

      expect(input().getAttribute('aria-activedescendant')).toBe(optionElements()[3].id);
    });

    it('Home y End van a los extremos elegibles', () => {
      press('End');
      expect(input().getAttribute('aria-activedescendant')).toBe(optionElements()[3].id);

      press('Home');
      expect(input().getAttribute('aria-activedescendant')).toBe(optionElements()[0].id);
    });

    it('Enter elige la opción activa', () => {
      press('ArrowDown');
      press('Enter');

      expect(host.value()).toBe('uuid-1');
      expect(host.selections.at(-1)).toEqual(MEDICOS[0]);
      expect(input().value).toBe('Ana Pérez');
      expect(input().getAttribute('aria-expanded')).toBe('false');
    });

    it('Enter no se roba el evento cuando no hay opción activa', () => {
      // El formulario que lo envuelve tiene que poder enviarse con Enter.
      const event = press('Enter');

      expect(event.defaultPrevented).toBe(false);
    });

    it('Escape cierra sin elegir', () => {
      press('ArrowDown');
      press('Escape');

      expect(input().getAttribute('aria-expanded')).toBe('false');
      expect(host.value()).toBeNull();
    });

    it('Escape con la lista cerrada borra la selección', () => {
      press('ArrowDown');
      press('Enter');

      press('Escape');

      expect(host.value()).toBeNull();
      expect(input().value).toBe('');
      expect(host.selections.at(-1)).toBeNull();
    });

    it('Alt+ArrowDown despliega sin mover la posición activa', () => {
      press('Escape');
      press('ArrowDown', { altKey: true });

      expect(input().getAttribute('aria-expanded')).toBe('true');
      expect(input().getAttribute('aria-activedescendant')).toBeNull();
    });

    it('Alt+ArrowUp cierra', () => {
      press('ArrowUp', { altKey: true });

      expect(input().getAttribute('aria-expanded')).toBe('false');
    });

    it('Tab cierra y no se roba el evento', () => {
      const event = press('Tab');

      expect(event.defaultPrevented).toBe(false);
      expect(input().getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('nunca deja texto sin uuid', () => {
    it('restaura el rótulo elegido al cerrar sin elegir', async () => {
      host.options.set(MEDICOS);
      await type('a');
      press('ArrowDown');
      press('Enter');

      await type('Diego a medio escr');
      press('Escape');
      press('Escape');

      // Escape cerró y restauró; el segundo Escape ya no tenía panel que cerrar.
      expect(host.value()).toBeNull();
    });

    it('invalida la selección en cuanto se escribe otra cosa', async () => {
      host.options.set(MEDICOS);
      await type('a');
      press('ArrowDown');
      press('Enter');
      expect(host.value()).toBe('uuid-1');

      await type('Bru');

      expect(host.value()).toBeNull();
      expect(host.selections.at(-1)).toBeNull();
    });

    it('vacía el campo al perder el foco sin nada elegido', async () => {
      host.options.set(MEDICOS);
      await type('texto suelto');

      input().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      fixture.detectChanges();

      expect(input().value).toBe('');
      expect(host.value()).toBeNull();
    });
  });

  describe('elección con el puntero', () => {
    it('abre todas las opciones al hacer clic con consulta mínima cero', () => {
      host.options.set(MEDICOS);
      host.minQueryLength.set(0);
      fixture.detectChanges();

      input().click();
      fixture.detectChanges();

      expect(input().getAttribute('aria-expanded')).toBe('true');
      expect(optionElements()).toHaveLength(MEDICOS.length);
    });

    it('abre todas las opciones al recibir foco con consulta mínima cero', () => {
      host.options.set(MEDICOS);
      host.minQueryLength.set(0);
      fixture.detectChanges();

      input().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();

      expect(input().getAttribute('aria-expanded')).toBe('true');
      expect(optionElements()).toHaveLength(MEDICOS.length);
    });

    it('abre sin buscar y permite filtrar después del clic', async () => {
      host.options.set(MEDICOS);
      input().click();
      fixture.detectChanges();

      expect(input().getAttribute('aria-expanded')).toBe('true');
      expect(host.searches).toEqual([]);

      await type('ana');
      host.options.set([MEDICOS[0]]);
      fixture.detectChanges();

      expect(host.searches).toEqual(['ana']);
      expect(input().getAttribute('aria-expanded')).toBe('true');
      expect(optionElements()).toHaveLength(1);
      expect(optionElements()[0].textContent).toContain('Ana Pérez');
    });

    it('elige al pulsar la opción', async () => {
      host.options.set(MEDICOS);
      await type('a');

      optionElements()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(host.value()).toBe('uuid-2');
    });

    it('ignora la opción deshabilitada', async () => {
      host.options.set(MEDICOS);
      await type('a');

      optionElements()[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(host.value()).toBeNull();
    });

    it('no deja que el puntero robe el foco antes del clic', async () => {
      host.options.set(MEDICOS);
      await type('a');

      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      optionElements()[0].dispatchEvent(event);

      // Si el foco se fuera, `focusout` cerraría el panel antes del `click`.
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('deshabilitado', () => {
    it('no despliega ni responde al teclado', async () => {
      host.options.set(MEDICOS);
      host.disabled.set(true);
      fixture.detectChanges();

      press('ArrowDown');

      expect(input().getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('el glifo del campo', () => {
    /** Los hijos con etiqueta del marco del control, en orden. */
    function marcoDelControl(elemento: HTMLElement): string[] {
      const marco = elemento.querySelector('.input-wrapper');
      return [...(marco?.children ?? [])].map((hijo) =>
        [hijo.tagName.toLowerCase(), ...hijo.classList].join('.'),
      );
    }

    it('el glifo que le proyecten va DENTRO del control, antes del campo', () => {
      // Sin reconfigurar el módulo —ya hay un componente creado—: el host es
      // standalone y trae sus propias dependencias.
      const conGlifo = TestBed.createComponent(HostConGlifo);
      conGlifo.detectChanges();

      const html = conGlifo.nativeElement as HTMLElement;
      const glifo = html.querySelector('[data-testid="glifo"]');
      const campo = html.querySelector('input');

      expect(glifo).not.toBeNull();
      // Dentro del marco —comparte borde, foco y estado de error— y delante del
      // campo, que es donde el motor pone el suyo.
      expect(campo?.parentElement?.contains(glifo!)).toBe(true);
      expect(campo?.previousElementSibling).toBe(glifo);
    });

    it('sin glifo proyectado el control queda como estaba', () => {
      // La ranura es aditiva: sin nada que proyectar, el marco tiene los mismos
      // hijos que tenía —el campo y su cola— y ni un nodo más.
      expect(marcoDelControl(fixture.nativeElement as HTMLElement)).toEqual([
        'input.native-input',
        'span.reference-combobox__trailing',
      ]);
    });
  });
});
