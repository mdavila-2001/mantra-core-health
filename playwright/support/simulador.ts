import type { Page } from '@playwright/test';

/**
 * Entrar al **backend simulado** y esperar a que la pantalla se asiente.
 *
 * Las dos cosas que toda auditoría visual de la rama `mockup` necesita antes de
 * medir nada, en un solo lugar: las usan `corr-evidencia.spec.ts` (los cuatro
 * criterios de la regla del propietario) y `premium-visual.spec.ts` (las
 * compuertas de acabado). Vivían dentro del primero; dos copias de una espera se
 * separan en el primer arreglo que alguien haga en una sola, y la medición
 * empieza a depender de qué archivo corriste.
 *
 * La rama `mockup` declara `mockBackend: true` en los dos entornos: **no habla
 * con ninguna API**, un interceptor contesta todo (`src/app/core/mock/`). Por
 * eso acá no se usan los actores de `support/actores.ts` —que crean cuentas
 * contra la API viva y necesitan Docker— sino las cuentas del propio simulador:
 * cualquier contraseña no vacía entra y el identificador es el correo. Ver
 * `core/mock/handlers/auth.handlers.ts`.
 */

/**
 * Entra por la pantalla de ingreso, como una persona, contra el simulador.
 *
 * La doctora pertenece a **dos** organizaciones (Clínica Los Olivos y Hospital
 * San Lucas), así que el ingreso no termina en el panel: termina en
 * `/auth/organization`, eligiendo con cuál entra. Esperar «una ruta que no
 * empiece con /auth» sin resolver ese paso es esperar para siempre — y eso no
 * es un fallo del producto, es el producto pidiendo lo que necesita.
 */
export async function entrarAlSimulador(page: Page, usuario: string, base: string): Promise<void> {
  await page.goto(`${base}/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-identifier').fill(`${usuario}@alovida.mock`);
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();

  await page.waitForURL(
    (url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'),
    { timeout: 30_000 },
  );

  if (page.url().includes('/auth/organization')) {
    // La primera de la lista: cuál se elige no cambia lo que estas fotos miden.
    await page.getByRole('button').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  }
}

/**
 * Espera a que el contenido deje de moverse antes de medirlo.
 *
 * Un `waitForTimeout` fijo no alcanza: «Mi perfil» del médico pide cinco cosas
 * distintas y pinta la columna lateral antes que la ficha. Medido a los 900 ms
 * daba, a veces, **una sola tarjeta** —la del lateral— y la matriz reportaba
 * «27 % del ancho» sobre una pantalla que en realidad estaba bien. Una medición
 * que falla una de cada tres veces es peor que ninguna: enseña a ignorar el
 * rojo.
 *
 * Se espera a que el número de tarjetas y el alto de la página se repitan varias
 * veces seguidas y a que no quede ningún esqueleto. `networkidle` no sirve acá:
 * con HMR no llega nunca (`CLAUDE.md` §5).
 */
export async function esperarAQueSeAsiente(page: Page): Promise<void> {
  const huella = async (): Promise<string> =>
    page.evaluate(() => {
      const area = document.querySelector('.app-main__inner');
      const tarjetas = area ? area.querySelectorAll('app-card').length : -1;
      // Mientras haya un esqueleto o un spinner, lo que se ve todavía no es la
      // pantalla: medir ahí fue exactamente lo que dio «27 % del ancho» sobre
      // «Mi perfil», cuando lo único pintado era la columna lateral.
      const cargando = document.querySelectorAll('app-skeleton, app-spinner').length;
      return `${tarjetas}:${document.body.scrollHeight}:${cargando}`;
    });

  // **Tres** muestras iguales, no dos: entre dos peticiones que tardan parecido
  // hay una meseta de 250 ms en la que nada cambia y la pantalla sigue a medias.
  let anterior = await huella();
  let repeticiones = 0;
  for (let intento = 0; intento < 16; intento += 1) {
    await page.waitForTimeout(250);
    const ahora = await huella();
    repeticiones = ahora === anterior ? repeticiones + 1 : 0;
    anterior = ahora;

    const sinCargar = ahora.endsWith(':0');
    if (repeticiones >= 2 && sinCargar) return;
  }
}
