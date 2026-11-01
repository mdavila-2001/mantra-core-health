import { navScreenKey } from '../../../core/visibility/ui-element-keys';
import { declareUiElements, type UiElementDeclaration } from '../../../core/visibility/ui-element-registry';

/**
 * Lo que de «Siniestralidad y analítica» se puede mostrar u ocultar por regla de visibilidad.
 *
 * Datos puros: la plantilla usa las claves con `*appVisible`, y `app/ui-elements.catalog.ts` importa este archivo
 * para que el portal de administración las sincronice. **Ocultar no es autorizar**: el CSV se arma con lo que la API
 * ya devolvió a quien mira, y la API sigue decidiendo qué le devuelve.
 */
export const INSURANCE_ANALYTICS_UI = {
  exportCsv: 'insurance.analytics.export-csv',
  topMedications: 'insurance.analytics.top-medications',
  personReportExport: 'insurance.analytics.person-report-export',
} as const;

/** La pantalla del menú (`administration/insurance-analytics`) y su módulo (M26 insurance). */
const PANTALLA = navScreenKey('administration/insurance-analytics');
const MODULO = 'insurance';

export const INSURANCE_ANALYTICS_UI_ELEMENTS: readonly UiElementDeclaration[] = [
  {
    key: INSURANCE_ANALYTICS_UI.exportCsv,
    kind: 'ACTION',
    moduleCode: MODULO,
    parentKey: PANTALLA,
    label: 'Botón «Exportar reporte CSV»',
    description: 'Descarga en CSV el tablero actuarial del período y el plan elegidos.',
  },
  {
    key: INSURANCE_ANALYTICS_UI.topMedications,
    kind: 'WIDGET',
    moduleCode: MODULO,
    parentKey: PANTALLA,
    label: 'Panel «Top 10 medicamentos»',
    description: 'Los diez medicamentos con más gasto facturado del período, en la pestaña de morbilidad.',
  },
  {
    key: INSURANCE_ANALYTICS_UI.personReportExport,
    kind: 'ACTION',
    moduleCode: MODULO,
    parentKey: PANTALLA,
    label: 'Botón «Exportar CSV» del informe por persona',
    description: 'Descarga el informe de siniestralidad por persona ya generado (pestaña «Por persona»).',
  },
];

declareUiElements(INSURANCE_ANALYTICS_UI_ELEMENTS);
