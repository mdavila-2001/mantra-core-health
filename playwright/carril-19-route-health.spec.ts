import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import {
  administrador,
  apiViva,
  contextoDeApi,
  crearPaciente,
  doctora,
  type Actor,
} from './support/actores';
import {
  catalogoDeRutas,
  tieneContenido,
  vigilar,
  type EstadoDeRuta,
  type ResultadoDeRuta,
  type RutaDelCatalogo,
} from './support/salud-de-rutas';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 19 — barrido de todas las rutas declaradas, por rol.
 *
 * Produce `ROUTE_HEALTH_MATRIX.md`: qué pinta cada ruta para cada quien, y por
 * qué no pinta cuando no pinta. Es lo que el carril pide como salida, y lo que
 * convierte «hay pestañas rotas» en una lista con nombre y apellido.
 *
 * ## Qué NO hace
 *
 * No arregla dominios. Un módulo incompleto sale reportado como tal; taparlo
 * con datos de ejemplo sería exactamente el defecto que este carril persigue.
 *
 * ## Rutas con parámetro
 *
 * Se saltean. Abrirlas con un identificador inventado mide cómo se comporta la
 * pantalla ante un 404 del backend —que es una prueba legítima, pero otra— y no
 * si la ruta existe y pinta.
 */

const SALIDA = 'ROUTE_HEALTH_MATRIX.md';

/**
 * Dónde se van dejando los parciales de cada actor.
 *
 * **Uno por actor, en disco, y no un array del módulo.** Playwright reinicia el
 * proceso trabajador cuando una prueba falla, y con un acumulador en memoria eso
 * borra en silencio lo que ya se había medido: una corrida donde falló el
 * administrador escribió una matriz con 126 filas en vez de 405, y la matriz no
 * decía que faltaba nada. Un informe que se calla lo que perdió es peor que no
 * tener informe.
 */
const PARCIALES = join('artifacts', 'playwright', 'rutas');

/**
 * Lo que **el actor en curso** fue midiendo, en el orden en que se midió.
 *
 * Se vacía al empezar cada actor: sin eso, el parcial de la doctora contendría
 * también las filas del paciente —el módulo es uno solo por proceso
 * trabajador— y la matriz saldría con todo duplicado.
 */
let resultados: ResultadoDeRuta[] = [];

/**
 * Abre una ruta y la clasifica.
 *
 * El orden de las comprobaciones importa y es de más grave a menos: una ruta
 * que ni siquiera navega no tiene sentido evaluarla por su contenido.
 */
async function medir(
  page: Page,
  vigilante: ReturnType<typeof vigilar>,
  actor: Actor,
  entrada: RutaDelCatalogo,
  puedeVerla: boolean,
): Promise<void> {
  vigilante.limpiar();
  await irA(page, entrada.ruta);
  await estable(page);

  const destino = new URL(page.url()).pathname;
  let estado: EstadoDeRuta;
  let detalle = '';

  if (destino !== entrada.ruta) {
    // Rebotar **es lo correcto** cuando el rol no alcanza: es `seccionRolesGuard`
    // haciendo su trabajo, no una ruta rota. Se distinguen para que la matriz no
    // pinte de rojo la seguridad que el carril 02 acaba de poner.
    estado = puedeVerla ? 'no navega' : 'denegada';
    detalle = `terminó en ${destino}`;
  } else if (!(await tieneContenido(page))) {
    estado = 'vacía';
    detalle = 'la región principal no pintó nada';
  } else if (vigilante.erroresDeConsola.length > 0) {
    estado = 'error de consola';
    detalle = vigilante.erroresDeConsola[0];
  } else if (vigilante.peticionesFallidas.length > 0) {
    estado = 'error de API';
    detalle = [...new Set(vigilante.peticionesFallidas)].join(' · ');
  } else {
    estado = 'ok';
  }

  resultados.push({
    ruta: entrada.ruta,
    rol: actor.rol,
    componente: entrada.componente,
    estado,
    detalle,
  });
}

/**
 * Los roles de la sesión, leídos del panel.
 *
 * Salen del propio token y el panel ya los muestra, así que no cuesta ni una
 * petición más — y sobre todo no cuesta un ingreso más, que es el recurso
 * escaso acá (diez por minuto y por IP).
 */
