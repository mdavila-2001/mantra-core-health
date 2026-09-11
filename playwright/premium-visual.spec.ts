import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * Auditoría de **acabado** de la rama `mockup`: lo que `corr-evidencia.spec.ts`
 * no mide.
 *
 * ## Por qué existe además de `corr-evidencia`
 *
 * Aquella mide los cuatro criterios que dictó el propietario el 2026-09-10
 * —fondo blanco, centrado ≤ 2 px, ancho ≥ 85 %, sin scroll horizontal—. Son la
 * composición. Pero «premium» en este producto también es lo que pasa cuando
 * alguien apunta, tabula o no puede ver: un ícono sin nombre, un globo de ayuda
 * que no aparece con el teclado, un anillo de foco invisible, un botón de 18 px
 * en el teléfono, una letra de 10 px, una animación que sigue corriendo con
 * «reducir movimiento». Nada de eso se ve en una foto de la pantalla quieta, y
 * todo eso se puede medir.
 *
 * Las dos auditorías comparten ingreso y espera (`support/simulador.ts`) y
 * escriben en la misma carpeta de evidencia, para que una fila roja de acá y
 * una de allá hablen del mismo estado de la aplicación.
 *
 * ## Lo que esto NO prueba
 *
 * Jerarquía, armonía, ritmo tipográfico, densidad y «se siente terminado» no
 * salen de acá: eso lo dictamina una persona mirando las fotos. Este archivo
 * cierra la parte falsable, para que la revisión humana discuta lo que de
 * verdad hace falta discutir y no si un tooltip existe.
 *
 * Variables:
 *   PREMIUM_LANE=34             carril cuyas rutas se recorren (default 34)
 *   PREMIUM_FASE=antes|despues  en `antes` no asevera: es la línea base
 *   PREMIUM_RUTA=/schedule      una sola ruta (opcional)
 *   PREMIUM_RUTAS=/a,/b,/c      una familia de rutas (opcional) — el plan trabaja
 *                               por rebanadas de 6-10, no por la aplicación entera
 *   PREMIUM_USUARIO=paciente    cuenta del simulador (default `medica`)
 *   E2E_BASE_URL                default http://localhost:4200
 */

const LANE = process.env['PREMIUM_LANE'] ?? '34';
const FASE = process.env['PREMIUM_FASE'] ?? 'despues';
const SOLO_RUTA = process.env['PREMIUM_RUTA'] ?? '';
const SOLO_FAMILIA = (process.env['PREMIUM_RUTAS'] ?? '')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);
const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const USUARIO = process.env['PREMIUM_USUARIO'] ?? 'medica';

const DESTINO = join('..', 'docs', 'progress', 'evidence', `lane-${LANE}`);
const FOTOS = join(DESTINO, 'fotos', 'premium', FASE);

/** Umbrales. Cada uno con su razón; ninguno es una preferencia. */
/** WCAG 2.2 AA, 2.5.8 «Target Size (Minimum)». 44 es el objetivo de diseño. */
const TARGET_MIN_PX = 24;
const TARGET_COMODO_PX = 44;
/**
 * El escalón más chico de la escala tipográfica del sistema: `--fs-overline`,
 * 11 px (`styles.css:175`, Inter 700 en mayúsculas con +8 % de espaciado). El
 * umbral **es la escala**, no un número propio: con 12 px esta compuerta ponía
 * en rojo los rótulos de cifra del panel en nueve rutas seguidas por usar un
 * token que el sistema declara. Lo que se caza es el texto que se salió de la
 * escala hacia abajo.
 */
const TIPOGRAFIA_MIN_PX = 11;
/** Con «reducir movimiento», una animación más larga que esto es decorativa. */
const MOTION_MAX_MS = 80;
/** Cuántos íconos se prueban por ruta: el globo se abre de a uno y cuesta ~1 s. */
const ICONOS_POR_RUTA = 4;
/** Paradas de tabulación que se recorren buscando un anillo de foco invisible. */
const PARADAS_DE_FOCO = 12;

