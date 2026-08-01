/* ============================================================================
    API pública de las molecules.
    ========================================================================== */

export { AvatarGroupComponent } from './avatar-group/avatar-group';

export { FileInputComponent } from './file-input/file-input';
export type { RejectedFile } from './file-input/file-input';

export { FormFieldComponent } from './form-field/form-field';

/**
 * `radio` y `radio-group` son un par: el grupo es el control (tiene el `value`)
 * y el radio solo se pinta a partir de él. Por eso el radio NO es un atom —
 * su propia documentación lo dice: «un radio suelto no significa nada».
 */
export { RadioComponent } from './radio/radio';
export { RadioGroupComponent } from './radio-group/radio-group';

export { Toast } from './toast/toast';
export { ToastService } from './toast/toast.service';
export { TOAST_DEFAULT_DURATION_MS, TOAST_MAX_VISIBLE } from './toast/toast.types';
export type { ToastMessage, ToastOptions } from './toast/toast.types';

