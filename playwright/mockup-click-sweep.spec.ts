import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { catalogoDeRutas, tieneContenido, vigilar, type RutaDelCatalogo } from './support/salud-de-rutas';
import { entrar, estable, irA } from './support/sesion';

/**
 * Barrido de clics de la rama `mockup`: en cada ruta, con cada cuenta, se
 * pulsa cada botón distinto de `<main>` y se anota qué pasó.
 *
 * `mockup-barrido` responde «¿la pantalla pinta?»; éste responde «¿lo que
 * hay para pulsar se puede pulsar sin que nada reviente?». No llena
 * formularios —eso lo prueba cada flujo a mano—: mide excepciones sin
 * capturar, errores de consola y peticiones que el simulador no supo
 * contestar (`[mock] sin manejador`), atribuidos al botón que los produjo.
 *
 * Un diálogo que se abre se cierra con Escape; una navegación se deshace
 * volviendo a la ruta. Se saltan los botones que cierran sesión o exportan
 * archivos, porque su efecto no es un estado de pantalla que se pueda medir.
 *
 * ```bash
 * yarn start &
 * E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/mockup-click-sweep.spec.ts --workers=1
 * # → artifacts/playwright/mockup/MOCKUP_CLICKS.md
 * ```
 */

const SALIDA = join('artifacts', 'playwright', 'mockup');
const MAX_BOTONES_POR_RUTA = 14;
// «Empezar/Continuar/Repetir: <título>» (único en tutorials-center.html) arranca
// un recorrido guiado: un organismo montado fuera del router-outlet, que sigue
// tapando la pantalla al navegar y sólo se cierra confirmando en su propio globo
// (`Dejar el tutorial», por diseño — mismo patrón de descarte-con-confirmación
// que el resto del repo). El «Escape»×3 genérico de `cerrarLoQueSeAbrio` no basta
// para eso: HALL-M6 (91 botones «rotos» sólo en Médica) era este único tour,
// trabado desde `/tutorials`, tapando cada ruta siguiente del barrido.
const SALTAR = /cerrar sesión|salir de la cuenta|exportar|descargar|imprimir|^(empezar|continuar|repetir):/i;

interface Clic {
  readonly cuenta: string;
  readonly ruta: string;
  readonly boton: string;
  readonly resultado: string;
  readonly detalle: string;
}

const CUENTAS: readonly Actor[] = [
  { rol: 'doctora', identificador: 'medica@alovida.mock', clave: 'mock', nombre: 'Médica' },
  { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mock', nombre: 'Paciente' },
  { rol: 'administrador', identificador: 'admin@alovida.mock', clave: 'mock', nombre: 'Admin' },
  { rol: 'operadora de facturación', identificador: 'visitador@alovida.mock', clave: 'mock', nombre: 'Visitador' },
];

const clics: Clic[] = [];

async function rolesDeLaSesion(page: Page): Promise<string[]> {
  await irA(page, '/dashboard');
  await estable(page);
  return page
    .getByTestId('panel-roles')
    .locator('app-badge')
    .evaluateAll((insignias) =>
      insignias.map((i) => i.getAttribute('data-role') ?? '').filter((c) => c !== ''),
    );
}

function puedeVer(entrada: RutaDelCatalogo, roles: readonly string[]): boolean {
  const exigidos = entrada.roles ?? [];
  if (entrada.rolesExclusivos === true) return exigidos.some((rol) => roles.includes(rol));
  if (roles.includes('SUPERADMIN')) return true;
  return exigidos.length === 0 || exigidos.some((rol) => roles.includes(rol));
}

const BOTONES_HABILITADOS = 'main button:not([disabled]):not([aria-disabled="true"])';
const CAPAS_ABIERTAS = 'dialog[open], [role="dialog"]:visible, [role="menu"]:visible';

/**
 * El rótulo de cada botón habilitado de `<main>`, en orden del DOM; `''` para
 * los que no se ven. Es la única función que nombra botones: listar y pulsar
 * usan la misma, así el índice que se lista es el índice que se pulsa.
 */
async function rotulosDe(page: Page): Promise<string[]> {
  return page.locator(BOTONES_HABILITADOS).evaluateAll((botones) =>
    botones.map((b) =>
      (b as HTMLElement).offsetParent === null
        ? ''
        : (b.getAttribute('aria-label') || (b as HTMLElement).innerText || '')
            .trim()
            .replace(/\s+/g, ' '),
    ),
  );
}

/** Los rótulos distintos que vale la pena pulsar en la pantalla actual. */
async function botonesDe(page: Page): Promise<string[]> {
  const rotulos = await rotulosDe(page);
  return [...new Set(rotulos.filter((r) => r !== '' && !SALTAR.test(r)))].slice(
    0,
    MAX_BOTONES_POR_RUTA,
  );
}

async function cerrarLoQueSeAbrio(page: Page): Promise<boolean> {
  if ((await page.locator(CAPAS_ABIERTAS).count()) === 0) return false;
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    if ((await page.locator(CAPAS_ABIERTAS).count()) === 0) break;
  }
  return true;
}

