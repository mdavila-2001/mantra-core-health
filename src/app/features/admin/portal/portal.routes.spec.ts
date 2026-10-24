import { describe, expect, it } from 'vitest';

import { PORTAL_NAV } from './portal-nav';
import { PORTAL_RUTAS } from './portal.routes';

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
      'sistemas/operaciones/:id',
      'procesos/:code',
      'catalogo/tablas/:schema/:table',
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
