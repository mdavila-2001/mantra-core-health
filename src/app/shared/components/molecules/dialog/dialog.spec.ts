import { ApplicationRef, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DialogService } from './dialog-service';
import type { DialogConfig } from './dialog.types';

const CONFIRMACION: DialogConfig = {
  title: 'Anular la orden',
  message: 'La orden queda anulada y el laboratorio deja de verla.',
};

describe('DialogService', () => {
  let service: DialogService;

  function dialogo(): HTMLDialogElement {
    const element = document.querySelector('dialog');
    if (!(element instanceof HTMLDialogElement)) {
      throw new Error('el <dialog> no está en el DOM');
    }
    return element;
  }

  function boton(texto: string): HTMLButtonElement {
    const encontrado = [...dialogo().querySelectorAll('button')].find(
      (candidato) => (candidato.textContent ?? '').trim() === texto,
    );
    if (encontrado === undefined) {
      throw new Error(`no hay botón «${texto}»`);
    }
    return encontrado;
  }

  /** El diálogo se monta en un render: hay que dejar que ocurra. */
  async function esperarRender(): Promise<void> {
    TestBed.inject(ApplicationRef).tick();
    await Promise.resolve();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DialogService);
  });

  afterEach(() => {
    document.querySelector('app-dialog')?.remove();
  });

  describe('resultado', () => {
    it('Confirmar resuelve true', async () => {
      const respuesta = service.confirm(CONFIRMACION);
      await esperarRender();

      boton('Confirmar').click();

      await expect(respuesta).resolves.toBe(true);
    });

    it('Cancelar resuelve false', async () => {
      const respuesta = service.confirm(CONFIRMACION);
      await esperarRender();

      boton('Cancelar').click();

      await expect(respuesta).resolves.toBe(false);
    });

    it('Escape resuelve false: cerrar nunca es confirmar', async () => {
      const respuesta = service.confirm(CONFIRMACION);
      await esperarRender();

      // el navegador dispara `cancel` al apretar Escape sobre un <dialog>
      dialogo().dispatchEvent(new Event('cancel', { cancelable: true }));

      await expect(respuesta).resolves.toBe(false);
    });

    it('el click en el fondo resuelve false', async () => {
      const respuesta = service.confirm(CONFIRMACION);
      await esperarRender();

      dialogo().click();

      await expect(respuesta).resolves.toBe(false);
    });

    it('con `dismissible: false` el fondo no cierra', async () => {
      let resuelto = false;
      const respuesta = service
        .confirm({ ...CONFIRMACION, dismissible: false })
        .then((valor) => {
          resuelto = true;
          return valor;
        });
      await esperarRender();

      dialogo().click();
      await Promise.resolve();
      expect(resuelto).toBe(false);

      boton('Cancelar').click();
      await expect(respuesta).resolves.toBe(false);
    });
  });

  describe('contenido y etiquetas', () => {
    it('muestra título y mensaje, y los usa como nombre y descripción', async () => {
      const respuesta = service.confirm(CONFIRMACION);
      await esperarRender();

      const titulo = dialogo().querySelector('.dialog__title');
      const mensaje = dialogo().querySelector('.dialog__message');

      expect(titulo?.textContent?.trim()).toBe('Anular la orden');
      expect(dialogo().getAttribute('aria-labelledby')).toBe(titulo?.id);
      expect(dialogo().getAttribute('aria-describedby')).toBe(mensaje?.id);

      boton('Cancelar').click();
      await respuesta;
    });

    it('las etiquetas de los botones se pueden cambiar', async () => {
      const respuesta = service.confirm({
        ...CONFIRMACION,
        confirmLabel: 'Anular',
        cancelLabel: 'Volver',
      });
      await esperarRender();

      expect(() => boton('Anular')).not.toThrow();
      boton('Volver').click();

      await expect(respuesta).resolves.toBe(false);
    });
  });

  describe('acción destructiva', () => {
    it('el botón de confirmar va en tono de peligro', async () => {
      const respuesta = service.confirm({ ...CONFIRMACION, destructive: true });
      await esperarRender();

      expect(boton('Confirmar').classList.contains('btn--danger')).toBe(true);

      boton('Cancelar').click();
      await respuesta;
    });

    it('NO pone el autofoco en confirmar: nadie da de baja por inercia', async () => {
      const respuesta = service.confirm({ ...CONFIRMACION, destructive: true });
      await esperarRender();

      expect(boton('Confirmar').hasAttribute('autofocus')).toBe(false);

      boton('Cancelar').click();
      await respuesta;
    });

    it('en una acción normal, confirmar sí toma el foco inicial', async () => {
      const respuesta = service.confirm(CONFIRMACION);
      await esperarRender();

      expect(boton('Confirmar').hasAttribute('autofocus')).toBe(true);

      boton('Cancelar').click();
      await respuesta;
    });
  });

  describe('limpieza y foco', () => {
    it('al cerrar no queda ningún nodo colgado del body', async () => {
      const respuesta = service.confirm(CONFIRMACION);
      await esperarRender();
      expect(document.querySelector('app-dialog')).not.toBeNull();

      boton('Cancelar').click();
      await respuesta;

      expect(document.querySelector('app-dialog')).toBeNull();
    });

    it('el foco vuelve al elemento que lo abrió', async () => {
      const disparador = document.createElement('button');
      document.body.appendChild(disparador);
      disparador.focus();

      const respuesta = service.confirm(CONFIRMACION);
      await esperarRender();
      boton('Cancelar').click();
      await respuesta;

      expect(document.activeElement).toBe(disparador);
      disparador.remove();
    });
  });

  describe('SSR', () => {
    it('en el servidor resuelve false y avisa en desarrollo', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
      });

      const servidor = TestBed.inject(DialogService);

      await expect(servidor.confirm(CONFIRMACION)).resolves.toBe(false);
      expect(document.querySelector('app-dialog')).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('en el servidor'));
      warn.mockRestore();
    });
  });
});
