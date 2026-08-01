/* ============================================================================
    API pública de los organisms — secciones funcionales completas.
    ========================================================================== */

/**
 * Diálogo modal reutilizable: foco adentro al abrir, trampa de Tab, Escape,
 * clic en el fondo y devolución del foco al cerrar.
 */
export { DialogComponent } from './dialog/dialog';

/**
 * El date-picker es un organism, no una molecule: monta un diálogo modal y
 * coordina calendario y hora.
 */
export { DatePickerComponent } from './date-picker/date-picker';
export { DATE_PICKER_MODES } from './date-picker/date-picker.types';
export type { CalendarDay, DatePickerMode } from './date-picker/date-picker.types';

/**
 * El contenedor es la región viva de los avisos y coordina la cola entera:
 * es una sección de la aplicación, no una pieza componible.
 */
export { ToastContainer } from './toast-container/toast-container';
