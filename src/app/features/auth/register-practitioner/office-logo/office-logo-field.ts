import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  signal,
} from '@angular/core';

import {
  PRACTICE_LOGO_ACCEPT,
  PRACTICE_LOGO_MAX_BYTES,
} from '../../../../core/data-access/practice-sites/practice-logo.client';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import {
  FileInput,
  type RejectedFile,
} from '../../../../shared/components/molecules/file-input/file-input';
import { PracticeLogo } from '../../../../shared/components/molecules/practice-logo/practice-logo';
import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
  type FormControlContext,
} from '../../../../shared/forms/form-control.context';
import { OfficeLogoSelection } from './office-logo-selection';

/**
 * El campo «Logo del consultorio» de la página «Su consultorio propio» del alta.
 *
 * Son las mismas dos piezas con las que el perfil lo muestra y lo cambia desde
 * «Editar»: la caja 2:1 de `app-practice-logo` —la del membrete de sus PDF— y el
 * selector `app-file-input`, que ya valida formato y peso al elegir y al soltar.
 * Lo elegido vive en {@link OfficeLogoSelection}, que provee el alta: este
 * campo se destruye al cambiar de página y el logo no se puede perder con él.
 *
 * ```html
 * <ng-template appCampoPersonalizado="officeLogo"><app-office-logo-field /></ng-template>
 * ```
 *
 * ## Nombra y describe a su selector
 *
 * Publica `FORM_CONTROL_CONTEXT`, como `app-search-field`. El motor de páginas
 * rodea el campo con su `app-form-field`, pero el selector no lo ve: lo que se
 * inyecta dentro de un `ng-template` se resuelve desde donde se declaró —el
 * alta—, no desde donde se dibuja. Sin esto, el motivo del rechazo quedaba fuera
 * del `aria-describedby` del `<input>` y un lector de pantalla no lo asociaba.
 */
@Component({
  selector: 'app-office-logo-field',
  imports: [AppButton, FileInput, PracticeLogo],
  templateUrl: './office-logo-field.html',
  styleUrl: './office-logo-field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    { provide: FORM_CONTROL_CONTEXT, useExisting: forwardRef(() => OfficeLogoField) },
  ],
})
export class OfficeLogoField implements FormControlContext {
  protected readonly selection = inject(OfficeLogoSelection);

  protected readonly accept = PRACTICE_LOGO_ACCEPT;
  protected readonly maxBytes = PRACTICE_LOGO_MAX_BYTES;

  /* ---- FormControlContext: el nombre y el motivo del selector ------------ */

  private readonly baseId = nextControlId('office-logo');
  readonly controlLabelable = signal(true);
  readonly controlId = computed(() => `${this.baseId}-control`);
  readonly labelId = computed(() => `${this.baseId}-label`);
  protected readonly errorId = `${this.baseId}-error`;
  /** El motivo del rechazo describe al selector mientras está en pantalla. */
  readonly describedBy = computed(() => (this.selection.error() === null ? null : this.errorId));
  readonly invalid = computed(() => this.selection.error() !== null);
  /** El logo es opcional: el alta se completa sin él. */
  readonly required = signal(false).asReadonly();

  /** Lo elegido, para que el selector diga «Reemplazar» y vuelva a «Subir» al quitarlo. */
  protected readonly files = computed<readonly File[]>(() => {
    const file = this.selection.file();
    return file === null ? [] : [file];
  });

  protected choose(files: readonly File[]): void {
    const file = files[0];
    if (file !== undefined) {
      this.selection.choose(file);
    }
  }

  protected reject(rejected: readonly RejectedFile[]): void {
    this.selection.reject(rejected[0]?.reason === 'tamaño' ? 'size' : 'type');
  }
}
