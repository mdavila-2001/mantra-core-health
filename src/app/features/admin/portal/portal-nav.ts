import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';

/** Una pantalla del portal. `path` es relativo a `superadmin/portal`. */
export interface PortalNavItem {
  readonly label: string;
  readonly path: string;
  /** Sólo coincide con la ruta exacta (el centro `''` no puede iluminarse en todas). */
  readonly exact?: boolean;
  /** Dice en una línea qué responde la pantalla; alimenta el buscador global. */
  readonly summary: string;
  /**
   * La entrada del menú a la que pertenece, cuando varias pantallas hermanas
   * comparten una (como `tabs` en AtlasAdminPortal): la barra enseña UNA línea
   * con este rótulo y cada pantalla pinta arriba las pestañas-enlace entre
   * hermanas. Cada pantalla conserva su ruta. Sin él, la pantalla es su propia
   * entrada.
   */
  readonly section?: string;
  /**
   * El icono de la pantalla en la loseta de su cabecera. Sin él, el del grupo.
   * Que dos pantallas del mismo grupo no compartan icono es lo que lo hace útil.
   */
  readonly icon?: NavIconName;
}

/** Una línea de la barra lateral: una pantalla sola o una sección de hermanas. */
export interface PortalNavEntry {
  readonly label: string;
  readonly items: readonly PortalNavItem[];
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
        icon: 'home',
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
        icon: 'network',
        section: 'Inventario técnico',
        summary: 'Todos los endpoints, con riesgo, tablas y pruebas',
      },
      {
        label: 'Mapa de rutas',
        path: 'systems/flows',
        icon: 'route',
        section: 'Inventario técnico',
        summary: 'Rutas por flujo, quién las llama y qué señales tienen',
      },
      {
        label: 'Diagrama',
        path: 'systems/flows/diagram',
        icon: 'merge',
        section: 'Inventario técnico',
        summary: 'El grafo de un proceso o módulo',
      },
      {
        label: 'Deriva',
        path: 'systems/drift',
        icon: 'sliders',
        section: 'Inventario técnico',
        summary: 'Dónde el frontend, la API y el contrato no coinciden',
      },
      {
        label: 'Revisión',
        path: 'systems/review',
        icon: 'clipboard',
        section: 'Inventario técnico',
        summary: 'Fichas del catálogo esperando una decisión',
      },
      {
        label: 'Piezas en ejecución',
        path: 'systems/runtime-pieces',
        icon: 'monitor',
        section: 'Inventario técnico',
        summary: 'Workers, crons, consumidores y procesos detectados en el código, y si están vivos',
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
        icon: 'orders',
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
        icon: 'table',
        section: 'Catálogo de datos',
        summary: 'Las 1 230 tablas del modelo, con su ficha',
      },
      {
        label: 'Dominios y glosario',
        path: 'catalog/domains',
        icon: 'book',
        section: 'Catálogo de datos',
        summary: 'Dominios de negocio y términos del glosario',
      },
      {
        label: 'Sonda de catalogación',
        path: 'catalog/fit',
        icon: 'scan',
        section: 'Catálogo de datos',
        summary: 'Si el catálogo sigue ajustado a las rutas del código, la base, el inventario y las fichas',
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
        icon: 'link',
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
        icon: 'cube',
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
        icon: 'history',
        summary: 'Quién hizo qué y cuándo, y quién leyó datos sensibles',
      },
      {
        label: 'Usuarios y roles',
        path: 'governance/users',
        icon: 'people',
        section: 'Usuarios y accesos',
        summary: 'Usuarios internos, sus roles y los permisos de cada rol',
      },
      {
        label: 'Deriva de permisos',
        path: 'governance/permission-drift',
        icon: 'flag',
        section: 'Permisos por módulo',
        summary: 'Roles que las rutas exigen y nadie siembra, y rutas sin roles',
      },
      {
        label: 'Roles y permisos',
        path: 'governance/roles',
        icon: 'key',
        section: 'Usuarios y accesos',
        summary: 'Qué permite y qué niega cada rol, con edición',
      },
      {
        label: 'Permisos por campo y alcance',
        path: 'governance/field-permissions',
        icon: 'lock',
        section: 'Usuarios y accesos',
        summary: 'Reglas por columna y permisos sobre un recurso concreto',
      },
      {
        label: 'Quién puede qué',
        path: 'governance/who-can',
        icon: 'shield',
        section: 'Usuarios y accesos',
        summary: 'Simulador de decisión del PDP y mapa permiso → roles → personas',
      },
      {
        label: 'Ciclo de vida y accesos',
        path: 'governance/access-reviews',
        icon: 'refresh',
        section: 'Usuarios y accesos',
        summary: 'Suspender, reactivar, dar de baja y revisar accesos',
      },
      {
        label: 'Matriz RBAC por módulo',
        path: 'governance/rbac-matrix',
        icon: 'grid',
        section: 'Permisos por módulo',
        summary: 'Qué rol puede qué acción en cada módulo, huecos de permisos finos y cobertura',
      },
      {
        label: 'Catálogo de visibilidad',
        path: 'governance/ui-catalog',
        icon: 'eye',
        section: 'Visibilidad de la interfaz',
        summary: 'Cada elemento de la interfaz que puede mostrarse u ocultarse, por módulo y con su jerarquía',
      },
      {
        label: 'Reglas de visibilidad',
        path: 'governance/ui-rules',
        icon: 'eye-off',
        section: 'Visibilidad de la interfaz',
        summary: 'Mostrar u ocultar elementos por persona, organización, rol o tipo de organización, con vigencia y motivo',
      },
      {
        label: 'Ver como',
        path: 'governance/ui-preview',
        icon: 'monitor',
        section: 'Visibilidad de la interfaz',
        summary: 'Previsualiza qué se oculta a una persona o a un rol y qué regla lo decide',
      },
      {
        label: 'Mutabilidad de datos',
        path: 'governance/mutability',
        icon: 'edit',
        section: 'Gobierno de datos',
        summary: 'Qué tabla es append-only, cuál se actualiza o se borra, y con qué evidencia',
      },
      {
        label: 'Políticas',
        path: 'governance/policies',
        icon: 'survey',
        section: 'Gobierno de datos',
        summary: 'Escritura, retención, anonimización, clasificación y residencia de los datos',
      },
      {
        label: 'Datos personales',
        path: 'governance/pii',
        icon: 'patients',
        section: 'Gobierno de datos',
        summary: 'Campos con datos personales, de salud o credenciales, y cómo se protegen',
      },
      {
        label: 'Solicitudes de privacidad',
        path: 'governance/privacy-requests',
        icon: 'mail',
        section: 'Gobierno de datos',
        summary: 'Solicitudes de acceso, rectificación y supresión de los titulares',
      },
    ],
  },
  {
    id: 'data-quality',
    label: 'Calidad de datos clínicos',
    icon: 'check',
    items: [
      {
        label: 'Incidencias',
        path: 'data-quality/issues',
        icon: 'flag',
        section: 'Incidencias y reglas',
        summary: 'Datos de salud (health_data) que incumplen una regla, con su estado y cómo cerrarlos',
      },
      {
        label: 'Reglas',
        path: 'data-quality/rules',
        icon: 'check-circle',
        section: 'Incidencias y reglas',
        summary: 'Las reglas de calidad de los datos clínicos, su expresión y sus últimas corridas',
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

/**
 * Las líneas de la barra para un grupo: las hermanas de una misma `section` se
 * juntan en una sola entrada, en el lugar de la primera.
 */
export function navEntries(group: PortalNavGroup): readonly PortalNavEntry[] {
  const entradas: { label: string; items: PortalNavItem[] }[] = [];
  const porSeccion = new Map<string, { label: string; items: PortalNavItem[] }>();
  for (const item of group.items) {
    if (!item.section) {
      entradas.push({ label: item.label, items: [item] });
      continue;
    }
    const existente = porSeccion.get(item.section);
    if (existente) {
      existente.items.push(item);
    } else {
      const nueva = { label: item.section, items: [item] };
      porSeccion.set(item.section, nueva);
      entradas.push(nueva);
    }
  }
  return entradas;
}

/** La pantalla activa para `url`, o `null`. */
export function activeItem(url: string): PortalNavItem | null {
  for (const grupo of PORTAL_NAV) {
    const item = grupo.items.find((i) => isActive(i, url));
    if (item) return item;
  }
  return null;
}

/** Las pestañas-enlace de la pantalla activa: sus hermanas de sección, sólo si son dos o más. */
export function siblingTabs(url: string): readonly PortalNavItem[] {
  const item = activeItem(url);
  if (!item?.section) return [];
  const hermanas = PORTAL_NAV.flatMap((g) => g.items).filter((i) => i.section === item.section);
  return hermanas.length >= 2 ? hermanas : [];
}

/** Lo que la cabecera de la pantalla activa muestra sin que la pantalla lo diga. */
export interface PortalHeader {
  readonly icon: NavIconName | null;
  /** El nombre del grupo de la barra lateral («Gobierno y acceso»). */
  readonly eyebrow: string;
}

/**
 * Icono y eyebrow de la cabecera para `url`: el icono propio de la pantalla (o
 * el de su grupo) y el nombre del grupo. Fuera de cualquier pantalla conocida,
 * nada: la cabecera se queda como la escribió la pantalla.
 */
export function headerFor(url: string): PortalHeader {
  const grupo = groupOf(url);
  const item = activeItem(url);
  if (!grupo || !item) return { icon: null, eyebrow: '' };
  return { icon: item.icon ?? grupo.icon, eyebrow: grupo.label };
}
