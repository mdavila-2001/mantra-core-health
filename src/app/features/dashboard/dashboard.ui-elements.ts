import { navScreenKey } from '../../core/visibility/ui-element-keys';
import { declareUiElements, type UiElementDeclaration } from '../../core/visibility/ui-element-registry';

/**
 * Lo que del panel se puede mostrar u ocultar por regla de visibilidad (catálogo de la pantalla `dashboard`).
 *
 * Datos puros: la plantilla usa las claves con `*appVisible`, y `app/ui-elements.catalog.ts` importa este archivo
 * para que el portal de administración las sincronice. **Ocultar no es autorizar**: la API sigue decidiendo.
 */
export const DASHBOARD_UI = {
  todayAgenda: 'dashboard.today-agenda',
  consultationsSummary: 'dashboard.consultations-summary',
  latestPatients: 'dashboard.latest-patients',
  myVerificationsShortcut: 'dashboard.my-verifications-shortcut',
  practitionerRequestsShortcut: 'dashboard.practitioner-requests-shortcut',
} as const;

/** El panel es la sección `dashboard` del menú (`nav.dashboard`) y su módulo es el de las proyecciones de lectura. */
const PANEL = navScreenKey('dashboard');
const MODULO = 'read_models';

/** Lo que el panel declara al catálogo. */
export const DASHBOARD_UI_ELEMENTS: readonly UiElementDeclaration[] = [
  {
    key: DASHBOARD_UI.todayAgenda,
    kind: 'WIDGET',
    moduleCode: MODULO,
    parentKey: PANEL,
    label: 'Agenda de hoy',
    description: 'La jornada de quien atiende: qué toca hoy, con salida a la agenda completa.',
  },
  {
    key: DASHBOARD_UI.consultationsSummary,
    kind: 'WIDGET',
    moduleCode: MODULO,
    parentKey: PANEL,
    label: 'Resumen de consultas',
    description: 'Reporte semanal o mensual de consultas y mapa de calor.',
  },
  {
    key: DASHBOARD_UI.latestPatients,
    kind: 'WIDGET',
    moduleCode: MODULO,
    parentKey: PANEL,
    label: 'Últimos pacientes',
    description: 'Los últimos pacientes registrados en la organización, con el total.',
  },
  {
    key: DASHBOARD_UI.myVerificationsShortcut,
    kind: 'ACTION',
    moduleCode: MODULO,
    parentKey: PANEL,
    label: 'Acceso a «Mis verificaciones»',
    description: 'Franja del panel que lleva al sello de verificación y a las respuestas de las instituciones.',
  },
  {
    key: DASHBOARD_UI.practitionerRequestsShortcut,
    kind: 'ACTION',
    moduleCode: MODULO,
    parentKey: PANEL,
    label: 'Acceso a «Profesionales que piden sumarse»',
    description: 'Franja del panel de la aseguradora que lleva a la bandeja de solicitudes de profesionales.',
  },
];

declareUiElements(DASHBOARD_UI_ELEMENTS);
