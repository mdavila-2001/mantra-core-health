import type { Routes } from '@angular/router';

/* ============================================================================
    Ruta de «Historias clínicas masivas» (H7).

    Va en el área de superadministración, junto a «Cargas masivas». La autoridad
    sobre quién puede cargar es la API (`SECURITY_ADMIN`; el resto recibe 403):
    ocultar el menú no protege nada.
    ========================================================================== */

/** Sin barra inicial, como las demás rutas de superadministración. */
export const CLINICAL_IMPORTS_PATH = 'superadmin/clinical-imports';

/** Carga diferida de la pantalla, con la forma que usa el mapa de `app.routes.ts`. */
export const loadClinicalImports = () =>
  import('./clinical-imports').then((m) => m.ClinicalImports);

/** La ruta como `Routes`, por si un contenedor la monta directamente. */
export const CLINICAL_IMPORTS_ROUTES: Routes = [
  { path: CLINICAL_IMPORTS_PATH, loadComponent: loadClinicalImports },
];
