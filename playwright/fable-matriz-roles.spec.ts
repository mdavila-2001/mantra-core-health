import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { catalogoDeRutas, tieneContenido, vigilar } from './support/salud-de-rutas';
import { entrar, estable, irA } from './support/sesion';

/**
 * Matriz de regresión por rol.
 *
 * La matriz global mide con una cuenta y responde «¿la pantalla pinta?». Ésta
 * responde la que importa después: **¿cada rol llega a lo suyo, y sólo a lo
 * suyo?**
 *
 * La distinción que hace útil el resultado: un redirect **no es un defecto** si
 * el rol no tiene el permiso — es el guardia funcionando. Sólo es defecto
 * cuando el rol SÍ figura entre los habilitados y aun así no entra. Sin esa
 * clasificación la matriz marcaría cientos de falsos positivos y no serviría.
 *
 * Roles copiados de `src/app/core/mock/mock-session.ts`.
 */

const SALIDA = join('docs', 'frontend', 'evidence', 'roles');

const VIEWPORTS = [
  { nombre: '390x844', width: 390, height: 844 },
  { nombre: '1440x900', width: 1440, height: 900 },
] as const;

interface Cuenta {
  readonly actor: Actor;
  readonly roles: readonly string[];
}

const CUENTAS: readonly Cuenta[] = [
  {
    actor: { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mock', nombre: 'Paciente' },
    roles: ['PATIENT'],
  },
  {
    actor: { rol: 'doctora', identificador: 'medica@alovida.mock', clave: 'mock', nombre: 'Médica' },
    roles: ['PRACTITIONER', 'CLINICIAN', 'SCHEDULING_ADMIN'],
  },
  {
    actor: { rol: 'administrador', identificador: 'admin@alovida.mock', clave: 'mock', nombre: 'Admin' },
    roles: [
      'SECURITY_ADMIN', 'SCHEDULING_ADMIN', 'IDENTITY_ADMIN', 'PLATFORM_ADMIN',
      'BUSINESS_ADMIN', 'PAYMENTS_ADMIN', 'PHARMA_LAB_ADMIN', 'ACCOUNTING_APPROVER',
      'BILLING', 'BILLING_OPERATOR', 'FINANCE', 'CASHIER', 'PERIOP_ADMIN',
      'CLINICAL_INFORMATICIAN',
    ],
  },
  {
    actor: { rol: 'administrador', identificador: 'superadmin@alovida.mock', clave: 'mock', nombre: 'Superadmin' },
    roles: ['SUPERADMIN', 'SECURITY_ADMIN', 'PLATFORM_ADMIN'],
  },
  {
    actor: { rol: 'operadora de facturación', identificador: 'visitador@alovida.mock', clave: 'mock', nombre: 'Visitador' },
    roles: ['MEDICAL_VISITOR'],
  },
];

interface Fila {
  readonly cuenta: string;
  readonly ruta: string;
  readonly urlFinal: string;
  readonly viewport: string;
  readonly habilitado: boolean;
  readonly pinta: boolean;
  readonly desbordeX: number;
  readonly veredicto: string;
}

async function desborde(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });
}

test('FABLE · matriz por rol', async ({ page }) => {
  test.setTimeout(60 * 60_000);

  const cat = catalogoDeRutas();
  const rutas = [...cat.secciones, ...cat.hijas, ...cat.portadas].filter((r) => !r.parametrizada);
  const filas: Fila[] = [];
  const ojo = vigilar(page);

  for (const cuenta of CUENTAS) {
    await page.context().clearCookies();
    await entrar(page, cuenta.actor);

    for (const ruta of rutas) {
      const exigidos = ruta.roles ?? [];
      const habilitado = exigidos.length === 0 || exigidos.some((r) => cuenta.roles.includes(r));

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        ojo.limpiar();

        let pinta = false;
        for (let i = 0; i < 2 && !pinta; i++) {
          try {
            await irA(page, ruta.ruta);
            await estable(page);
            pinta = await tieneContenido(page);
          } catch {
            pinta = false;
          }
        }

        const urlFinal = new URL(page.url()).pathname;
        const desvio = urlFinal !== ruta.ruta;
        const desbordeX = pinta ? await desborde(page) : 0;

        let veredicto: string;
        if (desvio && !habilitado) veredicto = 'GUARDIA-OK';
        else if (desvio && habilitado) veredicto = 'REDIRIGE-INESPERADO';
        else if (!pinta && habilitado) veredicto = 'NO-PINTA';
        else if (desbordeX > 0) veredicto = `DESBORDE:${desbordeX}px`;
        else if (!habilitado && !desvio) veredicto = 'ENTRA-SIN-PERMISO';
        else veredicto = 'OK';

        filas.push({
          cuenta: cuenta.actor.identificador,
          ruta: ruta.ruta,
          urlFinal,
          viewport: vp.nombre,
          habilitado,
          pinta,
          desbordeX,
          veredicto,
        });
      }
    }
  }

  mkdirSync(SALIDA, { recursive: true });
  writeFileSync(
    join(SALIDA, 'matriz-roles.json'),
    JSON.stringify({ capturadoEl: new Date().toISOString(), filas }, null, 2) + '\n',
    'utf8',
  );

  const resumen = filas.reduce<Record<string, number>>((acc, f) => {
    acc[f.veredicto.split(':')[0]] = (acc[f.veredicto.split(':')[0]] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`[roles] ${filas.length} filas · ${JSON.stringify(resumen)}`);
});
