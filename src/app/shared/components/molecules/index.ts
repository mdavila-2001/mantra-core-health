/* ============================================================================
    API pública de las molecules.
    ========================================================================== */

/* `AccordionPanel` se declara junto al `Accordion`: solo existe dentro de él. */
export { Accordion } from './accordion/accordion';
export { AccordionPanel } from './accordion/accordion-panel/accordion-panel';
export { ACCORDION_PARENT } from './accordion/accordion.types';
export type { AccordionHost } from './accordion/accordion.types';

export { Alert } from './alert/alert';
export { ALERT_TONE_NOUNS, ALERT_TONES } from './alert/alert.types';
export type { AlertTone } from './alert/alert.types';

export { AvatarGroup } from './avatar-group/avatar-group';

export { Breadcrumb } from './breadcrumb/breadcrumb';
export {
  BREADCRUMB_COLLAPSE_THRESHOLD,
  BREADCRUMB_VISIBLE_TAIL,
} from './breadcrumb/breadcrumb.types';
export type { BreadcrumbItem } from './breadcrumb/breadcrumb.types';

export { Card } from './card/card';
export { CARD_PADDINGS, CARD_VARIANTS } from './card/card.types';
export type { CardPadding, CardVariant } from './card/card.types';

/**
 * El diálogo se abre por el servicio, no declarándolo en una plantilla: así hay
 * una sola instancia y el foco no queda repartido entre varias.
 */
export { Dialog } from './dialog/dialog';
export { DialogService } from './dialog/dialog-service';
export { DEFAULT_CANCEL_LABEL, DEFAULT_CONFIRM_LABEL } from './dialog/dialog.types';
export type { DialogConfig } from './dialog/dialog.types';

export { EmptyState } from './empty-state/empty-state';
export { EMPTY_STATE_VARIANTS } from './empty-state/empty-state.types';
export type { EmptyStateVariant } from './empty-state/empty-state.types';

export { FileInput } from './file-input/file-input';
export type { RejectedFile } from './file-input/file-input';

export { FormField } from './form-field/form-field';

/* `MenuItem` y `MenuTrigger` solo tienen sentido dentro de un `Menu`. */
export { Menu } from './menu/menu';
export { MenuItem } from './menu/menu-item/menu-item';
export { MenuTrigger } from './menu/menu-trigger/menu-trigger';
export { MENU_GAP_PX, MENU_PARENT } from './menu/menu.types';
export type { MenuHost } from './menu/menu.types';

/* Exportar a PDF desde cualquier pantalla. El servicio va aparte para que se
   pueda sustituir en pruebas: `exportElementToPdf` es función de módulo y el
   espacio de nombres de un módulo ES está congelado. */
export { PdfExportButton } from './pdf-export-button/pdf-export-button';
export { PdfExportService } from './pdf-export-button/pdf-export.service';

export { Pagination } from './pagination/pagination';
export {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZE_OPTIONS,
  MAX_PAGE_SLOTS,
  PAGE_GAP,
} from './pagination/pagination.types';
export type { PageGap, PageSlot } from './pagination/pagination.types';

/**
 * `radio` y `radio-group` son un par: el grupo es el control (tiene el `value`)
 * y el radio solo se pinta a partir de él. Por eso el radio NO es un atom —
 * su propia documentación lo dice: «un radio suelto no significa nada».
 */
export { Radio } from './radio/radio';
export { RadioGroup } from './radio-group/radio-group';

export { ReferenceCombobox } from './reference-combobox/reference-combobox';
export {
  REFERENCE_COMBOBOX_DEBOUNCE_MS,
  REFERENCE_COMBOBOX_MIN_QUERY_LENGTH,
} from './reference-combobox/reference-combobox.types';
export type { ReferenceOption } from './reference-combobox/reference-combobox.types';

export { SearchField } from './search-field/search-field';
export { SEARCH_DEBOUNCE_MS } from './search-field/search-field.types';

/* La tarjeta de la superficie pública (V65). Su diseño vive en `redsat.css`
   §25, no en el componente — ver su `.css`, que está vacío a propósito. */
export { SearchResult } from './search-result/search-result';
export { SEARCH_RESULT_TONES } from './search-result/search-result.types';
export type {
  SearchResultItem,
  SearchResultMeta,
  SearchResultSeal,
  SearchResultTone,
} from './search-result/search-result.types';

export { Stepper } from './stepper/stepper';
export { STEP_STATUSES } from './stepper/stepper.types';
export type { StepperStep, StepStatus } from './stepper/stepper.types';

/* `Tab` es la pestaña individual; sin `Tabs` alrededor no significa nada. */
export { Tabs } from './tabs/tabs';
export { Tab } from './tabs/tab/tab';
export {
  TAB_ACTIVATION_KEYS,
  TAB_NAVIGATION_KEYS,
  TABS_ORIENTATIONS,
  TABS_PARENT,
} from './tabs/tabs.types';
export type { TabsHost, TabsOrientation } from './tabs/tabs.types';

export { Toast } from './toast/toast';
export { ToastService } from './toast/toast.service';
export { TOAST_DEFAULT_DURATION_MS, TOAST_TYPE_LABEL } from './toast/toast.types';
export type { ToastInput, ToastMessage, ToastType } from './toast/toast.types';
