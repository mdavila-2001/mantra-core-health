/* ============================================================================
    Qué queda de las pantallas de la bóveda cuando la app habla con la API real.

    NO es un archivo generado: `alovida.routes.ts` sí lo es, y lo que se
    escribiera ahí lo borraría la próxima corrida de
    `scripts/port-vistas-alovida.mjs`. Por eso el gate envuelve al bloque
    generado desde afuera —`app.routes.ts` monta lo que devuelve
    `designMockupRoutes()`— en vez de marcar ruta por ruta.
    ========================================================================== */

import { inject } from '@angular/core';
import { Router, type Route, type Routes } from '@angular/router';

import { ALOVIDA_ROUTES } from './alovida.routes';
import { LEGACY_MOCKUP_PATHS } from './legacy-mockup-paths';

/**
 * (a) Pantallas portadas que **sí** leen la API, con la URL canónica que las
 * sirve.
 *
 * Se redirigen en vez de dejarse donde están porque la URL canónica es la
 * misma pantalla con `data.pantallaReal`: bajo `/explore/…-list` el marco
 * las coronaba con el aviso «Referencia de diseño, no la aplicación» sobre
 * datos ciertos. `/explore` a secas va al buscador, como antes `/buscar`.
 */
export const CONNECTED_CANONICAL_URLS: Readonly<Record<string, string>> = {
  explore: '/search',
  'explore/finder-list': '/search',
  'explore/practitioners-list': '/search/practitioners',
  'explore/medications-list': '/search/medications',
  'explore/hospitals-list': '/search/hospitals',
  'explore/laboratories-list': '/search/diagnostics',
  'explore/insurers-list': '/search/insurers',
  'explore/nearby-detail': '/search/map',
};

/**
 * (b) Maquetas con filas escritas a mano cuya tarea **ya hace** una pantalla
 * conectada de otra feature.
 *
 * Sólo figura lo que se comprobó en el código de la pantalla destino: que
 * llama al endpoint que hace eso mismo. Las fichas `perfil-*-detalle` no
 * llevan identificador, así que van al directorio de su tipo, desde donde se
 * abre la ficha real (`/p/:slug`, `/f/:slug`…); con identificador van directo
 * a la ficha (ver {@link PROFILE_SLUG_PREFIXES}). Las operaciones que en la
 * aplicación se hacen **dentro** de una organización o de un paciente van al
 * listado, donde se elige a cuál.
 *
 * Lo que no está acá ni en {@link CONNECTED_CANONICAL_URLS} es (c): no tiene
 * equivalente real, y con el gate apagado no se registra.
 */
export const REAL_EQUIVALENTS: Readonly<Record<string, string>> = {
  // La portada de marketing enlaza a maquetas; la entrada real es `/`, que
  // decide `homeGuard` según haya sesión.
  home: '/',

  // V65 · Buscador. Las fichas reales leen `/public/profiles/:prefijo/:slug`.
  'explore/practitioner-profile-detail': '/search/practitioners',
  'explore/organization-profile-detail': '/search/hospitals',
  'explore/pharmacy-profile-detail': '/search/medications',
  'explore/laboratory-profile-detail': '/search/diagnostics',
  'explore/insurer-profile-detail': '/search/insurers',
  // Se califica desde la ficha del profesional: `RateEncounterDialog`.
  'explore/rate-care-form': '/search/practitioners',

  // V03 · Terminología → `TerminologyCatalog` (sistemas, conjuntos, versiones
  // y publicación) y `VersionImport`; la consulta de conceptos es el glosario.
  vocabulary: '/administration/terminology',
  'vocabulary/versions-import': '/administration/terminology/import',
  'vocabulary/versions-list': '/administration/terminology',
  'vocabulary/versions-publish': '/administration/terminology',
  'vocabulary/code-systems-list': '/administration/terminology',
  'vocabulary/value-sets-list': '/administration/terminology',
  'vocabulary/concepts-list': '/glossary',
  'vocabulary/concept-lookup-list': '/glossary',

  // V04 · Directorio → `OrganizationList` y las altas por organización
  // (`/administration/organizations/:tenantId/…`).
  institutions: '/administration/organizations',
  'institutions/organizations-list': '/administration/organizations',
  'institutions/organizations-form': '/administration/organizations/new',
  'institutions/organizations-verify': '/administration/organizations',
  'institutions/child-organizations-form': '/administration/organizations',
  'institutions/memberships-form': '/administration/organizations',
  'institutions/memberships-list': '/administration/organizations',
  'institutions/branches-form': '/administration/organizations',
  'institutions/branches-list': '/administration/organizations',

  // V05 · Personas → `PatientList`, `PatientNew`, `PatientMerge` (que también
  // revierte) y `PatientDetail` (personas relacionadas); el resumen propio lo
  // lee `MyProfile`.
  people: '/administration/patients',
  'people/patients-list': '/administration/patients',
  'people/patients-form': '/administration/patients/new',
  'people/patients-merge': '/administration/patients/merge',
  'people/patients-revert': '/administration/patients/merge',
  'people/related-persons-form': '/administration/patients',
  'people/related-persons-list': '/administration/patients',
  'people/own-summary-list': '/my-account',
};

