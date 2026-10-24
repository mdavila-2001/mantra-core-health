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

/**
 * (a) Pantallas portadas que **sí** leen la API, con la URL canónica que las
 * sirve.
 *
 * Se redirigen en vez de dejarse donde están porque la URL canónica es la
 * misma pantalla con `data.pantallaReal`: bajo `/buscar/…-listado` el marco
 * las coronaba con el aviso «Referencia de diseño, no la aplicación» sobre
 * datos ciertos. `/buscar` a secas ya lo redirige `app.routes.ts`.
 */
export const CONNECTED_CANONICAL_URLS: Readonly<Record<string, string>> = {
  'buscar/buscador-listado': '/search',
  'buscar/profesionales-listado': '/search/practitioners',
  'buscar/medicamentos-listado': '/search/medications',
  'buscar/hospitales-listado': '/search/hospitals',
  'buscar/laboratorios-listado': '/search/diagnostics',
  'buscar/aseguradoras-listado': '/search/insurers',
  'buscar/cercania-detalle': '/search/map',
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
  inicio: '/',

  // V65 · Buscador. Las fichas reales leen `/public/profiles/:prefijo/:slug`.
  'buscar/perfil-profesional-detalle': '/search/practitioners',
  'buscar/perfil-organizacion-detalle': '/search/hospitals',
  'buscar/perfil-farmacia-detalle': '/search/medications',
  'buscar/perfil-laboratorio-detalle': '/search/diagnostics',
  'buscar/perfil-aseguradora-detalle': '/search/insurers',
  // Se califica desde la ficha del profesional: `RateEncounterDialog`.
  'buscar/calificar-la-atencion-formulario': '/search/practitioners',

  // V03 · Terminología → `TerminologyCatalog` (sistemas, conjuntos, versiones
  // y publicación) y `VersionImport`; la consulta de conceptos es el glosario.
  terminologia: '/administration/terminology',
  'terminologia/versiones-importar': '/administration/terminology/import',
  'terminologia/versiones-listado': '/administration/terminology',
  'terminologia/versiones-publicar': '/administration/terminology',
  'terminologia/sistemas-de-codigos-listado': '/administration/terminology',
  'terminologia/conjuntos-de-valor-listado': '/administration/terminology',
  'terminologia/conceptos-listado': '/glossary',
  'terminologia/consulta-de-concepto-listado': '/glossary',

  // V04 · Directorio → `OrganizationList` y las altas por organización
  // (`/administration/organizations/:tenantId/…`).
  directorio: '/administration/organizations',
  'directorio/organizaciones-listado': '/administration/organizations',
  'directorio/organizaciones-formulario': '/administration/organizations/new',
  'directorio/organizaciones-verificar': '/administration/organizations',
  'directorio/organizaciones-hijas-formulario': '/administration/organizations',
  'directorio/membresias-formulario': '/administration/organizations',
  'directorio/membresias-listado': '/administration/organizations',
  'directorio/sucursales-formulario': '/administration/organizations',
  'directorio/sucursales-listado': '/administration/organizations',

  // V05 · Personas → `PatientList`, `PatientNew`, `PatientMerge` (que también
  // revierte) y `PatientDetail` (personas relacionadas); el resumen propio lo
  // lee `MyProfile`.
  personas: '/administration/patients',
  'personas/pacientes-listado': '/administration/patients',
  'personas/pacientes-formulario': '/administration/patients/new',
  'personas/pacientes-fusionar': '/administration/patients/merge',
  'personas/pacientes-revertir': '/administration/patients/merge',
  'personas/personas-relacionadas-formulario': '/administration/patients',
  'personas/personas-relacionadas-listado': '/administration/patients',
  'personas/resumen-propio-listado': '/my-account',
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
  'buscar/perfil-profesional-detalle': 'p',
  'buscar/perfil-organizacion-detalle': 'o',
  'buscar/perfil-farmacia-detalle': 'f',
  'buscar/perfil-laboratorio-detalle': 'l',
  'buscar/perfil-aseguradora-detalle': 's',
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
 * `/buscar/perfil-*-detalle/:slug` → la ficha pública real, en los dos modos.
 *
 * Van aparte y no dentro de {@link designMockupRoutes} porque son direcciones
 * heredadas: `app.routes.ts` las declara con las demás, después de toda
 * pantalla y antes del comodín, para que nunca puedan tapar a una pantalla.
 */
export function profileSlugRedirects(): Routes {
  return Object.entries(PROFILE_SLUG_PREFIXES).map(
    ([legacyPath, prefix]): Route => ({
      path: `${legacyPath}/:slug`,
      pathMatch: 'full',
      redirectTo: `/${prefix}/:slug`,
    }),
  );
}

/**
 * Redirección exacta que conserva el `?q=` y compañía.
 *
 * Un `redirectTo` de texto descarta la consulta de la URL original: un
 * `/buscar/profesionales-listado?q=cardio` guardado llegaría al directorio sin
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
