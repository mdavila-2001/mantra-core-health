import { describe, expect, it } from 'vitest';

import { PORTAL_NAV } from './portal-nav';
import { PORTAL_RUTAS } from './portal.routes';

const PANTALLAS = PORTAL_RUTAS.filter((r) => r.redirectTo === undefined);
const HEREDADAS = PORTAL_RUTAS.filter((r) => r.redirectTo !== undefined);

describe('PORTAL_RUTAS', () => {
  it('cada pantalla que el menú ofrece tiene su ruta: ningún ítem lleva a «no encontrada»', () => {
    const rutas = new Set(PANTALLAS.map((r) => r.path));
    const faltan = PORTAL_NAV.flatMap((g) => g.items)
      .map((i) => i.path)
      .filter((path) => !rutas.has(path));
    expect(faltan).toEqual([]);
  });

  it('las fichas cuelgan de la pantalla de la que salen, para que el menú ilumine la correcta', () => {
    const fichas = PANTALLAS.map((r) => r.path ?? '').filter((p) => p.includes(':'));
    expect(fichas).toEqual([
      'systems/operations/:id',
      'processes/:code',
      'catalog/tables/:schema/:table',
      'governance/policies/:id',
      'data-quality/rules/:ruleId',
      'governance/privacy-requests/:requestId',
    ]);
  });

  it('cada ruta descarga un componente y tiene título', async () => {
    for (const ruta of PANTALLAS) {
      expect(ruta.title, ruta.path).toBeTruthy();
      const componente = await (ruta.loadComponent as () => Promise<unknown>)();
      expect(typeof componente, ruta.path).toBe('function');
    }
  });

  it('TAREA-29: cada dirección en castellano de antes redirige, exacta, y ninguna pantalla la usa', () => {
    const pantallas = new Set(PANTALLAS.map((r) => r.path));
    expect(HEREDADAS.length).toBe(16);
    for (const ruta of HEREDADAS) {
      expect(ruta.pathMatch, ruta.path).toBe('full');
      expect(pantallas.has(ruta.path), ruta.path).toBe(false);
    }
  });
});
