import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ContentDialog } from './content-dialog';

@Component({
  imports: [ContentDialog],
  template: `
    <button type="button" data-testid="abrir" (click)="abierto.set(true)">Ver farmacias</button>
    @if (abierto()) {
      <app-content-dialog
        heading="Dónde conseguirlo"
        description="Lista y mapa de las farmacias que lo publican."
        (opened)="conLayout.set(true)"
        (closed)="cerrar()"
      >
        @if (conLayout()) {
          <p data-testid="contenido-diferido">El mapa se monta acá</p>
        }
      </app-content-dialog>
    }
  `,
})
class HostComponent {
  readonly abierto = signal(false);
  readonly conLayout = signal(false);

  cerrar(): void {
    this.abierto.set(false);
    this.conLayout.set(false);
  }
}

describe('ContentDialog', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botonDeApertura(): HTMLButtonElement {
    const element = root().querySelector('[data-testid="abrir"]');
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error('falta el botón que abre');
    }
    return element;
  }

  function dialogo(): HTMLDialogElement | null {
    const element = document.querySelector('[data-testid="content-dialog"]');
    return element instanceof HTMLDialogElement ? element : null;
  }

  async function abrir(): Promise<void> {
    botonDeApertura().focus();
    botonDeApertura().click();
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

  it('sin abrir no hay <dialog> en el documento', () => {
    expect(dialogo()).toBeNull();
  });

  it('al abrir muestra el <dialog> con su título como nombre accesible', async () => {
    await abrir();

    const modal = dialogo();
    expect(modal).not.toBeNull();
    const titulo = modal?.querySelector('[data-testid="content-dialog-title"]');
    expect(titulo?.textContent?.trim()).toBe('Dónde conseguirlo');
    expect(modal?.getAttribute('aria-labelledby')).toBe(titulo?.id);
  });

  it('el contenido diferido se monta DESPUÉS de abrir: Leaflet necesita layout (AC-06-11)', async () => {
    expect(host.conLayout()).toBe(false);

    await abrir();

    expect(host.conLayout()).toBe(true);
    expect(dialogo()?.querySelector('[data-testid="contenido-diferido"]')).not.toBeNull();
  });

  it('el foco inicial cae adentro: el primer control es el que cierra (AC-06-11)', async () => {
    await abrir();

    const cerrar = dialogo()?.querySelector('[data-testid="content-dialog-close"]');
    expect(cerrar?.hasAttribute('autofocus')).toBe(true);
  });

  it('el botón de cerrar cierra y devuelve el foco a quien lo abrió (AC-06-11)', async () => {
    await abrir();

    const cerrar = dialogo()?.querySelector('[data-testid="content-dialog-close"]');
    if (!(cerrar instanceof HTMLButtonElement)) {
      throw new Error('falta el botón de cerrar');
    }
    cerrar.click();
    await fixture.whenStable();

    expect(dialogo()).toBeNull();
    expect(document.activeElement).toBe(botonDeApertura());
  });

  it('Escape cierra: el navegador dispara `cancel` sobre el <dialog> (AC-06-11)', async () => {
    await abrir();

    dialogo()?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();

    expect(dialogo()).toBeNull();
  });

  it('el clic en el fondo cierra; el clic en el panel no', async () => {
    await abrir();

    const panel = dialogo()?.querySelector('.content-dialog__panel');
    panel?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(dialogo()).not.toBeNull();

    dialogo()?.click();
    await fixture.whenStable();
    expect(dialogo()).toBeNull();
  });

  it('mientras está abierto el fondo no se recorre, y al cerrar se devuelve', async () => {
    const antes = document.body.style.overflow;

    await abrir();
    expect(document.body.style.overflow).toBe('hidden');

    dialogo()?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();

    expect(document.body.style.overflow).toBe(antes);
  });
});

/* ═══ Lo que agregó la corrección del 10/09/2026 ══════════════════════════════
   El pie de acciones, los anchos de referencia y el cierre con cambios
   pendientes. Van en su propio anfitrión porque el de arriba fija el contrato
   anterior y no hay que tocarlo para probar el nuevo. */

@Component({
  imports: [ContentDialog],
  template: `
    <button type="button" data-testid="abrir" (click)="abierto.set(true)">Editar</button>
    @if (abierto()) {
      <app-content-dialog
        heading="Adjuntar archivos"
        size="lg"
        [dismissible]="sinCambios()"
        (dismissAttempt)="intentos.set(intentos() + 1)"
        (closed)="abierto.set(false)"
      >
        <p>El formulario</p>
        <button dialog-actions type="button" data-testid="guardar">Guardar</button>
      </app-content-dialog>
    }
  `,
})
class HostConPie {
  readonly abierto = signal(false);
  readonly sinCambios = signal(true);
  readonly intentos = signal(0);
}

describe('ContentDialog · pie, ancho y descarte', () => {
  let fixture: ComponentFixture<HostConPie>;
  let host: HostConPie;

  function dialogo(): HTMLDialogElement | null {
    const element = document.querySelector('[data-testid="content-dialog"]');
    return element instanceof HTMLDialogElement ? element : null;
  }

  async function abrir(): Promise<void> {
    const boton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="abrir"]',
    );
    boton?.focus();
    boton?.click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostConPie] }).compileComponents();
    fixture = TestBed.createComponent(HostConPie);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  /**
   * El pie va **fuera** del cuerpo con scroll: en un formulario largo, el botón
   * que guarda no puede estar al final del recorrido.
   */
  it('lo marcado con `dialog-actions` se proyecta al pie, no al cuerpo', async () => {
    await abrir();

    const pie = dialogo()?.querySelector('[data-testid="content-dialog-actions"]');
    expect(pie?.querySelector('[data-testid="guardar"]')).not.toBeNull();
    expect(
      dialogo()?.querySelector('.content-dialog__cuerpo [data-testid="guardar"]'),
    ).toBeNull();
  });

  it('el ancho de referencia viaja en el DOM, para que el CSS lo aplique', async () => {
    await abrir();

    expect(dialogo()?.dataset['size']).toBe('lg');
  });

  /**
   * Los tres gestos de cierre —el botón, `Escape` y el fondo— tienen que ir por
   * el mismo camino: si el botón cerrara de una mientras `Escape` pregunta, la
   * confirmación de descarte se esquivaría con el ratón.
   */
  it('con cambios pendientes los tres gestos avisan en vez de cerrar', async () => {
    await abrir();
    host.sinCambios.set(false);
    await fixture.whenStable();

    dialogo()?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(dialogo()).not.toBeNull();
    expect(host.intentos()).toBe(1);

    dialogo()?.click();
    await fixture.whenStable();
    expect(dialogo()).not.toBeNull();
    expect(host.intentos()).toBe(2);

    dialogo()
      ?.querySelector<HTMLButtonElement>('[data-testid="content-dialog-close"]')
      ?.click();
    await fixture.whenStable();
    expect(dialogo()).not.toBeNull();
    expect(host.intentos()).toBe(3);
  });

  it('sin cambios pendientes cierra de una: no hay nada que descartar', async () => {
    await abrir();

    dialogo()?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();

    expect(dialogo()).toBeNull();
    expect(host.intentos()).toBe(0);
  });
});
