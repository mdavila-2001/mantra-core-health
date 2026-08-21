import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';

import { AlarmaDePedidos, SONIDO_STORAGE_KEY } from './alarma-de-pedidos';

/**
 * La alarma de la bandeja (FAR-I3): el sonido respeta el interruptor y su
 * persistencia, y el título sólo parpadea cuando la pestaña está oculta —
 * al volver, se restaura solo. El díng-dóng real se escucha en runtime; acá
 * se fija QUÉ dispara y QUÉ no.
 */
describe('AlarmaDePedidos', () => {
  let reproducir: ReturnType<typeof vi.spyOn>;

  function crear(): AlarmaDePedidos {
    TestBed.configureTestingModule({ providers: [AlarmaDePedidos] });
    return TestBed.inject(AlarmaDePedidos);
  }

  function ocultarPestana(oculta: boolean): void {
    Object.defineProperty(document, 'hidden', { value: oculta, configurable: true });
  }

  beforeEach(() => {
    localStorage.removeItem(SONIDO_STORAGE_KEY);
    // jsdom no implementa `play()`: se fija la llamada, no el audio real.
    reproducir = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    ocultarPestana(false);
    vi.restoreAllMocks();
  });

  it('nace con el sonido encendido: la alarma es la razón de ser de la bandeja', () => {
    const alarma = crear();
    expect(alarma.sonidoActivo()).toBe(true);

    alarma.notificar(1);
    expect(reproducir).toHaveBeenCalledTimes(1);
  });

  it('el interruptor apaga el díng-dóng y la preferencia sobrevive', () => {
    const alarma = crear();
    alarma.alternarSonido();
    expect(alarma.sonidoActivo()).toBe(false);
    expect(localStorage.getItem(SONIDO_STORAGE_KEY)).toBe('off');

    alarma.notificar(3);
    expect(reproducir).not.toHaveBeenCalled();
  });

  it('con la preferencia guardada en off, arranca apagada', () => {
    localStorage.setItem(SONIDO_STORAGE_KEY, 'off');
    expect(crear().sonidoActivo()).toBe(false);
  });

  it('con la pestaña oculta el título lleva el contador; descartar lo devuelve', () => {
    const alarma = crear();
    const titulo = TestBed.inject(Title);
    titulo.setTitle('AloVida - Pedidos de farmacia');
    ocultarPestana(true);

    alarma.notificar(2);
    expect(titulo.getTitle()).toBe('(2) Pedidos nuevos — AloVida');

    alarma.descartar();
    expect(titulo.getTitle()).toBe('AloVida - Pedidos de farmacia');
  });

  it('con la pestaña a la vista el título no se toca', () => {
    const alarma = crear();
    const titulo = TestBed.inject(Title);
    titulo.setTitle('AloVida - Pedidos de farmacia');

    alarma.notificar(2);
    expect(titulo.getTitle()).toBe('AloVida - Pedidos de farmacia');
  });

  it('volver a la pestaña restaura el título sin que nadie lo pida', () => {
    const alarma = crear();
    const titulo = TestBed.inject(Title);
    titulo.setTitle('AloVida - Pedidos de farmacia');
    ocultarPestana(true);
    alarma.notificar(5);

    ocultarPestana(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(titulo.getTitle()).toBe('AloVida - Pedidos de farmacia');
  });

  it('cero pedidos nuevos no disparan nada', () => {
    const alarma = crear();
    alarma.notificar(0);
    expect(reproducir).not.toHaveBeenCalled();
  });

  it('los pedidos que llegan de a uno se acumulan en el contador del título', () => {
    const alarma = crear();
    const titulo = TestBed.inject(Title);
    titulo.setTitle('AloVida - Pedidos de farmacia');
    ocultarPestana(true);

    // Por el canal de la demo cada pedido llega en su propio aviso: el
    // contador tiene que ser el acumulado sin ver, no el tamaño del lote.
    alarma.notificar(1);
    alarma.notificar(1);
    expect(titulo.getTitle()).toBe('(2) Pedidos nuevos — AloVida');

    alarma.descartar();
    alarma.notificar(1);
    expect(titulo.getTitle()).toBe('(1) Pedidos nuevos — AloVida');
  });

  it('el parpadeo alterna entre el aviso y el título original', () => {
    vi.useFakeTimers();
    try {
      const alarma = crear();
      const titulo = TestBed.inject(Title);
      titulo.setTitle('AloVida - Pedidos de farmacia');
      ocultarPestana(true);
      alarma.notificar(1);
      expect(titulo.getTitle()).toBe('(1) Pedidos nuevos — AloVida');

      // La cadencia del parpadeo (PARPADEO_MS de la alarma).
      vi.advanceTimersByTime(1500);
      expect(titulo.getTitle()).toBe('AloVida - Pedidos de farmacia');
      vi.advanceTimersByTime(1500);
      expect(titulo.getTitle()).toBe('(1) Pedidos nuevos — AloVida');
    } finally {
      vi.useRealTimers();
    }
  });
});
