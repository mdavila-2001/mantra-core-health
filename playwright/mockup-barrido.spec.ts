import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { catalogoDeRutas, tieneContenido, vigilar, type RutaDelCatalogo } from './support/salud-de-rutas';
import { entrar, estable, irA } from './support/sesion';

/**
 * Barrido de la rama `mockup`: cada ruta declarada, con cada cuenta de prueba,
 * contra el backend simulado.
 *
 * Además de lo que mide el carril 19 (navega, pinta, sin errores), acá se
 * anota cada petición que el simulador **no supo contestar** — el interceptor
 * la deja en consola como `[mock] sin manejador` — porque ese es exactamente
 * el inventario de lo que falta cubrir para que la rama sirva para probar todo.
 *
 * No necesita API ni variables de entorno: las cuentas viven en el propio
 * front (`src/app/core/mock/mock-session.ts`) y cualquier contraseña vale.
 */

const SALIDA = join('artifacts', 'playwright', 'mockup');

interface Fila {
  readonly cuenta: string;
  readonly ruta: string;
  readonly componente: string;
  readonly estado: string;
  readonly detalle: string;
  readonly sinManejador: readonly string[];
}

const CUENTAS: readonly Actor[] = [
  { rol: 'doctora', identificador: 'medica@alovida.mock', clave: 'mock', nombre: 'Médica' },
  { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mock', nombre: 'Paciente' },
  { rol: 'administrador', identificador: 'admin@alovida.mock', clave: 'mock', nombre: 'Admin' },
  { rol: 'administrador', identificador: 'superadmin@alovida.mock', clave: 'mock', nombre: 'Superadmin' },
  { rol: 'operadora de facturación', identificador: 'visitador@alovida.mock', clave: 'mock', nombre: 'Visitador' },
];

const filas: Fila[] = [];

/** El mismo generador de identificadores de `src/app/core/mock/mock-store.ts`. */
function uuid(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n: number): string => n.toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

/**
 * Las pantallas de detalle, que el catálogo marca como parametrizadas y el
 * barrido general saltea. Se abren con identificadores reales de los fixtures,
 * así que acá sí se mide que la ficha pinte con datos y no cómo reacciona a un
 * 404.
 */
const DETALLES: Readonly<Record<string, readonly { ruta: string; componente: string }[]>> = {
  Médica: [
    { ruta: `/medical-records/${uuid('pid-paciente')}`, componente: 'PatientChart' },
    { ruta: `/my-account/identity/cases/${uuid('case-medica-identidad')}`, componente: 'VerificationCaseDetail' },
    { ruta: `/glossary/${uuid('concept-SX-FIEBRE')}`, componente: 'GlossaryTerm' },
    { ruta: `/laboratory-directory/${uuid('unit-lab-central')}`, componente: 'LaboratoryDetail' },
  ],
  Paciente: [
    { ruta: `/directory/${uuid('hpid-medica')}`, componente: 'PractitionerDetail' },
    { ruta: `/my-account/identity/cases/${uuid('case-paciente-identidad')}`, componente: 'VerificationCaseDetail' },
    { ruta: `/glossary/${uuid('concept-SX-FIEBRE')}`, componente: 'GlossaryTerm' },
    { ruta: `/laboratory-directory/${uuid('unit-lab-central')}`, componente: 'LaboratoryDetail' },
  ],
  Admin: [
    { ruta: `/administration/organizations/${uuid('tenant-clinica-los-olivos')}`, componente: 'OrganizationDetail' },
    { ruta: `/administration/patients/${uuid('pid-paciente')}`, componente: 'PatientDetail' },
    { ruta: `/administration/geolocation/subjects/last-position/${uuid('tracked-subject-demo')}`, componente: 'LastPosition' },
  ],
  Superadmin: [
    { ruta: `/administration/organizations/${uuid('tenant-clinica-los-olivos')}`, componente: 'OrganizationDetail' },
    { ruta: `/medical-records/${uuid('pid-paciente')}`, componente: 'PatientChart' },
  ],
  Visitador: [],
};

async function rolesDeLaSesion(page: Page): Promise<string[]> {
  await irA(page, '/dashboard');
  await estable(page);
  return page
    .getByTestId('panel-roles')
    .locator('app-badge')
    .evaluateAll((insignias) => insignias.map((i) => i.getAttribute('data-role') ?? '').filter((c) => c !== ''));
}

function puedeVer(entrada: RutaDelCatalogo, roles: readonly string[]): boolean {
  const exigidos = entrada.roles ?? [];
  if (entrada.rolesExclusivos === true) return exigidos.some((rol) => roles.includes(rol));
  if (roles.includes('SUPERADMIN')) return true;
  return exigidos.length === 0 || exigidos.some((rol) => roles.includes(rol));
}

async function barrer(page: Page, cuenta: Actor): Promise<void> {
  const sinManejador = new Set<string>();
  page.on('console', (mensaje) => {
    const texto = mensaje.text();
    const m = /\[mock\] sin manejador para (\S+ \S+)/.exec(texto);
    if (m !== null) sinManejador.add(m[1]!);
  });

  const vigilante = vigilar(page);
  await entrar(page, cuenta);
  const roles = await rolesDeLaSesion(page);
  const catalogo = catalogoDeRutas();
  const navegables: readonly RutaDelCatalogo[] = [
    ...[...catalogo.secciones, ...catalogo.hijas].filter((r) => !r.parametrizada && puedeVer(r, roles)),
    ...(DETALLES[cuenta.nombre] ?? []).map((d) => ({ ...d, estado: 'detalle', parametrizada: true })),
  ];

  for (const entrada of navegables) {
    vigilante.limpiar();
    sinManejador.clear();
    await irA(page, entrada.ruta);
    await estable(page);
    const destino = new URL(page.url()).pathname;
    let estado = 'ok';
    let detalle = '';
    if (destino !== entrada.ruta) {
      // Rebotar al panel es el guard de roles haciendo su trabajo: la rama
      // clona los guards de `dev`, así que se anota y no se cuenta como fallo.
      estado = destino === '/dashboard' ? 'denegada' : 'no navega';
      detalle = `terminó en ${destino}`;
    } else if (!(await tieneContenido(page))) {
      estado = 'vacía';
    } else if (vigilante.erroresDeConsola.length > 0) {
      estado = 'error de consola';
      detalle = vigilante.erroresDeConsola[0]!;
    } else if (vigilante.peticionesFallidas.length > 0) {
      estado = 'error de API';
      detalle = [...new Set(vigilante.peticionesFallidas)].join(' · ');
    }
    filas.push({ cuenta: cuenta.nombre, ruta: entrada.ruta, componente: entrada.componente, estado, detalle, sinManejador: [...sinManejador] });
  }

  // Un parcial por cuenta, en disco: Playwright reinicia el trabajador cuando
  // una prueba falla y con eso se pierde lo que había en memoria.
  mkdirSync(join(SALIDA, 'parciales'), { recursive: true });
  writeFileSync(join(SALIDA, 'parciales', `${cuenta.nombre}.json`), JSON.stringify(filas.filter((f) => f.cuenta === cuenta.nombre), null, 2), 'utf8');
}

function leerParciales(): Fila[] {
  const carpeta = join(SALIDA, 'parciales');
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta)
    .filter((n) => n.endsWith('.json'))
    .flatMap((n) => JSON.parse(readFileSync(join(carpeta, n), 'utf8')) as Fila[]);
}

