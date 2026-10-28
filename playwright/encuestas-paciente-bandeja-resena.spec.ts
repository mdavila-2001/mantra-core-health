import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * F5 + F7 · la bandeja de encuestas del paciente (barra superior) y el puente
 * encuesta → reseña pública, de punta a punta, contra el simulador.
 *
 * ## Qué recorre
 *
 * 1. Una paciente **sin ninguna atención terminada** no ve el ícono «Mis
 *    encuestas».
 * 2. La paciente **con** una invitación lo ve, con el contador de pendientes.
 * 3. Lo abre: cae en «Mis cuestionarios › Encuestas» y el ícono queda marcado.
 * 4. Responde la encuesta de consulta: las obligatorias **bloquean** el envío si
 *    faltan; el comentario es opcional.
 * 5. Aparece «¿Quiere compartir una reseña pública?»; deja la reseña **anónima**.
 * 6. Recarga: la encuesta sigue respondida, el contador se apagó y la reseña
 *    no se puede dejar dos veces.
 * 7. La reseña aparece en la ficha pública de la doctora, con el promedio
 *    corrido, firmada como «Paciente verificado».
 * 8. «Ahora no» → la acción «Dejar reseña pública» sigue en la lista.
 *
 * ## Por qué no se miran peticiones de red
 *
 * El simulador **no habla por la red**: un interceptor de Angular contesta cada
 * petición dentro de la página (`mockBackend: true`, `src/app/core/mock/`), así
 * que Playwright no ve ningún XHR. La cadena
 * `UI → request → response → persistencia → recarga → UI` se demuestra con lo
 * que sí es observable: la «base de datos» del simulador, que persiste en
 * `sessionStorage` (`Coleccion.persistirEn`). Lo que la petición lleva
 * (cuerpo exacto de la reseña, sin nada de la encuesta) lo fijan las pruebas
 * unitarias de `answer.spec.ts`, `rate-encounter-dialog.spec.ts` y
 * `community.client.spec.ts`; acá se comprueba lo que quedó **guardado**.
 *
 * ## Dependencia del simulador
 *
 * La invitación PENDING de la paciente tiene que colgar de una reserva
 * completada con encuentro terminado (ver `core/mock/fixtures/atencion-resenable.ts`
 * y `surveys-forms.handlers.ts`); si cuelga de una futura, `reviewable-care`
 * responde 404 y el paso de la reseña no aparece.
 *
 * ## Cómo se corre
 *
 *   E2E_BASE_URL=http://localhost:4202 yarn playwright test \
 *     playwright/encuestas-paciente-bandeja-resena.spec.ts
 *
 * contra `ng serve --configuration development,demo --port 4202`. Nunca
 * `networkidle`: con HMR no llega (`CLAUDE.md` §5).
 */

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

const EVIDENCIA = join('docs', 'frontend', 'evidence', 'encuestas-paciente-bandeja-resena-2026-10-28');

/** La médica de la demostración: la ficha donde se publica la reseña. */
const FICHA_DE_LA_MEDICA = '/p/valeria-rojas';

/** El simulador guarda sus tablas en `sessionStorage` con estas claves. */
const TABLA_DE_RESENAS = 'mock.comunidad.resenas';
const TABLA_DE_INVITACIONES = 'mock.surveys-forms.invitaciones';

/** La clave con la que la aplicación recuerda el tema (`ThemeService`). */
const CLAVE_DE_TEMA = 'mantra-core-health.theme';

/** La segunda paciente del padrón: entra con su documento y no tiene ninguna encuesta. */
const PACIENTE_SIN_ENCUESTAS = '5009871';

const VARIANTES = [
  { tema: 'claro', ancho: 1440, alto: 900 },
  { tema: 'oscuro', ancho: 1440, alto: 900 },
  { tema: 'claro', ancho: 390, alto: 844 },
  { tema: 'oscuro', ancho: 390, alto: 844 },
] as const;

type Variante = (typeof VARIANTES)[number];

/* ---- ayudas -------------------------------------------------------------- */

/** Prepara el tema antes de que la aplicación arranque y vigila errores de la página. */
async function prepararPagina(page: Page, tema: Variante['tema']): Promise<string[]> {
  await page.addInitScript(
    ([clave, valor]) => {
      try {
        window.localStorage.setItem(clave as string, valor as string);
      } catch {
        // Sin almacenamiento el tema queda en el claro, que también es válido.
      }
    },
    [CLAVE_DE_TEMA, tema === 'oscuro' ? 'dark' : 'light'],
  );
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(`pageerror: ${error.message}`));
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(`console: ${mensaje.text()}`);
  });
  return errores;
}