/**
 * Las fichas V65 con identificador: el prefijo de la ficha pública real.
 *
 * Es la conexión barata que pedía la tarea: en vez de hidratar a mano cinco
 * plantillas estáticas con el mismo `GET /public/profiles/:prefijo/:slug` que
 * `PublicProfile` ya consume —cinco copias del mismo defecto—, la dirección de
 * la bóveda con un slug abre la ficha que ya lo hace. Existe en los dos modos:
 * es una redirección a una pantalla real, no una maqueta. Se monta con
 * {@link profileSlugRedirects}, entre las direcciones heredadas del final.
 */
export const PROFILE_SLUG_PREFIXES: Readonly<Record<string, string>> = {
  'explore/practitioner-profile-detail': 'p',
  'explore/organization-profile-detail': 'o',
  'explore/pharmacy-profile-detail': 'f',
  'explore/laboratory-profile-detail': 'l',
  'explore/insurer-profile-detail': 's',
};

/**
 * Las rutas de la bóveda que se montan en `app.routes.ts`.
 *
 * Con `designMockups` encendido (rama `mockup`, desarrollo) son las 126 del
 * archivo generado, intactas. Apagado (`production-api`, `real-api`), sólo
 * quedan redirecciones: (a) a su URL canónica y (b) a la pantalla real
 * equivalente. Las (c) no se registran y caen en el comodín `**` —404—, con
 * `canMatch` implícito: la ruta no existe, en vez de existir prohibida.
 */
export function designMockupRoutes(designMockups: boolean): Routes {
  if (designMockups) return ALOVIDA_ROUTES;

  return Object.entries({ ...CONNECTED_CANONICAL_URLS, ...REAL_EQUIVALENTS }).map(
    ([legacyPath, target]) => redirectKeepingQuery(legacyPath, target),
  );
}

/**
 * `/explore/*-profile-detail/:slug` → la ficha pública real, en los dos modos.
 *
 * Van aparte y no dentro de {@link designMockupRoutes} porque son direcciones
 * heredadas: `app.routes.ts` las declara con las demás, después de toda
 * pantalla y antes del comodín, para que nunca puedan tapar a una pantalla.
 */
export function profileSlugRedirects(): Routes {
  const legacyByCurrent = new Map(
    Object.entries(LEGACY_MOCKUP_PATHS).map(([legacy, current]) => [current, legacy]),
  );
  return Object.entries(PROFILE_SLUG_PREFIXES).flatMap(([mockupPath, prefix]): Route[] => {
    const legacy = legacyByCurrent.get(mockupPath);
    return [mockupPath, ...(legacy === undefined ? [] : [legacy])].map((path) => ({
      path: `${path}/:slug`,
      pathMatch: 'full',
      redirectTo: `/${prefix}/:slug`,
    }));
  });
}

/**
 * Las direcciones en castellano de la bóveda (TAREA-29) → adonde van hoy.
 *
 * Con el gate encendido llevan a la maqueta con su ruta nueva en inglés.
 * Apagado van **directo** al destino real de esa maqueta —sin pasar por la
 * ruta nueva: el router aplica una sola redirección absoluta— y las que no
 * tienen equivalente (c) no se registran, igual que la ruta nueva: un enlace
 * viejo a una maqueta gateada sigue siendo un 404, no una puerta trasera.
 *
 * Van entre las direcciones heredadas del final de `app.routes.ts`, por la
 * misma razón que {@link profileSlugRedirects}.
 */
export function legacyMockupRedirects(designMockups: boolean): Routes {
  const realTargets: Readonly<Record<string, string>> = {
    ...CONNECTED_CANONICAL_URLS,
    ...REAL_EQUIVALENTS,
  };
  return Object.entries(LEGACY_MOCKUP_PATHS).flatMap(([legacy, current]) => {
    const target = designMockups ? `/${current}` : realTargets[current];
    return target === undefined ? [] : [redirectKeepingQuery(legacy, target)];
  });
}

/**
 * Redirección exacta que conserva el `?q=` y compañía.
 *
 * Un `redirectTo` de texto descarta la consulta de la URL original: un
 * `/explore/practitioners-list?q=cardio` guardado llegaría al directorio sin
 * la búsqueda.
 */
function redirectKeepingQuery(legacyPath: string, target: string): Route {
  return {
    path: legacyPath,
    pathMatch: 'full',
    redirectTo: ({ queryParams }) => inject(Router).createUrlTree([target], { queryParams }),
  };
}

/**
 * Toda dirección que el archivo generado declara, sin barra inicial: la raíz
 * de cada módulo y cada hoja. Es la lista contra la que se comprueba que los
 * mapas de arriba no nombran rutas que ya no existen.
 */
export function mockupPaths(routes: Routes = ALOVIDA_ROUTES): readonly string[] {
  const paths: string[] = [];
  for (const moduleRoute of routes) {
    const root = moduleRoute.path ?? '';
    paths.push(root);
    for (const child of moduleRoute.children ?? []) {
      if (child.path) paths.push(`${root}/${child.path}`);
    }
  }
  return paths;
}
