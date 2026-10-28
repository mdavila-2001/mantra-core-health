import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

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
 */
@Component({
  selector: 'app-office-logo-field',
  imports: [AppButton, FileInput, PracticeLogo],
  templateUrl: './office-logo-field.html',
  styleUrl: './office-logo-field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeLogoField {
  protected readonly selection = inject(OfficeLogoSelection);

  protected readonly accept = PRACTICE_LOGO_ACCEPT;
  protected readonly maxBytes = PRACTICE_LOGO_MAX_BYTES;

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
