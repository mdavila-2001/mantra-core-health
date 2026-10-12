import { cerrarConSalida, fijarOrigenDelPanel, SALIDA_DEL_PANEL_MS } from './panel-motion';

/**
 * Lo que estas pruebas fijan.
 *
 * Lo importante no es la curva —eso es de la hoja de estilos— sino los dos
 * contratos que, si fallan, rompen un modal: (1) sin animación posible el cierre
 * es SÍNCRONO, y (2) con animación el cierre ocurre UNA sola vez.
 */

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
}

function conRect(elemento: HTMLElement, cuadro: DOMRect): HTMLElement {
  elemento.getBoundingClientRect = () => cuadro;
  return elemento;
}

function fijarReducedMotion(activo: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (consulta: string) => ({
      matches: consulta.includes('prefers-reduced-motion') && activo,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

describe('panel-motion', () => {
  describe('fijarOrigenDelPanel', () => {
    it('publica el centro del disparador relativo al marco', () => {
      const panel = document.createElement('div');
      const marco = conRect(document.createElement('div'), rect(100, 50, 400, 300));
      const disparador = conRect(document.createElement('button'), rect(150, 60, 100, 40));

      fijarOrigenDelPanel(panel, marco, disparador);

      expect(panel.style.getPropertyValue('--origen-x')).toBe('100px');
      expect(panel.style.getPropertyValue('--origen-y')).toBe('30px');
    });

    it('acota el origen al marco cuando el disparador queda fuera', () => {
      const panel = document.createElement('div');
      const marco = conRect(document.createElement('div'), rect(100, 100, 200, 200));
      const disparador = conRect(document.createElement('button'), rect(0, 0, 20, 20));

      fijarOrigenDelPanel(panel, marco, disparador);

      expect(panel.style.getPropertyValue('--origen-x')).toBe('0px');
      expect(panel.style.getPropertyValue('--origen-y')).toBe('0px');
    });

    it('no escribe nada sin layout (jsdom) ni sin disparador', () => {
      const panel = document.createElement('div');
      fijarOrigenDelPanel(panel, document.createElement('div'), document.createElement('button'));
      fijarOrigenDelPanel(panel, document.createElement('div'), null);
      expect(panel.style.getPropertyValue('--origen-x')).toBe('');
    });
  });

  describe('cerrarConSalida', () => {
    afterEach(() => {
      fijarReducedMotion(false);
      delete (Element.prototype as { animate?: unknown }).animate;
    });

    it('cierra en el acto cuando no hay Web Animations API', () => {
      const cerrar = vi.fn();
      cerrarConSalida(document.createElement('div'), cerrar);
      expect(cerrar).toHaveBeenCalledTimes(1);
    });

    it('cierra en el acto con prefers-reduced-motion', () => {
      fijarReducedMotion(true);
      const panel = document.createElement('div');
      panel.animate = vi.fn() as unknown as typeof panel.animate;
      const cerrar = vi.fn();

      cerrarConSalida(panel, cerrar);

      expect(cerrar).toHaveBeenCalledTimes(1);
      expect(panel.animate).not.toHaveBeenCalled();
    });

    it('espera la salida y cierra una sola vez aunque se pida dos veces', async () => {
      fijarReducedMotion(false);
      const panel = document.createElement('div');
      const cancelar = vi.fn();
      const pedidos: KeyframeAnimationOptions[] = [];
      panel.animate = ((_k: unknown, opciones: KeyframeAnimationOptions) => {
        pedidos.push(opciones);
        return { finished: Promise.resolve(), cancel: cancelar };
      }) as unknown as typeof panel.animate;
      const cerrar = vi.fn();

      cerrarConSalida(panel, cerrar);
      cerrarConSalida(panel, cerrar);
      expect(cerrar).not.toHaveBeenCalled();

      await Promise.resolve();
      await Promise.resolve();

      expect(cerrar).toHaveBeenCalledTimes(1);
      expect(cancelar).toHaveBeenCalledTimes(1);
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0].duration).toBe(SALIDA_DEL_PANEL_MS);
    });
  });
});
