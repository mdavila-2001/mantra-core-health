import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { PORTAL_NAV } from './portal-nav';
import { LEGACY_PORTAL_PATHS, LEGACY_PORTAL_REDIRECTS, PORTAL_RUTAS } from './portal.routes';

describe('PORTAL_RUTAS', () => {
  it('cada pantalla que el menú ofrece tiene su ruta: ningún ítem lleva a «no encontrada»', () => {
    const rutas = new Set(PORTAL_RUTAS.map((r) => r.path));
    const faltan = PORTAL_NAV.flatMap((g) => g.items)
      .map((i) => i.path)
      .filter((path) => !rutas.has(path));
    expect(faltan).toEqual([]);
  });

  it('las fichas cuelgan de la pantalla de la que salen, para que el menú ilumine la correcta', () => {
    const fichas = PORTAL_RUTAS.map((r) => r.path ?? '').filter((p) => p.includes(':'));
    expect(fichas).toEqual([
      'systems/operations/:id',
      'processes/:code',
      'catalog/tables/:schema/:table',
    ]);
  });

  it('cada ruta descarga un componente y tiene título', async () => {
    for (const ruta of PORTAL_RUTAS) {
      expect(ruta.title, ruta.path).toBeTruthy();
      const componente = await (ruta.loadComponent as () => Promise<unknown>)();
      expect(typeof componente, ruta.path).toBe('function');
    }
  });
});

describe('LEGACY_PORTAL_REDIRECTS (TAREA-29)', () => {
  it('cada dirección vieja apunta a una pantalla que existe, y ninguna sigue siendo ruta', () => {
    const rutas = new Set(PORTAL_RUTAS.map((r) => r.path));

    expect(Object.values(LEGACY_PORTAL_PATHS).filter((path) => !rutas.has(path))).toEqual([]);
    expect(Object.keys(LEGACY_PORTAL_PATHS).filter((path) => rutas.has(path))).toEqual([]);
  });

  it.each([
    [
      '/superadmin/portal/sistemas/operaciones?riesgo=ALTO',
      '/superadmin/portal/systems/operations?riesgo=ALTO',
    ],
    ['/superadmin/portal/procesos/scheduling', '/superadmin/portal/processes/scheduling'],
    ['/superadmin/portal/catalogo/tablas/iam/users', '/superadmin/portal/catalog/tables/iam/users'],
    [
      '/superadmin/portal/gobierno/deriva-permisos',
      '/superadmin/portal/governance/permission-drift',
    ],
  ])('%s lleva a %s', async (legacyUrl, target) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'superadmin/portal',
            children: [
              ...PORTAL_RUTAS.map((r) => ({ path: r.path, children: [] })),
              ...LEGACY_PORTAL_REDIRECTS,
            ],
          },
        ]),
      ],
    });

    await TestBed.inject(Router).navigateByUrl(legacyUrl);

    expect(TestBed.inject(Location).path()).toBe(target);
  });
});
