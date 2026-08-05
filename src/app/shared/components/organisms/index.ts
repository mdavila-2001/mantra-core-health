/* ============================================================================
    API pública de los organisms — secciones funcionales completas.
    ========================================================================== */

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

export { FilterBar, SEARCH_PARAM } from './filter-bar/filter-bar';
export type { ActiveFilter, FilterDef } from './filter-bar/filter-bar';

export { CORRECTION_LABEL, FormActions } from './form-actions/form-actions';

export { FormSection } from './form-section/form-section';

export { Header } from './header/header';
export type { HeaderUser } from './header/header.types';

export { PageHeader } from './page-header/page-header';
export type { PageHeaderAction } from './page-header/page-header';

export { MAIN_CONTENT_ID, Shell } from './shell/shell';
export { NAV_STORAGE_KEY, ShellService } from './shell/shell-service';

export { SideNav } from './side-nav/side-nav';
export { NAV_ICON_NAMES, NAV_MODES } from './side-nav/side-nav.types';
export type { NavIconName, NavItem, NavMode, NavSection } from './side-nav/side-nav.types';

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
