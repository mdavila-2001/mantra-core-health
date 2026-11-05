import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';

import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import type { DynamicEnumOption } from '../../../../core/data-access/system-context/system-context.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { TARGET_CATEGORIA, TARGET_ESTUDIO } from '../analysis-order-block/analysis-order-block';
import { conceptIdPorCodigo } from '../demo-presets';
import { TARGET_DIAGNOSTICO } from '../diagnosis-block/diagnosis-block';

/** Order category the clinician picks when closing the form. */
export type CategoriaDeOrden = 'LAB' | 'IMAGING' | 'OTHER';

/** La orden que quien atiende eligió pedir al cerrar la ficha. */
export interface OrdenDelCierre {
  readonly codeConceptId: string;
  readonly category: CategoriaDeOrden;
  /** El concepto de la categoría, si el catálogo lo publica; es lo que el simulador guarda. */
  readonly categoryConceptId?: string;
}

/** Lo que el bloque emite cada vez que cambia una elección. Las dos son opcionales. */
export interface CierreDelFormulario {
  readonly diagnostico: string | null;
  readonly orden: OrdenDelCierre | null;
}

/** Los códigos con los que el catálogo nombra cada categoría de orden, en las dos convenciones vistas. */
const CODIGOS_DE_CATEGORIA: Readonly<Record<CategoriaDeOrden, readonly string[]>> = {
  LAB: ['SRQ-LAB', 'SR_LAB'],
  IMAGING: ['SRQ-IMAGING', 'SR_IMAGING'],
  OTHER: ['SRQ-OTHER', 'SR_OTHER'],
};

/**
 * Form closing (D4): the clinician optionally picks a tentative diagnosis and
 * an order, which the host block records when the form is completed.
 *
 * Every choice is the clinician's, by hand, from the platform catalog. There
 * is no AI suggestion: the owner removed it (04/11/2026) so that whatever ends
 * up in the record is attributable to the clinician alone.
 */
@Component({
  selector: 'app-form-conclusion-block',
  imports: [Card, ConceptSelect, FormField, Select],
  templateUrl: './form-conclusion-block.html',
  styleUrl: './form-conclusion-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormConclusionBlock {
  private readonly systemContext = inject(SystemContextClient);

  /** Cómo se llama la ficha, para decir de qué se está hablando. */
  readonly nombreDeFicha = input<string>('');

  /** Cada vez que cambia una elección. El anfitrión guarda la última. */
  readonly cierre = output<CierreDelFormulario>();

  protected readonly targetDiagnostico = TARGET_DIAGNOSTICO;
  protected readonly targetEstudio = TARGET_ESTUDIO;

  protected readonly categorias: readonly SelectOption<CategoriaDeOrden | null>[] = [
    { value: null, label: 'Sin categoría' },
    { value: 'LAB', label: 'Laboratorio' },
    { value: 'IMAGING', label: 'Imagenología' },
    { value: 'OTHER', label: 'Otro' },
  ];

  /* -- Lo elegido ----------------------------------------------------------- */

  protected readonly diagnostico = signal<string | null>(null);
  protected readonly categoriaDeOrden = signal<CategoriaDeOrden | null>(null);
  protected readonly estudio = signal<string | null>(null);

  /** Hay un estudio elegido pero no su categoría: sin ella la orden no se pide. */
  protected readonly ordenIncompleta = computed(
    () => this.estudio() !== null && this.categoriaDeOrden() === null,
  );

  readonly tieneCambiosPendientes = computed(
    () => this.diagnostico() !== null || this.estudio() !== null,
  );

  /** Category concepts, so the order carries the one the catalog publishes. */
  private readonly opcionesCategoria = signal<readonly DynamicEnumOption[]>([]);

  constructor() {
    this.cargarOpciones(TARGET_CATEGORIA, this.opcionesCategoria);
  }

  private cargarOpciones(
    target: string,
    destino: WritableSignal<readonly DynamicEnumOption[]>,
  ): void {
    this.systemContext.dynamicEnum(target).subscribe({
      next: (enumeracion) => destino.set(enumeracion.options),
      error: () => destino.set([]),
    });
  }

  /* -- Elegir a mano -------------------------------------------------------- */

  protected elegirDiagnostico(conceptId: string | null): void {
    this.diagnostico.set(conceptId);
    this.emitir();
  }

  protected elegirCategoria(categoria: CategoriaDeOrden | null): void {
    this.categoriaDeOrden.set(categoria);
    this.emitir();
  }

  protected elegirEstudio(conceptId: string | null): void {
    this.estudio.set(conceptId);
    this.emitir();
  }

  /** El concepto de una categoría de orden, si el catálogo publica su código. */
  private conceptoDeCategoria(categoria: CategoriaDeOrden): string | undefined {
    for (const codigo of CODIGOS_DE_CATEGORIA[categoria]) {
      const conceptId = conceptIdPorCodigo(this.opcionesCategoria(), codigo);
      if (conceptId !== null) return conceptId;
    }
    return undefined;
  }

  private emitir(): void {
    const estudio = this.estudio();
    const categoria = this.categoriaDeOrden();
    const categoryConceptId = categoria === null ? undefined : this.conceptoDeCategoria(categoria);
    this.cierre.emit({
      diagnostico: this.diagnostico(),
      orden:
        estudio === null || categoria === null
          ? null
          : {
              codeConceptId: estudio,
              category: categoria,
              ...(categoryConceptId === undefined ? {} : { categoryConceptId }),
            },
    });
  }
}
