import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { CORRECTION_LABEL, FormActions } from './form-actions';
import { DialogService } from '../../molecules/dialog/dialog-service';
import type { DialogConfig } from '../../molecules/dialog/dialog.types';

/** Diálogo falso: la confirmación se decide en la prueba, no en el navegador. */
class DialogServiceFalso {
  respuesta = true;
  readonly pedidos: DialogConfig[] = [];

  confirm(config: DialogConfig): Promise<boolean> {
    this.pedidos.push(config);
    return Promise.resolve(this.respuesta);
  }
}

@Component({
  imports: [FormActions],
  template: `
    <app-form-actions
      [submitLabel]="submitLabel()"
      [cancelLabel]="cancelLabel()"
      [pending]="pending()"
      [disabled]="disabled()"
      [destructive]="destructive()"
      [correctionOnly]="correctionOnly()"
      (submitted)="envios.push(1)"
      (cancelled)="cancelaciones.push(1)"
    />
  `,
})
class HostComponent {
  readonly submitLabel = signal('Guardar');
  readonly cancelLabel = signal('');
  readonly pending = signal(false);
  readonly disabled = signal(false);
  readonly destructive = signal(false);
  readonly correctionOnly = signal(false);
  readonly envios: number[] = [];
  readonly cancelaciones: number[] = [];
}

describe('FormActions', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let dialogs: DialogServiceFalso;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function primario(): HTMLButtonElement {
    const boton = root().querySelector<HTMLButtonElement>('button[type="submit"]');
    if (boton === null) {
      throw new Error('el botón primario no está en el DOM');
    }
    return boton;
  }

  beforeEach(async () => {
    dialogs = new DialogServiceFalso();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: DialogService, useValue: dialogs }],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('etiquetas', () => {
    it('por defecto dice «Guardar»', () => {
      expect(primario().textContent?.trim()).toBe('Guardar');
    });

    it('`correctionOnly` fuerza «Registrar corrección»', async () => {
      host.correctionOnly.set(true);
      await fixture.whenStable();

      expect(primario().textContent?.trim()).toBe(CORRECTION_LABEL);
    });

    it('`correctionOnly` gana sobre cualquier etiqueta que le pasen', async () => {
      host.correctionOnly.set(true);
      host.submitLabel.set('Editar');
      await fixture.whenStable();

      // «Editar» es exactamente lo que una entidad append-only no permite
      expect(primario().textContent?.trim()).toBe(CORRECTION_LABEL);
      expect(primario().textContent).not.toContain('Editar');
    });

    it('el botón de cancelar solo existe si tiene etiqueta', async () => {
      expect(root().querySelectorAll('button')).toHaveLength(1);

      host.cancelLabel.set('Volver');
      await fixture.whenStable();

      expect(root().querySelectorAll('button')).toHaveLength(2);
    });
  });

  describe('idempotencia de envío', () => {
    it('el doble click rápido emite UNA sola vez', async () => {
      primario().click();
      primario().click();
      await fixture.whenStable();

      expect(host.envios).toHaveLength(1);
    });

    it('con `pending` no emite ni una vez', async () => {
      host.pending.set(true);
      await fixture.whenStable();

      primario().click();
      await fixture.whenStable();

      expect(host.envios).toHaveLength(0);
    });

    it('con `pending` el primario queda deshabilitado y con spinner', async () => {
      host.pending.set(true);
      await fixture.whenStable();

      expect(primario().getAttribute('aria-disabled')).toBe('true');
      expect(primario().getAttribute('aria-busy')).toBe('true');
      expect(primario().querySelector('app-spinner')).not.toBeNull();
    });

    it('deshabilitado no emite', async () => {
      host.disabled.set(true);
      await fixture.whenStable();

      primario().click();
      await fixture.whenStable();

      expect(host.envios).toHaveLength(0);
    });

    it('sin trabajo declarado, se puede volver a enviar después', async () => {
      primario().click();
      await fixture.whenStable();
      primario().click();
      await fixture.whenStable();

      expect(host.envios).toHaveLength(2);
    });
  });

  describe('acción destructiva', () => {
    beforeEach(async () => {
      host.destructive.set(true);
      await fixture.whenStable();
    });

    it('pide confirmación antes de emitir', async () => {
      primario().click();
      await fixture.whenStable();

      expect(dialogs.pedidos).toHaveLength(1);
      expect(dialogs.pedidos[0].destructive).toBe(true);
      expect(host.envios).toHaveLength(1);
    });

    it('sin confirmación NO emite', async () => {
      dialogs.respuesta = false;

      primario().click();
      await fixture.whenStable();

      expect(dialogs.pedidos).toHaveLength(1);
      expect(host.envios).toHaveLength(0);
    });

    it('tras cancelar la confirmación, la barra vuelve a estar viva', async () => {
      dialogs.respuesta = false;
      primario().click();
      await fixture.whenStable();

      dialogs.respuesta = true;
      primario().click();
      await fixture.whenStable();

      expect(host.envios).toHaveLength(1);
    });

    it('el primario va en tono de peligro', () => {
      expect(primario().classList.contains('btn--danger')).toBe(true);
    });

    it('el diálogo usa la etiqueta de corrección cuando corresponde', async () => {
      host.correctionOnly.set(true);
      await fixture.whenStable();

      primario().click();
      await fixture.whenStable();

      expect(dialogs.pedidos[0].confirmLabel).toBe(CORRECTION_LABEL);
    });
  });

  describe('cancelar', () => {
    it('emite sin confirmación', async () => {
      host.cancelLabel.set('Volver');
      await fixture.whenStable();

      const cancelar = [...root().querySelectorAll('button')].find(
        (boton) => boton.textContent?.trim() === 'Volver',
      );
      cancelar?.click();
      await fixture.whenStable();

      expect(host.cancelaciones).toHaveLength(1);
      expect(dialogs.pedidos).toHaveLength(0);
    });
  });
});
