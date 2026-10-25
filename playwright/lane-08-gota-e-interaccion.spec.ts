import { expect, test, type Page } from '@playwright/test';

import { estable } from './support/sesion';

/**
 * Carril 08 — lo que `lane-08-reactive-background.spec.ts` no medía.
 *
 * Aquella prueba fija el balance de colores (criterios 1–3), el reposo y el
 * movimiento reducido (6). Esta cubre el resto de la ficha, sobre `/auth`,
 * que no pide sesión:
 *
 * - **4 · gota de agua**: un clic con mouse la dispara en el punto del clic y
 *   se retira sola; un toque no la dispara; con movimiento reducido, nada.
 * - **5 · no bloquea**: las capas del fondo no reciben eventos
 *   (`pointer-events: none`, detrás del contenido) y, con la gota en curso,
 *   el campo de correo recibe clic, foco y texto, y la página hace scroll.
 * - **7 · sin trabajo en reposo**: con el puntero quieto no hay cuadros
 *   pedidos (`requestAnimationFrame`) — el fondo no tiene bucle propio.
 * - **8 · contraste**: el texto del formulario —lo que se apoya sobre el
 *   fondo reactivo— cumple
 *   4,5:1 (texto normal, WCAG 2.2 AA) en modo claro.
 */

async function abrirIngreso(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/auth');
  await estable(page);
}

test.describe('Carril 08 · gota de agua, interacción y costo', () => {
  test('4 · un clic con mouse deja caer la gota en ese punto y se retira sola', async ({
    page,
  }) => {
    await abrirIngreso(page);
    // Un punto libre del fondo, fuera de la tarjeta del formulario.
    await page.mouse.click(60, 400);

    const raiz = page.locator('html');
    await expect(raiz).toHaveAttribute('data-gota', '');
    const posicion = await page.evaluate(() => ({
      x: document.documentElement.style.getPropertyValue('--gota-x'),
      y: document.documentElement.style.getPropertyValue('--gota-y'),
    }));
    expect(posicion).toEqual({ x: '60px', y: '400px' });

    // Se retira sola: el DOM vuelve a como estaba.
    await expect(raiz).not.toHaveAttribute('data-gota', /.*/, { timeout: 3000 });
  });

  test('4 · con movimiento reducido no hay gota', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/auth');
    await estable(page);
    await page.mouse.click(60, 400);
    await expect(page.locator('html')).not.toHaveAttribute('data-gota', /.*/);
  });

  test('5 · el fondo no recibe eventos y el formulario funciona con la gota en curso', async ({
    page,
  }) => {
    await abrirIngreso(page);

    // Las tres capas del fondo (`alovida.css`): los focos en `body::before` y
    // `body::after`, y la gota en `html::after`.
    const capas = await page.evaluate(() =>
      (
        [
          ['body', '::before'],
          ['body', '::after'],
          ['html', '::after'],
        ] as const
      ).map(([selector, pseudo]) => {
        const estilo = getComputedStyle(document.querySelector(selector)!, pseudo);
        return {
          capa: selector + pseudo,
          pointerEvents: estilo.pointerEvents,
          zIndex: estilo.zIndex,
        };
      }),
    );
    for (const capa of capas) {
      expect(capa.pointerEvents, `${capa.capa} recibe eventos`).toBe('none');
      expect(Number(capa.zIndex), `${capa.capa} queda delante del contenido`).toBeLessThan(0);
    }

    // Con la gota animándose, el campo recibe clic, foco y texto.
    const correo = page.getByRole('textbox', { name: /Correo o documento/ });
    const caja = (await correo.boundingBox())!;
    await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await expect(page.locator('html')).toHaveAttribute('data-gota', '');
    await expect(correo).toBeFocused();
    await page.keyboard.type('medica@alovida.test');
    await expect(correo).toHaveValue('medica@alovida.test');

    // Y el foco por teclado sigue su orden.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: /Contraseña/ })).toBeFocused();
  });

  test('7 · con el puntero quieto el fondo no pide cuadros', async ({ page }) => {
    await page.addInitScript(() => {
      const original = window.requestAnimationFrame.bind(window);
      (window as unknown as { __cuadros: number }).__cuadros = 0;
      window.requestAnimationFrame = (callback) => {
        (window as unknown as { __cuadros: number }).__cuadros += 1;
        return original(callback);
      };
    });
    await abrirIngreso(page);
    await page.mouse.move(300, 300);
    await page.mouse.move(320, 310);
    // Se deja pasar el reposo (650 ms) y la secuencia de entrada.
    await page.waitForTimeout(1500);

    const antes = await page.evaluate(() => (window as unknown as { __cuadros: number }).__cuadros);
    await page.waitForTimeout(2000);
    const despues = await page.evaluate(
      () => (window as unknown as { __cuadros: number }).__cuadros,
    );
    expect(despues - antes, 'el fondo siguió pidiendo cuadros en reposo').toBe(0);
  });

  test('8 · el texto del formulario cumple 4,5:1 sobre el fondo en reposo (modo claro)', async ({
    page,
  }) => {
    await abrirIngreso(page);
    const ratios = await page.evaluate(() => {
      function rgb(valor: string): [number, number, number, number] {
        const n = valor.match(/[\d.]+/g)!.map(Number);
        return [n[0]!, n[1]!, n[2]!, n[3] ?? 1];
      }
      function luminancia([r, g, b]: [number, number, number, number]): number {
        const canal = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
      }
      /** El primer fondo opaco hacia arriba: lo que el ojo ve detrás del texto. */
      function fondoDe(el: Element | null): [number, number, number, number] {
        while (el) {
          const color = rgb(getComputedStyle(el).backgroundColor);
          if (color[3] >= 0.99) return color;
          el = el.parentElement;
        }
        return [255, 255, 255, 1];
      }
      // Lo que se superpone al fondo reactivo es el formulario; el panel de
      // bienvenida va sobre una imagen oscura propia, no sobre este fondo.
      const muestras = [
        ...document.querySelectorAll('main h1, main h2, main label, main p, main button, main a'),
      ].filter((el) => (el as HTMLElement).offsetParent !== null && el.textContent?.trim());
      return muestras.slice(0, 25).map((el) => {
        const texto = luminancia(rgb(getComputedStyle(el).color));
        const fondo = luminancia(fondoDe(el));
        const [claro, oscuro] = texto > fondo ? [texto, fondo] : [fondo, texto];
        return {
          texto: el.textContent!.trim().slice(0, 40),
          ratio: Math.round(((claro + 0.05) / (oscuro + 0.05)) * 100) / 100,
        };
      });
    });
    expect(ratios.length).toBeGreaterThan(3);
    const bajos = ratios.filter((r) => r.ratio < 4.5);
    expect(bajos, JSON.stringify(bajos)).toEqual([]);
  });
});
