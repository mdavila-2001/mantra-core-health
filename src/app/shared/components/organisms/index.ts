/* ============================================================================
    API pública de los organisms — secciones funcionales completas.
    ========================================================================== */

/* Subida genérica de adjuntos: la usan la ficha clínica y, más adelante,
   presupuestos, procedimientos y laboratorios. No sabe de dominio. */
export { AttachmentUploader } from './attachment-uploader/attachment-uploader';

export { AuthLayout } from './auth-layout/auth-layout';

export { DataTable } from './data-table/data-table';
export {
  COLUMN_ALIGNMENTS,
  MOBILE_DETAIL_PRIORITY,
  SORT_DIRECTIONS,
} from './data-table/data-table.types';
export type {
  ColumnAlignment,
  ColumnDef,
  CursorState,
  SortDirection,
  SortState,
} from './data-table/data-table.types';

/**
 * El date-picker es un organism, no una molecule: monta un diálogo modal y
 * coordina calendario y hora.
 */
export { DatePicker } from './date-picker/date-picker';
export type { CalendarDay } from './date-picker/date-picker';
export { DATE_PICKER_MODES } from './date-picker/date-picker.types';
export type { DatePickerMode } from './date-picker/date-picker.types';

export { FactSection } from './fact-section/fact-section';
export { BLOQUES_POR_PAGINA, MINIMO_PARA_BUSCAR } from './fact-section/fact-section.types';
export type { BloqueDeFicha } from './fact-section/fact-section.types';

export { SurveyForm } from './survey-form/survey-form';
export type {
  RespuestasDelCuestionario,
  ValorDeRespuesta,
} from './survey-form/survey-form';

export { FilterBar, SEARCH_PARAM } from './filter-bar/filter-bar';
export type { ActiveFilter, FilterDef } from './filter-bar/filter-bar';

export { CORRECTION_LABEL, FormActions } from './form-actions/form-actions';

export { FormSection } from './form-section/form-section';

export { Header } from './header/header';
export type { HeaderUser } from './header/header.types';

export { AppMap, CARGADOR_DE_LEAFLET, construirPopup } from './map/map';
export type { CargadorDeLeaflet } from './map/map';
export { distanciaEnLineaRectaKm, ordenarPorCercania } from './map/geo';
export type { EstadoDePin, PinMapa, PuntoGeo } from './map/pin-mapa.types';

/**
 * El rail de la superficie pública. Reemplaza las ocho copias de `app-tabs`
 * que vivían dentro de las plantillas de `features/alovida/buscar/`.
 */
export { PublicNavRail } from './public-nav-rail/public-nav-rail';
export { PUBLIC_NAV_RAIL_SECTIONS } from './public-nav-rail/public-nav-rail.types';
export type {
  PublicNavRailEntry,
  PublicNavRailGroup,
} from './public-nav-rail/public-nav-rail.types';

export { PageHeader } from './page-header/page-header';
export type { PageHeaderAction } from './page-header/page-header';

export { MAIN_CONTENT_ID, Shell } from './shell/shell';
export { NAV_STORAGE_KEY, ShellService } from './shell/shell-service';

export { SideNav } from './side-nav/side-nav';
export { NAV_ICON_NAMES, NAV_MODES } from './side-nav/side-nav.types';
export type { NavIconName, NavItem, NavMode, NavSection } from './side-nav/side-nav.types';

export { SpecialtyBrowser } from './specialty-browser/specialty-browser';
export type {
  SpecialtyGroup,
  SpecialtyItemContext,
} from './specialty-browser/specialty-browser.types';

/* La insignia de especialidad (C-09): UNA forma de mostrar una especialidad en
   todo el proyecto. El grid va al lado porque el orden —la principal primero—
   y el hueco entre insignias son decisiones del sistema, no de cada pantalla.
   Están acá y no en `molecules/` porque la insignia monta `StatusSeal`; el
   porqué completo, en el encabezado de `specialty-badge.ts`. */
export { SpecialtyBadge } from './specialty-badge/specialty-badge';
export { SpecialtyBadgeGrid } from './specialty-badge-grid/specialty-badge-grid';
export type { SpecialtyBadgeItem } from './specialty-badge/specialty-badge.types';

export { StatusSeal } from './status-seal/status-seal';
export { STATUS_SEAL_VARIANTS, UNKNOWN_STATUS_VARIANT } from './status-seal/status-seal.types';
export type { StatusSealVariant } from './status-seal/status-seal.types';

export { TenantSwitcher } from './tenant-switcher/tenant-switcher';
export { TENANT_SWITCHER_VARIANTS } from './tenant-switcher/tenant-switcher.types';
export type { TenantOption, TenantSwitcherVariant } from './tenant-switcher/tenant-switcher.types';

/**
 * El contenedor coordina la cola entera de avisos: es una sección de la
 * aplicación, no una pieza componible.
 */
export { ToastContainer } from './toast-container/toast-container';

export { ViewStateHost } from './view-state-host/view-state-host';