interface Ruta {
  readonly ruta: string;
  readonly nombre: string;
  readonly esperado?: 'pantalla' | 'no-encontrado';
}

const RUTAS: readonly Ruta[] = (
  (JSON.parse(readFileSync(join(__dirname, 'corr-rutas.json'), 'utf8')) as Record<string, Ruta[]>)[
    LANE
  ] ?? []
)
  // Una ruta que el carril borró no tiene acabado que auditar.
  .filter((r) => r.esperado !== 'no-encontrado')
  .filter((r) => !SOLO_RUTA || r.ruta === SOLO_RUTA)
  .filter((r) => SOLO_FAMILIA.length === 0 || SOLO_FAMILIA.includes(r.ruta));

interface Hallazgo {
  readonly ruta: string;
  readonly viewport: string;
  readonly compuerta: string;
  readonly detalle: string;
  readonly selector: string;
}

interface Control {
  readonly idx: number;
  readonly etiqueta: string;
  readonly nombre: string;
  readonly fuenteDelNombre: string;
  readonly soloIcono: boolean;
  /**
   * Enlace de texto, no control con superficie propia. WCAG 2.2 excluye estos
   * del tamaño mínimo (2.5.8, excepción «Inline»): su alto lo fija la línea de
   * texto y agrandarlos rompería el párrafo. El «Panel» de las migas mide
   * 34×19 px y aparecía como FAIL en el primer borrador.
   */
  readonly enlaceDeTexto: boolean;
  readonly ancho: number;
  readonly alto: number;
  readonly selector: string;
}

interface Escaneo {
  readonly cargo: boolean;
  readonly controles: readonly Control[];
  readonly textoChico: readonly { readonly px: number; readonly selector: string }[];
}

/**
 * Marca y describe cada control visible de la pantalla.
 *
 * Marca con `data-premium-idx` porque después hay que **volver** a cada control
 * desde afuera del navegador —para enfocarlo, abrir su globo y sacarle una
 * foto— y un índice estable es la única forma honesta de hacerlo: un selector
 * CSS reconstruido se rompe con cualquier clase generada, y `nth()` sobre una
 * lista que se re-renderiza apunta a otra cosa. El atributo no cambia ni un
 * píxel de lo que se fotografía y se quita al terminar la ruta.
 *
 * «Sólo ícono» no se pregunta por el componente sino por lo que ve una persona:
 * un control sin texto visible y con un dibujo adentro. Así entran también los
 * botones que no usan `[app-button]` —el menú, el cerrar de un modal— que son
 * justamente donde el nombre accesible se olvida.
 */
