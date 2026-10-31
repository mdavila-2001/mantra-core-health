import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import { padresValidos } from '../../../../core/data-access/infrastructure/infrastructure.rules';
import type {
  CareSpaceDetail,
  InfrastructureCatalog,
  SiteStructure,
} from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/** El valor del selector que significa «sin padre». No es un id posible. */
export const RAIZ = '__raiz__';

/**
 * Mover un espacio — `POST /care-spaces/:id/move` con `If-Match`.
 *
 * Sólo se ofrecen padres **válidos**: los que la regla de formas admite, que
 * no son el espacio ni uno de sus hijos (sería un ciclo) y que no están
 * suspendidos ni retirados. La API vuelve a validar todo (422 `SPACE_CYCLE`,
 * `SPACE_PARENT_RULE`).
 */
@Component({
  selector: 'app-mover-dialog',
  imports: [AppButton, ContentDialog, FormField, ReactiveFormsModule, Select, ViewStateHost],
  template: `
    <app-content-dialog
      heading="Mover el espacio"
      [description]="'Elegí dónde va a colgar ' + espacio().name + '. Sólo aparecen los lugares que su forma admite.'"
      [dismissible]="!enviando()"
      (closed)="cerrado.emit()"
    >
      @if (fallo(); as estado) {
        <app-view-state-host [state]="estado" (retry)="mover()" />
      }
      @if (estructura() === null) {
        <p>Cargando los lugares posibles…</p>
      } @else if (opciones().length === 0) {
        <p data-testid="mover-sin-opciones">No hay ningún otro lugar donde un espacio de forma «{{ espacio().form.display }}» pueda ir.</p>
      } @else {
        <form (ngSubmit)="mover()" id="form-mover">
          <app-form-field label="Nuevo padre" [required]="true">
            <app-select [formControl]="destino" [options]="opciones()" placeholder="Elegí un lugar" data-testid="mover-destino" />
          </app-form-field>
        </form>
      }
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="enviando()" (clicked)="cerrado.emit()">Cancelar</button>
        <button app-button type="submit" form="form-mover" [disabled]="enviando() || destino.invalid" data-testid="mover-confirmar">
          {{ enviando() ? 'Moviendo…' : 'Mover' }}
        </button>
      </div>
    </app-content-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoverDialog {
  private readonly client = inject(InfrastructureClient);

  readonly espacio = input.required<CareSpaceDetail>();
  readonly estructura = input<SiteStructure | null>(null);
  readonly catalogo = input.required<InfrastructureCatalog>();
  readonly guardado = output<CareSpaceDetail>();
  readonly cerrado = output<void>();

  protected readonly enviando = signal(false);
  protected readonly fallo = signal<ViewState<never> | null>(null);
  protected readonly destino = new FormControl<string | null>(null, { validators: [Validators.required] });

  protected readonly opciones = computed<SelectOption<string>[]>(() => {
    const estructura = this.estructura();
    if (estructura === null) return [];
    const e = this.espacio();
    const { incluyeRaiz, padres } = padresValidos(this.catalogo(), estructura.spaces, e.form.code, e.id);
    return [
      ...(incluyeRaiz && e.parentId !== null ? [{ value: RAIZ, label: 'Raíz del establecimiento (sin padre)' }] : []),
      ...padres.filter((p) => p.id !== e.parentId).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
    ];
  });

  protected mover(): void {
    const valor = this.destino.value;
    if (valor === null) return;
    const e = this.espacio();
    this.enviando.set(true);
    this.fallo.set(null);
    this.client.moveCareSpace(e.id, e.rowVersion, valor === RAIZ ? null : valor).subscribe({
      next: (movido) => {
        this.enviando.set(false);
        this.guardado.emit(movido);
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.fallo.set(errorToViewState<never>(error));
      },
    });
  }
}
