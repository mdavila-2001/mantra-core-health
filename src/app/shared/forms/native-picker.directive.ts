import { Directive } from '@angular/core';

/**
 * Opens the browser's own picker when a `type="time"` input is clicked.
 *
 * Without it the picker only opened from the small clock icon at the right
 * edge, and people who clicked the text ended up typing times by hand without
 * knowing a picker existed. It reads type, `disabled` and `readOnly` from the
 * element itself, so it needs no inputs and is a no-op on any other type.
 *
 * `showPicker()` is missing in some browsers and throws outside a user gesture
 * or inside a cross-origin iframe: it is feature-checked and guarded, and the
 * field stays editable from the keyboard either way.
 */
@Directive({
  selector: 'input[appNativePicker]',
  host: { '(click)': 'abrir($event)' },
})
export class NativePicker {
  protected abrir(event: MouseEvent): void {
    const campo = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
    if (campo.type !== 'time' || campo.disabled || campo.readOnly) return;
    try {
      campo.showPicker?.();
    } catch {
      // The picker is a convenience: without it the time is typed.
    }
  }
}
