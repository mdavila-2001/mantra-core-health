/* ============================================================================
    API pública de los atoms. Un consumidor importa desde `@shared/components/atoms`
    y nunca desde la ruta interna del archivo: así mover una carpeta se paga
    una sola vez, acá.
    ========================================================================== */

export { Avatar } from './avatar/avatar';
export { AVATAR_SIZES, AVATAR_STATUSES, AVATAR_TONES } from './avatar/avatar.types';
export type { AvatarSize, AvatarStatus, AvatarTone } from './avatar/avatar.types';

export { Badge } from './badge/badge';
export { BADGE_SIZES, BADGE_VARIANTS } from './badge/badge.types';
export type { BadgeSize, BadgeValue, BadgeVariant } from './badge/badge.types';

export { AppButton } from './button/button';
export { BUTTON_SIZES, BUTTON_VARIANTS } from './button/button.types';
export type { ButtonSize, ButtonType, ButtonVariant } from './button/button.types';

export { Checkbox } from './checkbox/checkbox';

export { Chip } from './chip/chip';
export { CHIP_REMOVE_KEYS, CHIP_SIZES, CHIP_VARIANTS } from './chip/chip.types';
export type { ChipSize, ChipVariant } from './chip/chip.types';

export { Divider } from './divider/divider';
export { DIVIDER_ORIENTATIONS } from './divider/divider.types';
export type { DividerOrientation } from './divider/divider.types';

export { Input } from './input/input';
export { INPUT_TYPES } from './input/input.types';
export type { InputType } from './input/input.types';

export { Link } from './link/link';
export { BROWSABLE_PROTOCOLS, LINK_VARIANTS } from './link/link.types';
export type { LinkVariant } from './link/link.types';

export { Progress } from './progress/progress';
export {
  PROGRESS_MAX,
  PROGRESS_MIN,
  PROGRESS_SIZES,
  PROGRESS_TONES,
} from './progress/progress.types';
export type { ProgressSize, ProgressTone } from './progress/progress.types';

export { Select } from './select/select';
export type { SelectOption } from './select/select.types';

export { Skeleton } from './skeleton/skeleton';
export { SKELETON_LAST_LINE_WIDTH, SKELETON_VARIANTS } from './skeleton/skeleton.types';
export type { SkeletonVariant } from './skeleton/skeleton.types';

export { Spinner } from './spinner/spinner';
export { SPINNER_SIZES } from './spinner/spinner.types';
export type { SpinnerSize } from './spinner/spinner.types';

export { Switch } from './switch/switch';

export { Textarea } from './textarea/textarea';
export { TEXTAREA_LIMIT_BANDS, TEXTAREA_NEAR_LIMIT_RATIO } from './textarea/textarea.types';
export type { TextareaLimitBand } from './textarea/textarea.types';

/* `TooltipPanel` es interno del tooltip: no se declara suelto en una plantilla. */
export { Tooltip } from './tooltip/tooltip';
export {
  TOOLTIP_GAP_PX,
  TOOLTIP_HOVER_DELAY_MS,
  TOOLTIP_OPPOSITE,
  TOOLTIP_POSITIONS,
} from './tooltip/tooltip.types';
export type { TooltipPosition } from './tooltip/tooltip.types';