/** Entra por la pantalla de ingreso con el correo o el documento. El simulador acepta cualquier clave. */
async function entrarComo(page: Page, identificador: string): Promise<void> {
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-identifier').fill(identificador);
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(
    (url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'),
    { timeout: 30_000 },
  );
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  }
  // La cabecera es lo último que se arma: con «Chats» ya está el armazón entero.
  await expect(page.getByTestId('header-chats')).toBeAttached({ timeout: 30_000 });
}

/** En el teléfono los accesos rápidos viven detrás de «Más accesos». */
async function abrirMasAccesosSiHaceFalta(page: Page): Promise<void> {
  const boton = page.getByTestId('header-mas');
  if (await boton.isVisible()) {
    if ((await boton.getAttribute('aria-expanded')) !== 'true') await boton.click();
  }
}

async function foto(
  page: Page,
  paso: string,
  variante: Variante,
  opciones: { conMenu?: boolean } = {},
): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  // Un instante para que terminen las transiciones; no es una espera de red.
  await page.waitForTimeout(350);
  // En el teléfono el menú se cierra solo con cada cambio de ruta: para que la
  // foto lo muestre se vuelve a abrir justo antes de sacarla.
  if (opciones.conMenu === true && variante.ancho < 640) {
    await abrirMasAccesosSiHaceFalta(page);
    await expect(page.getByTestId('header-mas')).toHaveAttribute('aria-expanded', 'true');
  }
  await page.screenshot({
    path: join(EVIDENCIA, `${paso}-${variante.tema}-${variante.ancho}.png`),
  });
}

/**
 * Lo que el simulador tiene guardado en una de sus tablas.
 *
 * Una tabla sólo se escribe en `sessionStorage` cuando alguien la **modifica**:
 * antes de la primera escritura no hay nada que leer (devuelve `[]`), y desde
 * ahí viene entera. Por eso se lee después de actuar, nunca para el «antes».
 */
async function leerTabla(page: Page, clave: string): Promise<Record<string, unknown>[]> {
  return page.evaluate((k) => {
    const crudo = window.sessionStorage.getItem(k);
    if (crudo === null) return [];
    return (JSON.parse(crudo) as { filas?: Record<string, unknown>[] }).filas ?? [];
  }, clave);
}

/** Sin desbordes horizontales: lo primero que se rompe en un teléfono. */
async function sinDesbordeHorizontal(page: Page): Promise<void> {
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(desborda, 'la página no debe desbordar en horizontal').toBe(false);
}

/**
 * Responde todas las preguntas que no son de texto con la mejor opción y deja
 * el comentario para quien lo llame. Recorre el formulario por lo que dibuja —
 * no por preguntas escritas a mano— porque la encuesta la arma el sistema.
 */
async function responderLasObligatorias(page: Page): Promise<void> {
  await expect(page.getByTestId('responder-form')).toBeVisible();
  const tarjetas = page.locator('app-survey-form app-card');
  await expect(tarjetas.first()).toBeVisible();
  const total = await tarjetas.count();
  expect(total, 'la encuesta tiene preguntas').toBeGreaterThan(0);

  for (let i = 0; i < total; i += 1) {
    const tarjeta = tarjetas.nth(i);
    const radios = tarjeta.locator('app-radio');
    if ((await radios.count()) > 0) {
      // Escala: el último punto (el mejor). Sí/No: «Sí», que es el primero.
      const esSiNo = (await tarjeta.getByText('Sí', { exact: true }).count()) > 0;
      // Se pulsa la etiqueta: el anfitrión `app-radio` es más ancho que ella.
      await (esSiNo ? radios.first() : radios.last()).locator('label').click();
      continue;
    }
    const casillas = tarjeta.locator('app-checkbox');
    if ((await casillas.count()) > 0) {
      await casillas.first().locator('label').click();
      continue;
    }
    const desplegable = tarjeta.locator('button[role="combobox"]');
    if ((await desplegable.count()) > 0) {
      await desplegable.click();
      await page.locator('dialog.select-dialog [role="option"]').first().click();
    }
  }
}

/* ---- las pruebas --------------------------------------------------------- */

