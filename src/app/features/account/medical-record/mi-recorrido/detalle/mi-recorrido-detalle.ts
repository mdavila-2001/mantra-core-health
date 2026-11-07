import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../../shared/components/atoms/button/button-link';
import { FactList } from '../../../../../shared/components/molecules/fact-list/fact-list';
import type { RegistroConVinculos, VinculoAusente } from '../registro-con-vinculos.types';

/** What is said of a link that is not on record. The link is never made up. */
const AUSENTE_EN_PALABRAS: Readonly<Record<VinculoAusente, string>> = {
  'estudio-sin-diagnostico': 'No consta para qué diagnóstico se pidió.',
  'descartado-sin-reemplazo': 'No consta qué diagnóstico quedó en su lugar.',
  'receta-sin-diagnostico': 'No consta para qué diagnóstico se indicó.',
};

/**
 * The detail sheet's content of a record of «Mi recorrido»: its data, the
 * links not on record and what can be done with it. It sits on the sheet's
 * wrapper (same element, no extra box); downloading and navigating are the
 * owner screen's, through the outputs.
 */
@Component({
  selector: 'div[app-mi-recorrido-detalle]',
  imports: [AppButton, AppButtonLink, FactList, RouterLink],
  templateUrl: './mi-recorrido-detalle.html',
  styleUrl: './mi-recorrido-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiRecorridoDetalle {
  readonly registro = input.required<RegistroConVinculos>();
  /** The prescription being downloaded, if any. */
  readonly descargandoReceta = input<string | null>(null);

  readonly descargarReceta = output<string>();
  /** «Verlo en «Por fecha»»: the tab holding that record. */
  readonly irAlRegistro = output<RegistroConVinculos>();

  protected ausentesDe(registro: RegistroConVinculos): readonly string[] {
    return registro.ausentes.map((a) => AUSENTE_EN_PALABRAS[a]);
  }
}
