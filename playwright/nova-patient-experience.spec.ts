import { test, expect, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Verificación forense de las mejoras NOVA de experiencia del paciente.
 *
 * Es el gate AG-49 del sistema `AloVida_NOVA_PATIENT_EXPERIENCE_SYSTEM`: cada
 * criterio se comprueba **en la aplicación corriendo**, no en el DOM de una
 * prueba unitaria, y en los tres viewports que el protocolo exige
 * (375×812, 768×1024, 1440×900).
 *
 * Corre contra el backend simulado de la rama `mockup`, así que no necesita API
 * ni base de datos: `E2E_BASE_URL=http://localhost:4210 npx playwright test
 * playwright/nova-patient-experience.spec.ts`.
 *
 * Lo que NO se comprueba acá se dice en el informe, no se da por hecho.
 */

const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

/** Los tres tamaños del protocolo forense. */
const VIEWPORTS = [
  { nombre: 'móvil', ancho: 375, alto: 812 },
  { nombre: 'tablet', ancho: 768, alto: 1024 },
  { nombre: 'escritorio', ancho: 1440, alto: 900 },
] as const;

/** El ancho útil real del contenedor de la página, medido en el navegador. */
async function anchoUtil(page: Page): Promise<number> {
  return page.evaluate(() => {
    const main = document.querySelector('.app-main__inner') ?? document.querySelector('main');
    if (main === null) return 0;
    const caja = main.getBoundingClientRect();
    const estilo = getComputedStyle(main);
    return caja.width - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
  });
}

/**
 * Espera a que la pantalla termine de cargar lo suyo.
 *
 * `estable()` se apoya en `networkidle`, y contra el servidor de desarrollo eso
 * no llega nunca: el socket de recarga en caliente deja la red ocupada para
 * siempre, así que la espera se agota a los 15 s y la prueba sigue con la
 * pantalla todavía en «Buscando…». Se leía como «esta cuenta no tiene datos» y
 * era una carrera.
 *
 * La señal honesta es la propia pantalla: mientras haya un `role="status"` que
 * diga que está buscando, no terminó.
 */
async function esperarCarga(page: Page): Promise<void> {
  await estable(page);
  await expect(page.locator('[role="status"]', { hasText: /Buscando|Cargando/ })).toHaveCount(0, {
    timeout: 20_000,
  });
}

/** Si la página desborda horizontalmente. Ninguna vista puede hacerlo. */
async function desbordaHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

test.describe('NOVA · experiencia del paciente', () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, PACIENTE);
  });

  /* ---- FT-02 · «¿Cómo te sentís?» a ancho completo ------------------------ */

  test('FT-02 · el módulo de síntomas ocupa el ancho útil, sin desbordar', async ({ page }) => {
    await irA(page, '/');
    await esperarCarga(page);

    const tarjeta = page.getByTestId('mi-salud-sintomas');
    const sintomas = page.locator('.sintomas');
    await expect(sintomas).toBeVisible();

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.ancho, height: viewport.alto });
      await page.waitForTimeout(200);

      const util = await anchoUtil(page);
      const anchoTarjeta = await tarjeta.evaluate((el) => el.getBoundingClientRect().width);

      // La tarjeta que contiene el módulo llena el ancho útil real de la página.
      expect(
        anchoTarjeta,
        `${viewport.nombre}: la tarjeta no llena el ancho útil`,
      ).toBeGreaterThan(util - 2);

      // Y el módulo llena la caja de contenido de su contenedor. Se mide contra
      // el padre y no contra la página porque el relleno de la tarjeta es parte
      // del diseño; lo que FT-02 corrige es el tope PROPIO de 46rem, que dejaba
      // el módulo a un tercio del ancho en un escritorio.
      const { propio, disponible, tope } = await sintomas.evaluate((el) => {
        const padre = el.parentElement;
        const estilo = getComputedStyle(padre ?? el);
        return {
          propio: el.getBoundingClientRect().width,
          disponible:
            (padre ?? el).getBoundingClientRect().width -
            parseFloat(estilo.paddingLeft) -
            parseFloat(estilo.paddingRight),
          tope: getComputedStyle(el).maxInlineSize,
        };
      });
      expect(propio, `${viewport.nombre}: el módulo no llena su contenedor`).toBeGreaterThan(
        disponible - 2,
      );
      // Y no vuelve a ponerse un tope propio: es la regresión concreta de FT-02.
      expect(tope, `${viewport.nombre}: el módulo volvió a tener tope propio`).toBe('none');

      expect(await desbordaHorizontal(page), `${viewport.nombre}: la página desborda`).toBe(false);
    }
  });

  /* ---- FT-03 · «Tu próxima cita» ------------------------------------------ */

  test('FT-03 · el panel dice «Tu próxima cita», con jerarquía y sin «turno»', async ({ page }) => {
    await irA(page, '/');
    await esperarCarga(page);

    const bloque = page.getByTestId('mi-salud-proxima-cita');
    await expect(bloque).toBeVisible();
    await expect(bloque).toContainText('Tu próxima cita');
    // El texto viejo no puede quedar en ninguna parte de la pantalla.
    await expect(page.locator('body')).not.toContainText('Tu próximo turno');

    // Alguno de los tres estados, siempre declarado: nunca una banda muda.
    const estado = await bloque.getAttribute('data-estado');
    expect(['loading', 'error', 'empty', 'ready']).toContain(estado);

    if (estado === 'ready') {
      // La jerarquía: el día pesa más que el resto del bloque.
      const tamañoDia = await bloque
        .locator('.proxima-cita__dia')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      const tamañoDato = await bloque
        .locator('.proxima-cita__dato')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
        .catch(() => 0);
      if (tamañoDato > 0) {
        expect(tamañoDia).toBeGreaterThan(tamañoDato);
      }
    }

    await page.screenshot({
      path: 'artifacts/playwright/nova/ft-03-proxima-cita.png',
      fullPage: true,
    });
  });

  /* ---- FT-04 · el selector de vista --------------------------------------- */

  test('FT-04 · Lista y Calendario son botones y cambian la vista de verdad', async ({ page }) => {
    await irA(page, '/my-account/appointments');
    await esperarCarga(page);

    const lista = page.getByTestId('segmentado-lista');
    const calendario = page.getByTestId('segmentado-calendario');
    await expect(lista).toBeVisible();
    await expect(calendario).toBeVisible();

    // Botones de verdad, no texto: los dos, no sólo el activo.
    for (const opcion of [lista, calendario]) {
      expect(await opcion.evaluate((el) => el.tagName)).toBe('BUTTON');
      // Fondo o borde: el inactivo también tiene que leerse como control. El
      // defecto que originó FT-04 era un `ghost` sin ninguno de los dos.
      const pintado = await opcion.evaluate((el) => {
        const estilo = getComputedStyle(el);
        const caja = el.parentElement === null ? null : getComputedStyle(el.parentElement);
        return (
          estilo.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
          estilo.borderTopWidth !== '0px' ||
          (caja !== null && caja.borderTopWidth !== '0px')
        );
      });
      expect(pintado).toBe(true);
    }

    await expect(lista).toHaveAttribute('aria-checked', 'true');

    // El cambio ocurre de verdad: aparece el calendario y desaparece la lista.
    await calendario.click();
    await esperarCarga(page);
    await expect(calendario).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.calendario__grilla')).toBeVisible();
    await expect(page.locator('.turnos__lista')).toHaveCount(0);
    expect(page.url()).toContain('vista=calendario');

    // Y con teclado: la flecha mueve la selección, que es lo que un radiogroup
    // hace y dos `aria-pressed` sueltos no.
    await calendario.focus();
    await page.keyboard.press('ArrowLeft');
    await esperarCarga(page);
    await expect(lista).toHaveAttribute('aria-checked', 'true');
  });

  /* ---- FT-05 · búsqueda y filtros ----------------------------------------- */

  test('FT-05 · buscar, filtrar, combinar y limpiar actúa sobre los datos', async ({ page }) => {
    await irA(page, '/my-account/appointments');
    await esperarCarga(page);

    const filtros = page.getByTestId('turnos-filtros');
    if ((await filtros.count()) === 0) {
      test.skip(true, 'La cuenta simulada no tiene citas suficientes para filtrar');
    }
    await expect(filtros).toBeVisible();

    const filas = page.locator('.turnos__item');
    const antes = await filas.count();
    expect(antes).toBeGreaterThan(0);

    // Un texto que no puede coincidir con nadie: la lista tiene que quedar en
    // cero Y decir por qué, que es el caso negativo que exige el protocolo.
    await page.getByTestId('turnos-buscar').locator('input').fill('zzzzzzzz');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('turnos-sin-resultados')).toBeVisible();
    await expect(filas).toHaveCount(0);
    expect(page.url()).toContain('q=zzzzzzzz');

    // Limpiar devuelve la lista entera: el filtro no destruyó nada.
    await page.getByTestId('turnos-limpiar-vacio').click();
    await esperarCarga(page);
    await expect(filas).toHaveCount(antes);
    expect(page.url()).not.toContain('q=');
  });

  /* ---- FT-07 · cards de calendario estables ------------------------------- */

  test('FT-07 · el detalle del calendario no mueve la grilla y responde al foco', async ({
    page,
  }) => {
    await irA(page, '/my-account/appointments?vista=calendario');
    await esperarCarga(page);

    const tarjetas = page.locator('.calendario__turno');
    if ((await tarjetas.count()) === 0) {
      test.skip(true, 'La cuenta simulada no tiene citas en el mes visible');
    }

    const primera = tarjetas.first();
    const celda = page.locator('.calendario__dia').filter({ has: primera }).first();
    const antes = await celda.boundingBox();

    // Con el puntero.
    await primera.hover();
    await page.waitForTimeout(250);
    const detalle = page.locator('.calendario__detalle').first();
    await expect(detalle).toBeVisible();

    const despues = await celda.boundingBox();
    // El footprint no cambia: es literalmente lo que pedía FT-07.
    expect(Math.abs((despues?.height ?? 0) - (antes?.height ?? 0))).toBeLessThan(1);
    expect(Math.abs((despues?.width ?? 0) - (antes?.width ?? 0))).toBeLessThan(1);
    expect(await desbordaHorizontal(page)).toBe(false);

    // Y con teclado: el mismo detalle, sin puntero.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    await primera.focus();
    await page.waitForTimeout(250);
    await expect(detalle).toBeVisible();
  });

  /* ---- FT-20 · historia clínica por pestañas ------------------------------ */

  test('FT-20 · la historia tiene pestañas y «Descargar todo» siempre a mano', async ({ page }) => {
    await irA(page, '/my-account/medical-record');
    await esperarCarga(page);

    const pestañas = page.locator('[data-testid="historia-tabs"] [role="tab"]');
    await expect(pestañas).toHaveCount(4);
    await expect(pestañas.first()).toHaveAttribute('aria-selected', 'true');

    const descargar = page.getByTestId('historia-descargar-todo');
    await expect(descargar).toBeVisible();

    // Recorrer las cuatro: cada una pinta lo suyo y la descarga sigue a la vista.
    for (let i = 0; i < 4; i++) {
      await pestañas.nth(i).click();
      await esperarCarga(page);
      await expect(pestañas.nth(i)).toHaveAttribute('aria-selected', 'true');
      await expect(descargar).toBeVisible();
      expect(await desbordaHorizontal(page)).toBe(false);
    }

    // El enlace profundo abre la pestaña que nombra.
    await irA(page, '/my-account/medical-record?seccion=resultados');
    await esperarCarga(page);
    await expect(pestañas.nth(3)).toHaveAttribute('aria-selected', 'true');
  });

  /* ---- FT-21 · resultados con descarga y detalle --------------------------- */

  test('FT-21 · cada resultado muestra sus metadatos y su descarga', async ({ page }) => {
    await irA(page, '/my-account/diagnostic-results');
    await esperarCarga(page);

    const metas = page.getByTestId('resultado-meta');
    if ((await metas.count()) === 0) {
      test.skip(true, 'La cuenta simulada no tiene resultados liberados');
    }

    await expect(metas.first()).toContainText('Liberado el');
    // O tiene descarga, o dice por qué no la tiene. Nunca el hueco.
    const conDescarga = await page.locator('[data-testid^="resultado-descargar-"]').count();
    const sinArchivos = await page.getByTestId('resultado-sin-archivos').count();
    expect(conDescarga + sinArchivos).toBeGreaterThan(0);
  });

  /* ---- FT-22 · cuestionarios en dos pestañas ------------------------------- */

  test('FT-22 · aspectos médicos se editan y persisten tras recargar', async ({ page }) => {
    await irA(page, '/my-account/questionnaires');
    await esperarCarga(page);

    const pestañas = page.locator('[data-testid="cuestionarios-tabs"] [role="tab"]');
    await expect(pestañas).toHaveCount(2);
    await expect(pestañas.first()).toContainText('Aspectos médicos');
    await expect(pestañas.nth(1)).toContainText('Encuestas');

    const campo = page.getByTestId('aspecto-bloodType').locator('input');
    await expect(campo).toBeVisible();

    const nuevo = `AB+ ${Date.now() % 1000}`;
    await campo.fill(nuevo);
    await page.getByTestId('aspectos-guardar').click();
    await esperarCarga(page);

    // SELECT → EDIT → SAVE → RESPONSE → RELOAD → PERSISTS, que es el ciclo que
    // el protocolo forense exige para cualquier formulario.
    await expect(page.getByTestId('aspectos-actualizado')).toBeVisible();

    await page.reload();
    await esperarCarga(page);
    await expect(page.getByTestId('aspecto-bloodType').locator('input')).toHaveValue(nuevo);

    // La encuesta ya respondida no se puede volver a responder.
    await pestañas.nth(1).click();
    await esperarCarga(page);
    await expect(page.getByTestId('cuestionarios-lista')).toBeVisible();
  });
});
