import { TestBed } from '@angular/core/testing';

import { ToastService } from './toast.service';
import { TOAST_DEFAULT_DURATION_MS } from './toast.types';

/**
 * La duración por defecto depende del tono: `info` se cierra solo y `error`
 * queda fijo. Se lee del mapa en vez de escribir el número a mano para que
 * cambiarlo allá no obligue a tocar las pruebas.
 */
const INFO_MS = TOAST_DEFAULT_DURATION_MS.info as number;

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('encolado', () => {
    it('arranca vacío', () => {
      expect(service.toasts()).toEqual([]);
    });

    it('los atajos por tipo encolan con su tipo', () => {
      service.success('ok');
      service.warning('cuidado');
      service.error('falló');
      service.info('dato');

      expect(service.toasts().map((toast) => toast.type)).toEqual([
        'success',
        'warning',
        'error',
        'info',
      ]);
    });

    it('el aviso más nuevo va al final de la cola', () => {
      service.info('primero');
      service.info('segundo');

      expect(service.toasts().map((toast) => toast.message)).toEqual(['primero', 'segundo']);
    });

    it('el título solo aparece si se pide', () => {
      service.info('sin título');
      service.info('con título', 'Atención');

      const [sinTitulo, conTitulo] = service.toasts();
      expect(sinTitulo.title).toBeUndefined();
      expect(conTitulo.title).toBe('Atención');
    });

    it('cada aviso recibe un id distinto aunque el texto se repita', () => {
      service.info('mismo texto');
      service.info('mismo texto');

      const [primero, segundo] = service.toasts();
      expect(primero.id).not.toBe(segundo.id);
    });
  });

  describe('autocierre', () => {
    it('usa la duración por defecto de su tono cuando no se indica otra', () => {
      service.info('efímero');
      expect(service.toasts()).toHaveLength(1);

      vi.advanceTimersByTime(INFO_MS);

      expect(service.toasts()).toEqual([]);
    });

    it('no se va antes de tiempo', () => {
      service.info('efímero');

      vi.advanceTimersByTime(INFO_MS - 1);

      expect(service.toasts()).toHaveLength(1);
    });

    it('respeta una duración propia', () => {
      service.show({ type: 'info', message: 'corto', durationMs: 100 });

      vi.advanceTimersByTime(100);

      expect(service.toasts()).toEqual([]);
    });

    it('los errores quedan fijos: no se van solos nunca', () => {
      // `TOAST_DEFAULT_DURATION_MS.error` es `null` a propósito — un error que
      // se borra solo mientras la persona lee es un error que nadie leyó.
      service.error('fijo');

      vi.advanceTimersByTime(INFO_MS * 10);

      expect(service.toasts()).toHaveLength(1);
    });

    it('durationMs null deja fijo un aviso de cualquier tono', () => {
      service.show({ type: 'success', message: 'fijo', durationMs: null });

      vi.advanceTimersByTime(INFO_MS * 10);

      expect(service.toasts()).toHaveLength(1);
    });
  });

  describe('descarte', () => {
    it('cierra el aviso del id pedido y deja el resto', () => {
      const primero = service.info('uno');
      service.info('dos');

      service.dismiss(primero);

      expect(service.toasts().map((toast) => toast.message)).toEqual(['dos']);
    });

    it('descartar dos veces el mismo id no rompe ni afecta a los demás', () => {
      const id = service.info('uno');
      service.info('dos');

      service.dismiss(id);
      service.dismiss(id);

      expect(service.toasts()).toHaveLength(1);
    });

    it('cerrar a mano cancela el temporizador: no vuelve a disparar', () => {
      const id = service.info('uno');
      service.dismiss(id);
      service.info('dos');

      // Si el temporizador del primero siguiera vivo, al vencer buscaría un id
      // que ya no está — y no debe llevarse por delante al segundo.
      vi.advanceTimersByTime(INFO_MS - 1);

      expect(service.toasts().map((toast) => toast.message)).toEqual(['dos']);
    });

    it('clear vacía la cola entera, incluidos los fijos', () => {
      service.info('uno');
      service.error('fijo');

      service.clear();

      expect(service.toasts()).toEqual([]);
    });
  });
});
