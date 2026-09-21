import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { RowActions } from './row-actions';
import type { RowAction } from './row-actions.types';

const DOS: readonly RowAction[] = [
  { code: 'ver', label: 'Ver detalle', icon: 'note' },
  { code: 'editar', label: 'Editar', icon: 'edit' },
];

const CINCO: readonly RowAction[] = [
  { code: 'ver', label: 'Ver detalle', icon: 'note' },
  { code: 'aceptar', label: 'Aceptar' },
  { code: 'iniciar', label: 'Iniciar', disabled: true },
  { code: 'reprogramar', label: 'Reprogramar', icon: 'calendar' },
  { code: 'anular', label: 'Anular', icon: 'remove', destructive: true },
];

@Component({
  imports: [RowActions],
  template: `
    <app-row-actions
      [actions]="acciones()"
      [fila]="fila()"
      (actionSelected)="elegidos.push($event)"
    />
  `,
})
class HostComponent {
  readonly acciones = signal<readonly RowAction[]>(CINCO);
  readonly fila = signal('la solicitud de Ana Pérez');
  readonly elegidos: string[] = [];
}

describe('RowActions', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function disparador(): HTMLButtonElement {
    const element = root().querySelector('[data-testid="row-actions-trigger"]');
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error('el disparador no está en el DOM');
    }
    return element;
  }

  /** El panel se muda al `<body>`: buscarlo dentro del fixture no lo encuentra. */
  function items(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  }

  function botonesEnFila(): HTMLButtonElement[] {
    return [...root().querySelectorAll<HTMLButtonElement>('.row-actions__inline')];
  }

  async function abrir(): Promise<void> {
    disparador().click();
    await fixture.whenStable();
  }

  async function teclear(key: string): Promise<KeyboardEvent> {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    (document.activeElement ?? document.body).dispatchEvent(evento);
    await fixture.whenStable();
    return evento;
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

  /* ---- la forma sale de cuántas son ---------------------------------------- */

  it('con más de dos acciones muestra un solo disparador y ningún botón suelto', () => {
    expect(disparador()).toBeTruthy();
    expect(botonesEnFila()).toHaveLength(0);
  });

  it('con dos acciones las deja en la fila, con su texto, y no dibuja disparador', async () => {
    host.acciones.set(DOS);
    await fixture.whenStable();

    expect(root().querySelector('[data-testid="row-actions-trigger"]')).toBeNull();
    expect(botonesEnFila().map((b) => b.textContent?.trim())).toEqual([
      'Ver detalle',
      'Editar',
    ]);
  });

  it('ninguna acción queda sin su texto visible', async () => {
    await abrir();
    for (const item of items()) {
      expect(item.textContent?.trim()).not.toBe('');
    }
  });

  /* ---- el nombre accesible distingue la fila ------------------------------- */

  it('el disparador se anuncia con la fila a la que pertenece', () => {
    expect(disparador().getAttribute('aria-label')).toBe(
      'Acciones de la solicitud de Ana Pérez',
    );
  });

  it('sin fila, el disparador se anuncia con su texto visible', async () => {
    host.fila.set('');
    await fixture.whenStable();

    expect(disparador().getAttribute('aria-label')).toBe('Acciones');
  });

  it('en la fila, cada acción se anuncia con la fila a la que pertenece', async () => {
    host.acciones.set(DOS);
    host.fila.set('la sede Clínica Foianini');
    await fixture.whenStable();

    expect(botonesEnFila().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Ver detalle — la sede Clínica Foianini',
      'Editar — la sede Clínica Foianini',
    ]);
  });

  it('sin fila, la acción en la fila no lleva `aria-label` y vale su texto', async () => {
    host.acciones.set(DOS);
    host.fila.set('');
    await fixture.whenStable();

    for (const boton of botonesEnFila()) {
      expect(boton.getAttribute('aria-label')).toBeNull();
    }
  });

  /* ---- abre, lista, emite y cierra ----------------------------------------- */

  it('abre y lista las cinco acciones', async () => {
    await abrir();

    expect(disparador().getAttribute('aria-expanded')).toBe('true');
    expect(items()).toHaveLength(5);
  });

  it('emite el código de la acción elegida y cierra el panel', async () => {
    await abrir();
    const reprogramar = items().find((i) => i.dataset['action'] === 'reprogramar');
    reprogramar?.click();
    await fixture.whenStable();

    expect(host.elegidos).toEqual(['reprogramar']);
    expect(disparador().getAttribute('aria-expanded')).toBe('false');
  });

  it('una acción deshabilitada no emite nada', async () => {
    await abrir();
    const iniciar = items().find((i) => i.dataset['action'] === 'iniciar');

    expect(iniciar?.getAttribute('aria-disabled')).toBe('true');

    iniciar?.click();
    await fixture.whenStable();

    expect(host.elegidos).toEqual([]);
  });

  it('`Escape` cierra el panel y devuelve el foco al disparador', async () => {
    await abrir();
    await teclear('Escape');

    expect(disparador().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(disparador());
  });

  /* ---- la acción destructiva se distingue ---------------------------------- */

  it('marca como destructiva la que anula, y sólo esa', async () => {
    await abrir();
    const destructivas = items()
      .filter((i) => i.classList.contains('menu-item--destructive'))
      .map((i) => i.dataset['action']);

    expect(destructivas).toEqual(['anular']);
  });
});
