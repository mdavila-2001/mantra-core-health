import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * Evidencia fotográfica **medida** de un carril de correcciones (31–40).
 *
 * No es una prueba de regresión: es el recorrido que deja las fotos con las que
 * se revisa lo entregado, y además **mide** la regla visual que el propietario
 * fijó el 2026-09-10 —fondo blanco, centrado, a lo ancho, sin scroll
 * horizontal— para que «se ve bien» tenga un número atrás.
 *
 * ## Por qué el ingreso es el del backend simulado
 *
 * El ingreso y la espera viven en `support/simulador.ts`, compartidos con
 * `premium-visual.spec.ts` —la otra auditoría de esta rama— para que las dos
 * midan sobre exactamente el mismo estado. El resumen: `mockup` declara
 * `mockBackend: true`, no habla con ninguna API, y se entra con las cuentas del
 * propio simulador (`core/mock/handlers/auth.handlers.ts`), no con los actores
 * de `support/actores.ts`, que necesitan Docker.
 *
 * Variables:
 *   CORR_LANE=35              carril (obligatoria)
 *   CORR_FASE=antes|despues   default `despues`; en `antes` no asevera la regla
 *   CORR_RUTA=/notifications  una sola ruta (opcional)
 *   CORR_USUARIO=paciente     cuenta del simulador (default `medica`)
 *   E2E_BASE_URL              default http://localhost:4200
 */

const LANE = process.env['CORR_LANE'] ?? '';
const FASE = process.env['CORR_FASE'] ?? 'despues';
const SOLO_RUTA = process.env['CORR_RUTA'] ?? '';
const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const USUARIO = process.env['CORR_USUARIO'] ?? 'medica';
const ROUTE_KEY =
  LANE === '34' && USUARIO !== 'medica' ? `${LANE}-${USUARIO}` : LANE;

const BASE_DESTINATION = process.env['CORR_EVIDENCE_DESTINATION']
  ? resolve(process.env['CORR_EVIDENCE_DESTINATION'])
  : join('..', 'docs', 'progress', 'evidence', `lane-${LANE}`);
// Las dos pasadas de usuario deben conservar matrices y fotos independientes.
const DESTINO = USUARIO === 'medica' ? BASE_DESTINATION : join(BASE_DESTINATION, USUARIO);
const FOTOS = join(DESTINO, 'fotos', FASE);

interface Ruta {
  readonly ruta: string;
  readonly nombre: string;
  /** URL final esperada para una sección que conserva evidencia de su alias. */
  readonly destino?: string;
  /** Respuesta acotada para capturar un estado vacío sin cambiar la aplicación. */
  readonly fixture?: 'empty-memberships';
  readonly accion?:
    | 'crear-consultorio'
    | 'editar-perfil-consultorio'
    | 'panel-consultorio'
    | 'practitioner-practice-tab'
    | 'practitioner-credentials-tab';
  /**
   * `no-encontrado` para una ruta que este carril **borró**: la prueba pasa si
   * la aplicación ya no la sirve. Sin esto, borrar una pantalla dejaría la
   * matriz en rojo para siempre y el rojo dejaría de significar algo.
   */
  readonly esperado?: 'pantalla' | 'no-encontrado' | 'redirige';
}

const RUTAS: readonly Ruta[] = (
  (JSON.parse(readFileSync(join(__dirname, 'corr-rutas.json'), 'utf8')) as Record<string, Ruta[]>)[
    ROUTE_KEY
  ] ?? []
).filter((r) => !SOLO_RUTA || r.ruta === SOLO_RUTA);

