import type { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { mfaEnrollmentGuard } from './core/auth/mfa-enrollment.guard';
import { APP_SECTIONS } from './core/navigation/navigation.map';
import { seccionRolesGuard } from './core/navigation/section-roles.guard';
import { APP_TITLE, SECTION_ROUTE_DATA, titleOf, type AppSection } from './core/navigation/navigation.types';
import { PANTALLA_NO_DISPONIBLE_ROUTE, visibilityChildGuard } from './core/visibility/visibility.guard';

/* ============================================================================
    Las rutas que la franja de visibilidad y del portal de inventario (31/10/2026) suma a la raíz, en su propio
    archivo para no engordar `app.routes.ts` (congelado por `check-max-lines`), como `insights-portal.route.ts`.
    Lo que necesita de `app.routes.ts` (cómo se carga cada sección, sus hijas anidadas) llega por parámetro, así
    que este archivo no depende del que lo usa.

    Los guards **no autorizan**: ocultan y evitan una pantalla intermedia. La API decide en cada petición.
   ========================================================================== */

/**
 * Secciones con marco propio: se montan FUERA del armazón (`ShellLayout`),
 * como `/insights`, porque traen su barra lateral y su barra superior.
 *
 * El portal de inventario estaba colgado del armazón y dibujaba un segundo
 * marco completo dentro del primero: dos menús a la vez y un hueco en blanco
 * bajo la barra superior (31/10/2026). La dirección no cambia
 * (`/superadmin/portal/...`), la sección sigue en el registro —el menú global la
 * ofrece igual— y conserva cada guarda que heredaba del armazón: sesión, alta
 * del segundo factor, reglas de visibilidad y roles de la sección.
 */
export const SECCIONES_CON_MARCO_PROPIO: readonly string[] = ['superadmin/portal'];

/** Cómo se resuelve una sección (componente, carga diferida o redirección); lo decide `app.routes.ts`. */
type ComponenteDeSeccion = (
  section: AppSection,
) => Pick<Routes[number], 'component' | 'loadComponent' | 'redirectTo' | 'pathMatch'>;

export function rutasConMarcoPropio(
  componenteDe: ComponenteDeSeccion,
  anidadas: Readonly<Record<string, Routes>>,
): Routes {
  return APP_SECTIONS.filter((section) => SECCIONES_CON_MARCO_PROPIO.includes(section.path)).map(
    (section) => ({
      path: section.path,
      title: titleOf(section),
      // Lo que antes ponía el armazón (`authGuard`; `mfaEnrollmentGuard` y
      // `visibilityChildGuard` como `canActivateChild`) más lo que pone a toda
      // sección (`seccionRolesGuard`). Sesión primero: S1 del M34.
      canActivate: [authGuard, mfaEnrollmentGuard, visibilityChildGuard, seccionRolesGuard],
      canActivateChild: [mfaEnrollmentGuard, visibilityChildGuard],
      data: { [SECTION_ROUTE_DATA]: section },
      ...(anidadas[section.path] === undefined ? {} : { children: anidadas[section.path] }),
      ...componenteDe(section),
    }),
  );
}

/** A donde la guarda de visibilidad manda a quien abre una pantalla que se le oculta (S3 con próxima acción). */
export const RUTA_PANTALLA_NO_DISPONIBLE: Routes[number] = {
  path: PANTALLA_NO_DISPONIBLE_ROUTE.slice(1),
  title: `${APP_TITLE} - No disponible para su perfil`,
  loadComponent: () =>
    import('./features/visibility-unavailable/visibility-unavailable').then((m) => m.VisibilityUnavailable),
};