async function escanear(page: Page): Promise<Escaneo> {
  return page.evaluate(
    ({ minPx }) => {
      const area = document.querySelector('.app-main__inner');
      if (!area) {
        return { cargo: false, controles: [], textoChico: [] };
      }

      const describir = (el: Element): string => {
        const etiqueta = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const prueba = el.getAttribute('data-testid');
        const clase = (el.getAttribute('class') ?? '').trim().split(/\s+/).slice(0, 2).join('.');
        return `${etiqueta}${id}${prueba ? `[data-testid="${prueba}"]` : ''}${clase ? `.${clase}` : ''}`;
      };

      /**
       * Visible **de verdad**, no «tiene caja».
       *
       * El menú lateral agrupa secciones en `<details>` plegados. Sus enlaces
       * siguen midiendo 240×40 y `visibility` sigue en `visible`, pero no
       * están pintados: `innerText` devuelve `''` y el primer borrador de este
       * archivo los tomó por **once íconos sin nombre accesible** en `/schedule`
       * —enlaces con su texto y su `aria-label` correctos, comprobados en el
       * navegador el 2026-09-11—. Once rojos falsos en la primera ruta es la
       * forma más rápida de que nadie vuelva a mirar la matriz.
       *
       * `checkVisibility` con las tres opciones distingue exactamente los tres
       * pintados de los diez plegados (verificado: coincide 13/13 con «tiene
       * texto»). `offsetParent` no sirve: da `true` para los diez.
       */
      const visible = (el: Element): boolean => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;

        // El gemelo accesible de un control visible no es un control chico: es
        // el mismo control. `.solo-lectores` / `.sr-only` dejan un `<input>` de
        // 1×1 px recortado con `clip` para que el lector de pantalla lo alcance
        // mientras se ve el botón de al lado (`styles/alovida.css:439`). El
        // primer borrador lo denunciaba como «área táctil de 1×1 px» en
        // `/my-account`, que es exactamente al revés de lo que hay que pedir.
        const s = getComputedStyle(el);
        const recortadoParaLectores =
          s.getPropertyValue('clip') === 'rect(0px, 0px, 0px, 0px)' ||
          s.clipPath === 'inset(50%)' ||
          (r.width <= 4 && r.height <= 4);
        if (recortadoParaLectores) return false;

        return el.checkVisibility({
          contentVisibilityAuto: true,
          opacityProperty: true,
          visibilityProperty: true,
        });
      };

      const SELECTOR_INTERACTIVO =
        'button, a[href], [role="button"], [role="link"], [role="tab"], [role="menuitem"], input:not([type="hidden"]), select, textarea, summary';

      const controles: Control[] = [];
      let idx = 0;
      for (const el of Array.from(document.querySelectorAll(SELECTOR_INTERACTIVO))) {
        if (!visible(el)) continue;

        const texto = (el as HTMLElement).innerText?.trim() ?? '';
        const aria = el.getAttribute('aria-label')?.trim() ?? '';
        const etiquetadoPor = (el.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.innerText?.trim() ?? '')
          .join(' ')
          .trim();
        const titulo = el.getAttribute('title')?.trim() ?? '';
        const oculto = (el.querySelector('.sr-only') as HTMLElement | null)?.innerText?.trim() ?? '';

        const nombre = aria || etiquetadoPor || texto || oculto || titulo;
        const fuenteDelNombre = aria
          ? 'aria-label'
          : etiquetadoPor
            ? 'aria-labelledby'
            : texto
              ? 'texto'
              : oculto
                ? 'sr-only'
                : titulo
                  ? 'solo-title'
                  : 'ninguno';

        const dibujo = el.querySelector('svg, img, i[class*="icon"]') !== null;
        const soloIcono =
          el.classList.contains('btn--icon-only') || (texto === '' && dibujo && el.tagName !== 'INPUT');

        const enlaceDeTexto =
          el.tagName === 'A' &&
          texto !== '' &&
          !el.classList.contains('btn') &&
          el.getAttribute('role') !== 'button';

        const r = el.getBoundingClientRect();
        el.setAttribute('data-premium-idx', String(idx));
        controles.push({
          idx,
          etiqueta: el.tagName.toLowerCase(),
          nombre,
          fuenteDelNombre,
          soloIcono,
          enlaceDeTexto,
          ancho: Math.round(r.width),
          alto: Math.round(r.height),
          selector: describir(el),
        });
        idx += 1;
      }

      // Texto por debajo del mínimo, sólo dentro del área de contenido: el
      // pie de una tarjeta y una nota al margen cuentan; el chrome del
      // navegador y los `<script>` no.
      //
      // Las insignias quedan fuera **a propósito**: el sistema las declara en
      // 11,5 px (`md`) y 10,5 px (`sm`) copiando el spec del diseñador
      // (`CLAUDE.md`, sección del Badge). Son un número sobre un ícono, no
      // prosa; incluirlas pondría en rojo cada pantalla con una campana por
      // una decisión ya tomada.
      const textoChico: { px: number; selector: string }[] = [];
      const paseo = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
      const vistos = new Set<Element>();
      for (let n = paseo.nextNode(); n !== null; n = paseo.nextNode()) {
        const padre = n.parentElement;
        if (!padre || !n.textContent?.trim() || vistos.has(padre)) continue;
        if (!visible(padre) || padre.closest('app-badge, app-chip')) continue;
        vistos.add(padre);
        const px = Number.parseFloat(getComputedStyle(padre).fontSize);
        if (Number.isFinite(px) && px < minPx) {
          textoChico.push({ px: Math.round(px * 10) / 10, selector: describir(padre) });
        }
      }

      return { cargo: true, controles, textoChico };
    },
    { minPx: TIPOGRAFIA_MIN_PX },
  );
}

