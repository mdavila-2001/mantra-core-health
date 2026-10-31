import { ANY_ROLE } from './navigation.types';
import type { AppSection } from './navigation.types';

/* ============================================================================
    El portal de la plataforma misma, en el dominio «Superadministración».

    Once secciones: las cuatro que vivían bajo `administration/*` —retiradas del
    menú, con su ruta redirigiendo— y las siete de `superadmin/*` que las
    reemplazan (la séptima, «Instancias y herramientas», llegó el 31/10/2026).
    Viven en su propio archivo y no en `navigation.map.ts` porque ese registro
    está congelado por `scripts/check-max-lines.mjs` (un ratchet: no puede
    crecer) y porque son una unidad: se mudan juntas.

    `navigation.map.ts` las esparce en `APP_SECTIONS` en el mismo lugar donde
    estaban, así que el orden del registro —que es el orden del menú— no cambia.
    ========================================================================== */

export const SECCIONES_DE_PLATAFORMA: readonly AppSection[] = [
  {
    // Portal administrativo · catálogo de datos (API módulo 67). Los roles son
    // los mismos que exige `GET /admin/catalog/*`: la guarda evita llegar a
    // una pantalla que sólo devolvería 403; la autoridad sigue siendo la API.
    path: 'administration/data-catalog',
    // 17/10/2026 · se mudó a `superadmin/data-catalog` (grupo «Superadministración»). La ruta
    // vieja redirige en `app.routes.ts` (`SECCIONES_REDIRIGIDAS`), conservando
    // el query; la sección se conserva registrada —roles, disponibilidad— para
    // que esa dirección siga resolviendo si alguien la tiene guardada.
    fueraDelMenuPara: [ANY_ROLE],
    label: 'Catálogo de datos',
    group: 'Administración',
    icon: 'book',
    roles: ['SECURITY_ADMIN', 'PLATFORM_ADMIN', 'GOVERNANCE_ADMIN', 'DATA_PLATFORM_ADMIN', 'DPO'],
    availability: 'disponible',
    summary: 'Qué tablas existen, por qué existen, quién responde por ellas y con qué evidencia.',
    module: 'M67 data_catalog',
  },
  {
    // Analítica de producto y RUM sobre `telemetry` (`/admin/analytics`).
    path: 'administration/web-analytics',
    // 17/10/2026 · se mudó a `superadmin/web-analytics` (grupo «Superadministración»). La ruta
    // vieja redirige en `app.routes.ts` (`SECCIONES_REDIRIGIDAS`), conservando
    // el query; la sección se conserva registrada —roles, disponibilidad— para
    // que esa dirección siga resolviendo si alguien la tiene guardada.
    fueraDelMenuPara: [ANY_ROLE],
    label: 'Analítica web',
    group: 'Administración',
    icon: 'chart',
    roles: ['PLATFORM_ADMIN', 'SECURITY_ADMIN', 'DATA_PLATFORM_ADMIN', 'MARKETING_MANAGER', 'DPO'],
    availability: 'disponible',
    summary: 'Tráfico, embudos, Core Web Vitals y salud del pipeline de eventos.',
    module: 'M28 telemetry',
  },
  {
    // QA Lab: lectura del laboratorio (M36) y runner en el servidor (M68).
    path: 'administration/qa-lab',
    // 17/10/2026 · se mudó a `superadmin/qa-lab` (grupo «Superadministración»). La ruta
    // vieja redirige en `app.routes.ts` (`SECCIONES_REDIRIGIDAS`), conservando
    // el query; la sección se conserva registrada —roles, disponibilidad— para
    // que esa dirección siga resolviendo si alguien la tiene guardada.
    fueraDelMenuPara: [ANY_ROLE],
    label: 'QA Lab',
    group: 'Administración',
    icon: 'flask',
    roles: ['QA_ADMIN', 'QA_ENGINEER', 'RELEASE_MANAGER', 'PLATFORM_ADMIN'],
    availability: 'disponible',
    summary: 'Suites, planes de ejecución con aprobación y resultados con evidencia.',
    module: 'M36 qa_lab · M68 qa_execution',
  },
  {
    // Consola de operación y preparación para producción (`/admin/ops`).
    path: 'administration/operations',
    // 17/10/2026 · se mudó a `superadmin/operations` (grupo «Superadministración»). La ruta
    // vieja redirige en `app.routes.ts` (`SECCIONES_REDIRIGIDAS`), conservando
    // el query; la sección se conserva registrada —roles, disponibilidad— para
    // que esa dirección siga resolviendo si alguien la tiene guardada.
    fueraDelMenuPara: [ANY_ROLE],
    label: 'Operación',
    group: 'Administración',
    icon: 'monitor',
    roles: ['PLATFORM_ADMIN', 'SRE', 'SECURITY_ADMIN', 'RELEASE_MANAGER', 'GOVERNANCE_ADMIN'],
    availability: 'disponible',
    summary: 'Preparación para producción con evidencia, incidentes, SLO y backups.',
    module: 'M11 system_ops · M46 platform_ops',
  },
  /* -- Superadministración (17/10/2026) ----------------------------------- */
  {
    // La portada del dominio: la salud del sistema (31/10/2026). Lee
    // `GET /admin/observability/*` (módulo 70), y por eso los roles son los de esa lectura
    // —`OPS_READ_ROLES` en la API—: la guarda evita llegar a una pantalla que sólo
    // devolvería 403; la autoridad sigue siendo la API.
    path: 'superadmin/observability',
    label: 'Observabilidad',
    group: 'Superadministración',
    icon: 'chart',
    roles: ['PLATFORM_ADMIN', 'SRE', 'SECURITY_ADMIN', 'RELEASE_MANAGER', 'GOVERNANCE_ADMIN'],
    availability: 'disponible',
    summary: 'Cómo está la API: tráfico, errores agrupados con su requestId, latencia, consultas SQL y lo que no se mide.',
    module: 'M70 observability · M58 time_series',
  },
  {
    // Medición por funcionalidad (30/10/2026): uso, errores y latencia agrupados
    // por herramienta (`GET /admin/ops/traffic*`), dinero que mueve cada una
    // (`GET /admin/analytics/money`) y mapa de calor (`/admin/analytics/onboarding/*`).
    // Roles = los de la lectura de tráfico (`OPS_READ_ROLES`), que es la pestaña
    // principal. No se agrega `FINANCE`: la API no lo declara como rol de lectura de
    // ninguno de estos endpoints (el de dinero está en implementación). Cada
    // pestaña pide por su cuenta y, si la sesión no tiene el rol de esa lectura,
    // dice que no tiene permiso sin apagar a las otras; la autoridad es la API.
    path: 'superadmin/measurement',
    label: 'Medición por funcionalidad',
    group: 'Superadministración',
    icon: 'chart',
    roles: ['PLATFORM_ADMIN', 'SRE', 'SECURITY_ADMIN', 'RELEASE_MANAGER', 'GOVERNANCE_ADMIN'],
    availability: 'disponible',
    summary: 'Cuánto se usa cada herramienta, cuánto dinero mueve y dónde falla: uso, errores, latencia y mapa de calor.',
    module: 'M58 time_series · M28 telemetry',
  },
  {
    // Antes `administration/data-catalog` (API módulo 67). Roles = los de
    // `GET /admin/catalog/*`.
    path: 'superadmin/data-catalog',
    label: 'Catálogo de datos',
    group: 'Superadministración',
    icon: 'book',
    roles: ['SECURITY_ADMIN', 'PLATFORM_ADMIN', 'GOVERNANCE_ADMIN', 'DATA_PLATFORM_ADMIN', 'DPO'],
    availability: 'disponible',
    summary: 'Qué tablas, columnas, esquemas y relaciones existen, y por qué existe cada una.',
    module: 'M67 data_catalog',
  },
  {
    // Portal de inventario (H5): el mapa de sistemas, procesos, catálogo y linaje
    // que genera la API (`/admin/portal/*`). Roles = los de lectura de esa API.
    path: 'superadmin/portal',
    label: 'Portal de inventario',
    group: 'Superadministración',
    icon: 'route',
    roles: ['SECURITY_ADMIN', 'PLATFORM_ADMIN', 'GOVERNANCE_ADMIN', 'DATA_PLATFORM_ADMIN', 'DPO'],
    availability: 'disponible',
    summary: 'El sistema tal como lo ve el código: operaciones, procesos, tablas y linaje.',
    module: 'M67 data_catalog',
  },
  {
    // El árbol de decisión de cada recorrido del usuario, con sus endpoints y
    // sus casos válidos, límite e inválidos. Roles = los de `GET /admin/qa/*`
    // (`QA_LAB_READ_ROLES`): los flujos viven en el QA Lab.
    path: 'superadmin/flows',
    label: 'Catálogo de flujos',
    group: 'Superadministración',
    icon: 'route',
    roles: ['QA_ADMIN', 'QA_ENGINEER', 'RELEASE_MANAGER', 'PLATFORM_ADMIN'],
    availability: 'disponible',
    summary: 'Cada recorrido del usuario como árbol de decisión: pasos, endpoints y casos válidos, límite e inválidos.',
    module: 'M36 qa_lab',
  },
  {
    // Antes `administration/qa-lab`: lectura del laboratorio (M36) y runner en
    // el servidor (M68).
    path: 'superadmin/qa-lab',
    label: 'Orquestación de pruebas',
    group: 'Superadministración',
    icon: 'flask',
    roles: ['QA_ADMIN', 'QA_ENGINEER', 'RELEASE_MANAGER', 'PLATFORM_ADMIN'],
    availability: 'disponible',
    summary: 'Suites, planes de ejecución con aprobación y resultados con evidencia.',
    module: 'M36 qa_lab · M68 qa_execution',
  },
  {
    // Antes `administration/web-analytics`: analítica de producto y RUM sobre
    // `telemetry` (`/admin/analytics`).
    path: 'superadmin/web-analytics',
    label: 'Analítica web',
    group: 'Superadministración',
    icon: 'globe',
    roles: ['PLATFORM_ADMIN', 'SECURITY_ADMIN', 'DATA_PLATFORM_ADMIN', 'MARKETING_MANAGER', 'DPO'],
    availability: 'disponible',
    summary: 'Tráfico, embudos, Core Web Vitals y salud del pipeline de eventos.',
    module: 'M28 telemetry',
  },
  {
    // Antes `administration/operations`: consola de operación y preparación
    // para producción (`/admin/ops`).
    path: 'superadmin/operations',
    label: 'Operación',
    group: 'Superadministración',
    icon: 'monitor',
    roles: ['PLATFORM_ADMIN', 'SRE', 'SECURITY_ADMIN', 'RELEASE_MANAGER', 'GOVERNANCE_ADMIN'],
    availability: 'disponible',
    summary: 'Preparación para producción con evidencia, incidentes, SLO y backups.',
    module: 'M11 system_ops · M46 platform_ops',
  },
  {
    // Instancias (API, workers, bases, servicios) con su sonda de vida y
    // herramientas externas con su estado, como en el portal de Atlas
    // (31/10/2026). Lee `GET /admin/ops/instances/liveness` y `GET /admin/ops/tools`
    // (`ops_console`), así que los roles son `OPS_READ_ROLES`, los mismos que
    // Observabilidad y Operación. La autoridad sigue siendo la API.
    path: 'superadmin/instances',
    label: 'Instancias y herramientas',
    group: 'Superadministración',
    icon: 'monitor',
    roles: ['PLATFORM_ADMIN', 'SRE', 'SECURITY_ADMIN', 'RELEASE_MANAGER', 'GOVERNANCE_ADMIN'],
    availability: 'disponible',
    summary: 'Qué procesos y herramientas tiene la plataforma, y si cada uno tiene vida ahora.',
    module: 'M46 platform_ops · ops_console',
  },
  {
    // Cargas masivas (`/admin/bulk-imports`, módulo `bulk_import`): altas de
    // usuarios y carga especial de historias clínicas, con plantilla CSV y JSON
    // por tipo. La API exige el rol de gestión (`SECURITY_ADMIN`/`PLATFORM_ADMIN`)
    // y, además, el permiso fino del tipo (`bulk_import.users` / `.clinical`):
    // sin él responde 403 y la pantalla lo dice. La autoridad es la API.
    path: 'superadmin/bulk-imports',
    label: 'Cargas masivas',
    group: 'Superadministración',
    icon: 'package',
    roles: ['SECURITY_ADMIN', 'PLATFORM_ADMIN'],
    availability: 'disponible',
    summary: 'Altas masivas de usuarios y carga especial de historias clínicas, con plantilla CSV y JSON, vista previa, confirmación e informe.',
    module: 'bulk_import',
  },
];
