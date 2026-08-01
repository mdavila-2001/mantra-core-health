/* ============================================================================
    API pública de los atoms. Un consumidor importa desde `@shared/components/atoms`
    y nunca desde la ruta interna del archivo: así mover una carpeta se paga
    una sola vez, acá.
    ========================================================================== */

export { Avatar } from './avatar/avatar';
export { AVATAR_SIZES, AVATAR_TONES } from './avatar/avatar.types';
export type { AvatarSize, AvatarStatus, AvatarTone } from './avatar/avatar.types';

export { Badge } from './badge/badge';
export { BADGE_SIZES, BADGE_VARIANTS } from './badge/badge.types';
export type { BadgeSize, BadgeValue, BadgeVariant } from './badge/badge.types';

export { AppButtonComponent } from './button/button';
export { BUTTON_SIZES, BUTTON_VARIANTS } from './button/button.types';
export type { ButtonSize, ButtonType, ButtonVariant } from './button/button.types';

export { CheckboxComponent } from './checkbox/checkbox';

export { InputComponent } from './input/input';
export { INPUT_TYPES } from './input/input.types';
export type { InputType } from './input/input.types';

export { SelectComponent } from './select/select';
export type { SelectOption } from './select/select.types';

export { SwitchComponent } from './switch/switch';