test.describe('mockup · barrido con el backend simulado', () => {
  test.describe.configure({ timeout: 30 * 60_000 });


  for (const cuenta of CUENTAS) {
    test(cuenta.nombre, async ({ page }) => {
      await barrer(page, cuenta);
      const rotas = filas.filter((f) => f.cuenta === cuenta.nombre && f.estado !== 'ok' && f.estado !== 'denegada');
      expect.soft(rotas.map((f) => `${f.ruta} → ${f.estado} ${f.detalle}`)).toEqual([]);
    });
  }

  test.afterAll(() => {
    mkdirSync(SALIDA, { recursive: true });
    const filas = leerParciales();
    const faltantes = new Map<string, Set<string>>();
    for (const f of filas) for (const p of f.sinManejador) faltantes.set(p, (faltantes.get(p) ?? new Set()).add(f.ruta));
    const lineas = [
      '# Barrido de la rama mockup',
      '',
      `Rutas medidas: ${filas.length} · con problema: ${filas.filter((f) => f.estado !== 'ok' && f.estado !== 'denegada').length} · denegadas por rol: ${filas.filter((f) => f.estado === 'denegada').length} · peticiones sin manejador: ${faltantes.size}`,
      '',
      '| Cuenta | Ruta | Componente | Estado | Detalle |',
      '|---|---|---|---|---|',
      ...filas.map((f) => `| ${f.cuenta} | ${f.ruta} | ${f.componente} | ${f.estado} | ${f.detalle.replace(/\|/g, '/')} |`),
      '',
      '## Peticiones sin manejador',
      '',
      ...[...faltantes.entries()].sort().map(([p, rutas]) => `- \`${p}\` ← ${[...rutas].join(', ')}`),
      '',
    ];
    writeFileSync(join(SALIDA, 'MOCKUP_MATRIX.md'), lineas.join('\n'), 'utf8');
    writeFileSync(join(SALIDA, 'filas.json'), JSON.stringify(filas, null, 2), 'utf8');
  });
});
