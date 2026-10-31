import { ANY_ROLE } from './navigation.types';
import type { AppSection } from './navigation.types';

/* ============================================================================
    El portal de la **cuenta de laboratorio**: seis secciones de un menú plano y
    cerrado (resumen, recepción de muestras, cola de trabajo, resultados, precios
    y sucursales), todas solo para el tipo de organización `DIAGNOSTIC_CENTER`.

    Viven en su propio archivo y no en `navigation.map.ts` porque ese registro
    está congelado por `scripts/check-max-lines.mjs` (un ratchet: no puede
    crecer) y estas seis son una unidad: se mudan juntas. Mismo patrón que
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
    // La recepción de muestras del laboratorio: la bandeja de órdenes que
    // otras organizaciones le dirigieron (`POST /diagnostics/service-requests/inbox`)
    // y los dos actos que la vacían —recibir la muestra y acesionarla—. Es el
    // paso que falta **antes** de «Laboratorio e imagen», cuya cola arranca
    // cuando la acesión ya existe.
    //
    // Quien la opera es el personal de un centro de diagnóstico, que no tiene
    // rol propio en el token: el dueño entra con `USER` y su autoridad es la
    // membresía. La API decide con `LabStaffGuard` (miembro activo de un tenant
    // `DIAGNOSTIC_CENTER`, o `CLINICIAN`/`PRACTITIONER` del tenant activo); el
    // menú sólo puede mirar el tipo de la organización activa, y es lo que
    // mira. El paciente queda afuera también por rol: su membresía en el
    // tenant por defecto no lo vuelve personal de nadie.
    path: 'laboratory/reception',
    label: 'Recepción de muestras',
    // `General` desde el 30/09/2026: es un renglón del menú plano de la cuenta
    // de laboratorio, como los del mostrador de la farmacia.
    group: 'General',
    icon: 'flask',
    roles: [ANY_ROLE],
    requiresTenant: true,
    hiddenFor: ['PATIENT'],
    onlyForTenantTypes: ['DIAGNOSTIC_CENTER'],
    availability: 'disponible',
    summary: 'Reciba las muestras de las órdenes que le derivaron y registre su acesión.',
    module: 'M20 diagnostics',
  },
  {
    // La cola de trabajo del laboratorio, para su propio personal. Es la misma
    // pantalla que «Laboratorio e imagen» (`GET /diagnostics/work-orders`),
    // pero aquélla exige `CLINICIAN`/`PRACTITIONER` y el personal de un centro
    // de diagnóstico no tiene rol en el token: la API la abre con
    // `LabStaffGuard` (membresía en un `DIAGNOSTIC_CENTER`), y el menú, igual
    // que la recepción, mira el tipo de la organización activa. Dos secciones
    // y no una con dos reglas: `isVisibleTo` no sabe decir «este rol **o**
    // este tipo de organización», y enseñárselo para una sola pantalla sería
    // una regla nueva en el corazón del menú.
    path: 'laboratory/queue',
    label: 'Cola de trabajo',
    // `General` desde el 30/09/2026: es un renglón del menú plano de la cuenta
    // de laboratorio, como los del mostrador de la farmacia.
    group: 'General',
    icon: 'scan',
    roles: [ANY_ROLE],
    requiresTenant: true,
    hiddenFor: ['PATIENT'],
    onlyForTenantTypes: ['DIAGNOSTIC_CENTER'],
    availability: 'disponible',
    summary: 'Siga las órdenes de trabajo de las muestras que acesionaste.',
    module: 'M20 diagnostics',
  },
  {
    // Los resultados: el laboratorio sube archivos de cualquier formato y sin
    // tope de tamaño (por partes), y ve todo lo subido con su visor.
    path: 'administration/laboratory-results',
    // Sólo la cuenta de laboratorio (30/09/2026): su menú es plano y cerrado,
    // como el del mostrador de la farmacia. La autoridad sigue siendo la API.
    onlyForTenantTypes: ['DIAGNOSTIC_CENTER'],
    roles: [ANY_ROLE],
    fueraDelMenuPara: ['PRACTITIONER'],
    hiddenFor: ['PATIENT'],
    label: 'Resultados',
    group: 'General',
    icon: 'results',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'Suba los resultados en cualquier formato y mire todo lo que ya subió.',
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
