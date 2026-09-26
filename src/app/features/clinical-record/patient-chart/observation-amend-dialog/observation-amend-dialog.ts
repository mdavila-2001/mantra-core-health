import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import type { AmendObservation } from '../../../../core/data-access/clinical/clinical.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { mensajeDeEscritura } from '../../mensaje-de-escritura';

/** El campo de catálogo de la unidad de una cantidad (mismo que el alta). */
const TARGET_UNIDAD = 'clinical.observations.quantity_unit_concept_id';

/** Largo mínimo de la nota: una palabra suelta no justifica corregir un dato clínico. */
const MIN_NOTA = 5;
const MAX_NOTA = 500;

/**
 * **Enmendar una observación** (UC-08-04, BR-14/CL-16).
 *
 * Una medición ya registrada no se edita en el lugar: se enmienda con la nota
 * que dice por qué. La nota es obligatoria —el contrato la exige y la auditoría
 * clínica la necesita— y el valor nuevo viaja por **un** solo camino: el número
 * gana sobre el texto, igual que en el alta.
 *
 * El resumen del expediente todavía no publica la versión de fila de cada
 * observación, así que la enmienda viaja sin `expectedRowVersion`. Si alguna vez
 * llega un `409` se muestra tal cual y lo escrito no se pierde.
 */
@Component({
  selector: 'app-observation-amend-dialog',
  imports: [Alert, AppButton, AppInput, ConceptSelect, ContentDialog, FormField, Textarea],
  templateUrl: './observation-amend-dialog.html',
  styleUrl: './observation-amend-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObservationAmendDialog {
  private readonly clinical = inject(ClinicalClient);
  private readonly dialogs = inject(DialogService);
  private readonly dialog = viewChild(ContentDialog);

  /** La observación a corregir. */
  readonly observationId = input.required<string>();

  /** Qué medición es, en palabras («Presión arterial»). */
  readonly nombre = input.required<string>();

  /** El valor vigente, para que quien corrige vea contra qué corrige. */
  readonly valorActual = input('');

  /** La enmienda quedó registrada y el expediente tiene que releerse. */
  readonly amended = output<void>();

  /** El modal se cerró, con o sin enmienda. */
  readonly closed = output<void>();

  protected readonly targetUnidad = TARGET_UNIDAD;
  protected readonly maxNota = MAX_NOTA;

  protected readonly valorNumerico = signal<string | number | null>('');
  protected readonly unidad = signal<string | null>(null);
  protected readonly valorEnPalabras = signal('');
  protected readonly nota = signal('');
  protected readonly intentado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly resultado = signal<ViewState<null>>(ready(null));

  protected readonly numero = computed<number | null>(() => {
    const crudo = String(this.valorNumerico() ?? '').trim().replace(',', '.');
    if (crudo === '') {
      return null;
    }
    const valor = Number(crudo);
    return Number.isFinite(valor) ? valor : null;
  });

  protected readonly numeroInvalido = computed(
    () => String(this.valorNumerico() ?? '').trim() !== '' && this.numero() === null,
  );

  protected readonly falta = computed(
    () =>
      this.numeroInvalido() ||
      (this.numero() === null && this.valorEnPalabras().trim() === '') ||
      this.nota().trim().length < MIN_NOTA,
  );

  protected readonly errorDeNota = computed(() =>
    this.intentado() && this.nota().trim().length < MIN_NOTA
      ? `Explicá el motivo de la corrección (mínimo ${MIN_NOTA} caracteres).`
      : '',
  );

  protected readonly errorDeValor = computed(() => {
    if (this.numeroInvalido()) {
      return 'Escribí sólo el número; la unidad se elige aparte.';
    }
    return this.intentado() && this.numero() === null && this.valorEnPalabras().trim() === ''
      ? 'Ingresá el valor corregido, con número o con palabras.'
      : '';
  });

  protected readonly errorDelServidor = computed(() =>
    mensajeDeEscritura(this.resultado(), {
      accion: 'enmendar la observación',
      yaNoExiste: 'La observación ya no existe. Recargá el expediente.',
    }),
  );

  private readonly tieneCambios = computed(
    () =>
      String(this.valorNumerico() ?? '').trim() !== '' ||
      this.valorEnPalabras().trim() !== '' ||
      this.nota().trim() !== '' ||
      this.unidad() !== null,
  );

  protected readonly guardia = async (): Promise<boolean> => {
    if (this.enviando()) return false;
    if (!this.tieneCambios()) return true;
    return this.dialogs.confirm({
      title: '¿Descartar la enmienda?',
      message: 'Lo que escribiste no se guardó. Si cerrás, la medición queda como está.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Seguir editando',
      destructive: true,
    });
  };

  protected enviar(): void {
    this.intentado.set(true);
    if (this.enviando() || this.falta()) {
      return;
    }
    const numero = this.numero();
    const unidad = this.unidad();
    const enmienda: AmendObservation = {
      note: this.nota().trim(),
      ...(numero === null
        ? { valueText: this.valorEnPalabras().trim() }
        : {
            quantityValue: numero,
            ...(unidad === null ? {} : { quantityUnitConceptId: unidad }),
          }),
    };

    this.enviando.set(true);
    this.resultado.set(loading());
    this.clinical.amendObservation(this.observationId(), enmienda).subscribe({
      next: () => {
        this.enviando.set(false);
        this.resultado.set(ready(null));
        this.amended.emit();
        this.cerrar();
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.resultado.set(errorToViewState<null>(error));
      },
    });
  }

  protected cerrar(): void {
    const modal = this.dialog();
    if (modal === undefined) {
      this.closed.emit();
      return;
    }
    modal.close(true);
  }

  protected async cancelar(): Promise<void> {
    if (await this.guardia()) {
      this.cerrar();
    }
  }
}