async function rolesDeLaSesion(page: Page): Promise<string[]> {
  await irA(page, '/dashboard');
  await estable(page);
  return page
    .getByTestId('panel-roles')
    .locator('app-badge')
    .allInnerTexts()
    .then((textos) => textos.map((t) => t.trim()).filter(Boolean));
}

/** La misma regla que el menú y el guard: roles declarados, comodín y exclusión. */
function puedeVer(entrada: RutaDelCatalogo, roles: readonly string[]): boolean {
  const exigidos = entrada.roles ?? [];
  if (entrada.rolesExclusivos === true) {
    return exigidos.some((rol) => roles.includes(rol));
  }
  if (roles.includes('SUPERADMIN')) return true;
  return exigidos.length === 0 || exigidos.some((rol) => roles.includes(rol));
}

/** Recorre secciones e hijas con la sesión de un actor. */
async function barrer(page: Page, actor: Actor): Promise<void> {
  resultados = [];
  const vigilante = vigilar(page);
  await entrar(page, actor);
  const roles = await rolesDeLaSesion(page);

  const catalogo = catalogoDeRutas();
  const navegables = [...catalogo.secciones, ...catalogo.hijas].filter((r) => !r.parametrizada);

  for (const entrada of navegables) {
    // Las hijas no declaran roles propios: se les atribuyen los de su sección
    // sólo cuando el catálogo los trae, y si no, se asume que se pueden abrir.
    await medir(page, vigilante, actor, entrada, puedeVer(entrada, roles));
  }

  guardarParcial(actor.rol);
}

/**
 * Deja en disco lo que este actor midió.
 *
 * Se escribe al terminar cada actor y no al final de todo: si el proceso se
 * reinicia o la corrida se corta, lo ya medido sobrevive y la matriz se arma
 * igual con lo que haya.
 */
function guardarParcial(rol: string): void {
  mkdirSync(PARCIALES, { recursive: true });
  const archivo = join(PARCIALES, `${rol.replace(/[^a-z]/gi, '-')}.json`);
  writeFileSync(archivo, `${JSON.stringify(resultados, null, 2)}\n`, 'utf8');
}

/** Todo lo medido por todos los actores, venga del proceso que venga. */
function leerParciales(): ResultadoDeRuta[] {
  if (!existsSync(PARCIALES)) return [];

  return readdirSync(PARCIALES)
    .filter((n) => n.endsWith('.json'))
    .flatMap((n) => JSON.parse(readFileSync(join(PARCIALES, n), 'utf8')) as ResultadoDeRuta[]);
}

test.describe('Carril 19 · salud de todas las rutas', () => {
  // El barrido abre más de doscientas rutas por rol. El techo por prueba tiene
  // que dar para eso sin que una pantalla lenta invente un fallo.
  test.describe.configure({ timeout: 30 * 60_000 });

  test.beforeAll(async () => {
    const api = await contextoDeApi();
    expect(await apiViva(api), 'la API tiene que estar viva para el barrido').toBe(true);
    await api.dispose();

    // Los parciales de la corrida anterior se borran acá y no al final: si una
    // corrida se corta, lo medido queda para inspeccionarlo, y la siguiente
    // empieza limpia igual. Mezclarlos daría una matriz que describe dos
    // estados del código a la vez.
    rmSync(PARCIALES, { recursive: true, force: true });
  });

  test('paciente', async ({ page }) => {
    const api = await contextoDeApi();
    const paciente = await crearPaciente(api);
    await api.dispose();

    await barrer(page, paciente);
  });

  test('doctora', async ({ page }) => {
    await barrer(page, doctora());
  });

  test('administrador', async ({ page }) => {
    await barrer(page, administrador());
  });

  test('vistas portadas de la bóveda, sin sesión', async ({ page }) => {
    // Van sin sesión porque **no tienen guard**: es parte del hallazgo del
    // carril 01, y hay que medirlas como se alcanzan de verdad.
    resultados = [];
    const vigilante = vigilar(page);
    const portadas = catalogoDeRutas().portadas.filter((r) => !r.parametrizada);
    const sinSesion: Actor = {
      rol: 'paciente',
      identificador: '—',
      clave: '—',
      nombre: 'sin sesión',
    };

    await page.goto('/inicio');
    await estable(page);

    for (const entrada of portadas) {
      await medir(page, vigilante, { ...sinSesion, rol: 'sin sesión' as Actor['rol'] }, entrada, true);
    }

    guardarParcial('sin-sesion');
  });

  test.afterAll(() => {
    escribirMatriz();
  });
});

