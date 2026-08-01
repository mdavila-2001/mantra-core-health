import { TestBed } from '@angular/core/testing';

import { ToastService } from './toast.service';
import { TOAST_DEFAULT_DURATION_MS, TOAST_MAX_VISIBLE } from './toast.types';

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
      service.info('con título', { title: 'Atención' });

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
    it('usa la duración por defecto cuando no se indica otra', () => {
      service.info('efímero');
      expect(service.toasts()).toHaveLength(1);

      vi.advanceTimersByTime(TOAST_DEFAULT_DURATION_MS);

      expect(service.toasts()).toEqual([]);
    });

    it('no se va antes de tiempo', () => {
      service.info('efímero');

      vi.advanceTimersByTime(TOAST_DEFAULT_DURATION_MS - 1);

      expect(service.toasts()).toHaveLength(1);
    });

    it('respeta una duración propia', () => {
      service.info('corto', { duration: 100 });

      vi.advanceTimersByTime(100);

      expect(service.toasts()).toEqual([]);
    });

    it('duration null lo deja fijo: no se va solo nunca', () => {
      service.error('fijo', { duration: null });

      vi.advanceTimersByTime(TOAST_DEFAULT_DURATION_MS * 10);

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
      vi.advanceTimersByTime(TOAST_DEFAULT_DURATION_MS - 1);

      expect(service.toasts().map((toast) => toast.message)).toEqual(['dos']);
    });

    it('clear vacía la cola entera, incluidos los fijos', () => {
      service.info('uno');
      service.error('fijo', { duration: null });

      service.clear();

      expect(service.toasts()).toEqual([]);
    });
  });

  describe('techo de la pila', () => {
    it(`nunca muestra más de ${TOAST_MAX_VISIBLE} avisos`, () => {
      for (let n = 0; n < TOAST_MAX_VISIBLE + 3; n += 1) {
        service.info(`aviso ${n}`);
      }

      expect(service.toasts()).toHaveLength(TOAST_MAX_VISIBLE);
    });

    it('descarta los más viejos y conserva los más recientes', () => {
      for (let n = 0; n < TOAST_MAX_VISIBLE + 1; n += 1) {
        service.info(`aviso ${n}`);
      }

      const mensajes = service.toasts().map((toast) => toast.message);
      expect(mensajes[0]).toBe('aviso 1');
      expect(mensajes.at(-1)).toBe(`aviso ${TOAST_MAX_VISIBLE}`);
    });

    it('el desborde también cancela el temporizador del descartado', () => {
      // El aviso 0 sale por desborde; su temporizador no debe seguir vivo y
      // llevarse por delante a un aviso posterior.
      for (let n = 0; n <= TOAST_MAX_VISIBLE; n += 1) {
        service.info(`aviso ${n}`);
      }

      vi.advanceTimersByTime(TOAST_DEFAULT_DURATION_MS);

      expect(service.toasts()).toEqual([]);
    });
  });
});