async function pulsar(page: Page, ruta: string, rotulo: string): Promise<[string, string]> {
  // Se relista justo antes de pulsar: el DOM cambia con cada clic anterior y
  // el índice de la primera lista ya puede no valer. Por índice y no por
  // `getByRole('button')`, que deja afuera a las pestañas (`role="tab"`).
  const indice = (await rotulosDe(page)).indexOf(rotulo);
  if (indice < 0) return ['desapareció', ''];
  await page.locator(BOTONES_HABILITADOS).nth(indice).click({ timeout: 4_000 });
  await page.waitForTimeout(450);
  let detalle = (await cerrarLoQueSeAbrio(page)) ? 'abrió un diálogo' : '';
  const destino = new URL(page.url()).pathname;
  if (destino !== ruta) {
    detalle = `navegó a ${destino}`;
    await irA(page, ruta);
    await estable(page);
  }
  return ['ok', detalle];
}

async function barrer(page: Page, cuenta: Actor): Promise<void> {
  const sinManejador: string[] = [];
  page.on('console', (mensaje) => {
    const m = /\[mock\] sin manejador para (\S+ \S+)/.exec(mensaje.text());
    if (m !== null) sinManejador.push(m[1]!);
  });
  const vigilante = vigilar(page);
  await entrar(page, cuenta);
  const roles = await rolesDeLaSesion(page);
  const catalogo = catalogoDeRutas();
  const rutas = [...catalogo.secciones, ...catalogo.hijas].filter(
    (r) => !r.parametrizada && puedeVer(r, roles),
  );

  for (const entrada of rutas) {
    await irA(page, entrada.ruta);
    await estable(page);
    // Denegada por rol: la mide el barrido de rutas, acá no hay nada que pulsar.
    if (new URL(page.url()).pathname !== entrada.ruta) continue;
    // `estable` vuelve antes de que el chunk perezoso pinte: sin esto se
    // listaban botones sobre pantallas todavía vacías.
    await tieneContenido(page);
    await page.waitForTimeout(400);
    for (const rotulo of await botonesDe(page)) {
      vigilante.limpiar();
      sinManejador.length = 0;
      let resultado: string;
      let detalle: string;
      try {
        [resultado, detalle] = await pulsar(page, entrada.ruta, rotulo);
      } catch (error) {
        resultado = 'no se pudo pulsar';
        detalle = String((error as Error).message).split('\n')[0]!.slice(0, 120);
      }
      const excepcion = vigilante.erroresDeConsola.find((e) => e.startsWith('excepción sin capturar'));
      if (excepcion !== undefined) {
        [resultado, detalle] = ['excepción', excepcion];
      } else if (vigilante.erroresDeConsola.length > 0) {
        [resultado, detalle] = ['error de consola', vigilante.erroresDeConsola[0]!];
      } else if (vigilante.peticionesFallidas.length > 0) {
        [resultado, detalle] = ['error de API', [...new Set(vigilante.peticionesFallidas)].join(' · ')];
      } else if (sinManejador.length > 0) {
        [resultado, detalle] = ['sin manejador', [...new Set(sinManejador)].join(' · ')];
      }
      clics.push({ cuenta: cuenta.nombre, ruta: entrada.ruta, boton: rotulo, resultado, detalle });
    }
  }
  mkdirSync(join(SALIDA, 'clics'), { recursive: true });
  writeFileSync(
    join(SALIDA, 'clics', `${cuenta.nombre}.json`),
    JSON.stringify(clics.filter((c) => c.cuenta === cuenta.nombre), null, 2),
    'utf8',
  );
}

const esProblema = (c: Clic): boolean => c.resultado !== 'ok' && c.resultado !== 'desapareció';

test.describe('mockup · barrido de clics con el backend simulado', () => {
  test.describe.configure({ timeout: 40 * 60_000 });

  for (const cuenta of CUENTAS) {
    test(cuenta.nombre, async ({ page }) => {
      await barrer(page, cuenta);
      const rotos = clics.filter((c) => c.cuenta === cuenta.nombre && esProblema(c));
      expect
        .soft(rotos.map((c) => `${c.ruta} · «${c.boton}» → ${c.resultado} ${c.detalle}`))
        .toEqual([]);
    });
  }

  test.afterAll(() => {
    mkdirSync(SALIDA, { recursive: true });
    // Se leen los parciales de disco y no la memoria: cada cuenta puede
    // correrse sola (`-g Admin`) y el resumen tiene que sumar las corridas.
    const carpeta = join(SALIDA, 'clics');
    const todos: Clic[] = existsSync(carpeta)
      ? readdirSync(carpeta)
          .filter((n) => n.endsWith('.json'))
          .flatMap((n) => JSON.parse(readFileSync(join(carpeta, n), 'utf8')) as Clic[])
      : clics;
    const rotos = todos.filter(esProblema);
    const lineas = [
      '# Barrido de clics de la rama mockup',
      '',
      `Botones pulsados: ${todos.length} · con problema: ${rotos.length}`,
      '',
      '| Cuenta | Ruta | Botón | Resultado | Detalle |',
      '|---|---|---|---|---|',
      ...rotos.map(
        (c) => `| ${c.cuenta} | ${c.ruta} | ${c.boton} | ${c.resultado} | ${c.detalle.replace(/\|/g, '/')} |`,
      ),
      '',
    ];
    writeFileSync(join(SALIDA, 'MOCKUP_CLICKS.md'), lineas.join('\n'), 'utf8');
  });
});