/* ── el informe ──────────────────────────────────────────────────────────── */

const ORDEN: readonly EstadoDeRuta[] = [
  'error de consola',
  'error de API',
  'vacía',
  'no navega',
  'denegada',
  'ok',
];

function escribirMatriz(): void {
  // De disco y no de memoria: ver {@link PARCIALES}. Así la matriz incluye a
  // los actores que midió otro proceso trabajador.
  const medidos = leerParciales();
  if (medidos.length === 0) return;

  const recuento = new Map<EstadoDeRuta, number>();
  for (const r of medidos) {
    recuento.set(r.estado, (recuento.get(r.estado) ?? 0) + 1);
  }

  const problemas = medidos.filter((r) => r.estado !== 'ok' && r.estado !== 'denegada');

  const lineas: string[] = [];
  lineas.push('# Matriz de salud de rutas — carril 19');
  lineas.push('');
  lineas.push(
    '> **Generado** por `playwright/carril-19-route-health.spec.ts` sobre Chromium, ' +
      'contra la API viva. Se regenera con `yarn pw:rutas`. No editar a mano.',
  );
  lineas.push('');
  lineas.push(`${medidos.length} aperturas de ruta, sobre las rutas declaradas por el router.`);
  lineas.push('');

  lineas.push('## Qué significa cada estado');
  lineas.push('');
  lineas.push('| Estado | Qué se vio |');
  lineas.push('|---|---|');
  lineas.push('| `ok` | Navegó, pintó contenido, sin errores de consola ni respuestas de fallo. |');
  lineas.push('| `denegada` | Rebotó **y el rol no alcanzaba**: es el guard funcionando, no un defecto. |');
  lineas.push('| `no navega` | Rebotó aunque el rol alcanzaba. Menú y guard desacordados. |');
  lineas.push('| `vacía` | Llegó y la región principal no pintó nada. |');
  lineas.push('| `error de consola` | Excepción sin capturar o error de la aplicación. |');
  lineas.push('| `error de API` | 5xx, o un 4xx que no es de autorización ni de «no existe». |');
  lineas.push('');

  lineas.push('## Recuento');
  lineas.push('');
  lineas.push('| Estado | Aperturas |');
  lineas.push('|---|---|');
  for (const estado of ORDEN) {
    const total = recuento.get(estado);
    if (total !== undefined) lineas.push(`| \`${estado}\` | ${total} |`);
  }
  lineas.push('');

  lineas.push('## Hallazgos');
  lineas.push('');
  if (problemas.length === 0) {
    lineas.push('Ninguno: toda ruta alcanzable pintó contenido sin errores.');
  } else {
    lineas.push('| Rol | Ruta | Componente | Estado | Detalle |');
    lineas.push('|---|---|---|---|---|');
    for (const r of problemas) {
      lineas.push(
        `| ${r.rol} | \`${r.ruta}\` | \`${r.componente}\` | ${r.estado} | ${r.detalle.replace(/\|/g, '\\|')} |`,
      );
    }
  }
  lineas.push('');

  lineas.push('## Matriz completa');
  lineas.push('');
  lineas.push('| Rol | Ruta | Componente | Estado |');
  lineas.push('|---|---|---|---|');
  for (const r of medidos) {
    lineas.push(`| ${r.rol} | \`${r.ruta}\` | \`${r.componente}\` | ${r.estado} |`);
  }
  lineas.push('');

  mkdirSync(join('artifacts', 'playwright'), { recursive: true });
  writeFileSync(SALIDA, `${lineas.join('\n')}\n`, 'utf8');
}