async function quitarMarcas(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll('[data-premium-idx]'))) {
      el.removeAttribute('data-premium-idx');
    }
  });
}

/** La huella de estilos vive en `window` para que las dos lecturas del foco
 *  —con y sin él— comparen exactamente las mismas propiedades. */
interface VentanaConHuella extends Window {
  __huellaDeFoco?: (desde: Element) => string;
}

interface ResultadoTooltip {
  readonly aparecioConFoco: boolean;
  readonly texto: string;
  readonly dentroDePantalla: boolean;
  readonly cierraConEscape: boolean;
}

/**
 * Prueba el globo de ayuda **como lo usa una persona con teclado**.
 *
 * Con el puntero el globo espera 400 ms (`TOOLTIP_HOVER_DELAY_MS`); con el
 * teclado aparece de inmediato, porque llegar al control ya es la intención
 * (`atoms/tooltip/tooltip.ts`). Se prueba el camino del teclado porque es el
 * que se rompe sin que nadie lo note: el `title` del navegador tapa el agujero
 * con el puntero y no existe para quien tabula.
 */
async function probarTooltip(page: Page, control: Locator): Promise<ResultadoTooltip> {
  const globo = page.locator('app-tooltip-panel[role="tooltip"]');
  await control.focus();
  let aparecioConFoco = true;
  try {
    await globo.first().waitFor({ state: 'visible', timeout: 1500 });
  } catch {
    aparecioConFoco = false;
  }

  let texto = '';
  let dentroDePantalla = true;
  if (aparecioConFoco) {
    // «Visible» para el navegador es «tiene caja», y el globo entra con una
    // animación de 150 ms desde `opacity: 0` (`tooltip-panel.css`). Medir sin
    // esperar daba por bueno un globo que todavía no se veía —y la foto de
    // evidencia salía sin él, que fue como se descubrió—. Se espera a que
    // termine de aparecer y se comprueba que de verdad esté pintado.
    await page.waitForTimeout(250);
    const opacidad = await globo
      .first()
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity));
    if (opacidad < 0.9) {
      aparecioConFoco = false;
    }
    texto = (await globo.first().innerText()).trim();
    const caja = await globo.first().boundingBox();
    const vista = page.viewportSize();
    if (caja && vista) {
      dentroDePantalla =
        caja.x >= -1 &&
        caja.y >= -1 &&
        caja.x + caja.width <= vista.width + 1 &&
        caja.y + caja.height <= vista.height + 1;
    }
  }

  await page.keyboard.press('Escape');
  const cierraConEscape = aparecioConFoco
    ? await globo
        .first()
        .waitFor({ state: 'hidden', timeout: 1500 })
        .then(() => true)
        .catch(() => false)
    : false;

  // Sacar el foco del control: si queda enfocado, el globo del siguiente
  // control se mezcla con éste y la medición deja de ser de uno solo.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  return { aparecioConFoco, texto, dentroDePantalla, cierraConEscape };
}

