/**
 * Regenera la lista de rutas del carril 34 (auditoría global de la regla visual)
 * a partir del mapa de navegación.
 *
 * Se toman las secciones **sin parámetro** en la ruta: una ruta con `:id` necesita
 * un identificador real para cargar, y una foto de un «no encontrado» no prueba
 * nada sobre el fondo ni sobre el ancho. Las que hagan falta se agregan a mano al
 * JSON, con un id del backend simulado.
 *
 *   node scripts/corr-rutas.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const MAPA = 'src/app/core/navigation/navigation.map.ts';
const ROUTES = 'src/app/app.routes.ts';
const DESTINO = 'playwright/corr-rutas.json';

// Los comentarios guardan rutas históricas para explicar cambios. No son
// pantallas del mapa vigente y no deben entrar al auditor.
const fuente = readFileSync(MAPA, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/[^\n]*/gm, '$1')
  .replace(/},[ \t]*\{/g, '},\n  {');
const routesSource = readFileSync(ROUTES, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/gm, '$1');
const redirectedRoutes = new Set(
  [...(routesSource.match(/SECCIONES_REDIRIGIDAS[\s\S]*?=\s*\{([\s\S]*?)\n\};/)?.[1] ?? '').matchAll(/^\s*'([^']+)':/gm)].map(([, path]) => `/${path}`),
);
const secciones = [...fuente.matchAll(/path:\s*'([^']+)'[\s\S]{0,400}?label:\s*'([^']+)'/g)];

const vistas = new Set();
const rutas = [];
for (const [, ruta] of secciones) {
  if (ruta.includes(':') || vistas.has(ruta) || redirectedRoutes.has(`/${ruta}`)) continue;
  vistas.add(ruta);
  rutas.push({ ruta: `/${ruta}`, nombre: ruta.replace(/[/?=&]+/g, '_') || 'inicio' });
}

// La portada y las altas no pertenecen al menú autenticado, pero sí son vistas
// del producto alcanzables por una persona. Se auditan en el mismo carril.
const publicViews = [
  { ruta: '/posts', nombre: 'home' },
  { ruta: '/auth/register', nombre: 'register-account-type' },
  { ruta: '/auth/register/patient', nombre: 'register-patient' },
  { ruta: '/auth/register/practitioner', nombre: 'register-practitioner' },
  { ruta: '/auth/register/organization', nombre: 'register-organization' },
  { ruta: '/auth/register/laboratory', nombre: 'register-laboratory' },
  { ruta: '/auth/register/imaging-center', nombre: 'register-imaging-center' },
  { ruta: '/auth/register/pharmacy', nombre: 'register-pharmacy' },
];
for (const view of publicViews) {
  if (!rutas.some((currentRoute) => currentRoute.ruta === view.ruta)) rutas.push(view);
}

const catalogo = JSON.parse(readFileSync(DESTINO, 'utf8'));
const routeReport = JSON.parse(readFileSync('docs/reports/generated/rutas.json', 'utf8'));
const rolesByRoute = new Map(
  [...routeReport.secciones, ...routeReport.hijas].map((routeEntry) => [routeEntry.ruta, routeEntry.roles ?? []]),
);
const navigationEntries = [...fuente.matchAll(/^[ \t]{2}\{\n([\s\S]*?)^[ \t]{2}\},?[ \t]*$/gm)].map(
  ([, entry]) => entry,
);
const roleGroups = new Map(
  [...fuente.matchAll(/(?:const|let)\s+([A-Z][A-Z0-9_]*)[^=]*=\s*\[([\s\S]*?)\]\s*(?:as\s+const)?\s*;/g)].map(
    ([, name, values]) => [name, [...values.matchAll(/'([^']+)'/g)].map(([, value]) => value)],
  ),
);
const restrictionsByRoute = new Map();
for (const entry of navigationEntries) {
  const routePath = entry.match(/path:\s*'([^']+)'/)?.[1];
  if (!routePath) continue;
  const readCodes = (field) => {
    const expression = entry.match(new RegExp(`${field}:\\s*(\\[[^\\]]*\\]|[A-Z][A-Z0-9_]*)`))?.[1] ?? '';
    return expression.startsWith('[')
      ? [...expression.matchAll(/'([^']+)'/g)].map(([, value]) => value)
      : roleGroups.get(expression) ?? [];
  };
  restrictionsByRoute.set(`/${routePath}`, {
    roleCodes: readCodes('roles'),
    rolesDeclared: /roles:\s*(?:\[|[A-Z][A-Z0-9_]*\s*[,\n}])/.test(entry),
    allRoles: /roles:\s*\[\s*ANY_ROLE\s*\]/.test(entry) || /roles:\s*ANY_ROLE\b/.test(entry),
    hiddenFor: readCodes('hiddenFor'),
    hiddenForTenantTypes: readCodes('hiddenForTenantTypes'),
    onlyForTenantTypes: readCodes('onlyForTenantTypes'),
  });
}

function routesForRoles(allowedRoles) {
  return rutas.filter(({ ruta }) => {
    if (ruta === '/posts' || ruta.startsWith('/auth/')) return true;
    const restrictions = restrictionsByRoute.get(ruta);
    if (restrictions?.hiddenFor.some((role) => allowedRoles.includes(role))) return false;
    if (restrictions?.hiddenForTenantTypes.includes('PROVIDER')) return false;
    if (
      restrictions?.onlyForTenantTypes.length &&
      !restrictions.onlyForTenantTypes.includes('PROVIDER')
    ) {
      return false;
    }
    const roles = restrictions?.rolesDeclared
      ? restrictions.allRoles
        ? []
        : restrictions.roleCodes
      : rolesByRoute.get(ruta);
    // Las rutas manuales que el catálogo aún no clasifica se conservan para
    // que Playwright mida su acceso real. Las ramas administrativas y de
    // laboratorio requieren su pasada de administración; no se mezclan con
    // las rutas de autoservicio del paciente o de consulta médica.
    if (roles === undefined) {
      const requiereAdministracion = ruta.startsWith('/administration/') || ruta.startsWith('/laboratorio/');
      return !requiereAdministracion || allowedRoles.includes('SECURITY_ADMIN') || allowedRoles.includes('SUPERADMIN');
    }
    if (roles.length === 0) return true;
    return roles.some((role) => allowedRoles.includes(role));
  });
}

catalogo['34-inventario'] = rutas;
catalogo['34'] = routesForRoles(['PRACTITIONER', 'CLINICIAN']);
catalogo['34-paciente'] = routesForRoles(['PATIENT']);
// The seeded administration actor is SECURITY_ADMIN; SUPERADMIN paths need a
// separate actor and must not be treated as available in this audit.
catalogo['34-administrador'] = routesForRoles(['SECURITY_ADMIN']);
writeFileSync(DESTINO, `${JSON.stringify(catalogo, null, 2)}\n`);
console.log(
  `Carril 34: inventario ${rutas.length}; médica ${catalogo['34'].length}; paciente ${catalogo['34-paciente'].length}; administración ${catalogo['34-administrador'].length}`,
);