test.describe('Bandeja de encuestas del paciente y puente a la reseña pública', () => {
  test('una paciente SIN ninguna atención terminada no ve el ícono «Mis encuestas»', async ({ page }) => {
    const variante = VARIANTES[0];
    await page.setViewportSize({ width: variante.ancho, height: variante.alto });
    const errores = await prepararPagina(page, variante.tema);

    await entrarComo(page, PACIENTE_SIN_ENCUESTAS);
    // Sus atajos de siempre sí están: es la bandeja la que no se ofrece.
    await expect(page.getByTestId('header-chats')).toBeVisible();
    await expect(page.getByTestId('header-gastos')).toBeVisible();
    await expect(page.getByTestId('header-encuestas')).toHaveCount(0);
    await foto(page, '01-sin-atencion-cabecera-sin-icono', variante);

    // Y en el teléfono tampoco aparece dentro de «Más accesos».
    await page.setViewportSize({ width: 390, height: 844 });
    await abrirMasAccesosSiHaceFalta(page);
    await expect(page.getByTestId('header-encuestas')).toHaveCount(0);
    await foto(page, '01-sin-atencion-mas-accesos-sin-icono', { tema: 'claro', ancho: 390, alto: 844 }, { conMenu: true });

    expect(errores.filter((e) => !/\[API\]/.test(e))).toEqual([]);
  });

  for (const variante of VARIANTES) {
    test(`recorrido completo · ${variante.tema} · ${variante.ancho} px`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: variante.ancho, height: variante.alto });
      const errores = await prepararPagina(page, variante.tema);

      // ---- Antes: cómo está la ficha pública de la doctora ------------------
      await page.goto(`${BASE}${FICHA_DE_LA_MEDICA}`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('perfil-tab-reviews').click();
      const resumenAntes = (await page.getByTestId('opiniones-resumen').innerText()).replace(/\s+/g, ' ');
      const totalAntes = Number(/(\d+)\s+opini/.exec(resumenAntes)?.[1]);
      const promedioAntes = Number(/(\d+,\d)/.exec(resumenAntes)?.[1]?.replace(',', '.'));
      expect(totalAntes).toBeGreaterThan(0);
      expect(promedioAntes).toBeGreaterThan(0);

      // ---- 1. La paciente CON invitación ve el ícono, con el contador --------
      await entrarComo(page, 'paciente@alovida.mock');
      await abrirMasAccesosSiHaceFalta(page);
      const icono = page.getByTestId('header-encuestas');
      await expect(icono).toBeVisible();
      await expect(icono).toHaveAttribute('aria-label', 'Mis encuestas, 1 pendiente');
      await expect(page.getByTestId('header-encuestas-badge')).toHaveText('1');
      await expect(icono).toHaveAttribute('href', '/my-account/questionnaires?seccion=encuestas');
      await foto(page, '02-cabecera-con-contador', variante, { conMenu: true });

      // ---- 2. Abre la bandeja ------------------------------------------------
      await icono.click();
      await expect(page).toHaveURL(/\/my-account\/questionnaires\?seccion=encuestas/);
      await expect(page.getByTestId('cuestionarios-lista')).toBeVisible();
      await expect(page.getByTestId('cuestionarios-pendientes')).toContainText('1 cuestionario pendiente');
      await abrirMasAccesosSiHaceFalta(page);
      await expect(page.getByTestId('header-encuestas')).toHaveClass(/is-activo/);
      await expect(page.getByTestId('header-encuestas')).toHaveAttribute('aria-current', 'page');
      await foto(page, '03-bandeja-de-encuestas', variante, { conMenu: true });
      await sinDesbordeHorizontal(page);

      // La única pendiente de la lista: su botón «Responder» lleva el id.
      const responder = page.locator('[data-testid^="responder-"]');
      await expect(responder).toHaveCount(1);
      const invitacionId = (await responder.getAttribute('data-testid'))!.replace('responder-', '');

      // ---- 3. Responde: las obligatorias bloquean el envío -------------------
      await responder.click();
      await expect(page.getByTestId('responder-form')).toBeVisible();
      await page.getByTestId('responder-enviar').click();
      await expect(page.getByTestId('responder-faltantes')).toContainText(/Falta(n)? responder .*obligatoria/);
      // Nada se guardó: el simulador no escribió ninguna tabla.
      expect(await leerTabla(page, TABLA_DE_INVITACIONES)).toEqual([]);
      await page.getByTestId('responder-faltantes').scrollIntoViewIfNeeded();
      await foto(page, '04-obligatorias-bloquean-el-envio', variante);

      await responderLasObligatorias(page);
      // El comentario es opcional, pero se escribe para que viaje.
      await page.locator('app-survey-form textarea').last().fill('La doctora explicó todo con calma.');
      await expect(page.getByTestId('responder-faltantes')).toHaveCount(0);
      await foto(page, '05-encuesta-respondida', variante);
      await page.getByTestId('responder-enviar').click();

      // ---- 4. El paso de la reseña pública ----------------------------------
      const oferta = page.getByTestId('responder-resena');
      await expect(oferta).toBeVisible({ timeout: 15_000 });
      await expect(oferta).toContainText('¿Quiere compartir una reseña pública?');
      await expect(oferta).toContainText('Su encuesta es privada y sólo la ve su médico. Una reseña es pública.');
      await expect(oferta).toContainText('Valeria Rojas Mendoza');
      await expect(page.getByTestId('responder-resena-ahora-no')).toBeVisible();
      await expect(page.getByTestId('responder-form')).toHaveCount(0);
      await foto(page, '06-quiere-compartir-una-resena', variante);
      await sinDesbordeHorizontal(page);

      // La encuesta quedó guardada ANTES de ofrecer nada más: la reseña es otra escritura.
      const respondidas = (await leerTabla(page, TABLA_DE_INVITACIONES)).filter(
        (i) => i['id'] === invitacionId && i['status'] === 'ANSWERED',
      );
      expect(respondidas).toHaveLength(1);
      expect(respondidas[0]!['answeredAt']).toBeTruthy();
      // Todavía no hay ninguna reseña nacida de un encuentro: sólo las sembradas.
      expect((await leerTabla(page, TABLA_DE_RESENAS)).filter((r) => r['encounterId'])).toEqual([]);

      // ---- 5. Deja la reseña, ANÓNIMA por omisión ----------------------------
      await page.getByTestId('responder-resena-dejar').click();
      const dialogo = page.locator('app-rate-encounter-dialog');
      // El anfitrión no tiene caja propia (el diálogo es un `<dialog>` modal): se mira su contenido.
      await expect(dialogo.getByTestId('calificar-enviar')).toBeVisible();
      // Atención prefijada: no hay selector de atenciones.
      await expect(dialogo.getByTestId('calificar-atencion')).toHaveCount(0);
      await expect(dialogo.getByTestId('calificar-aviso-privacidad')).toContainText(
        'Su encuesta es privada y sólo la ve su médico. Una reseña es pública.',
      );
      await expect(dialogo.getByTestId('calificar-anonimo').locator('input')).toBeChecked();
      await dialogo.getByText('4 · Buena').click();
      await dialogo.locator('textarea').fill('Muy buena atención, gracias.');
      await foto(page, '07-dialogo-de-la-resena-anonima', variante);
      await dialogo.getByTestId('calificar-enviar').click();

      // Vuelve a la bandeja, con la encuesta ya respondida.
      await expect(page).toHaveURL(/\/my-account\/questionnaires/);
      await expect(page.locator('app-rate-encounter-dialog')).toHaveCount(0);

      // ---- 6. Persistencia: lo guardado, y después de recargar ---------------
      const resenasDespues = await leerTabla(page, TABLA_DE_RESENAS);
      const nacidas = resenasDespues.filter((r) => r['encounterId']);
      expect(nacidas).toHaveLength(1);
      const nueva = nacidas[0]!;
      const sembrada = resenasDespues.find((r) => !r['encounterId'])!;
      expect(nueva['overallRating']).toBe(4);
      expect(nueva['reviewText']).toBe('Muy buena atención, gracias.');
      expect(nueva['encounterId']).toBeTruthy();
      // Anónima: su modo es distinto al de las sembradas, que firman con nombre.
      expect(nueva['reviewerDisplayModeConceptId']).not.toBe(sembrada['reviewerDisplayModeConceptId']);
      // Dos escrituras, dos tablas: nada de la encuesta quedó en la reseña.
      expect(Object.keys(nueva).filter((clave) => /answer|invitation|survey|questionnaire/i.test(clave))).toEqual([]);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('header-chats')).toBeAttached({ timeout: 30_000 });
      await page.goto(`${BASE}/my-account/questionnaires?seccion=encuestas`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('cuestionarios-lista')).toBeVisible();
      await expect(page.getByTestId('cuestionarios-pendientes')).toHaveCount(0);
      // Ya reseñada: la acción desaparece, no se puede dejar una segunda.
      await expect(page.getByTestId(`resenar-${invitacionId}`)).toHaveCount(0);
      await abrirMasAccesosSiHaceFalta(page);
      await expect(page.getByTestId('header-encuestas')).toBeVisible();
      await expect(page.getByTestId('header-encuestas')).toHaveAttribute('aria-label', 'Mis encuestas');
      await expect(page.getByTestId('header-encuestas-badge')).toHaveCount(0);
      await foto(page, '08-bandeja-tras-recargar', variante, { conMenu: true });

      // ---- 7. La reseña aparece en la ficha pública, con el promedio ---------
      await page.goto(`${BASE}${FICHA_DE_LA_MEDICA}`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('perfil-tab-reviews').click();
      await expect(page.getByTestId('opiniones-resumen')).toContainText(`${totalAntes + 1} opiniones`);
      const promedioEsperado = (Math.round(((promedioAntes * totalAntes + 4) / (totalAntes + 1)) * 10) / 10)
        .toFixed(1)
        .replace('.', ',');
      await expect(page.getByTestId('opiniones-resumen')).toContainText(promedioEsperado);
      const primera = page.getByTestId('opinion').first();
      await expect(primera).toContainText('Muy buena atención, gracias.');
      await expect(primera).toContainText('Paciente verificado');
      await expect(primera).toContainText('4 de 5 estrellas');
      await primera.scrollIntoViewIfNeeded();
      await foto(page, '09-ficha-publica-con-la-resena', variante);
      await sinDesbordeHorizontal(page);

      // Sin errores de la página ni peticiones rotas (salvo el 404 esperado de
      // una reserva sin atención, que la API anota y la pantalla ignora).
      expect(errores.filter((e) => !/\[API\] GET \/patients\/me\/reviewable-care → 404/.test(e))).toEqual([]);
    });
  }

  test('«Ahora no» no pierde nada: «Dejar reseña pública» sigue en la lista de respondidas', async ({ page }) => {
    test.setTimeout(180_000);
    const variante = VARIANTES[0];
    await page.setViewportSize({ width: variante.ancho, height: variante.alto });
    const errores = await prepararPagina(page, variante.tema);

    await entrarComo(page, 'paciente@alovida.mock');
    await page.getByTestId('header-encuestas').click();
    const responder = page.locator('[data-testid^="responder-"]');
    await expect(responder).toHaveCount(1);
    const invitacionId = (await responder.getAttribute('data-testid'))!.replace('responder-', '');
    await responder.click();
    await responderLasObligatorias(page);
    await page.getByTestId('responder-enviar').click();

    // «Ahora no»: vuelve a la lista y NO se escribió ninguna reseña.
    await expect(page.getByTestId('responder-resena')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('responder-resena-ahora-no').click();
    await expect(page).toHaveURL(/\/my-account\/questionnaires/);
    expect((await leerTabla(page, TABLA_DE_RESENAS)).filter((r) => r['encounterId'])).toEqual([]);

    // La acción secundaria de la lista: sigue ahí, para quien cambie de idea.
    await page.goto(`${BASE}/my-account/questionnaires?seccion=encuestas`, { waitUntil: 'domcontentloaded' });
    const accion = page.getByTestId(`resenar-${invitacionId}`);
    await expect(accion).toBeVisible();
    await expect(accion).toHaveText('Dejar reseña pública');
    await foto(page, '10-ahora-no-accion-en-la-lista', variante);

    await accion.click();
    const dialogo = page.locator('app-rate-encounter-dialog');
    // El anfitrión no tiene caja propia (el diálogo es un `<dialog>` modal): se mira su contenido.
      await expect(dialogo.getByTestId('calificar-enviar')).toBeVisible();
    await expect(dialogo.getByTestId('calificar-atencion')).toHaveCount(0);
    await dialogo.getByTestId('calificar-enviar').click();
    await expect(dialogo).toHaveCount(0);
    expect((await leerTabla(page, TABLA_DE_RESENAS)).filter((r) => r['encounterId'])).toHaveLength(1);
    // Una por atención: ya no se ofrece.
    await expect(accion).toHaveCount(0);

    expect(errores.filter((e) => !/\[API\] GET \/patients\/me\/reviewable-care → 404/.test(e))).toEqual([]);
  });
});
