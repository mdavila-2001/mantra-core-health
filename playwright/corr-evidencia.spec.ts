import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
 * La rama `mockup` declara `mockBackend: true` en los dos entornos: **no habla
 * con ninguna API**, un interceptor contesta todo (`src/app/core/mock/`). Así
 * que acá no se usan los actores de `support/actores.ts` —que crean cuentas
 * contra la API viva y necesitan Docker— sino las cuentas del propio
 * simulador: cualquier contraseña no vacía entra, y el identificador es el
 * correo. Ver `core/mock/handlers/auth.handlers.ts`.
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

const DESTINO = join('..', 'docs', 'progress', 'evidence', `lane-${LANE}`);
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
    LANE
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

/**
 * Entra por la pantalla de ingreso, como una persona, contra el simulador.
 *
 * La doctora pertenece a **dos** organizaciones (Clínica Los Olivos y Hospital
 * San Lucas), así que el ingreso no termina en el panel: termina en
 * `/auth/organization`, eligiendo con cuál entra. Esperar «una ruta que no
 * empiece con /auth» sin resolver ese paso es esperar para siempre — y eso no
 * es un fallo del producto, es el producto pidiendo lo que necesita.
 */
async function entrarAlSimulador(page: Page): Promise<void> {
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-identifier').fill(`${USUARIO}@alovida.mock`);
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
 * Espera a que el contenido deje de moverse antes de medirlo.
 *
 * Un `waitForTimeout` fijo no alcanza: «Mi perfil» del médico pide cinco cosas
 * distintas y pinta la columna lateral antes que la ficha. Medido a los 900 ms
 * daba, a veces, **una sola tarjeta** —la del lateral— y la matriz reportaba
 * «27 % del ancho» sobre una pantalla que en realidad estaba bien. Una medición
 * que falla una de cada tres veces es peor que ninguna: enseña a ignorar el
 * rojo.
 *
 * Se espera a que el número de tarjetas y el ancho del área se repitan dos
 * veces seguidas. `networkidle` no sirve acá: con HMR no llega nunca
 * (`CLAUDE.md` §5).
 */
async function esperarAQueSeAsiente(page: Page): Promise<void> {
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
    const area = document.querySelector('.app-main__inner') as HTMLElement | null;
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
    const cb = getComputedStyle(document.body);
    const velo1 = Number(getComputedStyle(document.body, '::before').opacity || '0');
    const velo2 = Number(getComputedStyle(document.body, '::after').opacity || '0');
    const fondo = cb.backgroundColor;
    const fondoImagen = cb.backgroundImage !== 'none' || velo1 > 0.01 || velo2 > 0.01;
    const fondoQuien =
      cb.backgroundImage !== 'none'
        ? 'body + imagen'
        : velo1 > 0.01 || velo2 > 0.01
          ? `body + velo(${velo1.toFixed(2)}/${velo2.toFixed(2)})`
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

    if (tarjetas.length > 0) {
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
      fondoQuien,
      fondoImagen,
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
  const fondo = tema === 'oscuro' ? '—' : esBlanco ? 'PASS' : `FAIL (${m.fondoQuien}: ${m.fondo})`;
  const centrado =
    Math.abs(m.holguraIzq - m.holguraDer) <= HOLGURA_MAX_PX
      ? 'PASS'
      : `FAIL (${Math.round(m.holguraIzq)}/${Math.round(m.holguraDer)})`;
  const ancho =
    m.anchoArea > 0 && m.ancho / m.anchoArea >= ANCHO_MIN
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
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: tema === 'oscuro' ? 'dark' : 'light',
          locale: 'es-BO',
          timezoneId: 'America/La_Paz',
        });
        const page = await context.newPage();
        let consola = 0;
        page.on('console', (m) => {
          if (m.type() === 'error') consola += 1;
        });
        page.on('response', (r) => {
          if (r.status() >= 500) consola += 1;
        });

        await entrarAlSimulador(page);

        for (const { ruta, nombre, esperado } of RUTAS) {
          consola = 0;
          await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' });
          await esperarAQueSeAsiente(page);
          const foto = join(FOTOS, `${nombre}-${vp.nombre}-${tema}.png`);
          await page.screenshot({ path: foto, fullPage: true });
          const bytes = statSync(foto).size;
          if (bytes < FOTO_MIN_BYTES && esperado !== 'no-encontrado') {
            errores.push(`${ruta} @ ${vp.nombre}/${tema}: foto vacía (${bytes} B)`);
          }
          const m = await medir(page);
          const f = fila(ruta, vp.nombre, tema, m, consola, foto.replace(`${DESTINO}/`, ''), esperado);
          filas.push(f.texto);
          if (!f.ok) rojos += 1;
        }
        await context.close();
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
