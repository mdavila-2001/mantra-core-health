import { ANY_ROLE } from './navigation.types';
import type { AppSection } from './navigation.types';

/* ============================================================================
    El portal de la **cuenta de laboratorio**: cuatro secciones de un menú plano y
    cerrado (resumen, órdenes, precios y sucursales), todas solo para el tipo de
    organización `DIAGNOSTIC_CENTER`. Desde el 31/10/2026 «Órdenes» junta lo que
    antes eran recepción de muestras, cola de trabajo y resultados.

    Viven en su propio archivo y no en `navigation.map.ts` porque ese registro
    está congelado por `scripts/check-max-lines.mjs` (un ratchet: no puede
    crecer) y estas cuatro son una unidad: se mudan juntas. Mismo patrón que
    `navigation.platform.ts`.

    `navigation.map.ts` las esparce al **final** de `APP_SECTIONS`, donde
    estaban, así que el orden del registro —que es el orden del menú— no cambia.
    ========================================================================== */

export const SECCIONES_DE_LABORATORIO: readonly AppSection[] = [
  {
    // El portal de la cuenta de laboratorio (30/09/2026): el mismo menú plano que
    // tiene la farmacia desde el 29/09, adaptado a quien vende servicios y no
    // productos. Rutas bajo `administration/` por la misma razón que las de la
    // farmacia: nada de prefijos que el proxy se coma (check-route-prefixes).
    path: 'administration/laboratory',
    // Sólo la cuenta de laboratorio (30/09/2026): su menú es plano y cerrado,
    // como el del mostrador de la farmacia. La autoridad sigue siendo la API.
    onlyForTenantTypes: ['DIAGNOSTIC_CENTER'],
    roles: [ANY_ROLE],
    fueraDelMenuPara: ['PRACTITIONER'],
    hiddenFor: ['PATIENT'],
    label: 'Resumen',
    group: 'General',
    icon: 'home',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'Cómo va su laboratorio: servicios, órdenes sin resultado y lo último que pasó.',
    module: 'M20 diagnostics',
  },
  {
    // Las órdenes del laboratorio y del centro de imagenología (31/10/2026): UNA
    // pantalla en lugar de «Recepción de muestras», «Cola de trabajo» y
    // «Resultados». El camino es Borrador → Recibida → Procesada → Subidos, con
    // Cancelada y Rechazada como salidas, y cada paso es una acción del menú de
    // tres puntos de la fila. La autoridad de cada paso sigue siendo la API.
    path: 'administration/laboratory-orders',
    onlyForTenantTypes: ['DIAGNOSTIC_CENTER'],
    roles: [ANY_ROLE],
    fueraDelMenuPara: ['PRACTITIONER'],
    hiddenFor: ['PATIENT'],
    label: 'Órdenes',
    group: 'General',
    icon: 'orders',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'Reciba cada orden, márquela como procesada, suba sus resultados y descárguelos.',
    module: 'M20 diagnostics',
  },
  {
    // Los precios del laboratorio (01/10/2026): precio de lista y descuento
    // AloVida de cada servicio, editables en una tabla y guardados juntos.
    path: 'administration/laboratory-prices',
    onlyForTenantTypes: ['DIAGNOSTIC_CENTER'],
    roles: [ANY_ROLE],
    fueraDelMenuPara: ['PRACTITIONER'],
    hiddenFor: ['PATIENT'],
    label: 'Precios',
    group: 'General',
    icon: 'tag',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'El precio de lista y el descuento AloVida de cada servicio.',
    module: 'M20 diagnostics',
  },
  {
    // Las sucursales del laboratorio (01/10/2026): la misma pantalla que la de la
    // farmacia, sobre la organización activa.
    path: 'administration/laboratory-branches',
    onlyForTenantTypes: ['DIAGNOSTIC_CENTER'],
    roles: [ANY_ROLE],
    fueraDelMenuPara: ['PRACTITIONER'],
    hiddenFor: ['PATIENT'],
    label: 'Sucursales',
    group: 'General',
    icon: 'pin',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'Edite sus sucursales o suba varias de una vez con un CSV.',
    module: 'M04 directory',
  },
];