/**
 * Recorre las primeras paradas de tabulación y mira si el foco **se ve**.
 *
 * Dos decisiones, las dos por un falso rojo comprobado en el navegador:
 *
 * 1. **Se tabula de verdad**, no se llama a `focus()`. `:focus-visible` —de
 *    donde sale el anillo en este sistema— no se activa igual con foco
 *    programático, y comprobarlo así daría «sin anillo» en controles que con el
 *    teclado sí lo muestran.
 * 2. **Se compara enfocado contra sin enfocar, en el control y en sus tres
 *    ancestros.** Mirar sólo el `outline` del elemento enfocado marcaba
 *    `select#mch-field-1-control` como sin anillo: el anillo lo pinta
 *    `.select-wrapper` con `box-shadow: 0 0 0 4px var(--focus-ring)`
 *    (`atoms/select/select.css:104`), que es el padre. Y mirar si el ancestro
 *    «tiene sombra» sin comparar daría PASS a cualquier tarjeta con elevación
 *    propia. Lo que prueba que el foco se ve es que algo **cambie** al llegar.
 */
async function paradasSinAnillo(page: Page): Promise<string[]> {
  const MARCA = 'data-premium-foco';

  // La misma huella para las dos lecturas, definida una sola vez dentro del
  // navegador: dos copias de esta lista de propiedades compararían cosas
  // distintas y el resultado dependería de cuál se editó última.
  await page.evaluate(() => {
    const ventana = window as VentanaConHuella;
    ventana.__huellaDeFoco = (desde: Element): string => {
      const partes: string[] = [];
      let actual: Element | null = desde;
      for (let nivel = 0; nivel < 4 && actual; nivel += 1) {
        const s = getComputedStyle(actual);
        partes.push(
          `${s.outlineWidth}|${s.outlineStyle}|${s.outlineColor}|${s.boxShadow}|${s.borderColor}|${s.backgroundColor}`,
        );
        actual = actual.parentElement;
      }
      return partes.join(' // ');
    };
    (document.activeElement as HTMLElement | null)?.blur();
  });

  const paradas: { selector: string; enfocado: string }[] = [];
  for (let salto = 0; salto < PARADAS_DE_FOCO; salto += 1) {
    await page.keyboard.press('Tab');
    const parada = await page.evaluate((attr) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const ventana = window as VentanaConHuella;
      el.setAttribute(attr, String(document.querySelectorAll(`[${attr}]`).length));
      const prueba = el.getAttribute('data-testid');
      return {
        selector: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${prueba ? `[data-testid="${prueba}"]` : ''}`,
        enfocado: ventana.__huellaDeFoco?.(el) ?? '',
      };
    }, MARCA);
    if (parada) paradas.push(parada);
  }

  // Ahora sin foco: lo que no cambió, no se vio.
  //
  // El `blur` y la lectura van en llamadas separadas, con una pausa en medio,
  // **a propósito**. Varios controles del sistema no pintan el anillo con
  // `:focus-visible` sino con una clase que pone el componente al recibir el
  // foco (`.select-wrapper.is-focused`, `atoms/select/select.css:104`): quitarla
  // exige una vuelta de detección de cambios de Angular. Leyendo en el mismo
  // `evaluate` que el `blur`, la clase todavía estaba puesta, las dos huellas
  // salían iguales y el `<select>` aparecía como «sin anillo de foco» teniéndolo.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.waitForTimeout(150);

  const mudas = await page.evaluate(
    ({ attr, huellas }) => {
      const ventana = window as VentanaConHuella;
      const mudos: number[] = [];
      huellas.forEach((conFoco, indice) => {
        const el = document.querySelector(`[${attr}="${indice}"]`);
        if (el && ventana.__huellaDeFoco?.(el) === conFoco) mudos.push(indice);
      });
      for (const el of Array.from(document.querySelectorAll(`[${attr}]`))) {
        el.removeAttribute(attr);
      }
      return mudos;
    },
    { attr: MARCA, huellas: paradas.map((p) => p.enfocado) },
  );

  return mudas.map((i) => paradas[i]?.selector ?? '?');
}

function celda(ok: boolean, detalle = ''): string {
  return ok ? 'PASS' : `FAIL${detalle ? ` (${detalle})` : ''}`;
}

test.describe(`acabado premium · carril ${LANE} (${FASE})`, () => {
  test.skip(RUTAS.length === 0, 'El carril no declara rutas en corr-rutas.json');

  test('compuertas de acabado por ruta', async ({ browser }) => {
    test.setTimeout(40 * 60_000);
    mkdirSync(FOTOS, { recursive: true });
    const filas: string[] = [];
    const hallazgos: Hallazgo[] = [];
    let rojos = 0;

    // Tres contextos, no siete: el escritorio contesta las compuertas de
    // interacción, el teléfono las de tamaño, y «reducir movimiento» la suya.
    // Multiplicar viewports acá no descubre defectos nuevos, sólo tarda.
    const contextos = [
      { nombre: '1440', width: 1440, height: 900, motion: 'no-preference' as const },
      { nombre: '375', width: 375, height: 812, motion: 'no-preference' as const },
      { nombre: '1440-reduce', width: 1440, height: 900, motion: 'reduce' as const },
    ];

    for (const ctx of contextos) {
      const context = await browser.newContext({
        viewport: { width: ctx.width, height: ctx.height },
        reducedMotion: ctx.motion,
        colorScheme: 'light',
        locale: 'es-BO',
        timezoneId: 'America/La_Paz',
      });
      const page = await context.newPage();
      await entrarAlSimulador(page, USUARIO, BASE);

      for (const { ruta, nombre } of RUTAS) {
        await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' });
        await esperarAQueSeAsiente(page);
        const escaneo = await escanear(page);

        if (!escaneo.cargo) {
          filas.push(`| \`${ruta}\` | ${ctx.nombre} | SIN CARGAR | — | — | — | — | — | — |`);
          hallazgos.push({
            ruta,
            viewport: ctx.nombre,
            compuerta: 'carga',
            detalle: 'No se encontró `.app-main__inner`',
            selector: '.app-main__inner',
          });
          rojos += 1;
          continue;
        }

        // --- tamaño de área táctil y tipografía (todos los contextos) -----
        const chicos = escaneo.controles.filter(
          (c) => !c.enlaceDeTexto && (c.ancho < TARGET_MIN_PX || c.alto < TARGET_MIN_PX),
        );
        const incomodos = escaneo.controles.filter(
          (c) =>
            !chicos.includes(c) && (c.ancho < TARGET_COMODO_PX || c.alto < TARGET_COMODO_PX) && c.soloIcono,
        );
        for (const c of chicos) {
          hallazgos.push({
            ruta,
            viewport: ctx.nombre,
            compuerta: 'target-minimo',
            detalle: `${c.ancho}×${c.alto} px (mínimo ${TARGET_MIN_PX}) · «${c.nombre || 'sin nombre'}»`,
            selector: c.selector,
          });
        }
        for (const t of escaneo.textoChico) {
          hallazgos.push({
            ruta,
            viewport: ctx.nombre,
            compuerta: 'tipografia-minima',
            detalle: `${t.px} px (mínimo ${TIPOGRAFIA_MIN_PX})`,
            selector: t.selector,
          });
        }

        const target = celda(chicos.length === 0, `${chicos.length} control(es)`);
        const tipografia = celda(
          escaneo.textoChico.length === 0,
          `${escaneo.textoChico.length} texto(s)`,
        );

        if (ctx.motion === 'reduce') {
          const enMovimiento = await page.evaluate(
            (max) =>
              document
                .getAnimations()
                .filter((a) => {
                  const t = a.effect?.getTiming();
                  const dur = typeof t?.duration === 'number' ? t.duration : 0;
                  return a.playState === 'running' && dur > max;
                })
                .map((a) => (a.effect as KeyframeEffect | null)?.target?.tagName ?? '?'),
            MOTION_MAX_MS,
          );
          for (const quien of enMovimiento) {
            hallazgos.push({
              ruta,
              viewport: ctx.nombre,
              compuerta: 'motion-reducido',
              detalle: `animación > ${MOTION_MAX_MS} ms corriendo con reduced-motion`,
              selector: quien.toLowerCase(),
            });
          }
          const motion = celda(enMovimiento.length === 0, `${enMovimiento.length} animación(es)`);
          const fila = `| \`${ruta}\` | ${ctx.nombre} | — | — | — | — | ${target} | ${tipografia} | ${motion} | — |`;
          filas.push(fila);
          if (fila.includes('FAIL')) rojos += 1;
          await quitarMarcas(page);
          continue;
        }

        if (ctx.nombre === '375') {
          const fila = `| \`${ruta}\` | ${ctx.nombre} | — | — | — | — | ${target}${incomodos.length ? ` · ${incomodos.length} < ${TARGET_COMODO_PX}` : ''} | ${tipografia} | — | — |`;
          filas.push(fila);
          if (fila.includes('FAIL')) rojos += 1;
          await quitarMarcas(page);
          continue;
        }

        // --- nombre accesible, globos y foco (sólo 1440) ------------------
        const iconos = escaneo.controles.filter((c) => c.soloIcono);
        const sinNombre = iconos.filter((c) => c.nombre === '');
        const soloTitulo = iconos.filter((c) => c.fuenteDelNombre === 'solo-title');
        for (const c of [...sinNombre, ...soloTitulo]) {
          hallazgos.push({
            ruta,
            viewport: ctx.nombre,
            compuerta: 'nombre-accesible',
            detalle:
              c.nombre === ''
                ? 'ícono sin nombre accesible'
                : 'el nombre viene sólo de `title`: no es tooltip ni nombre fiable',
            selector: c.selector,
          });
        }

        let sinGlobo = 0;
        let recortados = 0;
        let sinEscape = 0;
        let fotoGlobo = '';
        for (const c of iconos.slice(0, ICONOS_POR_RUTA)) {
          const control = page.locator(`[data-premium-idx="${c.idx}"]`);
          if ((await control.count()) === 0) continue;
          const r = await probarTooltip(page, control);
          if (!r.aparecioConFoco || r.texto === '') {
            sinGlobo += 1;
            hallazgos.push({
              ruta,
              viewport: ctx.nombre,
              compuerta: 'tooltip',
              detalle: `el ícono «${c.nombre || 'sin nombre'}» no muestra globo al recibir foco`,
              selector: c.selector,
            });
            continue;
          }
          if (!r.dentroDePantalla) {
            recortados += 1;
            hallazgos.push({
              ruta,
              viewport: ctx.nombre,
              compuerta: 'tooltip-recortado',
              detalle: `el globo de «${c.nombre}» sale de la pantalla`,
              selector: c.selector,
            });
          }
          if (!r.cierraConEscape) {
            sinEscape += 1;
            hallazgos.push({
              ruta,
              viewport: ctx.nombre,
              compuerta: 'tooltip-escape',
              detalle: `el globo de «${c.nombre}» no se cierra con Escape`,
              selector: c.selector,
            });
          }
          if (fotoGlobo === '') {
            // Una foto por ruta, con el globo abierto: es la prueba de que el
            // PASS de esta fila corresponde a algo que se vio.
            await control.focus();
            await page.locator('app-tooltip-panel[role="tooltip"]').first().waitFor({
              state: 'visible',
              timeout: 1500,
            });
            // La misma espera que en la comprobación: sin ella la foto sale con
            // el globo a medio aparecer, o directamente sin él.
            await page.waitForTimeout(250);
            fotoGlobo = join(FOTOS, `${nombre}-tooltip.png`);
            await page.screenshot({ path: fotoGlobo });
            await page.keyboard.press('Escape');
            await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          }
        }

        if (fotoGlobo === '') {
          // Ninguna ruta se queda sin foto: si no hubo globo que fotografiar
          // —porque la pantalla no tiene íconos, o porque ninguno lo abre— la
          // evidencia es la pantalla misma. Una fila sin imagen es una fila que
          // nadie puede revisar.
          fotoGlobo = join(FOTOS, `${nombre}-1440.png`);
          await page.screenshot({ path: fotoGlobo });
        }

        const sinAnillo = await paradasSinAnillo(page);
        for (const selector of sinAnillo) {
          hallazgos.push({
            ruta,
            viewport: ctx.nombre,
            compuerta: 'foco-visible',
            detalle: 'parada de tabulación sin anillo de foco',
            selector,
          });
        }

        const probados = Math.min(iconos.length, ICONOS_POR_RUTA);
        const fila =
          `| \`${ruta}\` | ${ctx.nombre} ` +
          `| ${celda(sinNombre.length === 0 && soloTitulo.length === 0, `${sinNombre.length} sin nombre, ${soloTitulo.length} sólo title`)} ` +
          `| ${probados === 0 ? 'sin íconos' : celda(sinGlobo === 0 && sinEscape === 0, `${sinGlobo}/${probados} sin globo, ${sinEscape} sin Escape`)} ` +
          `| ${probados === 0 ? '—' : celda(recortados === 0, `${recortados} recortado(s)`)} ` +
          `| ${celda(sinAnillo.length === 0, `${sinAnillo.length} parada(s)`)} ` +
          `| ${target} | ${tipografia} | — | ${fotoGlobo ? `\`${fotoGlobo.replace(`${DESTINO}/`, '')}\`` : '—'} |`;
        filas.push(fila);
        if (fila.includes('FAIL')) rojos += 1;
        await quitarMarcas(page);
      }

      await context.close();
    }

    mkdirSync(DESTINO, { recursive: true });
    const matriz = [
      `# MATRIZ de acabado premium — carril ${LANE} — ${FASE} — ${new Date().toISOString()}`,
      '',
      `Celdas: ${filas.length} · en rojo: ${rojos} · hallazgos: ${hallazgos.length}`,
      '',
      'Lo que esta matriz **no** dice: si la pantalla está bien compuesta, si la',
      'jerarquía se lee o si el conjunto se siente terminado. Eso se mira en las',
      'fotos. Acá sólo está lo que se puede medir sin opinar.',
      '',
      `| Ruta | Viewport | Nombre accesible | Globo (foco+Escape) | Globo sin recorte | Foco visible | Target ≥${TARGET_MIN_PX} px | Texto ≥${TIPOGRAFIA_MIN_PX} px | Reduced motion | Foto |`,
      '|---|---|---|---|---|---|---|---|---|---|',
      ...filas,
      '',
      '## Hallazgos',
      hallazgos.length === 0
        ? '- ninguno'
        : hallazgos
            .map(
              (h) =>
                `- \`${h.ruta}\` @ ${h.viewport} · **${h.compuerta}** · ${h.detalle} · \`${h.selector}\``,
            )
            .join('\n'),
    ].join('\n');
    writeFileSync(
      join(DESTINO, `MATRIZ-premium${FASE === 'antes' ? '-antes' : ''}.md`),
      matriz,
      'utf8',
    );
    // El JSON es para arreglar, no para leer: cada hallazgo trae ruta, compuerta
    // y selector, que es lo que hace falta para ir al componente correcto.
    writeFileSync(
      join(DESTINO, `premium-hallazgos${FASE === 'antes' ? '-antes' : ''}.json`),
      `${JSON.stringify(hallazgos, null, 2)}\n`,
      'utf8',
    );

    if (FASE === 'despues') {
      const enRojo = filas.filter((f) => f.includes('FAIL') || f.includes('SIN CARGAR'));
      expect(enRojo, `Filas en rojo:\n${enRojo.join('\n')}`).toEqual([]);
    }
  });
});
