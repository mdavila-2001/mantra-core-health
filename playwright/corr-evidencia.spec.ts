import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

const BASE_DESTINATION = join('..', 'docs', 'progress', 'evidence', `lane-${LANE}`);
// Las dos pasadas de usuario deben conservar matrices y fotos independientes.
const DESTINO = USUARIO === 'medica' ? BASE_DESTINATION : join(BASE_DESTINATION, USUARIO);
const FOTOS = join(DESTINO, 'fotos', FASE);

interface Ruta {
  readonly ruta: string;
  readonly nombre: string;
  /**
   * `no-encontrado` para una ruta que este carril **borró**: la prueba pasa si
   * la aplicación ya no la sirve. Sin esto, borrar una pantalla dejaría la
   * matriz en rojo para siempre y el rojo dejaría de significar algo.
   */
  readonly esperado?: 'pantalla' | 'no-encontrado';
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
  const fondo =
    tema === 'oscuro'
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

        await entrarAlSimulador(page, USUARIO, BASE);

        for (const { ruta, nombre, esperado } of RUTAS) {
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
          if (ruta.includes('with-file=1')) {
            const input = activePage.getByTestId('matricula-archivo');
            await expect(input).toBeVisible();
            await input.setInputFiles({
              name: 'matricula.png',
              mimeType: 'image/png',
              buffer: Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLSDwAAAABJRU5ErkJggg==',
                'base64',
              ),
            });
            await expect(activePage.getByText('matricula.png')).toBeVisible();
            await expect(activePage.locator('app-file-preview img')).toBeVisible();
          }
          const foto = join(FOTOS, `${nombre}-${vp.nombre}-${tema}.png`);
          // La medición y la foto usan el viewport declarado
          // (375/768/1440), igual al que usaría una persona.
          const m = await medir(activePage);
          const expectedPath = new URL(ruta, BASE).pathname.replace(/\/$/, '') || '/';
          const actualPath = new URL(activePage.url()).pathname.replace(/\/$/, '') || '/';
          const routeLoaded = expectedPath === actualPath;
          // La foto representa el viewport medido. Capturar documentos de casi
          // 200 000 px de alto producía una franja ilegible y ocultaba el primer
          // pantallazo que realmente recibe la persona.
          await activePage.screenshot({ path: foto });
          const bytes = statSync(foto).size;
          if (bytes < FOTO_MIN_BYTES && esperado !== 'no-encontrado') {
            errores.push(`${ruta} @ ${vp.nombre}/${tema}: foto vacía (${bytes} B)`);
          }
          if (!routeLoaded && esperado !== 'no-encontrado') {
            errores.push(`${ruta} @ ${vp.nombre}/${tema}: redirigió a ${actualPath}`);
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
            foto.replace(`${DESTINO}/`, ''),
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