const VIEWPORTS = [
  { nombre: '375', width: 375, height: 812 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;

/** Umbrales de la regla del propietario (composition-rules.md §5 + CORR-04). */
const HOLGURA_MAX_PX = 2;
const ANCHO_MIN = 0.85;
const FOTO_MIN_BYTES = 8 * 1024;

async function crearAdjuntoDeMuestra(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 650;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo crear el adjunto de muestra');

    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#125B80';
    context.lineWidth = 12;
    context.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
    context.fillStyle = '#125B80';
    context.fillRect(36, 36, canvas.width - 72, 108);
    context.fillStyle = '#fff';
    context.font = 'bold 36px sans-serif';
    context.fillText('MUESTRA SINTÉTICA · SIN VALIDEZ LEGAL', 68, 102);
    context.fillStyle = '#173B4B';
    context.font = 'bold 42px sans-serif';
    context.fillText('Matrícula profesional', 68, 218);
    context.font = '28px sans-serif';
    context.fillText('Nombre: Dra. Valeria Rojas (dato de prueba)', 68, 286);
    context.fillText('Registro: MP-12345', 68, 344);
    context.fillText('Autoridad: Ministerio de Salud', 68, 402);
    context.fillText('Documento generado sólo para evidencia visual.', 68, 520);
    context.strokeStyle = '#9FD8D0';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(68, 452);
    context.lineTo(930, 452);
    context.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(base64 ?? '', 'base64');
}

function isPublicRoute(routePath: string): boolean {
  return routePath === '/posts' || routePath.startsWith('/auth/');
}

interface Medicion {
  readonly fondo: string;
  readonly fondoQuien: string;
  readonly fondoImagen: boolean;
  readonly holguraIzq: number;
  readonly holguraDer: number;
  readonly ancho: number;
  readonly anchoArea: number;
  readonly queSeMidio: string;
  readonly scrollHorizontal: boolean;
  readonly cargo: boolean;
}

/**
 * Mide lo que el propietario mira, no lo que es cómodo de medir.
 *
 * Dos trampas que esta función evita, las dos comprobadas en el navegador el
 * 2026-09-10:
 *
 * 1. **`.app-main` es transparente en los dos temas.** Leer su
 *    `background-color` devuelve `rgba(0,0,0,0)` siempre, así que «el fondo no
 *    es blanco» saldría igual antes y después de arreglarlo. Quien pinta es el
 *    primer ancestro con color o imagen — hoy `.app-shell` (un degradado) y el
 *    `body` (`fondo-vista.svg`). Eso es lo que se reporta.
 * 2. **El hijo directo del área siempre ocupa el 100 %.** Medirlo daba PASS en
 *    todas las pantallas, incluso en las que el propietario señaló como
 *    pegadas a la izquierda. Lo que se mide es **la unión de las tarjetas**, de
 *    la más a la izquierda a la más a la derecha. La tarjeta más ancha, que fue
 *    el primer intento, castigaba cualquier disposición de dos columnas: en «Mi
 *    perfil» la ficha mide 752 px y la columna lateral otros 313, y juntas
 *    ocupan el 93 % — pero la más ancha sola daba «65 %». La regla §5 prohíbe la
 *    columna **vacía**, no la columna. Si no hay tarjetas se cae al componente
 *    ruteado y se deja dicho en `queSeMidio`, para que nadie lea un PASS que no
 *    significa lo mismo.
 */
async function medir(page: Page): Promise<Medicion> {
  return page.evaluate(() => {
    const applicationArea = document.querySelector('.app-main__inner') as HTMLElement | null;
    const registrationScene = document.querySelector('.auth-split') as HTMLElement | null;
    const registrationArea = document.querySelector('.auth-split__panel') as HTMLElement | null;
    const registrationContent = document.querySelector(
      '.registro-conjunto, .registro, .tipos',
    ) as HTMLElement | null;
    const area = applicationArea ?? registrationArea;
    if (!area) {
      return {
        fondo: '',
        fondoQuien: '',
        fondoImagen: false,
        holguraIzq: -1,
        holguraDer: -1,
        ancho: 0,
        anchoArea: 0,
        queSeMidio: 'nada',
        scrollHorizontal: false,
        cargo: false,
      };
    }

    // --- qué se ve detrás del contenido ----------------------------------
    // El `<body>` es quien pinta la página: `.app-main` y `.app-main__inner`
    // son transparentes, y el degradado de `.app-shell` sólo cubre la franja
    // del menú (`--w-nav`), no el área de contenido. Encima del color hay dos
    // velos decorativos —`body::before` y `body::after`, los focos de menta y
    // aguamarina que siguen al puntero—: con cualquiera de los dos encendido
    // el fondo se ve celeste aunque el color de abajo sea blanco, así que
    // cuentan como «no es blanco».
    const surface = registrationScene ?? document.body;
    const cb = getComputedStyle(surface);
    const veilOne = registrationScene
      ? 0
      : Number(getComputedStyle(document.body, '::before').opacity || '0');
    const veilTwo = registrationScene
      ? 0
      : Number(getComputedStyle(document.body, '::after').opacity || '0');
    const registrationDecoration = registrationScene
      ? ['.auth-split__stage', '.auth-split__aurora', '.auth-split__brand'].some((selector) =>
          Array.from(registrationScene.querySelectorAll(selector)).some(
            (element) => getComputedStyle(element).display !== 'none',
          ),
        )
      : false;
    const fondo = cb.backgroundColor;
    const backgroundImage =
      cb.backgroundImage !== 'none' || veilOne > 0.01 || veilTwo > 0.01 || registrationDecoration;
    const backgroundSource =
      registrationDecoration
        ? 'alta + escena decorativa'
        : cb.backgroundImage !== 'none'
          ? `${registrationScene ? 'alta' : 'body'} + imagen`
        : veilOne > 0.01 || veilTwo > 0.01
          ? `body + velo(${veilOne.toFixed(2)}/${veilTwo.toFixed(2)})`
          : registrationScene
            ? 'alta'
            : 'body';

    // --- qué ocupa el contenido, de verdad -------------------------------
    // **La unión de las tarjetas, no la más ancha.** Medir la más ancha
    // penalizaba cualquier disposición de dos columnas: en «Mi perfil» la
    // ficha mide 752 px y la columna lateral —«Tu acceso», con contenido
    // real— otros 313, y juntas ocupan el 93 % del área. Con la métrica
    // anterior eso salía «FAIL 65 %», que habría empujado a romper un layout
    // que la regla §5 permite: lo que prohíbe es la columna **vacía**, no la
    // columna.
    //
    // Con la unión, un bloque angosto pegado a un lado sigue fallando —que es
    // el defecto que hay que cazar— y dos columnas llenas pasan.
    const tarjetas = (Array.from(area.querySelectorAll('app-card')) as HTMLElement[]).filter(
      (t) => t.getBoundingClientRect().width > 0,
    );
    const ruteado = Array.from(area.children).find(
      (c) => (c as HTMLElement).offsetWidth > 0,
    ) as HTMLElement | undefined;

    const a = area.getBoundingClientRect();
    let izq: number;
    let der: number;
    let ancho: number;
    let queSeMidio: string;

    if (registrationArea && registrationContent) {
      const b = registrationContent.getBoundingClientRect();
      izq = b.left - a.left;
      der = a.right - b.right;
      ancho = b.width;
      queSeMidio = `.${registrationContent.classList[0] ?? 'registration-content'}`;
    } else if (tarjetas.length > 0) {
      const cajas = tarjetas.map((t) => t.getBoundingClientRect());
      const min = Math.min(...cajas.map((c) => c.left));
      const max = Math.max(...cajas.map((c) => c.right));
      izq = min - a.left;
      der = a.right - max;
      ancho = max - min;
      queSeMidio = `${tarjetas.length} app-card`;
    } else if (ruteado) {
      const b = ruteado.getBoundingClientRect();
      izq = b.left - a.left;
      der = a.right - b.right;
      ancho = b.width;
      queSeMidio = `<${ruteado.tagName.toLowerCase()}>`;
    } else {
      izq = -1;
      der = -1;
      ancho = 0;
      queSeMidio = 'nada';
    }

    return {
      fondo,
      fondoQuien: backgroundSource,
      fondoImagen: backgroundImage,
      holguraIzq: izq,
      holguraDer: der,
      ancho,
      anchoArea: a.width,
      queSeMidio,
      scrollHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
      cargo: true,
    };
  });
}

function fila(
  ruta: string,
  vp: string,
  tema: string,
  m: Medicion,
  consola: number,
  foto: string,
  esperado: Ruta['esperado'],
): { texto: string; ok: boolean } {
  if (esperado === 'no-encontrado') {
    // Se borró a propósito: lo que se comprueba es que ya no está.
    const borrada = !m.cargo;
    return {
      texto: `| \`${ruta}\` | ${vp} | ${tema} | ${borrada ? 'BORRADA (esperado)' : 'FAIL (todavía carga)'} | — | — | — | — | \`${foto}\` |`,
      ok: borrada,
    };
  }
  if (esperado === 'redirige') {
    return {
      texto: `| \`${ruta}\` | ${vp} | ${tema} | REDIRIGE (esperado) | — | — | — | PASS | \`${foto}\` |`,
      ok: true,
    };
  }
  if (!m.cargo) {
    return {
      texto: `| \`${ruta}\` | ${vp} | ${tema} | SIN CARGAR | | | | | \`${foto}\` |`,
      ok: false,
    };
  }
  // Blanco es blanco **y sin imagen encima**: el degradado de `fondo-vista.svg`
  // sobre un color blanco se seguiría viendo celeste, que es lo que el
  // propietario rechazó.
  const esBlanco = m.fondo === 'rgb(255, 255, 255)' && !m.fondoImagen;
  const exigeFondoBlanco = LANE === '36' || tema === 'claro';
  const fondo =
    !exigeFondoBlanco
      ? esBlanco
        ? 'FAIL (se perdió la superficie oscura)'
        : 'PASS (oscuro conservado)'
      : esBlanco
        ? 'PASS'
        : `FAIL (${m.fondoQuien}: ${m.fondo})`;
  const centrado =
    Math.abs(m.holguraIzq - m.holguraDer) <= HOLGURA_MAX_PX
      ? 'PASS'
      : `FAIL (${Math.round(m.holguraIzq)}/${Math.round(m.holguraDer)})`;
  // `plainSurface` sólo existe en claro: la decisión registrada para CORR-34
  // exige conservar en oscuro la escena pública de dos columnas. Allí el
  // formulario no debe estirarse al 85 % porque eso sí sería una regresión de
  // la composición preservada; el auditor continúa exigiendo centrado, carga,
  // ausencia de scroll y consola limpia.
  const ancho =
    tema === 'oscuro' && isPublicRoute(ruta)
      ? `— (${m.queSeMidio}; escena conservada)`
      : m.anchoArea > 0 && m.ancho / m.anchoArea >= ANCHO_MIN
        ? `PASS (${m.queSeMidio})`
        : `FAIL (${Math.round((m.ancho / Math.max(1, m.anchoArea)) * 100)} % · ${m.queSeMidio})`;
  const scroll = m.scrollHorizontal ? 'FAIL' : 'PASS';
  const cons = consola === 0 ? 'PASS' : `FAIL (${consola})`;
  const texto = `| \`${ruta}\` | ${vp} | ${tema} | ${fondo} | ${centrado} | ${ancho} | ${scroll} | ${cons} | \`${foto}\` |`;
  return { texto, ok: ![fondo, centrado, ancho, scroll, cons].some((x) => x.startsWith('FAIL')) };
}

/**
 * Produce los tres estados visuales de CORR-35 recorriendo la interfaz real.
 * El query param sólo selecciona el escenario del capturador; no es una opción
 * de producto ni una fixture de datos. El estado vacío se obtiene marcando
 * toda la bandeja como leída y entrando a «Sin leer».
 */
async function prepararEstadoNotificaciones(page: Page, ruta: string): Promise<void> {
  const url = new URL(ruta, BASE);
  if (url.pathname !== '/notification-center') return;

  const escenario = url.searchParams.get('evidenceState');
  const titulos = page.locator('.avisos__titulo');
  const esperarBandejaLista = async (): Promise<void> => {
    // Al cambiar de pestaña se conserva el contenido previo y se dispara otra
    // consulta. Esperar sólo una fila visible puede aceptar el esqueleto o
    // contenido viejo; la foto debe esperar al cierre del estado de carga.
    await expect(page.locator('.view-state-host__loading')).toHaveCount(0);
    await expect(titulos.first()).toBeVisible();
    await expect(titulos.first()).toHaveText(/\S+/);
  };
  if (!escenario || escenario === 'all') {
    await esperarBandejaLista();
    return;
  }

  const pestanas = page.locator('[data-testid="avisos-pestanas"] [role="tab"]');
  await expect(pestanas).toHaveCount(6);

  if (escenario === 'unread') {
    await pestanas.nth(1).click();
    await esperarBandejaLista();
    // El simulador de la evidencia devuelve cuatro avisos sin leer. Esperar
    // esa respuesta evita fotografiar el esqueleto o una lista transitoria.
    await expect(titulos).toHaveCount(4);
    return;
  }

  if (escenario === 'empty') {
    const marcarTodas = page.getByTestId('avisos-marcar-todas');
    await expect(marcarTodas).toBeVisible();
    await marcarTodas.click();
    await expect(marcarTodas).toHaveCount(0);
    await pestanas.nth(1).click();
    await expect(page.locator('.view-state-host__loading')).toHaveCount(0);
    await expect(page.getByText('No hay notificaciones sin leer.')).toBeVisible();
    await expect(page.locator('app-empty-state')).toBeVisible();
    return;
  }

  throw new Error(`Escenario de notificaciones desconocido: ${escenario}`);
}

test.describe(`evidencia del carril ${LANE} (${FASE})`, () => {
  test.skip(!LANE, 'CORR_LANE es obligatoria');

  test('fotos y medición por ruta', async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    mkdirSync(FOTOS, { recursive: true });
    const filas: string[] = [];
    const errores: string[] = [];
    let rojos = 0;

    for (const tema of ['claro', 'oscuro'] as const) {
      const vps = tema === 'claro' ? VIEWPORTS : VIEWPORTS.slice(2);
      for (const vp of vps) {
        const contextOptions = {
          viewport: { width: vp.width, height: vp.height },
          colorScheme: tema === 'oscuro' ? 'dark' : 'light',
          locale: 'es-BO',
          timezoneId: 'America/La_Paz',
        } as const;
        const context = await browser.newContext(contextOptions);
        const publicContext = await browser.newContext(contextOptions);
        const preference = tema === 'oscuro' ? 'dark' : 'light';
        for (const browserContext of [context, publicContext]) {
          await browserContext.addInitScript((value) => {
            localStorage.setItem('mantra-core-health.theme', value);
          }, preference);
        }
        const page = await context.newPage();
        const publicPage = await publicContext.newPage();
        const consoleByPage = new Map<Page, { count: number; details: string[] }>([
          [page, { count: 0, details: [] }],
          [publicPage, { count: 0, details: [] }],
        ]);
        for (const pagina of [page, publicPage]) {
          pagina.on('console', (m) => {
            if (m.type() !== 'error') return;
            const state = consoleByPage.get(pagina);
            if (!state) return;
            state.count += 1;
            state.details.push(m.text());
          });
          pagina.on('response', (r) => {
            if (r.status() >= 500) {
              const state = consoleByPage.get(pagina);
              if (!state) return;
              state.count += 1;
              state.details.push(`${r.status()} ${r.url()}`);
            }
          });
        }

        if (LANE === '36') {
          await page.clock.install({ time: new Date('2026-10-14T12:00:00-04:00') });
        }
        await entrarAlSimulador(page, USUARIO, BASE);

        for (const { ruta, nombre, esperado, destino, fixture } of RUTAS) {
          const activePage = isPublicRoute(ruta) ? publicPage : page;
          const consoleState = consoleByPage.get(activePage);
          if (!consoleState) throw new Error(`No hay contador de consola para ${ruta}`);
          consoleState.count = 0;
          consoleState.details.length = 0;
          // La captura anterior puede haber aumentado el alto para sacar los
          // elementos fijos del camino. Volver siempre al viewport que se está
          // auditando evita que ese alto se acumule ruta tras ruta y termine
          // alterando el layout que pretendemos medir.
          await activePage.setViewportSize({ width: vp.width, height: vp.height });
          await activePage.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' });
          await esperarAQueSeAsiente(activePage);
          await prepararEstadoNotificaciones(activePage, ruta);
          // La preferencia del menú se restaura después de hidratar. Esperar a
          // que el ancho fijo del menú coincida con el espacio reservado por
          // el marco evita capturas con contenido debajo de la barra lateral.
          await activePage.waitForFunction(
            () => {
              if (window.innerWidth <= 900) return true;
              const shell = document.querySelector('.app-shell');
              const nav = document.querySelector('.app-side-nav');
              if (!shell || !nav) return true;
              const padding = Number.parseFloat(getComputedStyle(shell).paddingLeft);
              const width = nav.getBoundingClientRect().width;
              return Number.isFinite(padding) && Math.abs(padding - width) <= 2;
            },
            undefined,
            { timeout: 5_000 },
          );
          if (LANE === '36' && ruta.startsWith('/my-account/identity')) {
            await expect(activePage.getByText('Desconocido', { exact: true })).toHaveCount(0);
            const esSeguimiento = ruta.includes('tab=cases') || ruta.includes('/cases');
            if (esSeguimiento) {
              const tabla = activePage.getByTestId('tabla');
              await expect(tabla.getByText('Pendiente', { exact: true })).toBeVisible();
              await expect(tabla.getByText('Aprobado', { exact: true })).toBeVisible();
              await expect(tabla.getByText('Rechazado', { exact: true })).toBeVisible();
              await expect(activePage.locator('body')).not.toContainText(/\b2025\b/);
            }
            if (ruta.includes('/cases/')) {
              await expect(activePage.getByTestId('content-dialog-title')).toHaveText(
                'Detalle del trámite',
              );
              expect(new URL(activePage.url()).searchParams.get('case')).toBe(
                ruta.split('/').at(-1),
              );
            } else if (esperado === 'redirige' && ruta.endsWith('/cases')) {
              expect(new URL(activePage.url()).searchParams.get('tab')).toBe('cases');
            }
          }
          if (fixture === 'empty-memberships') {
            // Fixture de evidencia: deja asentado el estado vacío después de
            // que terminó la consulta simulada, sin agregar parámetros de
            // prueba ni ramas especiales al cliente de producción.
            await activePage.evaluate(() => {
              const angular = (window as Window & {
                ng?: { getComponent(host: Element): unknown };
              }).ng;
              const host = document.querySelector('app-memberships-tab');
              if (!angular || !host) throw new Error('No se encontró el componente de vinculaciones');
              const componente = angular.getComponent(host) as {
                vinculaciones?: { set(value: readonly unknown[]): void };
                falloDeVinculaciones?: { set(value: null): void };
              } | null;
              if (!componente?.vinculaciones || !componente.falloDeVinculaciones) {
                throw new Error('No se pudo preparar la fixture de vinculaciones vacías');
              }
              componente.falloDeVinculaciones.set(null);
              componente.vinculaciones.set([]);
            });
            await expect(activePage.getByText('Todavía no tiene vinculaciones')).toBeVisible();
          }
          const routeEntry = RUTAS.find((entry) => entry.ruta === ruta && entry.nombre === nombre);
          if (routeEntry?.accion === 'crear-consultorio') {
            await activePage.getByTestId('sede-agregar').click();
            await activePage.getByTestId('sede-cargar-propio').click();
            await expect(activePage.getByTestId('sede-formulario')).toBeVisible();
            // Esperar la transición del diálogo para evitar capturarlo a medio abrir.
            await activePage.waitForTimeout(400);
          }
          if (routeEntry?.accion === 'editar-perfil-consultorio') {
            await activePage.getByRole('tab', { name: 'Dónde atiendo' }).click();
            await expect(activePage.getByTestId('sedes-propias')).toBeVisible();
            // El bloque se monta al abrir la pestaña y su lectura termina un
            // poco después. Esperar sólo el contenedor capturaba el vacío
            // transitorio aunque la cuenta demo ya tuviera sus cuatro sedes.
            await expect(activePage.getByText('Centro Médico Equipetrol')).toBeVisible();
          }
          if (routeEntry?.accion === 'practitioner-practice-tab') {
            const tab = activePage.getByRole('tab', { name: 'Dónde atiendo' });
            await tab.click();
            await expect(tab).toHaveAttribute('aria-selected', 'true');
            await expect(activePage.getByTestId('perfil-sedes')).toBeVisible();
            await expect(activePage.getByTestId('practice-site-contact-phone').first()).toBeVisible();
          }
          if (routeEntry?.accion === 'practitioner-credentials-tab') {
            const tab = activePage.getByRole('tab', { name: 'Credenciales' });
            await tab.click();
            await expect(tab).toHaveAttribute('aria-selected', 'true');
            const tip = activePage
              .locator('app-toast')
              .filter({ hasText: 'Acá se separa lo que declaró' });
            await expect(tip).toBeVisible();
            await tip.getByTestId('toast-cerrar').click();
            await expect(tip).toBeHidden();
          }
          if (LANE === '37') {
            await activePage.evaluate(() => {
              document.querySelectorAll<HTMLElement>('*').forEach((element) => {
                element.scrollTop = 0;
                element.scrollLeft = 0;
              });
              window.scrollTo(0, 0);
            });
            if (vp.width > 768) {
              await activePage.locator('.app-header').evaluate((element) => {
                element.scrollIntoView({ block: 'start', behavior: 'instant' });
              });
            }
            await activePage.waitForTimeout(500);
            if (routeEntry?.accion === 'practitioner-practice-tab') {
              await expect(
                activePage.getByRole('tab', { name: 'Dónde atiendo' }),
              ).toHaveAttribute('aria-selected', 'true');
              await expect(activePage.getByTestId('practice-site-contact-phone').first()).toBeVisible();
            }
            if (routeEntry?.accion === 'practitioner-credentials-tab') {
              await expect(
                activePage.getByRole('tab', { name: 'Credenciales' }),
              ).toHaveAttribute('aria-selected', 'true');
            }
          }
          if (routeEntry?.accion === 'panel-consultorio') {
            const accesos = activePage.getByTestId('panel-accesos');
            await accesos.scrollIntoViewIfNeeded();
            await activePage
              .getByTestId('panel-zona')
              .filter({ hasText: 'Administración' })
              .click();
            const zonaAbierta = activePage.getByTestId('panel-zona-abierta');
            await zonaAbierta.scrollIntoViewIfNeeded();
            const accesoConsultorio = activePage
              .getByTestId('panel-acceso')
              .filter({ hasText: 'Mi consultorio propio' });
            if (FASE === 'antes') {
              await expect(accesoConsultorio).toHaveCount(0);
            } else {
              await expect(accesoConsultorio).toBeVisible();
              await accesoConsultorio.scrollIntoViewIfNeeded();
            }
            await activePage.waitForTimeout(400);
          }
          if (ruta.includes('with-file=1')) {
            await activePage.getByRole('button', { name: 'Agregar matrícula' }).click();
            const input = activePage.getByTestId('matricula-archivo');
            await expect(input).toBeVisible();
            await input.setInputFiles({
              name: 'matricula.png',
              mimeType: 'image/png',
              buffer: await crearAdjuntoDeMuestra(activePage),
            });
            await expect(activePage.getByText('matricula.png')).toBeVisible();
            const preview = activePage.locator('app-file-preview img');
            await expect(preview).toBeVisible();
            await preview.scrollIntoViewIfNeeded();
          }
          const foto = join(FOTOS, `${nombre}-${vp.nombre}-${tema}.png`);
          // La medición y la foto usan el viewport declarado
          // (375/768/1440), igual al que usaría una persona.
          const m = await medir(activePage);
          const expectedUrl = new URL(destino ?? ruta, BASE);
          const actualUrl = new URL(activePage.url());
          const expectedPath = expectedUrl.pathname.replace(/\/$/, '') || '/';
          const actualPath = actualUrl.pathname.replace(/\/$/, '') || '/';
          const routeLoaded =
            expectedPath === actualPath &&
            [...expectedUrl.searchParams].every(([key, value]) => actualUrl.searchParams.get(key) === value);
          // La foto encuadra el organismo del carril 33 dentro del viewport
          // medido para que la tabla y el vacío queden visibles sin capturar un
          // documento largo con el menú fijo superpuesto.
          if (LANE === '33') {
            const target = fixture === 'empty-memberships'
              ? activePage.getByText('Todavía no tiene vinculaciones')
              : activePage.locator('app-data-table tbody tr').first();
            if (vp.width > 768) {
              await target.evaluate((element) => element.scrollIntoView({ block: 'center' }));
            }
          }
          if (LANE === '33' && vp.width <= 768) {
            // El contenido queda debajo del formulario en móvil. Capturar todo
            // el documento deja ver la tabla; resetear los contenedores evita
            // que el encabezado fijo quede congelado a mitad de la foto.
            await activePage.evaluate(() => {
              document.querySelectorAll<HTMLElement>('*').forEach((element) => {
                element.scrollTop = 0;
                element.scrollLeft = 0;
              });
            });
          }
          const fullPage =
            (LANE === '33' && vp.width <= 768) ||
            (LANE === '37' && vp.width <= 768);
          await activePage.screenshot({ path: foto, fullPage, animations: 'disabled' });
          await activePage.screenshot({
            path: foto,
            fullPage: LANE === '33' && vp.width <= 768,
            animations: 'disabled',
          });
          if (LANE === '38' && nombre === 'practitioner-profile-editor' && vp.width === 1440 && tema === 'claro') {
            // La cuenta demo sólo trae especialidades verificadas, que por
            // diseño no se pueden editar. Abrimos el editor real sobre la fila
            // cargada para dejar evidencia directa del formulario corregido.
            await activePage.evaluate(() => {
              const angular = (window as Window & {
                ng?: {
                  getComponent(host: Element): Record<string, unknown> | null;
                  applyChanges(component: unknown): void;
                };
              }).ng;
              const host = document.querySelector('app-practitioner-profile-edit');
              const component = angular && host ? angular.getComponent(host) : null;
              const filas = component?.['filasEspecialidades'] as (() => unknown[]) | undefined;
              const editar = component?.['editarEspecialidad'] as ((fila: unknown) => void) | undefined;
              const fila = filas?.()[0];
              if (!fila || !editar) throw new Error('No hay una especialidad demo para abrir el editor');
              if (!angular || !component) throw new Error('No se encontró el editor de perfil');
              editar.call(component, fila);
              angular.applyChanges(component);
              const nativeDialog = document.querySelector<HTMLDialogElement>(
                '[data-testid="edicion-dialogo"] dialog',
              );
              if (!nativeDialog) throw new Error('El diálogo de edición no se montó');
              if (!nativeDialog.open) nativeDialog.showModal();
            });
            const dialogoEspecialidad = activePage.getByTestId('edicion-dialogo');
            await expect(dialogoEspecialidad.locator('dialog')).toBeVisible();
            await expect(dialogoEspecialidad.getByTestId('edicion-especialidad')).toBeVisible();
            await expect(dialogoEspecialidad.locator('app-switch')).toHaveCount(0);
            await activePage.waitForTimeout(400);
            await activePage.screenshot({ path: join(FOTOS, 'specialty-edit-dialog-1440-claro.png') });
          }
          const bytes = statSync(foto).size;
          if (bytes < FOTO_MIN_BYTES && esperado !== 'no-encontrado') {
            errores.push(`${ruta} @ ${vp.nombre}/${tema}: foto vacía (${bytes} B)`);
          }
          if (!routeLoaded && esperado !== 'no-encontrado') {
            errores.push(`${ruta} @ ${vp.nombre}/${tema}: terminó en ${actualUrl.pathname}${actualUrl.search}`);
          }
          if (!m.cargo && esperado !== 'no-encontrado') {
            errores.push(`${ruta} @ ${vp.nombre}/${tema}: la ruta no cargó el área de contenido`);
          }
          const routeMeasurement = routeLoaded ? m : { ...m, cargo: false };
          const f = fila(
            ruta,
            vp.nombre,
            tema,
            routeMeasurement,
            consoleState.count,
            // Relativa a la matriz y con `/`: en Windows `join` arma la ruta con `\`.
            relative(DESTINO, foto).split(sep).join('/'),
            esperado,
          );
          filas.push(f.texto);
          if (!f.ok) rojos += 1;
          if (consoleState.details.length > 0) {
            errores.push(
              `${ruta} @ ${vp.nombre}/${tema}: consola: ${consoleState.details.join(' | ')}`,
            );
          }
        }
        await context.close();
        await publicContext.close();
      }
    }

    mkdirSync(DESTINO, { recursive: true });
    const matriz = [
      `# MATRIZ visual — carril ${LANE} — ${FASE} — ${new Date().toISOString()}`,
      '',
      `Celdas: ${filas.length} · en rojo: ${rojos}`,
      '',
      '| Ruta | Viewport | Tema | Fondo blanco | Centrado (≤2 px) | Ancho (≥85 %) | Sin scroll H | Consola | Foto |',
      '|---|---|---|---|---|---|---|---|---|',
      ...filas,
      '',
      errores.length ? `## Errores\n${errores.map((e) => `- ${e}`).join('\n')}` : '## Errores\n- ninguno',
    ].join('\n');
    writeFileSync(
      join(DESTINO, `MATRIZ-visual${FASE === 'antes' ? '-antes' : ''}.md`),
      matriz,
      'utf8',
    );

    // Una foto en blanco es peor que ninguna: se guarda como si probara algo.
    expect(errores, errores.join('\n')).toEqual([]);
    // En «antes» no se asevera la regla: es la línea base, y se espera roja.
    if (FASE === 'despues') {
      const enRojo = filas.filter((f) => f.includes('FAIL') || f.includes('SIN CARGAR'));
      expect(enRojo, `Filas en rojo:\n${enRojo.join('\n')}`).toEqual([]);
    }
  });
});
