import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';

import type { PharmacyConcept } from '../../../../core/data-access/pharmacy/pharmacy.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import type { DynamicEnumOption } from '../../../../core/data-access/system-context/system-context.types';
import { withoutAccents } from '../../catalog-rules/catalog.rules';

/**
 * El campo de la receta cuyo catálogo es el de los medicamentos. Es el mismo
 * que usa el médico al recetar: un producto vinculado a otro catálogo no
 * cruzaría con ninguna receta.
 */
export const MEDICATION_TARGET = 'clinical.medication_requests.medication_concept_id';

/** Cuántas opciones se muestran a la vez: el catálogo tiene cientos. */
const SHOWN = 20;

/** La opción del buscador para un medicamento del catálogo. */
function optionOf(medication: DynamicEnumOption): ReferenceOption {
  return { value: medication.conceptId, label: medication.displayEs ?? medication.display };
}

/**
 * **Vincular un producto a su medicamento**: un buscador sobre el catálogo con
 * que se receta. La farmacia elige un nombre, nunca escribe un identificador, y
 * lo que se guarda es el concepto elegido (`medicationConceptId`): es lo que
 * hace que el producto aparezca al abrir una receta compartida con ese fármaco.
 *
 * Emite `chosen` sólo cuando la persona elige (o limpia, que desvincula): si no
 * toca el campo, el guardado no lo manda y el vínculo queda como estaba. Un
 * producto del catálogo oficial que ya trae su medicamento lo muestra sin
 * buscador: ese vínculo es del registro sanitario. Quién puede cambiarlo lo
 * decide la API.
 */
@Component({
  selector: 'app-medication-link',
  imports: [FormField, ReferenceCombobox],
  templateUrl: './medication-link.html',
  styleUrl: './medication-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicationLink {
  /** El medicamento vinculado hoy, como lo devuelve la lectura del producto. */
  readonly current = input<PharmacyConcept | null>(null);
  /** El producto pide receta: sin vínculo, ninguna receta lo encuentra. */
  readonly requiresPrescription = input(false);
  /** El vínculo vino del registro oficial y no se cambia. */
  readonly locked = input(false);

  /** El concepto elegido, o `null` si se limpió el campo (desvincular). */
  readonly chosen = output<string | null>();

  private readonly systemContext = inject(SystemContextClient);
  private readonly catalog = signal<readonly DynamicEnumOption[]>([]);
  /** El catálogo se pide al primer uso del buscador, no al abrir la ficha. */
  protected readonly status = signal<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  private pendingSearch = '';
  protected readonly options = signal<readonly ReferenceOption[]>([]);
  protected readonly selected = signal<ReferenceOption | null>(null);
  protected readonly touched = signal(false);

  protected readonly hint = computed(() => {
    if (this.status() === 'failed') {
      return 'No se pudo leer el catálogo de medicamentos. Escriba de nuevo para reintentar.';
    }
    if (this.selected() === null && this.requiresPrescription()) {
      return 'Pide receta y no tiene medicamento: ninguna receta lo va a encontrar hasta que lo vincule.';
    }
    return 'Elíjalo como figura en la receta: así el producto aparece cuando un paciente comparte su receta.';
  });

  constructor() {
    // Lo vinculado hoy se reconoce por su código en el catálogo; hasta que la
    // persona toque el campo, se muestra aunque el catálogo no lo liste.
    effect(() => {
      const current = this.current();
      if (this.touched()) {
        return;
      }
      const match = this.catalog().find((option) => option.code === current?.code);
      this.selected.set(
        current === null ? null : match ? optionOf(match) : { value: '', label: current.display },
      );
    });
  }

  protected search(text: string): void {
    this.pendingSearch = text;
    if (this.status() === 'idle' || this.status() === 'failed') {
      this.status.set('loading');
      this.systemContext.dynamicEnum(MEDICATION_TARGET).subscribe({
        next: (enumeration) => {
          this.catalog.set(enumeration.options);
          this.status.set('ready');
          this.filter(this.pendingSearch);
        },
        error: () => this.status.set('failed'),
      });
      return;
    }
    this.filter(text);
  }

  private filter(text: string): void {
    const wanted = withoutAccents(text.trim());
    this.options.set(
      this.catalog()
        .filter((option) => withoutAccents(option.displayEs ?? option.display).includes(wanted))
        .slice(0, SHOWN)
        .map(optionOf),
    );
  }

  protected choose(option: ReferenceOption | null): void {
    this.touched.set(true);
    this.selected.set(option);
    this.chosen.emit(option === null || option.value === '' ? null : option.value);
  }
}
