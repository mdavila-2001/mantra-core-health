import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';

/** Una pantalla del portal. `path` es relativo a `superadmin/portal`. */
export interface PortalNavItem {
  readonly label: string;
  readonly path: string;
  /** Sólo coincide con la ruta exacta (el centro `''` no puede iluminarse en todas). */
  readonly exact?: boolean;
  /** Dice en una línea qué responde la pantalla; alimenta el buscador global. */
  readonly summary: string;
}

export interface PortalNavGroup {
  readonly id: string;
  readonly label: string;
  readonly icon: NavIconName;
  readonly items: readonly PortalNavItem[];
}

export const PORTAL_BASE = '/superadmin/portal';

/**
 * Los grupos del portal. Es el único lugar que dice qué pantallas hay y dónde
 * cuelgan: la barra lateral, las migas y el buscador global leen de aquí.
 */
export const PORTAL_NAV: readonly PortalNavGroup[] = [
  {
    id: 'home',
    label: 'Inicio',
    icon: 'home',
    items: [
      {
        label: 'Centro interno',
        path: '',
        exact: true,
        summary: 'Cifras del inventario y postura del catálogo',
      },
    ],
  },
  {
    id: 'systems',
    label: 'Sistemas',
    icon: 'route',
    items: [
      {
        label: 'Operaciones',
        path: 'systems/operations',
        summary: 'Todos los endpoints, con riesgo, tablas y pruebas',
      },
      {
        label: 'Mapa de rutas',
        path: 'systems/flows',
        summary: 'Rutas por flujo, quién las llama y qué señales tienen',
      },
      {
        label: 'Diagrama',
        path: 'systems/flows/diagram',
        summary: 'El grafo de un proceso o módulo',
      },
      {
        label: 'Deriva',
        path: 'systems/drift',
        summary: 'Dónde el frontend, la API y el contrato no coinciden',
      },
      {
        label: 'Revisión',
        path: 'systems/review',
        summary: 'Fichas del catálogo esperando una decisión',
      },
    ],
  },
  {
    id: 'processes',
    label: 'Procesos',
    icon: 'orders',
    items: [
      {
        label: 'Procesos',
        path: 'processes',
        summary: 'Qué hace el sistema, paso a paso y por quién',
      },
    ],
  },
  {
    id: 'catalog',
    label: 'Catálogo y metadatos',
    icon: 'book',
    items: [
      {
        label: 'Tablas',
        path: 'catalog/tables',
        summary: 'Las 1 230 tablas del modelo, con su ficha',
      },
      {
        label: 'Dominios y glosario',
        path: 'catalog/domains',
        summary: 'Dominios de negocio y términos del glosario',
      },
    ],
  },
  {
    id: 'lineage',
    label: 'Linaje',
    icon: 'link',
    items: [
      {
        label: 'Linaje',
        path: 'lineage',
        summary: 'Qué operación toca qué tabla, y qué tabla depende de cuál',
      },
    ],
  },
  {
    id: 'schemas',
    label: 'Esquema de datos',
    icon: 'folder',
    items: [
      {
        label: 'Esquema',
        path: 'schemas',
        summary: 'Schemas, versión del modelo y deriva con la base',
      },
    ],
  },
  {
    id: 'governance',
    label: 'Gobierno y acceso',
    icon: 'shield',
    items: [
      {
        label: 'Auditoría',
        path: 'governance/audit',
        summary: 'Quién hizo qué y cuándo, y quién leyó datos sensibles',
      },
      {
        label: 'Usuarios y roles',
        path: 'governance/users',
        summary: 'Usuarios internos, sus roles y los permisos de cada rol',
      },
      {
        label: 'Deriva de permisos',
        path: 'governance/permission-drift',
        summary: 'Roles que las rutas exigen y nadie siembra, y rutas sin roles',
      },
    ],
  },
];

/** La dirección absoluta de una pantalla. */
export function portalUrl(path: string): string {
  return path === '' ? PORTAL_BASE : `${PORTAL_BASE}/${path}`;
}

function pathOf(url: string): string {
  return url.split('?')[0]!.split('#')[0]!;
}

/** ¿Esta pantalla es la activa para `url`? La más específica gana, no la primera. */
export function isActive(item: PortalNavItem, url: string): boolean {
  const actual = pathOf(url).replace(/\/+$/, '');
  const propia = portalUrl(item.path);
  if (item.exact) return actual === propia;
  if (actual === propia) return true;
  if (!actual.startsWith(`${propia}/`)) return false;
  // `systems/flows` no debe iluminarse en `systems/flows/diagram`, que tiene ítem propio
  return !PORTAL_NAV.flatMap((g) => g.items).some(
    (otro) =>
      otro !== item &&
      otro.path.length > item.path.length &&
      (actual === portalUrl(otro.path) || actual.startsWith(`${portalUrl(otro.path)}/`)),
  );
}

export interface PortalCrumb {
  readonly label: string;
  readonly url: string | null;
}

/** Las migas de `url` dentro del portal: Portal › Grupo › Pantalla. */
export function portalCrumbs(url: string): readonly PortalCrumb[] {
  const base: PortalCrumb = { label: 'Portal', url: PORTAL_BASE };
  for (const grupo of PORTAL_NAV) {
    const item = grupo.items.find((i) => isActive(i, url));
    if (item) {
      return item.path === ''
        ? [{ label: 'Portal', url: null }]
        : [
            base,
            { label: grupo.label, url: null },
            { label: item.label, url: portalUrl(item.path) },
          ];
    }
  }
  return [{ label: 'Portal', url: null }];
}

/** El grupo que contiene `url`, o `null`. */
export function groupOf(url: string): PortalNavGroup | null {
  return PORTAL_NAV.find((g) => g.items.some((i) => isActive(i, url))) ?? null;
}
